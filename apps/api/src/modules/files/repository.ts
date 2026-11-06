import type { FileClassification, FileRecord, FileStatus } from "@app/shared";
import type { PoolClient } from "pg";

export interface FileRow {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  bucket: string;
  object_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: string | number;
  sha256: string | null;
  classification: FileClassification;
  status: FileStatus;
  retention_until: Date | null;
  legal_hold: boolean;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

const COLUMNS = `id, organization_id, workspace_id, bucket, object_path, original_name, mime_type, size_bytes,
  sha256, classification, status, retention_until, legal_hold, uploaded_by, created_at, updated_at, deleted_at`;

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export function toFile(row: FileRow): FileRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    classification: row.classification,
    status: row.status,
    retentionUntil: iso(row.retention_until),
    legalHold: row.legal_hold,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: iso(row.deleted_at),
  };
}

export async function workspaceVisible(client: PoolClient, organizationId: string, workspaceId: string): Promise<boolean> {
  const result = await client.query(
    "select 1 from app.workspaces where id = $1 and organization_id = $2",
    [workspaceId, organizationId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function lockStorageQuota(client: PoolClient, organizationId: string): Promise<void> {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`files:${organizationId}`]);
}

export async function getQuotaUsage(
  client: PoolClient,
  organizationId: string,
): Promise<{ quotaBytes: number | null; usedBytes: number }> {
  const result = await client.query<{ storage_quota_bytes: string | null; used: string }>(
    `select storage_quota_bytes, app.org_storage_used_bytes() as used
       from app.organizations where id = $1`,
    [organizationId],
  );
  const row = result.rows[0];
  return {
    quotaBytes:
      row?.storage_quota_bytes === null || row?.storage_quota_bytes === undefined ? null : Number(row.storage_quota_bytes),
    usedBytes: Number(row?.used ?? 0),
  };
}

export interface NewFile {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  bucket: string;
  objectPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  classification: FileClassification;
  uploadedBy: string;
}

export async function insertFile(client: PoolClient, file: NewFile): Promise<FileRow> {
  const result = await client.query<FileRow>(
    `insert into app.files
       (id, organization_id, workspace_id, bucket, object_path, original_name, mime_type, size_bytes,
        classification, status, uploaded_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
     returning ${COLUMNS}`,
    [
      file.id,
      file.organizationId,
      file.workspaceId,
      file.bucket,
      file.objectPath,
      file.originalName,
      file.mimeType,
      file.sizeBytes,
      file.classification,
      file.uploadedBy,
    ],
  );
  return result.rows[0] as FileRow;
}

export async function findFile(client: PoolClient, organizationId: string, id: string): Promise<FileRow | undefined> {
  const result = await client.query<FileRow>(
    `select ${COLUMNS} from app.files where id = $1 and organization_id = $2`,
    [id, organizationId],
  );
  return result.rows[0];
}

export async function completeFile(
  client: PoolClient,
  id: string,
  update: { status: "available" | "quarantined"; sizeBytes: number; mimeType: string },
): Promise<FileRow | undefined> {
  const result = await client.query<FileRow>(
    `update app.files set status = $2, size_bytes = $3, mime_type = $4
      where id = $1 and status = 'pending'
      returning ${COLUMNS}`,
    [id, update.status, update.sizeBytes, update.mimeType],
  );
  return result.rows[0];
}

export async function softDeleteFile(client: PoolClient, id: string): Promise<FileRow | undefined> {
  const result = await client.query<FileRow>(
    `update app.files set status = 'deleted', deleted_at = now()
      where id = $1 and status <> 'deleted' and legal_hold = false
        and (retention_until is null or retention_until <= now())
      returning ${COLUMNS}`,
    [id],
  );
  return result.rows[0];
}
