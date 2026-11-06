import { TENANTS, type Tenant } from "@/lib/brand";
import { toISO } from "@/lib/reservas";
import type { Ocorrencia } from "@/lib/ocorrencias";
import { numerarEmOrdem, proximoProtocolo, type ProtocoloPrefs } from "@/lib/protocolo";
import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "superadmin" | "sindico" | "admin" | "conselho" | "zelador" | "morador";
export const isGestao = (r: Role) => r === "sindico" || r === "admin" || r === "conselho";
export type CanalStatus = "entregue" | "enviado" | "aguardando integração" | "desativado";

export type AnexoTipo = "pdf" | "imagem" | "ppt" | "video" | "link";
export type Anexo = { tipo: AnexoTipo; nome: string; url: string };
export type Comunicado = { id: string; titulo: string; corpo: string; data: string; autor: string; lido: boolean; prioridade?: "alta" | "normal"; anexos?: Anexo[] };
/** Somente Síndico(a) e SuperAdministrador criam, editam e excluem avisos. */
export const podeEditarAvisos = (r: Role) => r === "sindico" || r === "superadmin";
export type Reserva = { id: string; area: string; data: string; inicio: string; fim: string; morador: string; apto: string; status: "Pendente" | "Aprovada" | "Recusada" | "Cancelada" };
export type Notificacao = {
  id: string; titulo: string; detalhe: string; data: string; lida: boolean;
  canais: { portal: CanalStatus; email: CanalStatus; whatsapp: CanalStatus };
};
export type Settings = { portal: boolean; email: boolean; whatsapp: boolean; emailDestino: string; whatsappDestino: string };

const dIso = (offset: number, h = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, 0, 0, 0); return d; };
const dia = (offset: number) => toISO(dIso(offset));

const now = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

type Store = {
  role: Role; setRole: (r: Role) => void;
  tenant: Tenant; tenants: Tenant[]; setTenants: (t: Tenant[]) => void;
  user: { nome: string; cargo: string; apto?: string };
  comunicados: Comunicado[]; marcarLido: (id: string) => void; marcarTodosLidos: () => void;
  publicarComunicado: (c: Pick<Comunicado, "titulo" | "corpo" | "prioridade" | "anexos">) => void;
  editarComunicado: (id: string, c: Partial<Comunicado>) => void; excluirComunicado: (id: string) => void;
  reservas: Reserva[]; criarReserva: (r: Omit<Reserva, "id" | "status">) => void; alterarReserva: (id: string, patch: Partial<Reserva>) => void;
  notificacoes: Notificacao[]; marcarNotifLida: (id: string) => void; marcarTodasNotif: () => void;
  ocorrencias: Ocorrencia[]; criarOcorrencia: (o: Pick<Ocorrencia, "titulo" | "categoria" | "descricao" | "anexos">) => string; alterarOcorrencia: (id: string, status: Ocorrencia["status"], extra?: Partial<Pick<Ocorrencia, "prioridade" | "solucao">>) => void;
  anexarOcorrencia: (id: string, anexos: NonNullable<Ocorrencia["anexos"]>) => void;
  settings: Settings; setSettings: (s: Settings) => void;
  protocoloPrefs: ProtocoloPrefs; setProtocoloPrefs: (p: ProtocoloPrefs) => void;
  unread: number;
};

