export type Anexo = { id: string; nome: string; tipo: string; tamanho: number; url: string; descricao: string; enviadoEm: string; enviadoPor: string; fase?: string };

export const EXT_OCORRENCIA = ["png", "jpg", "jpeg", "webp", "mp4", "mov", "webm", "pdf", "doc", "docx"];
export const EXT_COMPROVANTE = ["pdf", "png", "jpg", "jpeg"];
export const MAX_ANEXO_MB = 20;

export function validarAnexo(nome: string, bytes: number, permitidas = EXT_OCORRENCIA): string | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (!permitidas.includes(ext)) return `"${nome}": formato não aceito. Use ${permitidas.map((e) => e.toUpperCase()).join(", ")}.`;
  if (bytes === 0) return `"${nome}": arquivo vazio.`;
  if (bytes > MAX_ANEXO_MB * 1024 * 1024) return `"${nome}": maior que ${MAX_ANEXO_MB} MB.`;
  return null;
}

export const tipoAnexo = (nome: string) => {
  const e = nome.toLowerCase().split(".").pop() ?? "";
  return ["png", "jpg", "jpeg", "webp"].includes(e) ? "Imagem" : ["mp4", "mov", "webm"].includes(e) ? "Vídeo" : "Documento";
};
export const fmtTamanho = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function criarAnexo(f: File, enviadoPor: string, descricao = "", fase?: string): Anexo {
  return { id: crypto.randomUUID(), nome: f.name, tipo: tipoAnexo(f.name), tamanho: f.size, url: URL.createObjectURL(f), descricao, enviadoEm: new Date().toISOString(), enviadoPor, ...(fase ? { fase } : {}) };
}
