import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  requestId: z.string().optional(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: paginationMetaSchema,
  });
}

export function buildPaginationMeta(query: PaginationQuery, total: number): PaginationMeta {
  return { page: query.page, pageSize: query.pageSize, total };
}

export function paginationOffset(query: PaginationQuery): number {
  return (query.page - 1) * query.pageSize;
}
