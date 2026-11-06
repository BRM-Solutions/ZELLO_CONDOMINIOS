import type { Logger } from "pino";
import { recordAudit } from "../audit";
import { withWorkerTx, type Db } from "../db";
import type { StorageClient } from "../integrations/storage-client";

export const PENDING_TTL_HOURS = 24;

type PurgeReason = "deleted" | "retention_expired" | "pending_expired";

interface Candidate {
  id: string;
  organization_id: string;
  bucket: string;
  object_path: string;
  reason: PurgeReason;
}

const PURGEABLE = `
  legal_hold = false
  and (
    (status = 'deleted' and (retention_until is null or retention_until <= now()))
    or (status <> 'deleted' and retention_until is not null and retention_until <= now())
    or (status = 'pending' and created_at < now() - make_interval(hours => $PENDING))
  )`;

export interface FilesRetentionResult {
  scanned: number;
  purged: number;
  failed: number;
}

export async function findPurgeCandidates(db: Db, limit: number): Promise<Candidate[]> {
  return withWorkerTx(
    db,
    null,
    async (client) => {
      const result = await client.query<Candidate>(
        `select id, organization_id, bucket, object_path,
                case
                  when status = 'deleted' then 'deleted'
                  when retention_until is not null and retention_until <= now() then 'retention_expired'
                  else 'pending_expired'
                end as reason
           from app.files
          where ${PURGEABLE.replace("$PENDING", "$2")}
          order by created_at
          limit $1`,
        [limit, PENDING_TTL_HOURS],
      );
      return result.rows;
    },
    { readOnly: true },
  );
}

export async function purgeFile(db: Db, storage: StorageClient, file: Candidate): Promise<boolean> {
  return withWorkerTx(db, file.organization_id, async (client) => {
    const deleted = await client.query<{ bucket: string; object_path: string }>(
      `delete from app.files
        where id = $1 and organization_id = $3 and ${PURGEABLE.replace("$PENDING", "$2")}
        returning bucket, object_path`,
      [file.id, PENDING_TTL_HOURS, file.organization_id],
    );
    const row = deleted.rows[0];
    if (!row) return false;
    await storage.removeObjects(row.bucket, [row.object_path], {});
    await recordAudit(client, {
      organizationId: file.organization_id,
      actorKind: "worker",
      action: "file.purge",
      entityType: "file",
      entityId: file.id,
      metadata: { reason: file.reason },
    });
    return true;
  });
}

export async function runFilesRetentionCycle(
  db: Db,
  storage: StorageClient,
  logger: Logger,
  options: { batchSize: number; shouldStop: () => boolean },
): Promise<FilesRetentionResult> {
  const candidates = await findPurgeCandidates(db, options.batchSize);
  const result: FilesRetentionResult = { scanned: candidates.length, purged: 0, failed: 0 };
  for (const file of candidates) {
    if (options.shouldStop()) break;
    try {
      if (await purgeFile(db, storage, file)) result.purged += 1;
    } catch (err) {
      result.failed += 1;
      logger.error({ fileId: file.id, err }, "file purge failed");
    }
  }
  return result;
}
