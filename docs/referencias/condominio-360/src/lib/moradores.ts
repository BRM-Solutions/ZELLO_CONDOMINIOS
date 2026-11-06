import { createMiniStore } from "@/lib/mini-store";

export type Vinculo = "Proprietário" | "Inquilino" | "Morador" | "Outros";
export type Situacao = "Ativo" | "Inativo" | "Pendente de confirmação";
export type Unidade = { bloco: string; apto: string; vinculo: Vinculo };
export type Pessoa = {
  id: string; nome: string; email: string; telefone: string; whatsapp?: string; foto?: string;
  situacao: Situacao; unidades: Unidade[];
  acesso: { perfil: string; status: "Ativo" | "Suspenso" | "Convidado"; ultimoAcesso?: string | undefined };
  historico: { data: string; texto: string }[];
};

export const VINCULOS: Vinculo[] = ["Proprietário", "Inquilino", "Morador", "Outros"];
export const SITUACOES: Situacao[] = ["Ativo", "Inativo", "Pendente de confirmação"];
export const BLOCOS = ["Bloco 1", "Bloco 2", "Bloco 3"];

export const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export type Filtros = { nome: string; email: string; bloco: string; apto: string; vinculo: string; situacao: string; ordem: "az" | "za" };
export const FILTROS_VAZIOS: Filtros = { nome: "", email: "", bloco: "", apto: "", vinculo: "", situacao: "", ordem: "az" };

export function filtrar(ps: Pessoa[], f: Filtros) {
  const n = semAcento(f.nome);
  return ps
    .filter((p) => !n || semAcento(p.nome).includes(n))
    .filter((p) => !f.email || p.email.toLowerCase().includes(f.email.toLowerCase().trim()))
    .filter((p) => !f.situacao || p.situacao === f.situacao)
    .filter((p) => p.unidades.some((u) => (!f.bloco || u.bloco === f.bloco) && (!f.apto || u.apto.includes(f.apto.trim())) && (!f.vinculo || u.vinculo === f.vinculo)))
    .sort((a, b) => (f.ordem === "az" ? 1 : -1) * a.nome.localeCompare(b.nome, "pt-BR"));
}

const p = (id: string, nome: string, bloco: string, apto: string, vinculo: Vinculo, situacao: Situacao, perfil = "Morador"): Pessoa => ({
  id, nome, email: `${semAcento(nome).split(" ")[0]}@exemplo.com`, telefone: "(21) 90000-0000", situacao,
  unidades: [{ bloco, apto, vinculo }], acesso: { perfil, status: situacao === "Inativo" ? "Suspenso" : situacao === "Ativo" ? "Ativo" : "Convidado", ultimoAcesso: situacao === "Ativo" ? "02/11/2026" : undefined },
  historico: [{ data: "01/10/2026", texto: "Cadastro criado" }],
});

export const moradoresStore = createMiniStore<Pessoa[]>([
  { ...p("m1", "Ana Souza", "Bloco 1", "1201", "Proprietário", "Ativo"), unidades: [{ bloco: "Bloco 1", apto: "1201", vinculo: "Proprietário" }, { bloco: "Bloco 2", apto: "2102", vinculo: "Proprietário" }] },
  p("m2", "Carlos Lima", "Bloco 2", "2304", "Inquilino", "Ativo"),
  p("m3", "Beatriz Melo", "Bloco 3", "3102", "Proprietário", "Pendente de confirmação"),
  p("m4", "Joana Ávila", "Bloco 3", "102", "Proprietário", "Ativo"),
  p("m5", "Márcio Távora", "Bloco 1", "101", "Morador", "Inativo"),
  p("m6", "Elton Grativol", "Bloco 2", "2001", "Proprietário", "Ativo", "Síndico(a)"),
  p("m7", "Paula Reis", "Bloco 1", "—", "Outros", "Ativo", "Administração"),
  p("m8", "Roberto Nunes", "Bloco 3", "3304", "Proprietário", "Ativo", "Conselho"),
]);
