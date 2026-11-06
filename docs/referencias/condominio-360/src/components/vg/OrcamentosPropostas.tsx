import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trophy } from "lucide-react";
import { Badge, Button, Card, CardTitle, Field, inputCls } from "@/components/vg/ui";
import { useStore } from "@/lib/store";
import { escolherProposta, propostasStore, valorContratado, type Orcamento } from "@/lib/propostas";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Aba "Orçamentos e Propostas" do Financeiro: comparar, escolher e acompanhar a execução. */
export function OrcamentosPropostas() {
  const { orcamentos } = propostasStore.use();
  const { role } = useStore();
  const pode = role === "sindico" || role === "admin";
  const [titulo, setTitulo] = useState("");
  const [nova, setNova] = useState<Record<string, { fornecedor: string; valor: string; prazo: string }>>({});
  const upd = (id: string, fn: (o: Orcamento) => Orcamento) => propostasStore.set((s) => ({ orcamentos: s.orcamentos.map((o) => (o.id === id ? fn(o) : o)) }));

  return (
    <div className="space-y-4">
      <Card><p className="text-sm text-muted-foreground">Total contratado a partir de propostas</p><p className="text-2xl font-semibold">{brl(valorContratado(orcamentos))}</p>
        <p className="text-xs text-muted-foreground">Propostas não escolhidas não entram como despesa realizada.</p></Card>
      {pode && <Card><form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); propostasStore.set((s) => ({ orcamentos: [{ id: crypto.randomUUID(), titulo, descricao: "", propostas: [], manifestacoes: [] }, ...s.orcamentos] })); setTitulo(""); }}>
        <div className="flex-1"><Field label="Novo orçamento"><input required className={inputCls} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Troca do portão da garagem" /></Field></div>
        <Button type="submit"><Plus className="h-5 w-5" />Criar</Button></form></Card>}
      {orcamentos.map((o) => { const n = nova[o.id] ?? { fornecedor: "", valor: "", prazo: "" }; const menor = Math.min(...o.propostas.map((p) => p.valor)); return (
        <Card key={o.id}>
          <CardTitle title={o.titulo} action={<Badge tone={o.contratacao ? "success" : "warning"}>{o.contratacao ? "Contratado" : "Em comparação"}</Badge>} />
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Fornecedor</th><th>Valor</th><th>Prazo</th><th></th></tr></thead>
            <tbody>{o.propostas.map((p) => <tr key={p.id} className="border-t"><td className="py-2">{p.fornecedor} {p.valor === menor && o.propostas.length > 1 && <Badge tone="info">Menor valor</Badge>}</td><td>{brl(p.valor)}</td><td>{p.prazoDias} dias</td>
              <td className="text-right">{p.escolhida ? <Badge tone="success">Escolhida</Badge> : pode && !o.contratacao && <Button size="sm" variant="outline" onClick={() => { upd(o.id, (x) => escolherProposta(x, p.id)); toast.success(`Proposta de ${p.fornecedor} escolhida`); }}><Trophy className="h-4 w-4" />Escolher</Button>}</td></tr>)}</tbody></table></div>
          {o.contratacao && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-muted p-3 text-sm">
            <span>{o.contratacao.fornecedor} • {brl(o.contratacao.valor)} • {o.contratacao.prazoDias} dias • contratado em {o.contratacao.data}</span>
            {pode ? <select aria-label="Situação da execução" className={inputCls + " h-9 w-auto"} value={o.contratacao.execucao} onChange={(e) => upd(o.id, (x) => ({ ...x, contratacao: { ...x.contratacao!, execucao: e.target.value as "Não iniciada" } }))}><option>Não iniciada</option><option>Em execução</option><option>Concluída</option></select> : <Badge tone="info">{o.contratacao.execucao}</Badge>}
          </div>}
          {pode && !o.contratacao && <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_120px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); upd(o.id, (x) => ({ ...x, propostas: [...x.propostas, { id: crypto.randomUUID(), fornecedor: n.fornecedor, valor: Number(n.valor.replace(",", ".")) || 0, prazoDias: Number(n.prazo) || 0, escolhida: false }] })); setNova({ ...nova, [o.id]: { fornecedor: "", valor: "", prazo: "" } }); }}>
            <Field label="Fornecedor"><input required className={inputCls} value={n.fornecedor} onChange={(e) => setNova({ ...nova, [o.id]: { ...n, fornecedor: e.target.value } })} /></Field>
            <Field label="Valor (R$)"><input required inputMode="decimal" className={inputCls} value={n.valor} onChange={(e) => setNova({ ...nova, [o.id]: { ...n, valor: e.target.value } })} /></Field>
            <Field label="Prazo (dias)"><input required inputMode="numeric" className={inputCls} value={n.prazo} onChange={(e) => setNova({ ...nova, [o.id]: { ...n, prazo: e.target.value } })} /></Field>
            <Button type="submit" variant="outline">Adicionar proposta</Button>
          </form>}
        </Card>); })}
    </div>
  );
}
