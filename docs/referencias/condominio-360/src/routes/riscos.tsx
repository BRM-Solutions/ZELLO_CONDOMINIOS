import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, PageTitle } from "@/components/vg/ui";
import { pageHead, useStore } from "@/lib/store";
import { preventivaStore, situacaoPreventiva } from "@/lib/preventiva";
import { ordensStore, atrasada } from "@/lib/ordens";
import { contratosStore, statusContrato, diasAte } from "@/lib/contratos";
import { docStore } from "@/lib/documentos";

export const Route = createFileRoute("/riscos")({
  head: pageHead("Painel de Riscos e Pendências", "Manutenções atrasadas, ocorrências críticas, documentos pendentes e contratos a vencer."),
  component: Riscos,
});

type Item = { tipo: string; titulo: string; detalhe: string; nivel: "Crítico" | "Atenção"; to: string };

function Riscos() {
  const { itens } = preventivaStore.use();
  const { ordens } = ordensStore.use();
  const { contratos } = contratosStore.use();
  const { lista: docs } = docStore.use();
  const { ocorrencias } = useStore();
  const [filtro, setFiltro] = useState("");
  const hoje = new Date().toISOString().slice(0, 10);

  const todos: Item[] = [
    ...itens.filter((p) => situacaoPreventiva(p) === "Atrasada").map((p) => ({ tipo: "Manutenção atrasada", titulo: p.item, detalhe: `Prevista para ${p.proxima.split("-").reverse().join("/")} • ${p.local}`, nivel: p.criticidade === "Crítica" || p.criticidade === "Alta" ? "Crítico" as const : "Atenção" as const, to: "/manutencoes" })),
    ...ordens.filter((o) => atrasada(o)).map((o) => ({ tipo: "Ordem de serviço atrasada", titulo: `${o.codigo} — ${o.titulo}`, detalhe: `${o.responsavel} • prazo ${o.prazo.split("-").reverse().join("/")}`, nivel: o.prioridade === "Crítica" || o.prioridade === "Alta" ? "Crítico" as const : "Atenção" as const, to: "/ordens-servico" })),
    ...ocorrencias.filter((o) => o.status !== "Concluída" && (o.prioridade === "Crítica" || o.prioridade === "Alta" || o.status === "Aberta")).map((o) => ({ tipo: o.status === "Aberta" ? "Ocorrência sem triagem" : "Ocorrência crítica", titulo: `${o.protocolo} — ${o.titulo}`, detalhe: `${o.status}${o.prioridade ? ` • prioridade ${o.prioridade}` : ""}`, nivel: o.prioridade === "Crítica" ? "Crítico" as const : "Atenção" as const, to: "/ocorrencias" })),
    ...contratos.filter((c) => ["Vencido", "Próximo do vencimento"].includes(statusContrato(c))).map((c) => ({ tipo: "Contrato a vencer", titulo: `${c.servico} (${c.numero})`, detalhe: statusContrato(c) === "Vencido" ? "Vencido" : `Vence em ${diasAte(c.vencimento)} dias`, nivel: statusContrato(c) === "Vencido" ? "Crítico" as const : "Atenção" as const, to: "/fornecedores" })),
    ...docs.filter((d) => !d.arquivado && d.vigenciaFim && d.vigenciaFim < hoje).map((d) => ({ tipo: "Documento vencido", titulo: d.nome, detalhe: `Validade até ${d.vigenciaFim!.split("-").reverse().join("/")}`, nivel: "Atenção" as const, to: "/documentos" })),
  ];
  const tipos = [...new Set(todos.map((t) => t.tipo))];
  const lista = todos.filter((t) => !filtro || t.tipo === filtro).sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "Crítico" ? -1 : 1));

  return (
    <AppShell>
      <PageTitle title="Painel de Riscos e Pendências" subtitle="Alimentado automaticamente pelos módulos de manutenção, ordens, ocorrências, contratos e documentos." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="text-center"><p className="text-3xl font-semibold text-destructive">{todos.filter((t) => t.nivel === "Crítico").length}</p><p className="text-sm text-muted-foreground">Críticos</p></Card>
        <Card className="text-center"><p className="text-3xl font-semibold">{todos.filter((t) => t.nivel === "Atenção").length}</p><p className="text-sm text-muted-foreground">Atenção</p></Card>
        <Card className="text-center"><p className="text-3xl font-semibold">{todos.filter((t) => t.tipo.includes("atrasada")).length}</p><p className="text-sm text-muted-foreground">Atrasos</p></Card>
        <Card className="text-center"><p className="text-3xl font-semibold">{todos.filter((t) => t.tipo === "Contrato a vencer").length}</p><p className="text-sm text-muted-foreground">Contratos a vencer</p></Card>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={!filtro ? "primary" : "outline"} onClick={() => setFiltro("")}>Todos</Button>
        {tipos.map((t) => <Button key={t} size="sm" variant={filtro === t ? "primary" : "outline"} onClick={() => setFiltro(t)}>{t}</Button>)}
      </div>
      <Card><ul className="divide-y">
        {lista.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma pendência. Tudo em dia.</p>}
        {lista.map((t, i) => (
          <li key={i} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0"><p className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" />{t.tipo}</p><p className="font-semibold">{t.titulo}</p><p className="text-sm text-muted-foreground">{t.detalhe}</p></div>
            <div className="flex items-center gap-2"><Badge tone={t.nivel === "Crítico" ? "danger" : "warning"}>{t.nivel}</Badge><Link to={t.to} className="text-sm font-medium text-primary hover:underline">Abrir</Link></div>
          </li>))}
      </ul></Card>
    </AppShell>
  );
}
