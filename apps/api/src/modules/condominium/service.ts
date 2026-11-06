import { randomUUID } from "node:crypto";
import {
  maskPhoneBr,
  type Block,
  type CreateBlockInput,
  type CreatePersonInput,
  type CreateUnitInput,
  type CreateUnitsBatchInput,
  type CreateWorkspaceInput,
  type EndUnitMemberInput,
  type LinkUnitInput,
  type MyUnit,
  type PeopleFilter,
  type PersonWithUnits,
  type RevealContactInput,
  type RevealedContact,
  type Unit,
  type UnitMember,
  type UnitsQuery,
  type UpdateBlockInput,
  type UpdatePersonInput,
  type UpdateUnitInput,
  type UpdateWorkspaceInput,
  type Workspace,
} from "@app/shared";
import type { Request } from "express";
import type { PoolClient } from "pg";
import { recordAudit } from "../../audit";
import type { Config } from "../../config";
import { decryptPii, encryptPii, hashPii } from "../../crypto/pii";
import { withTenantTx } from "../../db";
import { authRequired, badRequest, conflict, notFound, unprocessable, type DomainError } from "../../http";
import { findWorkspace, insertWorkspace, updateWorkspace as updateWorkspaceRow } from "../workspaces/repository";
import {
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
  constraintOf,
  endUnitMember as endUnitMemberRow,
  findBlock,
  findPerson,
  findPersonContact,
  findUnitMember,
  findUnits,
  insertBlock,
  insertPerson,
  insertUnit,
  insertUnitMember,
  insertUnitsBatch,
  listBlocks as listBlockRows,
  listMyUnits as listMyUnitRows,
  listPeople as listPeopleRows,
  listPersonUnits,
  listUnits as listUnitRows,
  toPerson,
  updateBlock as updateBlockRow,
  updatePerson as updatePersonRow,
  updateUnit as updateUnitRow,
  type PersonPatch,
  type PersonRow,
} from "./repository";

export type CondominiumConfig = Pick<Config, "dataEncryptionKey" | "dataHashKey">;
export interface CondominiumDeps {
  config: CondominiumConfig;
}

interface Ctx {
  userId: string;
  organizationId: string;
  requestId: string;
  encryptionKey: Buffer;
  hashKey: Buffer;
}

function context(req: Request, deps: CondominiumDeps): Ctx {
  if (!req.auth) throw authRequired();
  if (!req.membership) throw notFound();
  return {
    userId: req.auth.userId,
    organizationId: req.membership.organizationId,
    requestId: String(req.id ?? ""),
    encryptionKey: deps.config.dataEncryptionKey,
    hashKey: deps.config.dataHashKey,
  };
}

type ConstraintMap = Record<string, () => DomainError>;

// Traduz violação de unicidade/check do Postgres em erro de domínio; o resto segue como 500.
async function mapDbErrors<T>(fn: () => Promise<T>, map: ConstraintMap = {}): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const unique = constraintOf(err, PG_UNIQUE_VIOLATION);
    const mapped = unique !== null ? map[unique] : undefined;
    if (mapped) throw mapped();
    if (constraintOf(err, PG_CHECK_VIOLATION) !== null) throw badRequest("Dados inválidos.");
    throw err;
  }
}

const audit = (
  client: PoolClient,
  ctx: Ctx,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) =>
  recordAudit(client, {
    organizationId: ctx.organizationId,
    actorKind: "user",
    actorUserId: ctx.userId,
    action,
    entityType,
    entityId,
    requestId: ctx.requestId,
    metadata,
  });

// ---------------------------------------------------------------------------
// Condomínio
// ---------------------------------------------------------------------------
const slugTaken = () => conflict("SLUG_TAKEN", "Este endereço (slug) já está em uso.");

export async function createWorkspace(req: Request, deps: CondominiumDeps, input: CreateWorkspaceInput): Promise<Workspace> {
  const ctx = context(req, deps);
  const id = randomUUID();
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        await insertWorkspace(tx, ctx.organizationId, id, input);
        await audit(tx, ctx, "workspace.create", "workspace", id, { fields: Object.keys(input), slug: input.slug });
        const created = await findWorkspace(tx, ctx.organizationId, id);
        if (!created) throw notFound();
        return created;
      }),
    { workspaces_slug_uidx: slugTaken },
  );
}

