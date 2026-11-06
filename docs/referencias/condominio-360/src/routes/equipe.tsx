import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, List, CalendarDays, History, Plus, Pencil, Power, CheckCircle2, Clock, Moon, AlertTriangle, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, useStore } from "@/lib/store";
import { DIAS, SITUACAO, avisoModelo, equipeStore, situacaoDoDia, type Alteracao, type Situacao, type TipoAlteracao } from "@/lib/equipe";
import { toISO } from "@/lib/reservas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/equipe")({
  head: pageHead("Equipe e Escalas", "Organize os horários, acompanhe as escalas e informe alterações à comunidade."),
  component: Equipe,
});

const SIT_ICON: Record<Situacao, typeof Clock> = { regular: CheckCircle2, alterado: Clock, folga: Moon, descoberto: AlertTriangle };
const SIT_BG: Record<Situacao, string> = { regular: "bg-success-soft text-primary", alterado: "bg-warning-soft text-accent", folga: "bg-muted text-muted-foreground", descoberto: "bg-destructive-soft text-destructive" };
const TIPOS: TipoAlteracao[] = ["Folga", "Férias", "Ausência", "Substituição", "Horário temporário", "Observação"];
const br = (iso: string) => iso.split("-").reverse().join("/");

function SitBadge({ s }: { s: Situacao }) {
  const I = SIT_ICON[s];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium", SIT_BG[s])}><I className="h-3.5 w-3.5" />{SITUACAO[s].label}</span>;
}

