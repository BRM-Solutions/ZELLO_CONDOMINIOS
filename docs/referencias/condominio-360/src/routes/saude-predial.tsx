import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Card, CardTitle, PageTitle, Progress } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";
import { ordensStore, atrasada } from "@/lib/ordens";
import { preventivaStore, situacaoPreventiva } from "@/lib/preventiva";
import { obrasStore, progressoObra, obraTone } from "@/lib/obras";

export const Route = createFileRoute("/saude-predial")({
  head: pageHead("Painel de Saúde Predial", "Tarefas concluídas, pendentes, atrasadas e críticas, com acompanhamento de prazos."),
  component: Saude,
});

function Saude() {
  const { ordens } = ordensStore.use();
  const { itens } = preventivaStore.use();
  const { obras } = obrasStore.use();
  const concl = ordens.filter((o) => o.status === "Validada" || o.status === "Executada").length;
  const kpis = [
    ["Concluídas", concl, "success"], ["Pendentes", ordens.filter((o) => o.status === "A fazer" || o.status === "Em execução").length, "info"],
    ["Atrasadas", ordens.filter((o) => atrasada(o)).length + itens.filter((p) => situacaoPreventiva(p) === "Atrasada").length, "warning"],
    ["Críticas", ordens.filter((o) => o.prioridade === "Crítica").length + itens.filter((p) => p.criticidade === "Crítica").length, "danger"],
  ] as const;
  const emDia = itens.length ? Math.round((itens.filter((p) => situacaoPreventiva(p) !== "Atrasada").length / itens.length) * 100) : 100;
  return (
    <AppShell>
      <PageTitle title="Painel de Saúde Predial" subtitle="Acompanhamento da operação — somente consulta." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">{kpis.map(([l, n, t]) => <Card key={l} className="text-center"><p className="text-3xl font-semibold">{n}</p><Badge tone={t}>{l}</Badge></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardTitle icon={<HeartPulse className="h-5 w-5" />} title="Manutenção preventiva em dia" />
          <p className="mb-2 text-3xl font-semibold">{emDia}%</p><Progress value={emDia} tone={emDia >= 80 ? "success" : "danger"} />
          <ul className="mt-3 divide-y text-sm">{itens.map((p) => <li key={p.id} className="flex justify-between gap-2 py-2"><span>{p.item}</span><Badge tone={situacaoPreventiva(p) === "Atrasada" ? "danger" : situacaoPreventiva(p) === "Próxima" ? "warning" : "success"}>{situacaoPreventiva(p)}</Badge></li>)}</ul>
        </Card>
        <Card><CardTitle title="Obras e instalações" />
          <ul className="divide-y">{obras.map((o) => <li key={o.id} className="py-3"><div className="mb-1 flex justify-between gap-2"><span className="font-medium">{o.nome}</span><Badge tone={obraTone[o.status]}>{o.status}</Badge></div><Progress value={progressoObra(o)} /></li>)}</ul>
        </Card>
      </div>
    </AppShell>
  );
}
