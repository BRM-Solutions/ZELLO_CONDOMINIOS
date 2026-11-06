import { createMiniStore } from "@/lib/mini-store";
import type { Role } from "@/lib/store";

export const EXT_DOCUMENTO = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png"];
export const CATEGORIAS_PADRAO = ["Convenção Condominial", "Regulamento Interno", "Atas de Assembleias", "Contratos de Fornecedores", "Documentos Financeiros", "Balancetes", "Notas Fiscais e Recibos", "Laudos e Inspeções", "Manutenções", "Seguros", "Certificados e Licenças", "Documentos Administrativos", "Outros"];
export const CONFIDENCIALIDADE = ["Público", "Interno", "Restrito"] as const;
export const VINCULOS = ["Fornecedor", "Contrato", "Ocorrência", "Manutenção", "Obra", "Registro financeiro"];
/** Fase 1: não há leitura automática; todo arquivo fica aguardando processamento. */
export const STATUS_INICIAL = "Aguardando processamento";

export type Versao = { versao: number; nome: string; tamanho: number; url: string; enviadoEm: string; enviadoPor: string };
export type Documento = {
  id: string; codigo: string; nome: string; categoria: string; descricao: string; condominio: string;
  dataDocumento: string; enviadoEm: string; enviadoPor: string; vigenciaInicio?: string; vigenciaFim?: string;
  versao: number; status: string; confidencialidade: (typeof CONFIDENCIALIDADE)[number]; perfis: Role[];
  tamanho: number; url: string; tipoArquivo: string; arquivado: boolean; historico: Versao[]; vinculo?: string | undefined;
};

/** Morador só vê documentos públicos; demais perfis veem o que estiver liberado para eles. */
export function podeVerDocumento(d: Pick<Documento, "confidencialidade" | "perfis">, role: Role) {
  if (role === "superadmin") return false;
  if (role === "morador") return d.confidencialidade === "Público";
  return role === "sindico" || d.perfis.includes(role);
}

export const ehDuplicado = (lista: Pick<Documento, "nome" | "tamanho">[], nome: string, tamanho: number) =>
  lista.some((d) => d.nome.toLowerCase() === nome.toLowerCase() && d.tamanho === tamanho);

/** Nova versão substitui o arquivo atual e guarda o anterior no histórico. */
export function novaVersao(d: Documento, arq: { nome: string; tamanho: number; url: string }, por: string): Documento {
  const atual: Versao = { versao: d.versao, nome: d.nome, tamanho: d.tamanho, url: d.url, enviadoEm: d.enviadoEm, enviadoPor: d.enviadoPor };
  return { ...d, nome: arq.nome, tamanho: arq.tamanho, url: arq.url, versao: d.versao + 1, enviadoEm: new Date().toISOString(), enviadoPor: por, status: STATUS_INICIAL, historico: [...d.historico, atual] };
}

export const proximoCodigo = (lista: { codigo: string }[]) => `DOC-${String(lista.length + 1).padStart(4, "0")}`;

const base = (p: Partial<Documento> & Pick<Documento, "id" | "codigo" | "nome" | "categoria">): Documento => ({
  descricao: "", condominio: "Condomínio Vila Gaudí", dataDocumento: "2026-03-15", enviadoEm: "2026-10-01T10:00:00", enviadoPor: "Elton Grativol",
  versao: 1, status: STATUS_INICIAL, confidencialidade: "Interno", perfis: ["sindico", "admin", "conselho"], tamanho: 500_000, url: "#", tipoArquivo: "PDF", arquivado: false, historico: [], ...p,
});

export const docStore = createMiniStore({
  categorias: CATEGORIAS_PADRAO,
  lista: [
    base({ id: "d1", codigo: "DOC-0001", nome: "Convenção do condomínio.pdf", categoria: "Convenção Condominial", confidencialidade: "Público", perfis: ["sindico", "admin", "conselho", "morador"], tamanho: 2_100_000 }),
    base({ id: "d2", codigo: "DOC-0002", nome: "Ata da assembleia - Março 2026.pdf", categoria: "Atas de Assembleias", confidencialidade: "Público", perfis: ["sindico", "admin", "conselho", "morador"], tamanho: 480_000 }),
    base({ id: "d3", codigo: "DOC-0003", nome: "Contrato limpeza 2026.pdf", categoria: "Contratos de Fornecedores", vigenciaInicio: "2026-01-01", vigenciaFim: "2026-12-31", confidencialidade: "Restrito", perfis: ["sindico", "admin"], vinculo: "Contrato" }),
  ] as Documento[],
});
