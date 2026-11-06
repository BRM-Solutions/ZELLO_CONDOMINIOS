import type { PoolClient } from "pg";

export interface AuditEntry {
  organizationId: string;
  actorKind: "user" | "worker" | "system";
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(client: PoolClient, entry: AuditEntry): Promise<void> {
  await client.query(
    `insert into app.audit_log
       (organization_id, actor_user_id, actor_kind, action, entity_type, entity_id, request_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.organizationId,
      entry.actorUserId ?? null,
      entry.actorKind,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.requestId ?? null,
      JSON.stringify(entry.metadata ?? {}),
    ],
  );
}