export async function updateWorkspace(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  patch: UpdateWorkspaceInput,
): Promise<Workspace> {
  const ctx = context(req, deps);
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        if (!(await updateWorkspaceRow(tx, ctx.organizationId, workspaceId, patch))) throw notFound();
        await audit(tx, ctx, "workspace.update", "workspace", workspaceId, { fields: Object.keys(patch) });
        const updated = await findWorkspace(tx, ctx.organizationId, workspaceId);
        if (!updated) throw notFound();
        return updated;
      }),
    { workspaces_slug_uidx: slugTaken },
  );
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------
const blockTaken = () => conflict("BLOCK_EXISTS", "Já existe um bloco com este nome.");
const blockMissing = () => notFound("Bloco não encontrado.");

export function listBlocks(req: Request, deps: CondominiumDeps, workspaceId: string): Promise<Block[]> {
  const ctx = context(req, deps);
  return withTenantTx(req, (tx) => listBlockRows(tx, ctx.organizationId, workspaceId), { readOnly: true });
}

export function createBlock(req: Request, deps: CondominiumDeps, workspaceId: string, input: CreateBlockInput): Promise<Block> {
  const ctx = context(req, deps);
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        const block = await insertBlock(tx, ctx.organizationId, workspaceId, input);
        await audit(tx, ctx, "block.create", "block", block.id, { workspaceId });
        return block;
      }),
    { blocks_workspace_name_uidx: blockTaken },
  );
}

export function updateBlock(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  blockId: string,
  patch: UpdateBlockInput,
): Promise<Block> {
  const ctx = context(req, deps);
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        const block = await updateBlockRow(tx, ctx.organizationId, workspaceId, blockId, patch);
        if (!block) throw blockMissing();
        await audit(tx, ctx, "block.update", "block", blockId, { workspaceId, fields: Object.keys(patch) });
        return block;
      }),
    { blocks_workspace_name_uidx: blockTaken },
  );
}

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------
const unitTaken = () => conflict("UNIT_EXISTS", "Já existe uma unidade com este número no bloco.");

export async function listUnits(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  query: UnitsQuery,
): Promise<{ items: Unit[]; total: number }> {
  const ctx = context(req, deps);
  return withTenantTx(req, (tx) => listUnitRows(tx, ctx.organizationId, workspaceId, query), { readOnly: true });
}

export function createUnit(req: Request, deps: CondominiumDeps, workspaceId: string, input: CreateUnitInput): Promise<Unit> {
  const ctx = context(req, deps);
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        if (!(await findBlock(tx, ctx.organizationId, workspaceId, input.blockId))) throw blockMissing();
        const id = await insertUnit(tx, ctx.organizationId, workspaceId, input.blockId, input.number);
        await audit(tx, ctx, "unit.create", "unit", id, { workspaceId, blockId: input.blockId });
        const [unit] = await findUnits(tx, ctx.organizationId, workspaceId, [id]);
        if (!unit) throw notFound();
        return unit;
      }),
    { units_block_number_uidx: unitTaken },
  );
}

export function createUnitsBatch(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  input: CreateUnitsBatchInput,
): Promise<{ created: Unit[]; skipped: string[] }> {
  const ctx = context(req, deps);
  const seen = new Set<string>();
  const numbers = input.numbers.filter((number) => {
    const key = number.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return withTenantTx(req, async (tx) => {
    if (!(await findBlock(tx, ctx.organizationId, workspaceId, input.blockId))) throw blockMissing();
    const ids = await insertUnitsBatch(tx, ctx.organizationId, workspaceId, input.blockId, numbers);
    const created = ids.length > 0 ? await findUnits(tx, ctx.organizationId, workspaceId, ids) : [];
    const createdKeys = new Set(created.map((unit) => unit.number.toLowerCase()));
    const skipped = numbers.filter((number) => !createdKeys.has(number.toLowerCase()));
    if (created.length > 0) {
      await audit(tx, ctx, "unit.batch_create", "block", input.blockId, {
        workspaceId,
        requested: numbers.length,
        created: created.length,
        skipped: skipped.length,
      });
    }
    return { created, skipped };
  });
}

export function updateUnit(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  unitId: string,
  patch: UpdateUnitInput,
): Promise<Unit> {
  const ctx = context(req, deps);
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        if (!(await updateUnitRow(tx, ctx.organizationId, workspaceId, unitId, patch))) throw notFound("Unidade não encontrada.");
        await audit(tx, ctx, "unit.update", "unit", unitId, { workspaceId, fields: Object.keys(patch) });
        const [unit] = await findUnits(tx, ctx.organizationId, workspaceId, [unitId]);
        if (!unit) throw notFound("Unidade não encontrada.");
        return unit;
      }),
    { units_block_number_uidx: unitTaken },
  );
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------
const emailTaken = () => conflict("PERSON_EMAIL_TAKEN", "Já existe uma pessoa com este e-mail neste condomínio.");
const linkExists = () => conflict("UNIT_LINK_EXISTS", "A pessoa já tem vínculo ativo com esta unidade.");
const personMissing = () => notFound("Pessoa não encontrada.");
const unitMissing = () => notFound("Unidade não encontrada.");

