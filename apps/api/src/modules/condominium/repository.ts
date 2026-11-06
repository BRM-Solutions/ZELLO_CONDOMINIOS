import type {
  Block,
  MyUnit,
  PeopleFilter,
  Person,
  PersonUnit,
  Relation,
  Unit,
  UnitMember,
  UnitsQuery,
} from "@app/shared";
import { paginationOffset } from "@app/shared";
import type { PoolClient } from "pg";

type Ts = Date | string;
const iso = (value: Ts): string => (value instanceof Date ? value.toISOString() : String(value));

export function constraintOf(err: unknown, code: string): string | null {
  const e = err as { code?: string; constraint?: string } | null;
  return e?.code === code ? (e.constraint ?? "") : null;
}

export const PG_UNIQUE_VIOLATION = "23505";
export const PG_CHECK_VIOLATION = "23514";

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------
interface BlockRow {
  id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
  created_at: Ts;
  updated_at: Ts;
}

const BLOCK_COLUMNS = "id, workspace_id, name, sort_order, created_at, updated_at";

const toBlock = (row: BlockRow): Block => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  sortOrder: row.sort_order,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export async function listBlocks(client: PoolClient, organizationId: string, workspaceId: string): Promise<Block[]> {
  const result = await client.query<BlockRow>(
    `select ${BLOCK_COLUMNS} from app.blocks
      where organization_id = $1 and workspace_id = $2
      order by sort_order, lower(name), id
      limit 500`,
    [organizationId, workspaceId],
  );
  return result.rows.map(toBlock);
}

export async function findBlock(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  blockId: string,
): Promise<Block | null> {
  const result = await client.query<BlockRow>(
    `select ${BLOCK_COLUMNS} from app.blocks where id = $1 and organization_id = $2 and workspace_id = $3`,
    [blockId, organizationId, workspaceId],
  );
  return result.rows[0] ? toBlock(result.rows[0]) : null;
}

export async function insertBlock(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  input: { name: string; sortOrder: number },
): Promise<Block> {
  const result = await client.query<BlockRow>(
    `insert into app.blocks (organization_id, workspace_id, name, sort_order)
     values ($1, $2, $3, $4)
     returning ${BLOCK_COLUMNS}`,
    [organizationId, workspaceId, input.name, input.sortOrder],
  );
  return toBlock(result.rows[0] as BlockRow);
}

