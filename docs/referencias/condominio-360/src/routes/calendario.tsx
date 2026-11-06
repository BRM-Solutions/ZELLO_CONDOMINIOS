import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Card, PageTitle } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";
import { equipeStore } from "@/lib/equipe";
import { preventivaStore } from "@/lib/preventiva";
import { obrasStore } from "@/lib/obras";

const fixos: { title: string; sub: string; badge: [string, "info" | "warning" | "success" | "neutral"] }[] = [
  { title: "04/09 • Carro da fruta", sub: "10h às 12h", badge: ["Evento", "info"] },
  { title: "05/09 • Manutenção preventiva", sub: "Bombas de água", badge: ["Manutenção", "warning"] },
  { title: "06/09 • Salão de Festas", sub: "Reserva aprovada 14h–22h", badge: ["Reserva", "success"] },
  { title: "20/09 • Assembleia geral", sub: "19h no Salão", badge: ["Assembleia", "neutral"] },
];

export const Route = createFileRoute("/calendario")({
  head: pageHead("Calendário", "Eventos, manutenções, reservas e alterações de escala do mês."),
  component: Calendario,
});

function Calendario() {
  const eq = equipeStore.use();
  const { itens } = preventivaStore.use();
  const { obras } = obrasStore.use();
  const fmt = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
  const manut = itens.map((p) => ({ title: `${fmt(p.proxima)} • Manutenção preventiva`, sub: `${p.item} • ${p.local}`, badge: ["Manutenção", "warning"] as [string, "warning"] }));
  const obrasEv = obras.filter((o) => o.status !== "Concluída").map((o) => ({ title: `${fmt(o.inicio)} a ${fmt(o.fim)} • Obra`, sub: `${o.nome} • ${o.local} (pode haver indisponibilidade)`, badge: ["Indisponibilidade", "neutral"] as [string, "neutral"] }));
  const escalas = eq.alteracoes.filter((a) => a.publicada).map((a) => {
    const i = eq.integrantes.find((x) => x.id === a.integranteId);
    const cat = eq.categorias.find((c) => c.id === i?.categoriaId)?.nome ?? "Equipe";
    return { title: `${a.data.slice(8)}/${a.data.slice(5, 7)} • ${cat}`, sub: a.novoHorario ? `Horário: ${a.novoHorario}` : "Sem atendimento", badge: ["Escala", "warning"] as [string, "warning"] };
  });
  return (
    <AppShell>
      <PageTitle title="Calendário" subtitle="Eventos, manutenções, reservas e alterações de escala do mês." />
      <Card><ul className="divide-y">{[...escalas, ...manut, ...obrasEv, ...fixos].map((r) => (
        <li key={r.title + r.sub} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="truncate font-medium">{r.title}</p><p className="truncate text-sm text-muted-foreground">{r.sub}</p></div><Badge tone={r.badge[1]}>{r.badge[0]}</Badge></li>
      ))}</ul></Card>
    </AppShell>
  );
}
