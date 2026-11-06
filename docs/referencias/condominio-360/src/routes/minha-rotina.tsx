import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, MessageSquare, Play, History } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, useStore } from "@/lib/store";
import { ordensStore, osTone, prioridadeTone, proximoStatusOS, atrasada, ZELADOR, type OrdemServico, type Evidencia } from "@/lib/ordens";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/minha-rotina")({
  head: pageHead("Minha Rotina", "Tarefas, checklists, ordens de serviço e evidências do zelador em uma única tela."),
  component: MinhaRotina,
});

const hoje = () => new Date().toISOString().slice(0, 10);
const ORDEM = { "Crítica": 0, Alta: 1, "Média": 2, Baixa: 3 } as const;

function MinhaRotina() {
  const { ordens } = ordensStore.use();
  const { criarOcorrencia, user } = useStore();
  const [aba, setAba] = useState<"agenda" | "historico">("agenda");
  const [abrir, setAbrir] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [evTipo, setEvTipo] = useState<Evidencia["tipo"]>("Antes");
  const [rep, setRep] = useState(false);
  const [p, setP] = useState({ local: "", descricao: "" });

  const minhas = ordens.filter((o) => o.responsavel === ZELADOR);
  const pendentes = minhas.filter((o) => o.status === "A fazer" || o.status === "Em execução").sort((a, b) => ORDEM[a.prioridade] - ORDEM[b.prioridade]);
  const feitas = minhas.filter((o) => o.status === "Executada" || o.status === "Validada");
  const os = minhas.find((o) => o.id === abrir);
  const upd = (id: string, fn: (o: OrdemServico) => OrdemServico) => ordensStore.set((s) => ({ ordens: s.ordens.map((o) => (o.id === id ? fn(o) : o)) }));

  const kpis = [
    ["Para hoje", minhas.filter((o) => o.prazo === hoje() && o.status !== "Validada" && o.status !== "Executada").length],
    ["Em execução", minhas.filter((o) => o.status === "Em execução").length],
    ["Atrasadas", minhas.filter((o) => atrasada(o)).length],
    ["Executadas", feitas.length],
  ] as const;

  return (
    <AppShell>
      <PageTitle title="Minha Rotina" subtitle={`Olá, ${user.nome}. Suas atividades do dia, em uma única tela.`}
        action={<Button size="lg" variant="outline" onClick={() => setRep(true)}><AlertTriangle className="h-5 w-5" />Reportar problema</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([l, n]) => <Card key={l} className="text-center"><p className="text-3xl font-semibold">{n}</p><p className="text-sm text-muted-foreground">{l}</p></Card>)}
      </div>
      <div className="mb-4 flex gap-2" role="tablist">
        <Button role="tab" aria-selected={aba === "agenda"} size="lg" variant={aba === "agenda" ? "primary" : "outline"} onClick={() => setAba("agenda")}>Agenda de atividades</Button>
        <Button role="tab" aria-selected={aba === "historico"} size="lg" variant={aba === "historico" ? "primary" : "outline"} onClick={() => setAba("historico")}><History className="h-5 w-5" />Histórico</Button>
      </div>
      <Card>
        <ul className="divide-y">
          {(aba === "agenda" ? pendentes : feitas).map((o) => (
            <li key={o.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{o.codigo} • {o.recorrencia}</p>
                <p className="text-base font-semibold">{o.titulo}</p>
                <p className="text-sm text-muted-foreground">{o.local} • Prazo {o.prazo.split("-").reverse().join("/")} • Checklist {o.checklist.filter((c) => c.feito).length}/{o.checklist.length}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {atrasada(o) && <Badge tone="danger">Atrasada</Badge>}
                <Badge tone={prioridadeTone[o.prioridade]}>{o.prioridade}</Badge>
                <Badge tone={osTone[o.status]}>{o.status}</Badge>
                <Button size="sm" onClick={() => setAbrir(o.id)}>Abrir</Button>
              </div>
            </li>
          ))}
          {(aba === "agenda" ? pendentes : feitas).length === 0 && <p className="py-6 text-center text-muted-foreground">Nada por aqui.</p>}
        </ul>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Demonstração: os registros ficam só nesta sessão. Marcar como executada não encerra a ocorrência — quem conclui é o síndico.</p>

      <Dialog open={!!os} onOpenChange={(v) => !v && setAbrir(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {os && <>
            <DialogHeader><DialogTitle>{os.codigo} — {os.titulo}</DialogTitle></DialogHeader>
            <section><h3 className="mb-2 font-semibold">Checklist</h3>
              <ul className="space-y-2">{os.checklist.map((c, i) => (
                <li key={c.texto}><label className="flex min-h-11 items-center gap-3 rounded-xl border px-3">
                  <input type="checkbox" className="h-5 w-5" checked={c.feito} disabled={os.status === "Validada"} onChange={() => upd(os.id, (o) => ({ ...o, checklist: o.checklist.map((x, j) => (j === i ? { ...x, feito: !x.feito } : x)) }))} />{c.texto}
                </label></li>))}</ul>
            </section>
            <section><h3 className="mb-2 font-semibold">Evidências</h3>
              <ul className="mb-2 space-y-1 text-sm">{os.evidencias.map((e, i) => <li key={i}>• <strong>{e.tipo}:</strong> {e.nome}</li>)}{!os.evidencias.length && <li className="text-muted-foreground">Nenhuma evidência ainda.</li>}</ul>
              <div className="flex flex-wrap items-center gap-2">
                <select className={cn(inputCls, "w-auto")} value={evTipo} onChange={(e) => setEvTipo(e.target.value as Evidencia["tipo"])}><option>Antes</option><option>Depois</option><option>Documento</option></select>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-medium"><Camera className="h-5 w-5" />Adicionar foto ou arquivo
                  <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; upd(os.id, (o) => ({ ...o, evidencias: [...o.evidencias, { tipo: evTipo, nome: f.name, url: URL.createObjectURL(f), data: hoje() }] })); toast.success("Evidência adicionada"); e.target.value = ""; }} />
                </label>
              </div>
            </section>
            <section><h3 className="mb-2 flex items-center gap-2 font-semibold"><MessageSquare className="h-5 w-5" />Comunicação com o síndico</h3>
              <ul className="mb-2 space-y-1 text-sm">{os.mensagens.map((m, i) => <li key={i}><strong>{m.autor}:</strong> {m.texto}</li>)}</ul>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!msg.trim()) return; upd(os.id, (o) => ({ ...o, mensagens: [...o.mensagens, { autor: user.nome, texto: msg, data: hoje() }] })); setMsg(""); }}>
                <input className={inputCls} placeholder="Atualização ou impedimento" value={msg} onChange={(e) => setMsg(e.target.value)} /><Button type="submit">Enviar</Button>
              </form>
            </section>
            {(() => { const prox = proximoStatusOS(os.status, "zelador"); return prox && (
              <Button size="lg" className="w-full" onClick={() => { upd(os.id, (o) => ({ ...o, status: prox })); toast.success(prox === "Executada" ? "Serviço sinalizado como executado. O síndico vai validar." : "Atividade iniciada"); }}>
                {prox === "Em execução" ? <><Play className="h-5 w-5" />Iniciar atividade</> : <><CheckCircle2 className="h-5 w-5" />Sinalizar serviço executado</>}
              </Button>); })()}
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={rep} onOpenChange={setRep}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reportar problema</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const prot = criarOcorrencia({ titulo: `Problema em ${p.local}`, categoria: "Manutenção", descricao: p.descricao }); setRep(false); setP({ local: "", descricao: "" }); toast.success(`Encaminhado ao síndico — Protocolo ${prot}`); }}>
            <Field label="Localização"><input required className={inputCls} value={p.local} onChange={(e) => setP({ ...p, local: e.target.value })} placeholder="Ex.: Hall do Bloco 2" /></Field>
            <Field label="Descrição"><textarea required rows={3} className={cn(inputCls, "h-auto py-2")} value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} /></Field>
            <Button size="lg" type="submit" className="w-full">Enviar ao síndico</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
