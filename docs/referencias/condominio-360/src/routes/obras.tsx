import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { HardHat, Plus } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, Progress, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, useStore } from "@/lib/store";
import { obrasStore, obraTone, progressoObra, type Obra } from "@/lib/obras";
import { ordensStore } from "@/lib/ordens";

export const Route = createFileRoute("/obras")({
  head: pageHead("Obras e Instalações", "Obras, melhorias e equipamentos com etapas, custos, prazos, documentos e status."),
  component: Obras,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s: string) => s.split("-").reverse().join("/");

function Obras() {
  const { obras } = obrasStore.use();
  const { ordens } = ordensStore.use();
  const { role } = useStore();
  const edita = role === "sindico" || role === "admin";
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ nome: "", tipo: "Obra" as Obra["tipo"], local: "", fornecedor: "", orcamento: "", inicio: "", fim: "" });
  const upd = (id: string, fn: (o: Obra) => Obra) => obrasStore.set((s) => ({ obras: s.obras.map((o) => (o.id === id ? fn(o) : o)) }));

  return (
    <AppShell>
      <PageTitle title="Obras e Instalações" subtitle={edita ? "Cronograma, etapas, custos, documentos e status de cada obra." : "Acompanhamento das obras — somente consulta."}
        action={edita ? <Button size="lg" onClick={() => setNovo(true)}><Plus className="h-5 w-5" />Nova obra</Button> : undefined} />
      <div className="grid gap-4 lg:grid-cols-2">
        {obras.map((o) => { const pct = progressoObra(o); const relacionadas = ordens.filter((x) => x.obraId === o.id); return (
          <Card key={o.id}>
            <CardTitle icon={<HardHat className="h-5 w-5" />} title={o.nome} action={<Badge tone={obraTone[o.status]}>{o.status}</Badge>} />
            <p className="text-sm text-muted-foreground">{o.tipo} • {o.local} • Responsável {o.responsavel} • Fornecedor {o.fornecedor || "a definir"}</p>
            <p className="mt-1 text-sm">{dt(o.inicio)} a {dt(o.fim)}</p>
            <div className="my-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-muted p-3"><p className="text-muted-foreground">Orçamento aprovado</p><p className="font-semibold">{brl(o.orcamentoAprovado)}</p></div>
              <div className="rounded-xl bg-muted p-3"><p className="text-muted-foreground">Custo realizado</p><p className="font-semibold">{brl(o.custoRealizado)}</p></div>
            </div>
            <p className="mb-1 text-sm font-medium">Etapas concluídas: {pct}%</p>
            <Progress value={pct} tone={pct === 100 ? "success" : "primary"} />
            <ul className="mt-3 space-y-1 text-sm">{o.etapas.map((e, i) => (
              <li key={e.nome}><label className="flex min-h-10 items-center gap-2">
                <input type="checkbox" className="h-5 w-5" disabled={!edita} checked={e.concluida} onChange={() => upd(o.id, (x) => ({ ...x, etapas: x.etapas.map((y, j) => (j === i ? { ...y, concluida: !y.concluida } : y)) }))} />
                {e.nome} <span className="text-muted-foreground">({dt(e.inicio)} a {dt(e.fim)})</span></label></li>))}</ul>
            {!!o.documentos.length && <p className="mt-2 text-sm">Documentos: {o.documentos.join(", ")}</p>}
            {!!relacionadas.length && <p className="text-sm">Ordens de serviço: {relacionadas.map((r) => r.codigo).join(", ")}</p>}
          </Card>); })}
      </div>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova obra ou instalação</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); obrasStore.set((s) => ({ obras: [{ id: crypto.randomUUID(), nome: f.nome, tipo: f.tipo, local: f.local, responsavel: "Elton Grativol", fornecedor: f.fornecedor, orcamentoAprovado: Number(f.orcamento) || 0, custoRealizado: 0, inicio: f.inicio, fim: f.fim, status: "Planejada", etapas: [], documentos: [] }, ...s.obras] })); setNovo(false); toast.success("Obra cadastrada"); }}>
            <Field label="Nome"><input required className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo"><select className={inputCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Obra["tipo"] })}><option>Obra</option><option>Melhoria</option><option>Instalação</option><option>Equipamento</option></select></Field>
              <Field label="Local"><input required className={inputCls} value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></Field>
              <Field label="Fornecedor"><input className={inputCls} value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} /></Field>
              <Field label="Orçamento aprovado (R$)"><input inputMode="decimal" className={inputCls} value={f.orcamento} onChange={(e) => setF({ ...f, orcamento: e.target.value })} /></Field>
              <Field label="Início"><input required type="date" className={inputCls} value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Field>
              <Field label="Fim previsto"><input required type="date" className={inputCls} value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Field>
            </div>
            <Button size="lg" type="submit" className="w-full">Cadastrar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
