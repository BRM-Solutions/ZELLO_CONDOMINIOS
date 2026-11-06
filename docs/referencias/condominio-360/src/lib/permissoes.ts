import { createMiniStore } from "@/lib/mini-store";

export const ACOES = ["Visualizar", "Criar", "Editar", "Excluir", "Aprovar", "Publicar", "Exportar"] as const;
export type Acao = (typeof ACOES)[number];

export const MODULOS: { nome: string; acoes: Acao[] }[] = [
  { nome: "Feedback do Portal", acoes: ["Visualizar", "Criar"] },
  { nome: "Painel", acoes: ["Visualizar"] },
  { nome: "Financeiro", acoes: ["Visualizar", "Criar", "Editar", "Aprovar", "Exportar"] },
  { nome: "Notas Fiscais e Recibos", acoes: ["Visualizar", "Criar", "Editar", "Exportar"] },
  { nome: "Conferência Mensal", acoes: ["Visualizar", "Editar", "Aprovar", "Exportar"] },
  { nome: "Moradores", acoes: ["Visualizar", "Criar", "Editar", "Excluir", "Exportar"] },
  { nome: "Unidades", acoes: ["Visualizar", "Criar", "Editar"] },
  { nome: "Ocorrências", acoes: ["Visualizar", "Criar", "Editar", "Excluir"] },
  { nome: "Manutenções", acoes: ["Visualizar", "Criar", "Editar", "Excluir"] },
  { nome: "Ordens de Serviço", acoes: ["Visualizar", "Criar", "Editar", "Aprovar"] },
  { nome: "Obras e Instalações", acoes: ["Visualizar", "Criar", "Editar"] },
  { nome: "Riscos e Pendências", acoes: ["Visualizar"] },
  { nome: "Orçamentos e Propostas", acoes: ["Visualizar", "Criar", "Aprovar"] },
  { nome: "Fluxo de Aprovações", acoes: ["Visualizar", "Criar"] },
  { nome: "Configuração e Importação", acoes: ["Visualizar", "Criar"] },
  { nome: "Minha Rotina", acoes: ["Visualizar", "Editar"] },
  { nome: "Equipe e Escalas", acoes: ["Visualizar", "Criar", "Editar", "Publicar"] },
  { nome: "Fornecedores", acoes: ["Visualizar", "Criar", "Editar", "Excluir"] },
  { nome: "Contratos", acoes: ["Visualizar", "Criar", "Editar", "Exportar"] },
  { nome: "Reservas", acoes: ["Visualizar", "Criar", "Aprovar"] },
  { nome: "Avisos à Comunidade", acoes: ["Visualizar", "Criar", "Editar", "Excluir", "Publicar"] },
  { nome: "Calendário", acoes: ["Visualizar", "Criar", "Editar"] },
  { nome: "Central de Documentos", acoes: ["Visualizar", "Criar", "Editar", "Excluir", "Publicar"] },
  { nome: "Relatórios", acoes: ["Visualizar", "Exportar"] },
  { nome: "Assistente de IA", acoes: ["Visualizar"] },
  { nome: "Configurações", acoes: ["Visualizar", "Editar"] },
  { nome: "Perfis e Permissões", acoes: ["Visualizar", "Editar"] },
];

/** Módulos/ações estruturais que só o SuperAdministrador pode delegar. */
export const ESTRUTURAIS = new Set(["Perfis e Permissões:Editar"]);

export type Perfil = { id: string; nome: string; descricao: string; tipo: "Padrão" | "Personalizado"; ativo: boolean; perms: string[] };
export const chave = (m: string, a: Acao) => `${m}:${a}`;

const tudo = MODULOS.flatMap((m) => m.acoes.map((a) => chave(m.nome, a)));
const ver = MODULOS.map((m) => chave(m.nome, "Visualizar"));

/** Permissões são negadas por padrão: só vale o que estiver na lista. */
export const temPermissao = (p: Pick<Perfil, "perms">, m: string, a: Acao) => p.perms.includes(chave(m, a));

/** Quem configura só pode conceder o que ele próprio tem — e nunca permissões estruturais, salvo o SuperAdministrador. */
export function podeConceder(configurador: Pick<Perfil, "perms">, k: string, superadmin = false) {
  if (superadmin) return true;
  return !ESTRUTURAIS.has(k) && configurador.perms.includes(k);
}

/** Síndico(a) não pode se desativar quando é o único síndico ativo. */
export const podeDesativarSindico = (sindicosAtivos: number, eleProprio: boolean) => !(eleProprio && sindicosAtivos <= 1);

export const NOMES_PROIBIDOS = ["superadministrador", "superadmin"];

export type Auditoria = { data: string; responsavel: string; afetado: string; tipo: string; anterior: string; novo: string; resultado: string };

export const permStore = createMiniStore({
  perfis: [
    { id: "sindico", nome: "Síndico(a)", descricao: "Administração do condomínio", tipo: "Padrão", ativo: true, perms: tudo.filter((k) => !ESTRUTURAIS.has(k)).concat("Perfis e Permissões:Editar") },
    { id: "admin", nome: "Administração", descricao: "Acesso operacional conforme delegação", tipo: "Padrão", ativo: true, perms: [...ver.filter((k) => !k.startsWith("Perfis")), "Financeiro:Criar", "Financeiro:Editar", "Notas Fiscais e Recibos:Criar", "Notas Fiscais e Recibos:Editar", "Conferência Mensal:Editar", "Ocorrências:Editar", "Manutenções:Criar", "Manutenções:Editar", "Reservas:Aprovar", "Moradores:Editar", "Relatórios:Exportar", "Feedback do Portal:Criar", "Central de Documentos:Criar", "Central de Documentos:Editar"] },
    { id: "conselho", nome: "Conselho", descricao: "Acesso consultivo e fiscalizatório", tipo: "Padrão", ativo: true, perms: [...ver.filter((k) => !k.startsWith("Perfis") && !k.startsWith("Configurações") && !k.startsWith("Minha Rotina")), "Fluxo de Aprovações:Criar"] },
    { id: "zelador", nome: "Zelador", descricao: "Executa e registra pela Minha Rotina", tipo: "Padrão", ativo: true, perms: ["Minha Rotina:Visualizar", "Minha Rotina:Editar", "Ocorrências:Criar"] },
    { id: "morador", nome: "Morador", descricao: "Proprietários, inquilinos e residentes", tipo: "Padrão", ativo: true, perms: ["Painel:Visualizar", "Ocorrências:Visualizar", "Ocorrências:Criar", "Reservas:Visualizar", "Reservas:Criar", "Avisos à Comunidade:Visualizar", "Calendário:Visualizar", "Central de Documentos:Visualizar", "Feedback do Portal:Criar"] },
  ] as Perfil[],
  auditoria: [
    { data: "01/11/2026 10:20", responsavel: "Elton Grativol", afetado: "Administração", tipo: "Permissão concedida", anterior: "—", novo: "Reservas: Aprovar", resultado: "Concluído" },
  ] as Auditoria[],
});
