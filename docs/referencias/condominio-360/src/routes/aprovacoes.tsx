import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Gavel } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { pageHead, useStore } from "@/lib/store";
import { propostasStore, type Manifestacao } from "@/lib/propostas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/aprovacoes")({
  head: pageHead("Fluxo de Aprovações", "Manifestações do conselho sobre propostas e orçamentos, com data, responsável e histórico."),
  component: Aprovacoes,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Aprovacoes() {
  const { orcamentos } = propostasStore.use();
  const { role, user } = useStore();
  const pode = role === "conselho" || role === "admin";
  const [form, setForm] = useState<Record<string, { parecer: Manifestacao["parecer"]; comentario: string }>>({});

  return (
    <AppShell>
      <PageTitle title="Fluxo de Aprovações" subtitle="Análise e manifestação sobre propostas e orçamentos. Não substitui a assembleia quando ela for exigida." />
      <div className="space-y-4">{orcamentos.map((o) => { const f = form[o.id] ?? { parecer: "Favorável" as const, comentario: "" }; return (
        <Card key={o.id}>
          <CardTitle icon={<Gavel className="h-5 w-5" />} title={o.titulo} action={<Badge tone={o.contratacao ? "success" : "warning"}>{o.contratacao ? `Contratado: ${o.contratacao.fornecedor}` : "Em análise"}</Badge>} />
          <p className="mb-2 text-sm text-muted-foreground">{o.descricao}</p>
          <ul className="mb-3 text-sm">{o.propostas.map((p) => <li key={p.id}>• {p.fornecedor}: {brl(p.valor)} em {p.prazoDias} dias{p.escolhida ? " (escolhida)" : ""}</li>)}</ul>
          <h3 className="font-semibold">Manifestações</h3>
          <ul className="mb-3 text-sm">{o.manifestacoes.map((m, i) => <li key={i}>{m.data} • <strong>{m.autor}</strong> — {m.parecer}: {m.comentario}</li>)}{!o.manifestacoes.length && <li className="text-muted-foreground">Nenhuma manifestação ainda.</li>}</ul>
          {pode && <form className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); propostasStore.set((s) => ({ orcamentos: s.orcamentos.map((x) => (x.id === o.id ? { ...x, manifestacoes: [...x.manifestacoes, { autor: user.nome, parecer: f.parecer, comentario: f.comentario, data: new Date().toLocaleDateString("pt-BR") }] } : x)) })); setForm({ ...form, [o.id]: { parecer: "Favorável", comentario: "" } }); toast.success("Manifestação registrada"); }}>
            <Field label="Parecer"><select className={inputCls} value={f.parecer} onChange={(e) => setForm({ ...form, [o.id]: { ...f, parecer: e.target.value as Manifestacao["parecer"] } })}><option>Favorável</option><option>Contrária</option><option>Com ressalvas</option></select></Field>
            <Field label="Comentário"><input required className={cn(inputCls)} value={f.comentario} onChange={(e) => setForm({ ...form, [o.id]: { ...f, comentario: e.target.value } })} /></Field>
            <Button type="submit">Registrar</Button>
          </form>}
        </Card>); })}</div>
    </AppShell>
  );
}