function masker(ctx: Ctx) {
  return (cipher: string | null) => (cipher ? maskPhoneBr(decryptPii(cipher, ctx.encryptionKey)) : null);
}

function sealPhone(ctx: Ctx, phone: string | null | undefined) {
  if (phone === undefined) return undefined;
  return phone === null
    ? { enc: null, hash: null }
    : { enc: encryptPii(phone, ctx.encryptionKey), hash: hashPii(phone, ctx.hashKey) };
}

async function assertLinkableUnits(tx: PoolClient, ctx: Ctx, workspaceId: string, unitIds: string[]): Promise<void> {
  if (new Set(unitIds).size !== unitIds.length) throw badRequest("Unidade repetida na lista de vínculos.");
  if (unitIds.length === 0) return;
  const units = await findUnits(tx, ctx.organizationId, workspaceId, unitIds);
  if (units.length !== unitIds.length) throw unitMissing();
  if (units.some((unit) => unit.status !== "active")) {
    throw unprocessable("UNIT_INACTIVE", "Não é possível vincular uma pessoa a uma unidade inativa.");
  }
}

async function loadPerson(
  tx: PoolClient,
  ctx: Ctx,
  workspaceId: string,
  personId: string,
  onlyActiveUnits: boolean,
): Promise<PersonWithUnits> {
  const row = await findPerson(tx, ctx.organizationId, workspaceId, personId);
  if (!row) throw personMissing();
  const units = await listPersonUnits(tx, ctx.organizationId, workspaceId, [personId], onlyActiveUnits);
  return { ...toPerson(row, masker(ctx)), units: units.get(personId) ?? [] };
}

export async function listPeople(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  filter: PeopleFilter,
): Promise<{ items: PersonWithUnits[]; total: number }> {
  const ctx = context(req, deps);
  return withTenantTx(
    req,
    async (tx) => {
      const { rows, total } = await listPeopleRows(tx, ctx.organizationId, workspaceId, filter);
      const units =
        rows.length > 0
          ? await listPersonUnits(tx, ctx.organizationId, workspaceId, rows.map((row: PersonRow) => row.id), true)
          : new Map();
      const mask = masker(ctx);
      return { items: rows.map((row) => ({ ...toPerson(row, mask), units: units.get(row.id) ?? [] })), total };
    },
    { readOnly: true },
  );
}

export function getPerson(req: Request, deps: CondominiumDeps, workspaceId: string, personId: string): Promise<PersonWithUnits> {
  const ctx = context(req, deps);
  return withTenantTx(req, (tx) => loadPerson(tx, ctx, workspaceId, personId, false), { readOnly: true });
}

export function createPerson(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  input: CreatePersonInput,
): Promise<PersonWithUnits> {
  const ctx = context(req, deps);
  const phone = sealPhone(ctx, input.phone ?? null);
  const whatsapp = sealPhone(ctx, input.whatsapp ?? null);
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        await assertLinkableUnits(tx, ctx, workspaceId, input.units.map((link) => link.unitId));
        const personId = await insertPerson(tx, ctx.organizationId, workspaceId, ctx.userId, {
          fullName: input.fullName,
          email: input.email,
          phoneEnc: phone?.enc ?? null,
          phoneHash: phone?.hash ?? null,
          whatsappEnc: whatsapp?.enc ?? null,
        });
        for (const link of input.units) {
          await insertUnitMember(tx, ctx.organizationId, workspaceId, ctx.userId, { ...link, personId });
        }
        await audit(tx, ctx, "person.create", "person", personId, {
          workspaceId,
          hasPhone: Boolean(phone),
          hasWhatsapp: Boolean(whatsapp),
          units: input.units.length,
        });
        return loadPerson(tx, ctx, workspaceId, personId, false);
      }),
    { people_workspace_email_key: emailTaken, unit_members_active_uidx: linkExists },
  );
}

