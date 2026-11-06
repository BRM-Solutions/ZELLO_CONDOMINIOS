import { useState } from "react";
import { toast } from "sonner";
import { Check, Download, MessageSquareWarning, Scale } from "lucide-react";
import { Badge, Button, Card, Field, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { brl, finStore } from "@/lib/financeiro";
import { conciliar, despStore, indicadores, STATUS_CONC, type Despesa, type ResultadoConc, type StatusConc } from "@/lib/despesas";
import { exportarExcel } from "@/components/vg/NotasFiscais";

const tone = (s: string) => (s === "Conciliado" ? "success" : s.startsWith("Diverg") || s.startsWith("Não") ? "danger" : "warning");

export function ConferenciaMensal() {
  const { role, user, tenant } = useStore();
  const fin = finStore.use();
  const st = despStore.use();
  const [comp, setComp] = useState(new Date().toISOString().slice(0, 7));
  const [msg, setMsg] = useState<string | null>(null);
  const confirma = role === "sindico" || role === "admin";
  const observa = confirma || role === "conselho";

  const lancImportados = fin.lancamentos.filter((l) => l.origem !== "Lançamento manual");
  const temBalancete = lancImportados.some((l) => l.data.startsWith(comp));
  const res = conciliar(st.despesas, lancImportados, comp, temBalancete);
  const ind = indicadores(res);

  const gravar = (d: Despesa, p: Partial<Despesa>, acao: string) => despStore.set((s) => ({ ...s, despesas: s.despesas.map((x) => (x.id === d.id ? { ...x, ...p, alteradoEm: new Date().toISOString(), historico: [...x.historico, { em: new Date().toISOString(), por: user.nome, acao }] } : x)) }));
  const classificar = (r: ResultadoConc, status: StatusConc) => r.despesa && gravar(r.despesa, { conciliacao: status, conciliacaoManual: true, ...(r.lancamento ? { lancamentoId: r.lancamento.id } : {}) }, `Conferência: ${status}`);
  const solicitar = (r: ResultadoConc) => {
    const d = r.despesa!;
    setMsg(`Assunto: Solicitação de conferência — ${d.codigo} — Gaudí 360°\n\nPrezados,\n\nSolicitamos a conferência da despesa abaixo no balancete de ${comp.split("-").reverse().join("/")}.\n\nCondomínio: ${tenant.legalName}\nIdentificador: ${d.codigo}\nDespesa: ${d.titulo}\nValor registrado: ${brl(d.valor)}\nValor no balancete: ${r.lancamento ? brl(r.lancamento.valor) : "não localizado"}\nTipo de divergência: ${r.status}\nComprovantes: ${d.comprovantes.map((c) => c.nome).join(", ") || "nenhum"}\nObservações: ${d.obsConferencia ?? "—"}\n\nAtenciosamente,\nAdministração do ${tenant.legalName}`);
    gravar(d, {}, "Solicitada conferência à administradora");
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="flex items-center gap-2 text-2xl"><Scale className="h-6 w-6" />Conferência Mensal de Despesas</h2>
        <p className="mb-3 text-muted-foreground">Verifique se as despesas registradas no condomínio foram contabilizadas no balancete da administradora.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Mês e ano"><input type="month" className={inputCls} value={comp} onChange={(e) => setComp(e.target.value)} /></Field>
          <Button variant="outline" disabled={!res.length} onClick={() => exportarExcel(`conferencia-${comp}.xlsx`, res.map((r) => ({ Código: r.despesa?.codigo ?? "—", Despesa: r.despesa?.titulo ?? r.lancamento?.descricao, "Valor registrado": r.despesa?.valor ?? "", "Valor no balancete": r.lancamento?.valor ?? "", Situação: r.status, Observação: r.despesa?.obsConferencia ?? "" })))}><Download className="h-4 w-4" />Exportar relatório</Button>
        </div>
        {!temBalancete && <p className="mt-3 rounded-xl bg-warning-soft p-3 text-sm">Nenhum balancete importado para este mês. Use "Importar Balancete Mensal" para comparar.</p>}
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {([["Despesas registradas", ind.total], ["Conciliadas", ind.conciliadas], ["Não localizadas", ind.naoLocalizadas], ["Divergências", ind.divergencias], ["Valor pendente", brl(ind.valorPendente)], ["Conciliação", `${ind.percentual}%`]] as const).map(([k, v]) => <Card key={k}><p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></Card>)}
      </div>
      <Card>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm">
          <thead><tr className="border-b text-left"><th className="py-2">Despesa</th><th>Valor registrado</th><th>Valor no balancete</th><th>Situação</th><th>Ações</th></tr></thead>
          <tbody>{res.map((r, i) => <tr key={r.despesa?.id ?? `l${i}`} className="border-b align-top">
            <td className="py-2"><p className="font-medium">{r.despesa?.titulo ?? r.lancamento?.descricao}</p><p className="text-xs text-muted-foreground">{r.despesa?.codigo ?? "Somente no balancete"}{r.lancamento && ` • balancete: ${r.lancamento.descricao}`}</p>{r.despesa?.obsConferencia && <p className="text-xs">Obs.: {r.despesa.obsConferencia}</p>}</td>
            <td>{r.despesa ? brl(r.despesa.valor) : "—"}</td><td>{r.lancamento ? brl(r.lancamento.valor) : "—"}</td>
            <td><Badge tone={tone(r.status)}>{r.status}</Badge></td>
            <td>{r.despesa && <div className="flex flex-wrap gap-1">
              {confirma && r.lancamento && r.status !== "Conciliado" && <Button size="sm" onClick={() => { classificar(r, "Conciliado"); toast.success("Correspondência confirmada"); }}><Check className="h-4 w-4" />Confirmar</Button>}
              {confirma && <select aria-label="Corrigir classificação" className="h-9 rounded-lg border bg-card px-2" value="" onChange={(e) => e.target.value && classificar(r, e.target.value as StatusConc)}><option value="">Corrigir…</option>{STATUS_CONC.filter((s) => s !== "Lançamento adicional no balancete").map((s) => <option key={s}>{s}</option>)}</select>}
              {observa && <Button size="sm" variant="outline" onClick={() => { const o = prompt("Observação da conferência", r.despesa!.obsConferencia ?? ""); if (o !== null) gravar(r.despesa!, { obsConferencia: o.slice(0, 500) }, "Observação de conferência"); }}>Observação</Button>}
              {observa && (r.status === "Não localizado no balancete" || r.status === "Divergência de valor") && <Button size="sm" variant="outline" onClick={() => solicitar(r)}><MessageSquareWarning className="h-4 w-4" />Solicitar Conferência à Administradora</Button>}
            </div>}</td>
          </tr>)}</tbody>
        </table></div>
        {!res.length && <p className="py-6 text-center text-muted-foreground">Nenhuma despesa ou lançamento neste mês.</p>}
        <p className="mt-3 text-xs text-muted-foreground">A comparação automática só sugere correspondências. "Conciliado" exige confirmação.</p>
      </Card>
      <Dialog open={!!msg} onOpenChange={(o) => !o && setMsg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Solicitar Conferência à Administradora</DialogTitle></DialogHeader>
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-muted p-3 text-sm">{msg}</pre>
          <div className="flex flex-wrap gap-2">
            <Button onClick={async () => { await navigator.clipboard.writeText(msg ?? ""); toast.success("Mensagem copiada"); }}>Copiar mensagem</Button>
            <a className="inline-flex h-11 items-center rounded-xl border px-4 text-sm font-medium hover:bg-muted" href={`mailto:${encodeURIComponent(st.emailAdministradora)}?subject=${encodeURIComponent("Solicitação de conferência — Gaudí 360°")}&body=${encodeURIComponent(msg ?? "")}`}>Abrir no e-mail</a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