export const USERS: Record<Role, { nome: string; cargo: string; apto?: string; email: string }> = {
  superadmin: { nome: "Equipe ZELLO", cargo: "SuperAdministrador", email: "super@demo.zello.com.br" },
  zelador: { nome: "José Carlos", cargo: "Zelador", email: "zelador@demo.gaudi360.com.br" },
  sindico: { nome: "Elton Grativol", cargo: "Síndico(a)", email: "sindico@demo.gaudi360.com.br" },
  admin: { nome: "Paula Reis", cargo: "Administração", email: "adm@demo.gaudi360.com.br" },
  conselho: { nome: "Roberto Nunes", cargo: "Administração e Conselho", email: "conselho@demo.gaudi360.com.br" },
  morador: { nome: "Ana Souza", cargo: "Moradores", apto: "Bl 1 • 1.201", email: "morador@demo.gaudi360.com.br" },
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("sindico");
  const [tenants, setTenants] = useState<Tenant[]>(TENANTS);
  const [comunicados, setComunicados] = useState<Comunicado[]>([
    { id: "c1", titulo: "Manutenção das bombas de água", corpo: "No dia 05/09, das 08h às 12h, o abastecimento poderá ser interrompido nos blocos 1 e 2.", data: "03/09/2026", autor: "Elton Grativol • Síndico", lido: false, prioridade: "alta" },
    { id: "c2", titulo: "Assembleia geral ordinária", corpo: "Convocamos todos os condôminos para a assembleia em 20/09 às 19h no Salão de Festas. Leia o edital oficial de convocação.", data: "01/09/2026", autor: "Elton Grativol • Síndico", lido: false, anexos: [{ tipo: "link", nome: "Edital de convocação da Assembleia Geral (exemplo)", url: "https://example.com/edital-assembleia.pdf" }] },
    { id: "c3", titulo: "Novo horário da piscina", corpo: "A partir de setembro a piscina funciona das 7h às 22h.", data: "25/08/2026", autor: "Administração", lido: true },
  ]);
  const [reservas, setReservas] = useState<Reserva[]>([
    { id: "r1", area: "Salão de Festas", data: dia(4), inicio: "14:00", fim: "22:00", morador: "Ana Souza", apto: "Bl 1 • 1.201", status: "Aprovada" },
    { id: "r2", area: "Churrasqueira da Piscina", data: dia(5), inicio: "12:00", fim: "18:00", morador: "Carlos Lima", apto: "Bl 2 • 2.304", status: "Pendente" },
    { id: "r4", area: "Churrasqueira da Piscina", data: dia(12), inicio: "12:00", fim: "17:00", morador: "Ana Souza", apto: "Bl 1 • 1.201", status: "Pendente" },
    { id: "r3", area: "Sala de Relaxamento", data: dia(7), inicio: "18:00", fim: "20:00", morador: "Beatriz Melo", apto: "Bl 3 • 3.102", status: "Pendente" },
  ]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([
    { id: "n1", titulo: "Nova reserva: Churrasqueira da Piscina", detalhe: "Carlos Lima (Bl 2 • 2.304) — 07/09 12:00–18:00", data: "02/09/2026 10:12", lida: false, canais: { portal: "entregue", email: "aguardando integração", whatsapp: "aguardando integração" } },
  ]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(() => numerarEmOrdem([
    { id: "o1", titulo: "Portão da garagem - Bloco 1", categoria: "Manutenção", descricao: "Portão travando ao fechar.", status: "Em andamento", autor: "Ana Souza", apto: "Bl 1 • 1.201", criadaEm: dIso(0, 9).toISOString() },
    { id: "o2", titulo: "Iluminação da quadra", categoria: "Manutenção", descricao: "Duas lâmpadas queimadas.", status: "Aberta", autor: "Carlos Lima", apto: "Bl 2 • 2.304", criadaEm: dIso(-1, 16).toISOString() },
    { id: "o3", titulo: "Limpeza da área externa", categoria: "Reclamação", descricao: "Folhas acumuladas perto da piscina.", status: "Concluída", autor: "Beatriz Melo", apto: "Bl 3 • 3.102", criadaEm: dIso(-1, 8).toISOString(), concluidaEm: dIso(0, 11).toISOString() },
    { id: "o4", titulo: "Parabéns à equipe da portaria", categoria: "Elogio", descricao: "Atendimento excelente.", status: "Concluída", autor: "Ana Souza", apto: "Bl 1 • 1.201", criadaEm: dIso(-40, 10).toISOString(), concluidaEm: dIso(-39, 15).toISOString() },
    { id: "o5", titulo: "Bicicletário coberto", categoria: "Sugestões", descricao: "Sugestão de cobertura no bicicletário.", status: "Aberta", autor: "Carlos Lima", apto: "Bl 2 • 2.304", criadaEm: dIso(-45, 19).toISOString() },
  ]));
  const [protocoloPrefs, setProtocoloPrefs] = useState<ProtocoloPrefs>({ portal: true, email: false, whatsapp: false, emailDestino: "", whatsappDestino: "" });
  const [settings, setSettings] = useState<Settings>({ portal: true, email: true, whatsapp: true, emailDestino: "sindico@vilagaudi.com.br", whatsappDestino: "+55 21 99999-0000" });

  const notificarSindico = (titulo: string, detalhe: string) => {
    const st = (on: boolean, ok: CanalStatus): CanalStatus => (on ? ok : "desativado");
    setNotificacoes((n) => [{
      id: crypto.randomUUID(), titulo, detalhe, data: now(), lida: false,
      canais: { portal: st(settings.portal, "entregue"), email: st(settings.email, "aguardando integração"), whatsapp: st(settings.whatsapp, "aguardando integração") },
    }, ...n]);
  };

  const fmt = (r: Pick<Reserva, "morador" | "apto" | "data" | "inicio" | "fim">) =>
    `${r.morador} (${r.apto}) — ${r.data.split("-").reverse().slice(0, 2).join("/")} ${r.inicio}–${r.fim}`;

  const store: Store = {
    role, setRole, tenants, setTenants, tenant: tenants[0]!,
    user: USERS[role],
    comunicados,
    marcarLido: (id) => setComunicados((c) => c.map((x) => (x.id === id ? { ...x, lido: true } : x))),
    marcarTodosLidos: () => setComunicados((c) => c.map((x) => ({ ...x, lido: true }))),
    publicarComunicado: (c) => setComunicados((all) => [{ ...c, id: crypto.randomUUID(), data: new Date().toLocaleDateString("pt-BR"), autor: "Elton Grativol • Síndico", lido: false }, ...all]),
    editarComunicado: (id, c) => setComunicados((all) => all.map((x) => (x.id === id ? { ...x, ...c } : x))),
    excluirComunicado: (id) => setComunicados((all) => all.filter((x) => x.id !== id)),
    reservas,
    criarReserva: (r) => {
      setReservas((all) => [{ ...r, id: crypto.randomUUID(), status: "Pendente" }, ...all]);
      notificarSindico(`Nova reserva: ${r.area}`, fmt(r));
    },
    alterarReserva: (id, patch) => {
      const old = reservas.find((x) => x.id === id);
      if (!old) return;
      const next = { ...old, ...patch };
      setReservas((all) => all.map((x) => (x.id === id ? next : x)));
      notificarSindico(`Reserva alterada: ${next.area}${patch.status ? ` — ${patch.status}` : ""}`, fmt(next));
    },
    notificacoes,
    marcarNotifLida: (id) => setNotificacoes((n) => n.map((x) => (x.id === id ? { ...x, lida: true } : x))),
    marcarTodasNotif: () => setNotificacoes((n) => n.map((x) => ({ ...x, lida: true }))),
    ocorrencias,
    criarOcorrencia: (o) => {
      const protocolo = proximoProtocolo(ocorrencias.map((x) => x.protocolo), new Date().getFullYear());
      setOcorrencias((all) => [{ ...o, id: crypto.randomUUID(), protocolo, status: "Aberta", autor: USERS[role].nome, apto: USERS[role].apto ?? "Administração", criadaEm: new Date().toISOString() }, ...all]);
      const pf = protocoloPrefs; const st = (on: boolean, ok: CanalStatus): CanalStatus => (on ? ok : "desativado");
      setNotificacoes((n) => [{ id: crypto.randomUUID(), titulo: `Protocolo ${protocolo}: ${o.titulo}`, detalhe: `Sua ocorrência foi registrada com o protocolo ${protocolo}.`, data: now(), lida: false,
        canais: { portal: st(pf.portal, "entregue"), email: st(pf.email, "aguardando integração"), whatsapp: st(pf.whatsapp, "aguardando integração") } }, ...n]);
      return protocolo;
    },
    alterarOcorrencia: (id, status, extra) => {
      const o = ocorrencias.find((x) => x.id === id);
      setOcorrencias((all) => all.map((x) => (x.id === id ? { ...x, ...extra, status, concluidaEm: status === "Concluída" ? new Date().toISOString() : undefined } : x)));
      if (o && status === "Concluída") {
        const pf = protocoloPrefs; const st = (on: boolean, ok: CanalStatus): CanalStatus => (on ? ok : "desativado");
        setNotificacoes((n) => [{ id: crypto.randomUUID(), titulo: `Protocolo ${o.protocolo}: concluída`, detalhe: `${o.titulo} — Solução: ${extra?.solucao || o.solucao || "não informada"}. Aviso para ${o.autor}.`, data: now(), lida: false,
          canais: { portal: st(pf.portal, "entregue"), email: st(pf.email, "aguardando integração"), whatsapp: st(pf.whatsapp, "aguardando integração") } }, ...n]);
      }
    },
    anexarOcorrencia: (id, anexos) => setOcorrencias((all) => all.map((x) => (x.id === id ? { ...x, anexos: [...(x.anexos ?? []), ...anexos] } : x))),
    settings, setSettings, protocoloPrefs, setProtocoloPrefs,
    unread: role === "morador" ? comunicados.filter((c) => !c.lido).length : notificacoes.filter((n) => !n.lida).length,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}

export const pageHead = (title: string, description: string, brand = "Gaudí 360°") => () => ({
  meta: [
    { title: `${title} • ${brand}` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} • ${brand}` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