export async function updateBlock(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  blockId: string,
  patch: { name?: string; sortOrder?: number },
): Promise<Block | null> {
  const result = await client.query<BlockRow>(
    `update app.blocks
        set name = coalesce($4, name), sort_order = coalesce($5, sort_order)
      where id = $1 and organization_id = $2 and workspace_id = $3
      returning ${BLOCK_COLUMNS}`,
    [blockId, organizationId, workspaceId, patch.name ?? null, patch.sortOrder ?? null],
  );
  return result.rows[0] ? toBlock(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------
interface UnitRow {
  id: string;
  workspace_id: string;
  block_id: string;
  block_name: string;
  number: string;
  status: "active" | "inactive";
  created_at: Ts;
  updated_at: Ts;
}

const UNIT_SELECT = `select u.id, u.workspace_id, u.block_id, b.name as block_name, u.number, u.status, u.created_at, u.updated_at
       from app.units u
       join app.blocks b on b.id = u.block_id and b.organization_id = u.organization_id and b.workspace_id = u.workspace_id`;

const toUnit = (row: UnitRow): Unit => ({
  id: row.id,
  workspaceId: row.workspace_id,
  blockId: row.block_id,
  blockName: row.block_name,
  number: row.number,
  status: row.status,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export async function listUnits(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  query: UnitsQuery,
): Promise<{ items: Unit[]; total: number }> {
  const params: unknown[] = [organizationId, workspaceId, query.blockId ?? null];
  const where = "u.organization_id = $1 and u.workspace_id = $2 and ($3::uuid is null or u.block_id = $3)";
  const list = await client.query<UnitRow>(
    `${UNIT_SELECT}
      where ${where}
      order by b.sort_order, lower(b.name), b.id, length(u.number), lower(u.number), u.id
      limit $4 offset $5`,
    [...params, query.pageSize, paginationOffset(query)],
  );
  const count = await client.query<{ total: number }>(
    `select count(*)::int as total from app.units u where ${where}`,
    params,
  );
  return { items: list.rows.map(toUnit), total: count.rows[0]?.total ?? 0 };
}

export async function findUnits(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  ids: string[],
): Promise<Unit[]> {
  const result = await client.query<UnitRow>(
    `${UNIT_SELECT}
      where u.organization_id = $1 and u.workspace_id = $2 and u.id = any($3::uuid[])
      order by length(u.number), lower(u.number), u.id`,
    [organizationId, workspaceId, ids],
  );
  return result.rows.map(toUnit);
}

export async function insertUnit(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  blockId: string,
  number: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into app.units (organization_id, workspace_id, block_id, number)
     values ($1, $2, $3, $4) returning id`,
    [organizationId, workspaceId, blockId, number],
  );
  return (result.rows[0] as { id: string }).id;
}

// ON CONFLICT sem alvo: ignora número já existente no bloco (índice por lower(number)) e deixa a chamada idempotente.
export async function insertUnitsBatch(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  blockId: string,
  numbers: string[],
): Promise<string[]> {
  const result = await client.query<{ id: string }>(
    `insert into app.units (organization_id, workspace_id, block_id, number)
     select $1, $2, $3, n from unnest($4::text[]) as t(n)
     on conflict do nothing
     returning id`,
    [organizationId, workspaceId, blockId, numbers],
  );
  return result.rows.map((row) => row.id);
}

export async function updateUnit(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  unitId: string,
  patch: { number?: string; status?: "active" | "inactive" },
): Promise<boolean> {
  const result = await client.query(
    `update app.units
        set number = coalesce($4, number), status = coalesce($5, status)
      where id = $1 and organization_id = $2 and workspace_id = $3`,
    [unitId, organizationId, workspaceId, patch.number ?? null, patch.status ?? null],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------
export interface PersonRow {
  id: string;
  workspace_id: string;
  full_name: string;
  email: string;
  phone_enc: string | null;
  whatsapp_enc: string | null;
  photo_file_id: string | null;
  user_id: string | null;
  status: Person["status"];
  access_status: Person["accessStatus"];
  created_at: Ts;
  updated_at: Ts;
}

const PERSON_COLUMNS =
  "id, workspace_id, full_name, email, phone_enc, whatsapp_enc, photo_file_id, user_id, status, access_status, created_at, updated_at";

export const toPerson = (row: PersonRow, mask: (cipher: string | null) => string | null): Person => ({
  id: row.id,
  workspaceId: row.workspace_id,
  fullName: row.full_name,
  email: row.email,
  phoneMasked: mask(row.phone_enc),
  whatsappMasked: mask(row.whatsapp_enc),
  photoFileId: row.photo_file_id,
  userId: row.user_id,
  status: row.status,
  accessStatus: row.access_status,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export interface PersonWrite {
  fullName: string;
  email: string;
  phoneEnc: string | null;
  phoneHash: string | null;
  whatsappEnc: string | null;
}

export async function insertPerson(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  createdBy: string,
  input: PersonWrite,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into app.people
       (organization_id, workspace_id, full_name, email, phone_enc, phone_hash, whatsapp_enc, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [organizationId, workspaceId, input.fullName, input.email, input.phoneEnc, input.phoneHash, input.whatsappEnc, createdBy],
  );
  return (result.rows[0] as { id: string }).id;
}

export async function findPerson(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  personId: string,
): Promise<PersonRow | null> {
  const result = await client.query<PersonRow>(
    `select ${PERSON_COLUMNS} from app.people where id = $1 and organization_id = $2 and workspace_id = $3`,
    [personId, organizationId, workspaceId],
  );
  return result.rows[0] ?? null;
}

export async function findPersonContact(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  personId: string,
): Promise<{ phone_enc: string | null; whatsapp_enc: string | null } | null> {
  const result = await client.query<{ phone_enc: string | null; whatsapp_enc: string | null }>(
    `select phone_enc, whatsapp_enc from app.people where id = $1 and organization_id = $2 and workspace_id = $3`,
    [personId, organizationId, workspaceId],
  );
  return result.rows[0] ?? null;
}

// Colunas permitidas no UPDATE (allowlist); `undefined` = não alterar, `null` = limpar.
export interface PersonPatch {
  full_name?: string;
  email?: string;
  status?: Person["status"];
  phone_enc?: string | null;
  phone_hash?: string | null;
  whatsapp_enc?: string | null;
}

const PERSON_PATCH_COLUMNS = ["full_name", "email", "status", "phone_enc", "phone_hash", "whatsapp_enc"] as const;

export async function updatePerson(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  personId: string,
  patch: PersonPatch,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [personId, organizationId, workspaceId];
  for (const column of PERSON_PATCH_COLUMNS) {
    if (patch[column] === undefined) continue;
    params.push(patch[column]);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return true;
  const result = await client.query(
    `update app.people set ${sets.join(", ")} where id = $1 and organization_id = $2 and workspace_id = $3`,
    params,
  );
  return (result.rowCount ?? 0) > 0;
}

// Comparação sem acento nem caixa, sem depender da extensão unaccent.
const FOLD_FROM = "áàâãäéèêëíìîïóòôõöúùûüçñ";
const FOLD_TO = "aaaaaeeeeiiiiooooouuuucn";
const foldSql = (column: string) => `translate(lower(${column}), '${FOLD_FROM}', '${FOLD_TO}')`;
export const fold = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const likeEscape = (value: string): string => value.replace(/[\\%_]/g, "\\$&");

export async function listPeople(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  filter: PeopleFilter,
): Promise<{ rows: PersonRow[]; total: number }> {
  const params: unknown[] = [organizationId, workspaceId];
  const conditions = ["p.organization_id = $1", "p.workspace_id = $2"];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };

  if (filter.name) add(`${foldSql("p.full_name")} like ? escape '\\'`, `%${likeEscape(fold(filter.name))}%`);
  if (filter.email) add("p.email like ? escape '\\'", `%${likeEscape(filter.email.toLowerCase())}%`);
  if (filter.status) add("p.status = ?", filter.status);

  const unitConditions: string[] = [];
  const addUnit = (sql: string, value: unknown) => {
    params.push(value);
    unitConditions.push(sql.replace("?", `$${params.length}`));
  };
  if (filter.blockId) addUnit("u.block_id = ?", filter.blockId);
  if (filter.unitNumber) addUnit("lower(u.number) like ? escape '\\'", `%${likeEscape(filter.unitNumber.toLowerCase())}%`);
  if (filter.relation) addUnit("um.relation = ?", filter.relation);
  if (unitConditions.length > 0) {
    conditions.push(
      `exists (select 1 from app.unit_members um
                 join app.units u on u.id = um.unit_id
                where um.person_id = p.id and um.ends_on is null and ${unitConditions.join(" and ")})`,
    );
  }

  const where = conditions.join(" and ");
  const direction = filter.order === "za" ? "desc" : "asc";
  const list = await client.query<PersonRow>(
    `select ${PERSON_COLUMNS.split(", ").map((c) => `p.${c}`).join(", ")}
       from app.people p
      where ${where}
      order by lower(p.full_name) ${direction}, p.id ${direction}
      limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, filter.pageSize, paginationOffset(filter)],
  );
  const count = await client.query<{ total: number }>(
    `select count(*)::int as total from app.people p where ${where}`,
    params,
  );
  return { rows: list.rows, total: count.rows[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Vínculos
// ---------------------------------------------------------------------------
// Datas `date` chegam como texto AAAA-MM-DD (to_char na query), sem deslocamento de fuso do driver.
interface UnitMemberRow {
  id: string;
  unit_id: string;
  person_id: string;
  relation: Relation;
  starts_on: string;
  ends_on: string | null;
  created_at: Ts;
  updated_at: Ts;
}

interface PersonUnitRow extends UnitMemberRow {
  block_id: string;
  block_name: string;
  unit_number: string;
}

const toUnitMember = (row: UnitMemberRow): UnitMember => ({
  id: row.id,
  unitId: row.unit_id,
  personId: row.person_id,
  relation: row.relation,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const toPersonUnit = (row: PersonUnitRow): PersonUnit => ({
  ...toUnitMember(row),
  blockId: row.block_id,
  blockName: row.block_name,
  unitNumber: row.unit_number,
});

export async function listPersonUnits(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  personIds: string[],
  onlyActive: boolean,
): Promise<Map<string, PersonUnit[]>> {
  const result = await client.query<PersonUnitRow>(
    `select um.id, um.unit_id, um.person_id, um.relation, to_char(um.starts_on, 'YYYY-MM-DD') as starts_on, to_char(um.ends_on, 'YYYY-MM-DD') as ends_on, um.created_at, um.updated_at,
            u.block_id, b.name as block_name, u.number as unit_number
       from app.unit_members um
       join app.units u on u.id = um.unit_id
       join app.blocks b on b.id = u.block_id
      where um.organization_id = $1 and um.workspace_id = $2 and um.person_id = any($3::uuid[])
        and ($4::boolean = false or um.ends_on is null)
      order by (um.ends_on is not null), b.sort_order, lower(b.name), length(u.number), lower(u.number), um.starts_on desc, um.id`,
    [organizationId, workspaceId, personIds, onlyActive],
  );
  const grouped = new Map<string, PersonUnit[]>();
  for (const row of result.rows) {
    const list = grouped.get(row.person_id) ?? [];
    list.push(toPersonUnit(row));
    grouped.set(row.person_id, list);
  }
  return grouped;
}

export async function findUnitMember(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  unitMemberId: string,
): Promise<{ id: string; person_id: string; unit_id: string; starts_on: string; ends_on: string | null } | null> {
  const result = await client.query<{ id: string; person_id: string; unit_id: string; starts_on: string; ends_on: string | null }>(
    `select id, person_id, unit_id, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on
       from app.unit_members
      where id = $1 and organization_id = $2 and workspace_id = $3`,
    [unitMemberId, organizationId, workspaceId],
  );
  return result.rows[0] ?? null;
}

export async function insertUnitMember(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  createdBy: string,
  input: { unitId: string; personId: string; relation: Relation; startsOn?: string | undefined },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into app.unit_members
       (organization_id, workspace_id, unit_id, person_id, relation, starts_on, created_by)
     values ($1, $2, $3, $4, $5, coalesce($6::date, current_date), $7)
     returning id`,
    [organizationId, workspaceId, input.unitId, input.personId, input.relation, input.startsOn ?? null, createdBy],
  );
  return (result.rows[0] as { id: string }).id;
}

export async function endUnitMember(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  unitMemberId: string,
  endsOn: string,
): Promise<UnitMember | null> {
  const result = await client.query<UnitMemberRow>(
    `update app.unit_members
        set ends_on = $4::date
      where id = $1 and organization_id = $2 and workspace_id = $3 and ends_on is null
      returning id, unit_id, person_id, relation, to_char(starts_on, 'YYYY-MM-DD') as starts_on,
                to_char(ends_on, 'YYYY-MM-DD') as ends_on, created_at, updated_at`,
    [unitMemberId, organizationId, workspaceId, endsOn],
  );
  return result.rows[0] ? toUnitMember(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Unidades do próprio usuário (/me/units)
// ---------------------------------------------------------------------------
interface MyUnitRow {
  unit_id: string;
  unit_number: string;
  block_id: string;
  block_name: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string | null;
  unit_member_id: string;
  relation: Relation;
  starts_on: string;
  ends_on: string | null;
}

export async function listMyUnits(client: PoolClient, organizationId: string, userId: string): Promise<MyUnit[]> {
  const result = await client.query<MyUnitRow>(
    `select u.id as unit_id, u.number as unit_number, b.id as block_id, b.name as block_name,
            w.id as workspace_id, w.name as workspace_name, w.slug as workspace_slug,
            um.id as unit_member_id, um.relation, to_char(um.starts_on, 'YYYY-MM-DD') as starts_on, to_char(um.ends_on, 'YYYY-MM-DD') as ends_on
       from app.unit_members um
       join app.people p on p.id = um.person_id and p.organization_id = um.organization_id
       join app.units u on u.id = um.unit_id
       join app.blocks b on b.id = u.block_id
       join app.workspaces w on w.id = um.workspace_id and w.organization_id = um.organization_id
      where um.organization_id = $1
        and p.user_id = $2
        and um.unit_id in (select app.my_unit_ids())
        and (um.ends_on is null or um.ends_on > current_date)
      order by w.name, b.sort_order, lower(b.name), length(u.number), lower(u.number), um.id`,
    [organizationId, userId],
  );
  return result.rows.map((row) => ({
    unitId: row.unit_id,
    unitNumber: row.unit_number,
    blockId: row.block_id,
    blockName: row.block_name,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceSlug: row.workspace_slug,
    unitMemberId: row.unit_member_id,
    relation: row.relation,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }));
}
