import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "./common";

export const RELATIONS = ["owner", "tenant", "resident", "other"] as const;
export const relationSchema = z.enum(RELATIONS);
export type Relation = z.infer<typeof relationSchema>;

export const PERSON_STATUSES = ["active", "inactive", "pending"] as const;
export const personStatusSchema = z.enum(PERSON_STATUSES);
export type PersonStatus = z.infer<typeof personStatusSchema>;

export const ACCESS_STATUSES = ["none", "pending_approval", "active", "suspended"] as const;
export const accessStatusSchema = z.enum(ACCESS_STATUSES);
export type AccessStatus = z.infer<typeof accessStatusSchema>;

export const UNITS_BATCH_MAX = 500;
export const REVEAL_REASON_MIN = 10;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida");
export const isoDateSchema = isoDate;

// Telefone BR em E.164 (+55DDNNNNNNNN ou +55DD9NNNNNNNN); aceita entrada formatada e normaliza.
export function normalizePhoneBr(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  const match = /^55([1-9][1-9])(9\d{8}|[2-5]\d{7})$/.exec(digits);
  return match ? `+${digits}` : null;
}

export function maskPhoneBr(e164: string): string {
  const match = /^\+55(\d{2})(\d{8,9})$/.exec(e164);
  if (!match) return "•••••";
  const subscriber = match[2] as string;
  const hidden = "•".repeat(subscriber.length - 4);
  return `(${match[1]}) ${hidden}-${subscriber.slice(-4)}`;
}

export const phoneBrSchema = z
  .string()
  .trim()
  .max(30)
  .transform((value, ctx) => {
    const normalized = normalizePhoneBr(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Telefone inválido (DDD + número brasileiro)" });
      return z.NEVER;
    }
    return normalized;
  });

const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido").max(254);

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens");

const cnpjSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9A-Z]{14}$/, "CNPJ inválido");
const stateSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF inválida");

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema,
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(120),
  state: stateSchema,
  cnpj: cnpjSchema.nullish(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: slugSchema,
    address: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(120).nullable(),
    state: stateSchema.nullable(),
    cnpj: cnpjSchema.nullable(),
    status: z.enum(["active", "inactive"]),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo");
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const blockSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Block = z.infer<typeof blockSchema>;

export const createBlockSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export type CreateBlockInput = z.infer<typeof createBlockSchema>;

export const updateBlockSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo");
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;

const unitNumberSchema = z.string().trim().min(1).max(20);
export const unitStatusSchema = z.enum(["active", "inactive"]);

export const unitSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  blockId: uuidSchema,
  blockName: z.string(),
  number: z.string(),
  status: unitStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Unit = z.infer<typeof unitSchema>;

export const createUnitSchema = z.object({
  blockId: uuidSchema,
  number: unitNumberSchema,
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const createUnitsBatchSchema = z.object({
  blockId: uuidSchema,
  numbers: z.array(unitNumberSchema).min(1).max(UNITS_BATCH_MAX),
});
export type CreateUnitsBatchInput = z.infer<typeof createUnitsBatchSchema>;

export const updateUnitSchema = z
  .object({ number: unitNumberSchema, status: unitStatusSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo");
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

export const unitsQuerySchema = paginationQuerySchema.extend({
  blockId: uuidSchema.optional(),
});
export type UnitsQuery = z.infer<typeof unitsQuerySchema>;

export const unitMemberSchema = z.object({
  id: uuidSchema,
  unitId: uuidSchema,
  personId: uuidSchema,
  relation: relationSchema,
  startsOn: isoDate,
  endsOn: isoDate.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UnitMember = z.infer<typeof unitMemberSchema>;

export const personUnitSchema = unitMemberSchema.extend({
  blockId: uuidSchema,
  blockName: z.string(),
  unitNumber: z.string(),
});
export type PersonUnit = z.infer<typeof personUnitSchema>;

// Telefone e WhatsApp saem sempre mascarados; o completo so pelo endpoint reveal-contact.
export const personSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  fullName: z.string(),
  email: z.string(),
  phoneMasked: z.string().nullable(),
  whatsappMasked: z.string().nullable(),
  photoFileId: uuidSchema.nullable(),
  userId: uuidSchema.nullable(),
  status: personStatusSchema,
  accessStatus: accessStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Person = z.infer<typeof personSchema>;

export const personWithUnitsSchema = personSchema.extend({ units: z.array(personUnitSchema) });
export type PersonWithUnits = z.infer<typeof personWithUnitsSchema>;

export const linkUnitSchema = z.object({
  unitId: uuidSchema,
  relation: relationSchema,
  startsOn: isoDate.optional(),
});
export type LinkUnitInput = z.infer<typeof linkUnitSchema>;

export const createPersonSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: emailSchema,
  phone: phoneBrSchema.nullish(),
  whatsapp: phoneBrSchema.nullish(),
  units: z.array(linkUnitSchema).max(20).default([]),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160),
    email: emailSchema,
    phone: phoneBrSchema.nullable(),
    whatsapp: phoneBrSchema.nullable(),
    status: personStatusSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo");
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export const endUnitMemberSchema = z.object({ endsOn: isoDate });
export type EndUnitMemberInput = z.infer<typeof endUnitMemberSchema>;

export const revealContactSchema = z.object({
  reason: z.string().trim().min(REVEAL_REASON_MIN, "Informe o motivo (mínimo 10 caracteres)").max(500),
});
export type RevealContactInput = z.infer<typeof revealContactSchema>;

export const revealedContactSchema = z.object({
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
});
export type RevealedContact = z.infer<typeof revealedContactSchema>;

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().min(1).max(max).optional());

export const peopleFilterSchema = paginationQuerySchema.extend({
  name: optionalText(160),
  email: optionalText(254),
  blockId: z.preprocess(blankToUndefined, uuidSchema.optional()),
  unitNumber: optionalText(20),
  relation: z.preprocess(blankToUndefined, relationSchema.optional()),
  status: z.preprocess(blankToUndefined, personStatusSchema.optional()),
  order: z.preprocess(blankToUndefined, z.enum(["az", "za"]).default("az")),
});
export type PeopleFilter = z.infer<typeof peopleFilterSchema>;

export const myUnitSchema = z.object({
  unitId: uuidSchema,
  unitNumber: z.string(),
  blockId: uuidSchema,
  blockName: z.string(),
  workspaceId: uuidSchema,
  workspaceName: z.string(),
  workspaceSlug: z.string().nullable(),
  unitMemberId: uuidSchema,
  relation: relationSchema,
  startsOn: isoDate,
  endsOn: isoDate.nullable(),
});
export type MyUnit = z.infer<typeof myUnitSchema>;
