import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Plus, Check } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, useStore } from "@/lib/store";
import { ordensStore, osTone, prioridadeTone, PRIORIDADES, proximoCodigoOS, proximoStatusOS, atrasada, ZELADOR, type OrdemServico, type Prioridade } from "@/lib/ordens";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ordens-servico")({
  head: pageHead("Ordens de Serviço e Zeladoria", "Tarefas pontuais e recorrentes com prioridade, prazo, responsável, checklist e validação."),
  component: Ordens,
});

const vazio = { titulo: "", local: "", recorrencia: "Pontual" as OrdemServico["recorrencia"], prioridade: "Média" as Prioridade, prazo: "", responsavel: ZELADOR, checklist: "" };

function Ordens() {
  const { ordens } = ordensStore.use();
  const { role } = useStore();
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState(vazio);
  const [st, setSt] = useState("");
  const lista = ordens.filter((o) => !st || o.status === st);

  const criar = (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = proximoCodigoOS(ordens.map((o) => o.codigo));
    ordensStore.set((s) => ({ ordens: [{ id: crypto.randomUUID(), codigo, titulo: f.titulo, local: f.local, recorrencia: f.recorrencia, prioridade: f.prioridade, prazo: f.prazo, responsavel: f.responsavel, status: "A fazer", checklist: f.checklist.split("\n").filter((x) => x.trim()).map((texto) => ({ texto: texto.trim(), feito: false })), evidencias: [], mensagens: [] }, ...s.ordens] }));
    toast.success(`${codigo} criada`, { description: f.responsavel === ZELADOR ? "Já aparece na Minha Rotina do zelador." : undefined });
    setF(vazio); setNovo(false);
  };

  return (
    <AppShell>
      <PageTitle title="Ordens de Serviço e Zeladoria" subtitle="Tarefas com prioridade, prazo, responsável, checklist e evidências."
        action={role === "sindico" || role === "admin" ? <Button size="lg" onClick={() => setNovo(true)}><Plus className="h-5 w-5" />Nova ordem</Button> : undefined} />
      <Card className="mb-4"><Field label="Status"><select className={cn(inputCls, "sm:w-64")} value={st} onChange={(e) => setSt(e.target.value)}><option value="">Todos</option><option>A fazer</option><option>Em execução</option><option>Executada</option><option>Validada</option></select></Field></Card>
      <Card>
        <ul className="divide-y">{lista.map((o) => (
          <li key={o.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">{o.codigo} • {o.recorrencia}</p>
              <p className="font-semibold">{o.titulo}</p>
              <p className="text-sm text-muted-foreground">{o.local} • {o.responsavel} • Prazo {o.prazo.split("-").reverse().join("/")} • Checklist {o.checklist.filter((c) => c.feito).length}/{o.checklist.length} • {o.evidencias.length} evidência(s)</p>
              {o.mensagens.at(-1) && <p className="text-sm">Última mensagem: {o.mensagens.at(-1)!.autor}: {o.mensagens.at(-1)!.texto}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {atrasada(o) && <Badge tone="danger">Atrasada</Badge>}
              <Badge tone={prioridadeTone[o.prioridade]}>{o.prioridade}</Badge>
              <Badge tone={osTone[o.status]}>{o.status}</Badge>
              {role === "sindico" && proximoStatusOS(o.status, "sindico") && <Button size="sm" variant="outline" onClick={() => { ordensStore.set((s) => ({ ordens: s.ordens.map((x) => (x.id === o.id ? { ...x, status: "Validada" } : x)) })); toast.success("Execução validada"); }}><Check className="h-4 w-4" />Validar</Button>}
            </div>
          </li>))}</ul>
      </Card>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />Nova ordem de serviço</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={criar}>
            <Field label="Título"><input required className={inputCls} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Field>
            <Field label="Local"><input required className={inputCls} value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Recorrência"><select className={inputCls} value={f.recorrencia} onChange={(e) => setF({ ...f, recorrencia: e.target.value as OrdemServico["recorrencia"] })}><option>Pontual</option><option>Diária</option><option>Semanal</option><option>Mensal</option></select></Field>
              <Field label="Prioridade"><select className={inputCls} value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value as Prioridade })}>{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</select></Field>
              <Field label="Prazo"><input required type="date" className={inputCls} value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></Field>
              <Field label="Responsável"><input required className={inputCls} value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Field>
            </div>
            <Field label="Checklist (uma etapa por linha)"><textarea rows={3} className={cn(inputCls, "h-auto py-2")} value={f.checklist} onChange={(e) => setF({ ...f, checklist: e.target.value })} /></Field>
            <Button size="lg" type="submit" className="w-full">Criar ordem</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