function Equipe() {
  const { role, user, publicarComunicado } = useStore();
  const st = equipeStore.use();
  const pode = role === "sindico";
  const [aba, setAba] = useState<"lista" | "calendario" | "historico" | "categorias">("lista");
  const [alt, setAlt] = useState<Omit<Alteracao, "id" | "registradoEm" | "responsavel" | "publicada"> | null>(null);
  const [pergunta, setPergunta] = useState<Alteracao | null>(null);
  const [previa, setPrevia] = useState<{ a: Alteracao; titulo: string; corpo: string } | null>(null);
  const [pessoa, setPessoa] = useState<{ id?: string; nome: string; categoriaId: string; funcao: string; horario: string; dias: string[] } | null>(null);
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const hoje = toISO(new Date());

  if (role === "superadmin") return <AppShell><PageTitle title="Equipe e Escalas" /><Card>O SuperAdministrador não tem acesso aos dados internos da equipe do condomínio.</Card></AppShell>;

  const nomeCat = (id: string) => st.categorias.find((c) => c.id === id)?.nome ?? "—";
  const integ = (id: string) => st.integrantes.find((i) => i.id === id)!;

  const salvarAlt = () => {
    if (!alt) return;
    if (!alt.integranteId || !alt.data) { toast.error("Informe o profissional e a data."); return; }
    const a: Alteracao = { ...alt, id: crypto.randomUUID(), registradoEm: new Date().toISOString(), responsavel: user.nome, publicada: false };
    setAlt(null); setPergunta(a);
  };
  const gravar = (a: Alteracao) => equipeStore.set((s) => ({ ...s, alteracoes: [a, ...s.alteracoes] }));

  const tabs = [["lista", "Lista", List], ["calendario", "Calendário", CalendarDays], ["historico", "Histórico", History], ["categorias", "Categorias", Users]] as const;
  const cells = [...Array(mes.getDay()).fill(null), ...Array.from({ length: new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate() }, (_, i) => toISO(new Date(mes.getFullYear(), mes.getMonth(), i + 1)))] as (string | null)[];

  return (
    <AppShell>
      <PageTitle title="Equipe e Escalas" subtitle="Organize os horários, acompanhe as escalas e informe alterações à comunidade."
        action={pode && <div className="flex flex-wrap gap-2"><Button variant="outline" size="lg" onClick={() => setPessoa({ nome: "", categoriaId: st.categorias[0]!.id, funcao: "", horario: "08:00–17:00", dias: ["seg", "ter", "qua", "qui", "sex"] })}><Plus className="h-5 w-5" />Integrante</Button><Button size="lg" onClick={() => setAlt({ integranteId: st.integrantes[0]?.id ?? "", tipo: "Folga", data: hoje, motivo: "", novoHorario: "", coberto: false })}><CalendarClock className="h-5 w-5" />Registrar alteração</Button></div>} />
      {!pode && <p className="mb-4 rounded-xl bg-muted p-3 text-sm">Acesso de consulta. Somente o(a) Síndico(a) altera e publica escalas.</p>}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {tabs.map(([k, l, I]) => <Button key={k} role="tab" aria-selected={aba === k} variant={aba === k ? "primary" : "outline"} size="lg" onClick={() => setAba(k)}><I className="h-5 w-5" />{l}</Button>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">{(Object.keys(SITUACAO) as Situacao[]).map((s) => <SitBadge key={s} s={s} />)}</div>

      {aba === "lista" && (
        <div className="grid gap-3 md:grid-cols-2">
          {st.integrantes.filter((i) => i.ativo).map((i) => {
            const s = situacaoDoDia(i, hoje, st.alteracoes) ?? "folga";
            return (
              <Card key={i.id}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-lg font-semibold">{i.nome}</p><p className="text-sm text-muted-foreground">{nomeCat(i.categoriaId)} • {i.funcao}</p>
                    <p className="mt-1">Horário: <b>{i.horario}</b></p><p className="text-sm text-muted-foreground">Dias: {i.dias.join(", ")}</p></div>
                  <div className="flex flex-col items-end gap-2"><span className="text-xs text-muted-foreground">Hoje</span><SitBadge s={s} />
                    {pode && <Button size="sm" variant="outline" onClick={() => setPessoa({ ...i })}><Pencil className="h-4 w-4" />Editar</Button>}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === "calendario" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <Button variant="outline" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft className="h-5 w-5" /></Button>
            <p className="text-lg font-semibold capitalize">{mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
            <Button variant="outline" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight className="h-5 w-5" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DIAS.map((d) => <span key={d} className="py-1 text-center text-sm font-medium uppercase text-muted-foreground">{d}</span>)}
            {cells.map((iso, k) => iso ? (
              <div key={iso} className={cn("min-h-24 rounded-lg border p-1 text-xs", iso === hoje && "ring-2 ring-primary")}>
                <p className="font-semibold">{Number(iso.slice(8))}</p>
                {st.integrantes.filter((i) => i.ativo).map((i) => { const s = situacaoDoDia(i, iso, st.alteracoes); if (!s || s === "regular") return null; const I = SIT_ICON[s]; return <p key={i.id} className={cn("mt-0.5 flex items-center gap-1 truncate rounded px-1", SIT_BG[s])} title={`${i.nome}: ${SITUACAO[s].label}`}><I className="h-3 w-3 shrink-0" />{i.nome.split(" ")[0]}</p>; })}
              </div>) : <span key={`e${k}`} />)}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Dias sem marcação: escala regular.</p>
        </Card>
      )}

      {aba === "historico" && (
        <Card><CardTitle icon={<History className="h-5 w-5" />} title="Histórico de alterações" />
          <ul className="divide-y">{st.alteracoes.map((a) => (
            <li key={a.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div><p className="font-semibold">{integ(a.integranteId)?.nome} — {a.tipo} em {br(a.data)}</p>
                <p className="text-sm text-muted-foreground">{a.horarioAnterior && `De ${a.horarioAnterior} `}{a.novoHorario && `para ${a.novoHorario} • `}{pode || role === "admin" ? `Motivo: ${a.motivo || "—"} • ` : ""}Registrado por {a.responsavel}</p></div>
              <Badge tone={a.publicada ? "success" : "neutral"}>{a.publicada ? "Publicado aos moradores" : "Só na gestão"}</Badge>
            </li>))}</ul>
        </Card>
      )}

      {aba === "categorias" && (
        <Card><CardTitle title="Categorias" action={pode && <Button size="sm" onClick={() => { const n = prompt("Nome da categoria"); if (n?.trim()) equipeStore.set((s) => ({ ...s, categorias: [...s.categorias, { id: crypto.randomUUID(), nome: n.trim(), ativa: true }] })); }}><Plus className="h-4 w-4" />Nova</Button>} />
          <ul className="divide-y">{st.categorias.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <span className={cn("font-medium", !c.ativa && "text-muted-foreground line-through")}>{c.nome}</span>
              {pode && <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { const n = prompt("Novo nome", c.nome); if (n?.trim()) equipeStore.set((s) => ({ ...s, categorias: s.categorias.map((x) => x.id === c.id ? { ...x, nome: n.trim() } : x) })); }}><Pencil className="h-4 w-4" />Editar</Button>
                <Button size="sm" variant="outline" onClick={() => equipeStore.set((s) => ({ ...s, categorias: s.categorias.map((x) => x.id === c.id ? { ...x, ativa: !x.ativa } : x) }))}><Power className="h-4 w-4" />{c.ativa ? "Desativar" : "Ativar"}</Button>
              </div>}
            </li>))}</ul>
        </Card>
      )}

      <Dialog open={!!alt} onOpenChange={(o) => !o && setAlt(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar alteração</DialogTitle></DialogHeader>
          {alt && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); salvarAlt(); }}>
            <Field label="Profissional ou equipe"><select className={inputCls} value={alt.integranteId} onChange={(e) => setAlt({ ...alt, integranteId: e.target.value })}>{st.integrantes.filter((i) => i.ativo).map((i) => <option key={i.id} value={i.id}>{i.nome} — {nomeCat(i.categoriaId)}</option>)}</select></Field>
            <Field label="Tipo de alteração"><select className={inputCls} value={alt.tipo} onChange={(e) => setAlt({ ...alt, tipo: e.target.value as TipoAlteracao })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Data"><input type="date" required className={inputCls} value={alt.data} onChange={(e) => setAlt({ ...alt, data: e.target.value })} /></Field>
            {(alt.tipo === "Horário temporário" || alt.tipo === "Substituição") && <Field label="Novo horário"><input className={inputCls} placeholder="ex.: 12:00–18:00" value={alt.novoHorario ?? ""} onChange={(e) => setAlt({ ...alt, novoHorario: e.target.value })} /></Field>}
            {(alt.tipo === "Ausência" || alt.tipo === "Férias") && <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!alt.coberto} onChange={(e) => setAlt({ ...alt, coberto: e.target.checked })} />Há cobertura/substituto</label>}
            <Field label="Motivo ou observação (interno)"><textarea rows={3} className={cn(inputCls, "h-auto py-2")} value={alt.motivo} onChange={(e) => setAlt({ ...alt, motivo: e.target.value })} /></Field>
            <Button size="lg" className="w-full" type="submit">Salvar</Button>
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pergunta} onOpenChange={(o) => !o && setPergunta(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deseja informar esta atualização aos moradores?</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Button size="lg" variant="outline" onClick={() => { gravar(pergunta!); setPergunta(null); toast.success("Alteração salva apenas na gestão"); }}>Salvar apenas na gestão</Button>
            <Button size="lg" onClick={() => { const a = pergunta!; const i = integ(a.integranteId); const h = a.novoHorario || (a.tipo === "Folga" || a.tipo === "Férias" || a.tipo === "Ausência" ? "sem atendimento neste dia" : i.horario); setPrevia({ a, titulo: "Atualização da Equipe e Escalas", corpo: avisoModelo(nomeCat(i.categoriaId).toLowerCase(), br(a.data), h) }); setPergunta(null); }}>Salvar e publicar aviso</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previa} onOpenChange={(o) => !o && setPrevia(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Prévia do aviso</DialogTitle></DialogHeader>
          {previa && <div className="space-y-3">
            <Field label="Título"><input className={inputCls} value={previa.titulo} onChange={(e) => setPrevia({ ...previa, titulo: e.target.value })} /></Field>
            <Field label="Texto (sem motivos ou dados pessoais)"><textarea rows={10} className={cn(inputCls, "h-auto py-2")} value={previa.corpo} onChange={(e) => setPrevia({ ...previa, corpo: e.target.value })} /></Field>
            <Button size="lg" className="w-full" onClick={() => { gravar({ ...previa.a, publicada: true }); publicarComunicado({ titulo: previa.titulo, corpo: previa.corpo, prioridade: "normal" }); setPrevia(null); toast.success("Aviso publicado em Avisos à Comunidade"); }}>Confirmar e publicar</Button>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pessoa} onOpenChange={(o) => !o && setPessoa(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pessoa?.id ? "Editar integrante" : "Novo integrante"}</DialogTitle></DialogHeader>
          {pessoa && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); equipeStore.set((s) => ({ ...s, integrantes: pessoa.id ? s.integrantes.map((x) => x.id === pessoa.id ? { ...x, ...pessoa } : x) : [...s.integrantes, { ...pessoa, id: crypto.randomUUID(), ativo: true }] })); setPessoa(null); toast.success("Integrante salvo"); }}>
            <Field label="Nome"><input required className={inputCls} value={pessoa.nome} onChange={(e) => setPessoa({ ...pessoa, nome: e.target.value })} /></Field>
            <Field label="Categoria"><select className={inputCls} value={pessoa.categoriaId} onChange={(e) => setPessoa({ ...pessoa, categoriaId: e.target.value })}>{st.categorias.filter((c) => c.ativa).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
            <Field label="Função"><input required className={inputCls} value={pessoa.funcao} onChange={(e) => setPessoa({ ...pessoa, funcao: e.target.value })} /></Field>
            <Field label="Horário habitual"><input required className={inputCls} value={pessoa.horario} onChange={(e) => setPessoa({ ...pessoa, horario: e.target.value })} /></Field>
            <div><p className="mb-1 text-sm font-medium">Dias de trabalho</p><div className="flex flex-wrap gap-2">{DIAS.map((d) => <button type="button" key={d} onClick={() => setPessoa({ ...pessoa, dias: pessoa.dias.includes(d) ? pessoa.dias.filter((x) => x !== d) : [...pessoa.dias, d] })} className={cn("h-10 rounded-xl border px-3", pessoa.dias.includes(d) && "bg-primary text-primary-foreground")}>{d}</button>)}</div></div>
            <Button size="lg" className="w-full" type="submit">Salvar</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
