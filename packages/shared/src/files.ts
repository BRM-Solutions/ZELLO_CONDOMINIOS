import { z } from "zod";
import { uuidSchema } from "./common";

export const FILE_CLASSIFICATIONS = ["public", "internal", "confidential", "personal"] as const;
export const fileClassificationSchema = z.enum(FILE_CLASSIFICATIONS);
export type FileClassification = z.infer<typeof fileClassificationSchema>;

export const FILE_STATUSES = ["pending", "available", "quarantined", "deleted"] as const;
export const fileStatusSchema = z.enum(FILE_STATUSES);
export type FileStatus = z.infer<typeof fileStatusSchema>;

export const MAX_FILE_NAME_LENGTH = 255;
const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

export const createFileInputSchema = z.object({
  workspaceId: uuidSchema.nullish(),
  originalName: z.string().trim().min(1).max(MAX_FILE_NAME_LENGTH),
  mimeType: z.string().trim().toLowerCase().regex(MIME_PATTERN, "MIME type inválido"),
  sizeBytes: z.number().int().min(1),
  classification: fileClassificationSchema,
});
export type CreateFileInput = z.infer<typeof createFileInputSchema>;

export const fileSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  workspaceId: uuidSchema.nullable(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  sha256: z.string().nullable(),
  classification: fileClassificationSchema,
  status: fileStatusSchema,
  retentionUntil: z.string().nullable(),
  legalHold: z.boolean(),
  uploadedBy: uuidSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type FileRecord = z.infer<typeof fileSchema>;

export const fileUploadSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
  path: z.string().min(1),
});
export type FileUpload = z.infer<typeof fileUploadSchema>;

const meta = z.object({ requestId: z.string().optional() }).optional();

export const createFileResponseSchema = z.object({
  data: z.object({ file: fileSchema, upload: fileUploadSchema }),
  meta,
});
export type CreateFileResponse = z.infer<typeof createFileResponseSchema>;

export const completeFileResponseSchema = z.object({ data: fileSchema, meta });
export type CompleteFileResponse = z.infer<typeof completeFileResponseSchema>;

export const fileUrlResponseSchema = z.object({
  data: z.object({ url: z.string().url(), expiresInSeconds: z.number().int().min(1) }),
  meta,
});
export type FileUrlResponse = z.infer<typeof fileUrlResponseSchema>;

export const deleteFileResponseSchema = z.object({ data: fileSchema, meta });
export type DeleteFileResponse = z.infer<typeof deleteFileResponseSchema>;

const cleanSegment = (value: string) =>
  value
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

export function sanitizeFileName(name: string): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[\\/]/)
      .pop() ?? "";
  const dot = base.lastIndexOf(".");
  const rawStem = dot > 0 ? base.slice(0, dot) : base;
  const rawExt = dot > 0 ? base.slice(dot + 1) : "";
  const stem = cleanSegment(rawStem).slice(0, 100) || "file";
  const ext = cleanSegment(rawExt).slice(0, 16);
  return ext ? `${stem}.${ext}` : stem;
}