export function updatePerson(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  personId: string,
  input: UpdatePersonInput,
): Promise<PersonWithUnits> {
  const ctx = context(req, deps);
  const phone = sealPhone(ctx, input.phone);
  const whatsapp = sealPhone(ctx, input.whatsapp);
  const patch: PersonPatch = {
    ...(input.fullName !== undefined && { full_name: input.fullName }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.status !== undefined && { status: input.status }),
    ...(phone && { phone_enc: phone.enc, phone_hash: phone.hash }),
    ...(whatsapp && { whatsapp_enc: whatsapp.enc }),
  };
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        if (!(await updatePersonRow(tx, ctx.organizationId, workspaceId, personId, patch))) throw personMissing();
        // Só os nomes dos campos: nunca valores de contato.
        await audit(tx, ctx, "person.update", "person", personId, { workspaceId, fields: Object.keys(input) });
        return loadPerson(tx, ctx, workspaceId, personId, false);
      }),
    { people_workspace_email_key: emailTaken },
  );
}

export function revealContact(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  personId: string,
  input: RevealContactInput,
): Promise<RevealedContact> {
  const ctx = context(req, deps);
  return withTenantTx(req, async (tx) => {
    const contact = await findPersonContact(tx, ctx.organizationId, workspaceId, personId);
    if (!contact) throw personMissing();
    // A auditoria entra na mesma transação: se falhar, nada é revelado.
    await audit(tx, ctx, "person.contact_reveal", "person", personId, {
      workspaceId,
      reason: input.reason,
      fields: [contact.phone_enc ? "phone" : null, contact.whatsapp_enc ? "whatsapp" : null].filter(Boolean),
    });
    return {
      phone: contact.phone_enc ? decryptPii(contact.phone_enc, ctx.encryptionKey) : null,
      whatsapp: contact.whatsapp_enc ? decryptPii(contact.whatsapp_enc, ctx.encryptionKey) : null,
    };
  });
}

export function linkUnit(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  personId: string,
  input: LinkUnitInput,
): Promise<PersonWithUnits> {
  const ctx = context(req, deps);
  return mapDbErrors(
    () =>
      withTenantTx(req, async (tx) => {
        if (!(await findPerson(tx, ctx.organizationId, workspaceId, personId))) throw personMissing();
        await assertLinkableUnits(tx, ctx, workspaceId, [input.unitId]);
        const unitMemberId = await insertUnitMember(tx, ctx.organizationId, workspaceId, ctx.userId, { ...input, personId });
        await audit(tx, ctx, "person.unit_link", "person", personId, {
          workspaceId,
          unitMemberId,
          unitId: input.unitId,
          relation: input.relation,
        });
        return loadPerson(tx, ctx, workspaceId, personId, false);
      }),
    { unit_members_active_uidx: linkExists },
  );
}

export function endUnitMember(
  req: Request,
  deps: CondominiumDeps,
  workspaceId: string,
  unitMemberId: string,
  input: EndUnitMemberInput,
): Promise<UnitMember> {
  const ctx = context(req, deps);
  return mapDbErrors(() =>
    withTenantTx(req, async (tx) => {
      const current = await findUnitMember(tx, ctx.organizationId, workspaceId, unitMemberId);
      if (!current) throw notFound("Vínculo não encontrado.");
      if (current.ends_on !== null) throw conflict("UNIT_LINK_ENDED", "Este vínculo já foi encerrado.");
      if (input.endsOn < current.starts_on) throw badRequest("A data de término não pode ser anterior ao início do vínculo.");
      const ended = await endUnitMemberRow(tx, ctx.organizationId, workspaceId, unitMemberId, input.endsOn);
      if (!ended) throw conflict("UNIT_LINK_ENDED", "Este vínculo já foi encerrado.");
      await audit(tx, ctx, "person.unit_end", "person", current.person_id, {
        workspaceId,
        unitMemberId,
        unitId: current.unit_id,
        endsOn: input.endsOn,
      });
      return ended;
    }),
  );
}

// ---------------------------------------------------------------------------
// Unidades do próprio usuário
// ---------------------------------------------------------------------------
export function myUnits(req: Request, deps: CondominiumDeps): Promise<MyUnit[]> {
  const ctx = context(req, deps);
  return withTenantTx(req, (tx) => listMyUnitRows(tx, ctx.organizationId, ctx.userId), { readOnly: true });
}
