import { randomUUID } from "node:crypto";
import {
  sanitizeFileName,
  type CreateFileInput,
  type CreateFileResponse,
  type FileRecord,
  type FileUrlResponse,
} from "@app/shared";
import type { Request } from "express";
import { recordAudit } from "../../audit";
import type { Config } from "../../config";
import { withTenantTx } from "../../db";
import { DomainError, authRequired, conflict, forbidden, notFound, unprocessable } from "../../http";
import { StorageError, type StorageClient } from "../../integrations/storage-client";
import {
  completeFile,
  findFile,
  getQuotaUsage,
  insertFile,
  lockStorageQuota,
  softDeleteFile,
  toFile,
  workspaceVisible,
  type FileRow,
} from "./repository";

export type FilesConfig = Pick<Config, "storageBucket" | "signedUrlTtlSeconds" | "fileMaxBytes" | "fileAllowedMime">;

export interface FilesDeps {
  storage: StorageClient;
  config: FilesConfig;
}

const ORG_LEVEL_ROLES = ["owner", "admin"];
const PG_INSUFFICIENT_PRIVILEGE = "42501";

function context(req: Request) {
  if (!req.auth) throw authRequired();
  if (!req.membership) throw notFound();
  return {
    userId: req.auth.userId,
    accessToken: req.auth.accessToken,
    organizationId: req.membership.organizationId,
    role: req.membership.role,
    requestId: String(req.id ?? ""),
  };
}

async function viaStorage<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof StorageError) {
      if (err.isPolicyDenied) throw forbidden();
      throw new DomainError(502, "STORAGE_UNAVAILABLE", "Armazenamento de arquivos indisponível. Tente novamente.");
    }
    throw err;
  }
}

async function rlsAware<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string } | null)?.code === PG_INSUFFICIENT_PRIVILEGE) throw forbidden();
    throw err;
  }
}

const baseMime = (value: string) => (value.split(";")[0] ?? "").trim().toLowerCase();

function visibleFile(row: FileRow | undefined): FileRow {
  if (!row || row.status === "deleted") throw notFound("Arquivo não encontrado.");
  return row;
}

export async function initUpload(req: Request, deps: FilesDeps, input: CreateFileInput): Promise<CreateFileResponse["data"]> {
  const ctx = context(req);
  const { config, storage } = deps;
  const mimeType = baseMime(input.mimeType);

  if (!config.fileAllowedMime.includes(mimeType)) {
    throw unprocessable("FILE_TYPE_NOT_ALLOWED", "Tipo de arquivo não permitido.", { allowed: config.fileAllowedMime });
  }
  if (input.sizeBytes > config.fileMaxBytes) {
    throw unprocessable("FILE_TOO_LARGE", "Arquivo maior que o limite permitido.", { maxBytes: config.fileMaxBytes });
  }

  const workspaceId = input.workspaceId ?? null;
  if (workspaceId === null && !ORG_LEVEL_ROLES.includes(ctx.role)) throw forbidden();
  if (workspaceId !== null) {
    const visible = await withTenantTx(req, (tx) => workspaceVisible(tx, ctx.organizationId, workspaceId), {
      readOnly: true,
    });
    if (!visible) throw notFound("Workspace não encontrado.");
  }

  const id = randomUUID();
  const objectPath = `${ctx.organizationId}/${workspaceId ?? "org"}/${id}/${sanitizeFileName(input.originalName)}`;
  const ref = { bucket: config.storageBucket, path: objectPath };

  const row = await rlsAware(() =>
    withTenantTx(req, async (tx) => {
      await lockStorageQuota(tx, ctx.organizationId);
      const { quotaBytes, usedBytes } = await getQuotaUsage(tx, ctx.organizationId);
      if (quotaBytes !== null && usedBytes + input.sizeBytes > quotaBytes) {
        throw unprocessable("STORAGE_QUOTA_EXCEEDED", "Cota de armazenamento da organização excedida.", {
          quotaBytes,
          usedBytes,
          requestedBytes: input.sizeBytes,
        });
      }
      const inserted = await insertFile(tx, {
        id,
        organizationId: ctx.organizationId,
        workspaceId,
        bucket: config.storageBucket,
        objectPath,
        originalName: input.originalName,
        mimeType,
        sizeBytes: input.sizeBytes,
        classification: input.classification,
        uploadedBy: ctx.userId,
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorKind: "user",
        actorUserId: ctx.userId,
        action: "file.upload_init",
        entityType: "file",
        entityId: id,
        requestId: ctx.requestId,
        metadata: { workspaceId, classification: input.classification, mimeType, sizeBytes: input.sizeBytes },
      });
      return inserted;
    }),
  );

  const upload = await viaStorage(() => storage.createSignedUploadUrl(ref, { accessToken: ctx.accessToken }));

  return { file: toFile(row), upload: { url: upload.url, token: upload.token, path: objectPath } };
}

