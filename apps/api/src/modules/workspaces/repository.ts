import type { Workspace, PaginationQuery } from "@app/shared";
import { paginationOffset } from "@app/shared";
import type { PoolClient } from "pg";

export interface WorkspaceRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  address: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
}

export const WORKSPACE_COLUMNS = "id, organization_id, name, slug, address, cnpj, city, state, status, created_at, updated_at";

export function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug ?? null,
    address: row.address ?? null,
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
    `select ${WORKSPACE_COLUMNS}
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

export async function insertWorkspace(
  client: PoolClient,
  organizationId: string,
  id: string,
  input: { name: string; slug: string; address: string; city: string; state: string; cnpj?: string | null | undefined },
): Promise<void> {
  // Sem RETURNING: a policy de select lê app.workspaces e não enxerga a linha da própria instrução.
  await client.query(
    `insert into app.workspaces (id, organization_id, name, slug, address, city, state, cnpj)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, organizationId, input.name, input.slug, input.address, input.city, input.state, input.cnpj ?? null],
  );
}

export async function findWorkspace(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
): Promise<Workspace | null> {
  const result = await client.query<WorkspaceRow>(
    `select ${WORKSPACE_COLUMNS} from app.workspaces where id = $1 and organization_id = $2`,
    [workspaceId, organizationId],
  );
  return result.rows[0] ? toWorkspace(result.rows[0]) : null;
}

const WORKSPACE_PATCH_COLUMNS = ["name", "slug", "address", "city", "state", "cnpj", "status"] as const;

export async function updateWorkspace(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  patch: Partial<Record<(typeof WORKSPACE_PATCH_COLUMNS)[number], string | null>>,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [workspaceId, organizationId];
  for (const column of WORKSPACE_PATCH_COLUMNS) {
    if (patch[column] === undefined) continue;
    params.push(patch[column]);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return true;
  const result = await client.query(
    `update app.workspaces set ${sets.join(", ")} where id = $1 and organization_id = $2`,
    params,
  );
  return (result.rowCount ?? 0) > 0;
}
