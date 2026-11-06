import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type z } from "zod";

export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new DomainError(400, "BAD_REQUEST", message, details);
export const authRequired = () => new DomainError(401, "AUTH_REQUIRED", "Entre para continuar.");
export const authInvalid = () => new DomainError(401, "AUTH_INVALID", "Sessão inválida ou expirada.");
export const forbidden = () => new DomainError(403, "FORBIDDEN", "Sem permissão para esta ação.");
export const notFound = (message = "Registro não encontrado.") => new DomainError(404, "NOT_FOUND", message);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new DomainError(422, code, message, details);
export const conflict = (code: string, message: string, details?: unknown) =>
  new DomainError(409, code, message, details);

const REQUEST_ID_PATTERN = /^[\w.-]{8,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  req.id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", String(req.id));
  next();
};

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncRoute(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  return schema.parse(input);
}

export function sendData<T>(req: Request, res: Response, data: T, meta: Record<string, unknown> = {}): void {
  res.json({ data, meta: { ...meta, requestId: String(req.id) } });
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new DomainError(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${req.path}`));
};

interface BodyParserError extends Error {
  type?: string;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof DomainError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    });
    return;
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details: { issues } } });
    return;
  }

  const parserError = err as BodyParserError | null;
  if (parserError?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Corpo da requisição não é um JSON válido" } });
    return;
  }
  if (parserError?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Corpo da requisição muito grande" } });
    return;
  }

  req.log.error({ err }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" } });
};
