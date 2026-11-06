import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Wrench, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, useStore } from "@/lib/store";
import { preventivaStore, situacaoPreventiva, calcularProxima, hojeISO, type Periodicidade, type Preventiva } from "@/lib/preventiva";

export const Route = createFileRoute("/manutencoes")({
  head: pageHead("Matriz de Manutenção Preventiva", "Periodicidades, responsáveis, criticidade, próxima execução, evidências e histórico."),
  component: Matriz,
});

const PER: Periodicidade[] = ["Semanal", "Mensal", "Trimestral", "Semestral", "Anual"];
const dt = (s: string) => (s ? s.split("-").reverse().join("/") : "—");
const tone = { Atrasada: "danger", "Próxima": "warning", "Em dia": "success" } as const;
const crit = { Baixa: "neutral", "Média": "info", Alta: "warning", "Crítica": "danger" } as const;

function Matriz() {
  const { itens } = preventivaStore.use();
  const { role } = useStore();
  const edita = role === "sindico" || role === "admin";
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ item: "", local: "", periodicidade: "Mensal" as Periodicidade, responsavel: "", criticidade: "Média" as Preventiva["criticidade"], proxima: "" });
  const registrar = (p: Preventiva) => {
    const hoje = hojeISO();
    preventivaStore.set((s) => ({ itens: s.itens.map((x) => (x.id === p.id ? { ...x, ultima: hoje, proxima: calcularProxima(hoje, x.periodicidade), historico: [`Executada em ${dt(hoje)}`, ...x.historico] } : x)) }));
    toast.success("Execução registrada", { description: `Próxima: ${dt(calcularProxima(hoje, p.periodicidade))}` });
  };
  const ord = [...itens].sort((a, b) => a.proxima.localeCompare(b.proxima));
  return (
    <AppShell>
      <PageTitle title="Matriz de Manutenção Preventiva" subtitle="Periodicidades devem seguir as características do condomínio e validação técnica e jurídica."
        action={edita ? <Button size="lg" onClick={() => setNovo(true)}><Plus className="h-5 w-5" />Novo item</Button> : undefined} />
      <Card><ul className="divide-y">{ord.map((p) => { const s = situacaoPreventiva(p); return (
        <li key={p.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4 text-primary" />{p.item}</p>
            <p className="text-sm text-muted-foreground">{p.local} • {p.periodicidade} • {p.responsavel} • Última {dt(p.ultima)} • Próxima <strong>{dt(p.proxima)}</strong></p>
            {!!p.evidencias.length && <p className="text-sm">Evidências: {p.evidencias.join(", ")}</p>}
            {!!p.historico.length && <p className="text-sm text-muted-foreground">Histórico: {p.historico.join(" • ")}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={crit[p.criticidade]}>{p.criticidade}</Badge><Badge tone={tone[s]}>{s}</Badge>
            {edita && <Button size="sm" variant="outline" onClick={() => registrar(p)}><CheckCircle2 className="h-4 w-4" />Registrar execução</Button>}
          </div>
        </li>); })}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Também é possível cadastrar em massa pela Central de Configuração e Importação.</p>
      </Card>
      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo item da matriz</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); preventivaStore.set((s) => ({ itens: [...s.itens, { id: crypto.randomUUID(), ...f, ultima: "", evidencias: [], historico: [] }] })); setNovo(false); toast.success("Item cadastrado"); }}>
            <Field label="Equipamento, instalação ou área"><input required className={inputCls} value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Local"><input required className={inputCls} value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></Field>
              <Field label="Responsável"><input required className={inputCls} value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Field>
              <Field label="Periodicidade"><select className={inputCls} value={f.periodicidade} onChange={(e) => setF({ ...f, periodicidade: e.target.value as Periodicidade })}>{PER.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Criticidade"><select className={inputCls} value={f.criticidade} onChange={(e) => setF({ ...f, criticidade: e.target.value as Preventiva["criticidade"] })}><option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option></select></Field>
              <Field label="Próxima execução"><input required type="date" className={inputCls} value={f.proxima} onChange={(e) => setF({ ...f, proxima: e.target.value })} /></Field>
            </div>
            <Button size="lg" type="submit" className="w-full">Cadastrar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
