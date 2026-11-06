import { describe, expect, it } from "vitest";
import {
  can,
  createFileInputSchema,
  fileClassificationSchema,
  fileSchema,
  fileStatusSchema,
  rolesFor,
  sanitizeFileName,
} from "./index";

const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";

describe("file schemas", () => {
  it("accepts the four classifications and four statuses only", () => {
    for (const value of ["public", "internal", "confidential", "personal"]) {
      expect(fileClassificationSchema.safeParse(value).success).toBe(true);
    }
    expect(fileClassificationSchema.safeParse("secret").success).toBe(false);
    for (const value of ["pending", "available", "quarantined", "deleted"]) {
      expect(fileStatusSchema.safeParse(value).success).toBe(true);
    }
    expect(fileStatusSchema.safeParse("archived").success).toBe(false);
  });

  it("validates and normalizes the create input", () => {
    const parsed = createFileInputSchema.parse({
      workspaceId: WORKSPACE_ID,
      originalName: "  Contrato.PDF ",
      mimeType: "Application/PDF",
      sizeBytes: 1024,
      classification: "confidential",
    });
    expect(parsed.originalName).toBe("Contrato.PDF");
    expect(parsed.mimeType).toBe("application/pdf");
    expect(createFileInputSchema.safeParse({ ...parsed, workspaceId: undefined }).success).toBe(true);
    expect(createFileInputSchema.safeParse({ ...parsed, workspaceId: null }).success).toBe(true);
  });

  it("rejects invalid create inputs", () => {
    const valid = { originalName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10, classification: "internal" };
    expect(createFileInputSchema.safeParse(valid).success).toBe(true);
    for (const patch of [
      { sizeBytes: 0 },
      { sizeBytes: 1.5 },
      { sizeBytes: -1 },
      { mimeType: "pdf" },
      { mimeType: "text/html; charset=utf-8" },
      { originalName: "" },
      { originalName: "a".repeat(256) },
      { classification: "secret" },
      { workspaceId: "not-a-uuid" },
    ]) {
      expect(createFileInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
  });

  it("parses a file record", () => {
    const file = {
      id: WORKSPACE_ID,
      organizationId: WORKSPACE_ID,
      workspaceId: null,
      originalName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      sha256: null,
      classification: "internal",
      status: "pending",
      retentionUntil: null,
      legalHold: false,
      uploadedBy: WORKSPACE_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    expect(fileSchema.safeParse(file).success).toBe(true);
    expect(fileSchema.safeParse({ ...file, status: "gone" }).success).toBe(false);
  });
});

describe("file permissions", () => {
  it("lets every member read, writers upload and managers delete", () => {
    expect(rolesFor("files:read")).toEqual(["owner", "admin", "council", "manager", "staff", "member"]);
    expect(rolesFor("files:write")).toEqual(["owner", "admin", "manager", "staff"]);
    expect(rolesFor("files:delete")).toEqual(["owner", "admin", "manager"]);
    expect(can("member", "files:read")).toBe(true);
    expect(can("member", "files:write")).toBe(false);
    expect(can("staff", "files:write")).toBe(true);
    expect(can("staff", "files:delete")).toBe(false);
    expect(can("manager", "files:delete")).toBe(true);
    expect(can(undefined, "files:read")).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("keeps safe names and strips accents and spaces", () => {
    expect(sanitizeFileName("relatorio.pdf")).toBe("relatorio.pdf");
    expect(sanitizeFileName("Relatório Final (v2).PDF")).toBe("Relatorio-Final-v2.PDF");
  });

  it("removes path segments and traversal", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\tmp\\evil.exe")).toBe("evil.exe");
    expect(sanitizeFileName("..")).toBe("file");
    expect(sanitizeFileName("a/..")).toBe("file");
    expect(sanitizeFileName("...hidden")).toBe("file.hidden");
    expect(sanitizeFileName(".bashrc")).toBe("bashrc");
  });

  it("never returns an empty or slash-bearing name and bounds the length", () => {
    expect(sanitizeFileName("???")).toBe("file");
    expect(sanitizeFileName("日本語.pdf")).toBe("file.pdf");
    expect(sanitizeFileName(".pdf")).toBe("pdf");
    const long = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith(".pdf")).toBe(true);
    expect(long).not.toContain("/");
  });
});