export async function completeUpload(req: Request, deps: FilesDeps, fileId: string): Promise<FileRecord> {
  const ctx = context(req);
  const { config, storage } = deps;

  const current = visibleFile(
    await withTenantTx(req, (tx) => findFile(tx, ctx.organizationId, fileId), { readOnly: true }),
  );
  if (current.uploaded_by !== ctx.userId) throw forbidden();
  if (current.status !== "pending") {
    throw conflict("FILE_NOT_PENDING", "O envio deste arquivo já foi concluído.", { status: current.status });
  }

  const info = await viaStorage(() =>
    storage.headObject({ bucket: current.bucket, path: current.object_path }, { accessToken: ctx.accessToken }),
  );
  if (!info) throw conflict("UPLOAD_MISSING", "O arquivo ainda não foi enviado ao armazenamento.");

  const declaredSize = Number(current.size_bytes);
  const actualMime = info.mimeType ? baseMime(info.mimeType) : current.mime_type;
  const reasons: string[] = [];
  if (info.sizeBytes !== declaredSize) reasons.push("size_mismatch");
  if (actualMime !== current.mime_type) reasons.push("mime_mismatch");
  if (!config.fileAllowedMime.includes(actualMime)) reasons.push("mime_not_allowed");
  if (info.sizeBytes > config.fileMaxBytes) reasons.push("too_large");
  const status = reasons.length === 0 ? "available" : "quarantined";

  const row = await withTenantTx(req, async (tx) => {
    const updated = await completeFile(tx, fileId, { status, sizeBytes: info.sizeBytes, mimeType: actualMime });
    if (!updated) throw conflict("FILE_NOT_PENDING", "O envio deste arquivo já foi concluído.");
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorKind: "user",
      actorUserId: ctx.userId,
      action: "file.complete",
      entityType: "file",
      entityId: fileId,
      requestId: ctx.requestId,
      metadata: { status, reasons, declaredSizeBytes: declaredSize, sizeBytes: info.sizeBytes, mimeType: actualMime },
    });
    return updated;
  });
  return toFile(row);
}

export async function downloadUrl(req: Request, deps: FilesDeps, fileId: string): Promise<FileUrlResponse["data"]> {
  const ctx = context(req);
  const { config, storage } = deps;

  const current = visibleFile(
    await withTenantTx(req, (tx) => findFile(tx, ctx.organizationId, fileId), { readOnly: true }),
  );
  if (current.status !== "available") {
    throw conflict("FILE_NOT_AVAILABLE", "O arquivo não está disponível para download.", { status: current.status });
  }

  const signed = await viaStorage(() =>
    storage.createSignedDownloadUrl(
      { bucket: current.bucket, path: current.object_path },
      config.signedUrlTtlSeconds,
      { accessToken: ctx.accessToken },
    ),
  );

  await withTenantTx(req, (tx) =>
    recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorKind: "user",
      actorUserId: ctx.userId,
      action: "file.download",
      entityType: "file",
      entityId: fileId,
      requestId: ctx.requestId,
      metadata: { classification: current.classification, ttlSeconds: config.signedUrlTtlSeconds },
    }),
  );

  return { url: signed.url, expiresInSeconds: config.signedUrlTtlSeconds };
}

export async function deleteFile(req: Request, fileId: string): Promise<FileRecord> {
  const ctx = context(req);

  const row = await rlsAware(() =>
    withTenantTx(req, async (tx) => {
      const current = visibleFile(await findFile(tx, ctx.organizationId, fileId));
      if (current.legal_hold) {
        throw conflict("FILE_LEGAL_HOLD", "O arquivo está sob bloqueio legal e não pode ser removido.");
      }
      if (current.retention_until && current.retention_until.getTime() > Date.now()) {
        throw conflict("FILE_RETENTION_ACTIVE", "O arquivo está dentro do prazo de retenção.", {
          retentionUntil: current.retention_until.toISOString(),
        });
      }
      const deleted = await softDeleteFile(tx, fileId);
      if (!deleted) throw conflict("FILE_DELETE_BLOCKED", "Não foi possível remover o arquivo agora.");
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorKind: "user",
        actorUserId: ctx.userId,
        action: "file.delete",
        entityType: "file",
        entityId: fileId,
        requestId: ctx.requestId,
        metadata: { classification: current.classification, previousStatus: current.status },
      });
      return deleted;
    }),
  );
  return toFile(row);
}
