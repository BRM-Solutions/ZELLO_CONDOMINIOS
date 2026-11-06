import type { Workspace, PaginationQuery } from "@app/shared";
import { paginationOffset } from "@app/shared";
import type { PoolClient } from "pg";

interface WorkspaceRow {
  id: string;
  organization_id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    cnpj: row.cnpj,
    city: row.city,
    state: row.state,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listWorkspaces(
  client: PoolClient,
  organizationId: string,
  query: PaginationQuery,
): Promise<{ items: Workspace[]; total: number }> {
  const list = await client.query<WorkspaceRow>(
    `select id, organization_id, name, cnpj, city, state, status, created_at, updated_at
       from app.workspaces
      where organization_id = $1
      order by name, id
      limit $2 offset $3`,
    [organizationId, query.pageSize, paginationOffset(query)],
  );
  const count = await client.query<{ total: number }>(
    "select count(*)::int as total from app.workspaces where organization_id = $1",
    [organizationId],
  );
  return { items: list.rows.map(toWorkspace), total: count.rows[0]?.total ?? 0 };
}
