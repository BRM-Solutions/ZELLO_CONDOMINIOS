import { useState } from "react";
import { toast } from "sonner";
import { Plus, Send, Eye, Pencil, Download, Copy, Mail, Ban, Trash2, Settings2, ReceiptText } from "lucide-react";
import { Badge, Button, Card, Field, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnexosLista, AnexosPicker } from "@/components/vg/AnexosPicker";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/financeiro";
import { contratosStore } from "@/lib/contratos";
import { EXT_COMPROVANTE, type Anexo } from "@/lib/anexos";
import { fmtDataHora } from "@/lib/ocorrencias";
import {
  despStore, FORMAS_PAG, mensagemAdministradora, ORIGENS_PAG, podeExcluir, proximoCodigo, SITUACOES_FIN, STATUS_COM, STATUS_CONC, TIPOS_DESPESA, type Despesa, type StatusCom,
} from "@/lib/despesas";
import { cn } from "@/lib/utils";

const br = (iso: string) => iso.split("-").reverse().join("/");
const toneConc = (s: string) => (s === "Conciliado" ? "success" : s.startsWith("Diverg") || s.startsWith("Não") ? "danger" : "warning");
const toneCom = (s: string) => (s === "Recebimento confirmado" || s === "Enviado" ? "success" : s === "Pendente de correção" ? "danger" : s === "Não enviado" ? "neutral" : "warning");

type Form = Omit<Despesa, "id" | "codigo" | "condominio" | "criadoEm" | "criadoPor" | "alteradoEm" | "historico" | "comunicacao" | "comunicacoes" | "conciliacao">;
const vazio = (resp: string): Form => ({ titulo: "", descricao: "", tipo: TIPOS_DESPESA[0]!, categoria: "", valor: 0, data: new Date().toISOString().slice(0, 10), competencia: new Date().toISOString().slice(0, 7), fornecedor: "", responsavel: resp, formaPagamento: "PIX", origemPagamento: ORIGENS_PAG[0], situacao: "Pago", comprovantes: [], observacoes: "" });

export async function exportarExcel(nome: string, linhas: Record<string, unknown>[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Dados"); XLSX.writeFile(wb, nome);
}
export function imprimir(titulo: string, html: string) {
  const w = window.open("", "_blank"); if (!w) { toast.error("Permita janelas pop-up para gerar o PDF."); return; }
  w.document.write(`<html><head><title>${titulo}</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left}</style></head><body><h1>${titulo}</h1>${html}</body></html>`);
  w.document.close(); w.print();
}
const linhaExport = (d: Despesa) => ({ Código: d.codigo, Data: br(d.data), Competência: d.competencia, Despesa: d.titulo, Tipo: d.tipo, Categoria: d.categoria, Fornecedor: d.fornecedor, Valor: d.valor, Situação: d.situacao, Administradora: d.comunicacao, Conciliação: d.conciliacao, Comprovantes: d.comprovantes.length });

export function NotasFiscais() {
  const { role, user, tenant } = useStore();
  const st = despStore.use();
  const forn = contratosStore.use().fornecedores;
  const edita = role === "sindico" || role === "admin";
  const [form, setForm] = useState<Form | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const [envio, setEnvio] = useState<string | null>(null);
  const [lote, setLote] = useState(false);
  const [cats, setCats] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [novosComp, setNovosComp] = useState<Anexo[]>([]);
  const [fl, setFl] = useState({ mes: "", tipo: "", categoria: "", fornecedor: "", situacao: "", com: "", conc: "" });

  const mesAtual = new Date().toISOString().slice(0, 7);
  const ds = st.despesas;
  const ativos = ds.filter((d) => d.situacao !== "Cancelado");
  const kpis: [string, string | number][] = [
    ["Total registrado no mês", brl(ativos.filter((d) => d.data.startsWith(mesAtual)).reduce((a, d) => a + d.valor, 0))],
    ["Aguardando envio à administradora", ativos.filter((d) => d.comunicacao === "Não enviado" || d.comunicacao === "Preparado para envio").length],
    ["Despesas enviadas", ativos.filter((d) => d.comunicacao === "Enviado" || d.comunicacao === "Recebimento confirmado").length],
    ["Pendentes de conferência", ativos.filter((d) => d.conciliacao === "Pendente de conferência").length],
    ["Conciliadas com o balancete", ativos.filter((d) => d.conciliacao === "Conciliado").length],
    ["Divergências identificadas", ativos.filter((d) => d.conciliacao === "Divergência de valor" || d.conciliacao === "Não localizado no balancete").length],
  ];
  const lista = ds.filter((d) => (!fl.mes || d.data.startsWith(fl.mes)) && (!fl.tipo || d.tipo === fl.tipo) && (!fl.categoria || d.categoria === fl.categoria) && (!fl.fornecedor || d.fornecedor === fl.fornecedor) && (!fl.situacao || d.situacao === fl.situacao) && (!fl.com || d.comunicacao === fl.com) && (!fl.conc || d.conciliacao === fl.conc));
  const atualizar = (id: string, p: Partial<Despesa>, acao: string) => despStore.set((s) => ({ ...s, despesas: s.despesas.map((d) => (d.id === id ? { ...d, ...p, alteradoEm: new Date().toISOString(), historico: [...d.historico, { em: new Date().toISOString(), por: user.nome, acao }] } : d)) }));

  const salvar = () => {
    if (!form) return;
    if (!form.titulo.trim() || !form.descricao.trim() || !form.categoria || !(form.valor > 0) || !form.data || !form.fornecedor.trim() || !form.responsavel.trim()) { toast.error("Preencha todos os campos obrigatórios."); return; }
    if (editId) { atualizar(editId, form, "Registro editado"); toast.success("Despesa atualizada"); }
    else {
      const agora = new Date().toISOString();
      despStore.set((s) => ({ ...s, despesas: [{ ...form, id: crypto.randomUUID(), codigo: proximoCodigo(s.despesas), condominio: tenant.legalName, criadoEm: agora, criadoPor: user.nome, alteradoEm: agora, historico: [{ em: agora, por: user.nome, acao: "Despesa registrada" }], comunicacao: "Não enviado", comunicacoes: [], conciliacao: "Pendente de conferência" }, ...s.despesas] }));
      toast.success("Despesa registrada");
    }
    setForm(null); setEditId(null);
  };

  const atual = ds.find((d) => d.id === ver);
  const env = ds.find((d) => d.id === envio);
  const msgEnv = env ? mensagemAdministradora(env, tenant.legalName) : "";
  const registrarCom = (d: Despesa, status: StatusCom, meio: string) => atualizar(d.id, { comunicacao: status, comunicacoes: [...d.comunicacoes, { em: new Date().toISOString(), por: user.nome, destinatario: st.emailAdministradora || "Administradora", meio, id: `COM-${Date.now().toString(36).toUpperCase()}`, status }] }, `Comunicação: ${status} (${meio})`);
  const doLote = ds.filter((d) => sel.includes(d.id));

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0"><h2 className="flex items-center gap-2 text-2xl"><ReceiptText className="h-6 w-6 shrink-0" />Notas Fiscais e Recibos</h2><p className="text-muted-foreground">Registre despesas, anexe comprovantes e acompanhe a contabilização dos gastos do condomínio.</p></div>
          {edita && <Button size="lg" onClick={() => { setEditId(null); setForm(vazio(user.nome)); }}><Plus className="h-5 w-5" />Registrar Despesa</Button>}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(([k, v]) => <Card key={k}><p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></Card>)}</div>

      <Card>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Field label="Mês"><input type="month" className={inputCls} value={fl.mes} onChange={(e) => setFl({ ...fl, mes: e.target.value })} /></Field>
          {([["tipo", "Tipo", TIPOS_DESPESA], ["categoria", "Categoria", st.categorias], ["fornecedor", "Fornecedor", [...new Set(ds.map((d) => d.fornecedor))]], ["situacao", "Situação financeira", SITUACOES_FIN], ["com", "Administradora", STATUS_COM], ["conc", "Conciliação", STATUS_CONC]] as const).map(([k, l, ops]) => (
            <Field key={k} label={l}><select className={inputCls} value={fl[k]} onChange={(e) => setFl({ ...fl, [k]: e.target.value })}><option value="">Todos</option>{ops.map((o) => <option key={o}>{o}</option>)}</select></Field>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {edita && <Button variant="outline" disabled={!sel.length} onClick={() => setLote(true)}><Send className="h-4 w-4" />Enviar Despesas do Mês ({sel.length})</Button>}
          <Button variant="outline" disabled={!lista.length} onClick={() => exportarExcel("notas-fiscais-e-recibos.xlsx", lista.map(linhaExport))}><Download className="h-4 w-4" />Exportar</Button>
          {role === "sindico" && <Button variant="outline" onClick={() => setCats(true)}><Settings2 className="h-4 w-4" />Categorias</Button>}
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b text-left">{edita && <th className="py-2"><span className="sr-only">Selecionar</span></th>}<th className="py-2">Data</th><th>Despesa</th><th>Tipo</th><th>Valor</th><th>Administradora</th><th>Conciliação</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((d) => <tr key={d.id} className={cn("border-b align-top", d.situacao === "Cancelado" && "opacity-60")}>
              {edita && <td className="py-2"><input type="checkbox" className="h-5 w-5" aria-label={`Selecionar ${d.codigo}`} checked={sel.includes(d.id)} onChange={(e) => setSel(e.target.checked ? [...sel, d.id] : sel.filter((x) => x !== d.id))} /></td>}
              <td className="py-2">{br(d.data)}</td>
              <td><p className="font-medium">{d.titulo}</p><p className="text-xs text-muted-foreground">{d.codigo} • {d.categoria} • {d.situacao}</p></td>
              <td>{d.tipo}</td><td className="font-semibold">{brl(d.valor)}</td>
              <td><Badge tone={toneCom(d.comunicacao)}>{d.comunicacao}</Badge></td>
              <td><Badge tone={toneConc(d.conciliacao)}>{d.conciliacao}</Badge></td>
              <td><div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => { setVer(d.id); setNovosComp([]); }}><Eye className="h-4 w-4" />Ver</Button>
                {edita && d.situacao !== "Cancelado" && <>
                  <Button size="sm" variant="outline" onClick={() => { setEditId(d.id); const { id: _i, codigo: _c, condominio: _co, criadoEm: _ce, criadoPor: _cp, alteradoEm: _a, historico: _h, comunicacao: _cm, comunicacoes: _cs, conciliacao: _cc, ...rest } = d; setForm(rest); }}><Pencil className="h-4 w-4" />Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEnvio(d.id)}><Send className="h-4 w-4" />Enviar à Administradora</Button>
                </>}
              </div></td>
            </tr>)}
          </tbody>
        </table></div>
        {!lista.length && <p className="py-6 text-center text-muted-foreground">Nenhuma despesa registrada{ds.length ? " com esses filtros" : " ainda"}.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Demonstração: despesas e comprovantes ficam só nesta sessão.</p>
      </Card>

      {/* Formulário */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar despesa" : "Registrar Despesa"}</DialogTitle></DialogHeader>
          {form && <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
            <div className="sm:col-span-2"><Field label="Título da despesa *"><input className={inputCls} maxLength={150} placeholder="Compra de lâmpadas para iluminação da garagem" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Descrição *"><textarea rows={3} maxLength={1000} className={cn(inputCls, "h-auto py-2")} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field></div>
            <Field label="Tipo de lançamento *"><select className={inputCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS_DESPESA.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Categoria financeira *"><select className={inputCls} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}><option value="">Selecione</option>{st.categorias.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Valor (R$) *"><input type="number" min="0.01" step="0.01" className={inputCls} value={form.valor || ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></Field>
            <Field label="Data da despesa *"><input type="date" className={inputCls} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value, competencia: e.target.value.slice(0, 7) })} /></Field>
            <Field label="Competência contábil"><input type="month" className={inputCls} value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} /></Field>
            <Field label="Fornecedor *"><input list="forn-lista" className={inputCls} placeholder="Escolha ou digite um novo" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /><datalist id="forn-lista">{forn.map((f) => <option key={f.id} value={f.nome} />)}</datalist></Field>
            <Field label="Responsável pela compra *"><input className={inputCls} value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></Field>
            <Field label="Forma de pagamento"><select className={inputCls} value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}>{FORMAS_PAG.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Origem do pagamento"><select className={inputCls} value={form.origemPagamento} onChange={(e) => setForm({ ...form, origemPagamento: e.target.value })}>{ORIGENS_PAG.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Situação financeira"><select className={inputCls} value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as Form["situacao"] })}>{SITUACOES_FIN.filter((s) => s !== "Cancelado").map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Data e hora do registro"><input disabled className={cn(inputCls, "bg-muted")} value={editId ? fmtDataHora(ds.find((d) => d.id === editId)!.criadoEm) : "Preenchida automaticamente ao salvar"} /></Field>
            <div className="sm:col-span-2"><p className="mb-1 text-sm font-medium">Comprovantes (nota fiscal, recibo, comprovante de pagamento)</p><AnexosPicker value={form.comprovantes} onChange={(comprovantes) => setForm({ ...form, comprovantes })} autor={user.nome} permitidas={EXT_COMPROVANTE} /></div>
            <div className="sm:col-span-2"><Field label="Observações"><textarea rows={2} maxLength={1000} className={cn(inputCls, "h-auto py-2")} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field></div>
            <Button size="lg" type="submit" className="sm:col-span-2">Salvar despesa</Button>
          </form>}
        </DialogContent>
      </Dialog>

      {/* Ficha */}
      <Dialog open={!!atual} onOpenChange={(o) => !o && setVer(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {atual && <>
            <DialogHeader><DialogTitle>{atual.codigo} — {atual.titulo}</DialogTitle></DialogHeader>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {([["Valor", brl(atual.valor)], ["Data", br(atual.data)], ["Competência", atual.competencia], ["Tipo", atual.tipo], ["Categoria", atual.categoria], ["Fornecedor", atual.fornecedor], ["Responsável", atual.responsavel], ["Pagamento", `${atual.formaPagamento} • ${atual.origemPagamento}`], ["Situação", atual.situacao], ["Administradora", atual.comunicacao], ["Conciliação", atual.conciliacao], ["Registrado em", `${fmtDataHora(atual.criadoEm)} por ${atual.criadoPor}`], ["Última alteração", fmtDataHora(atual.alteradoEm)]] as const).map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
            <p className="text-sm">{atual.descricao}</p>
            {atual.observacoes && <p className="text-sm text-muted-foreground">Obs.: {atual.observacoes}</p>}
            <h3 className="text-lg font-semibold">Comprovantes</h3>
            <AnexosLista anexos={atual.comprovantes} />
            {edita && atual.situacao !== "Cancelado" && <div className="space-y-2 rounded-xl border p-3"><p className="font-medium">Anexar comprovante</p><AnexosPicker value={novosComp} onChange={setNovosComp} autor={user.nome} permitidas={EXT_COMPROVANTE} /><Button size="sm" disabled={!novosComp.length} onClick={() => { atualizar(atual.id, { comprovantes: [...atual.comprovantes, ...novosComp] }, `${novosComp.length} comprovante(s) anexado(s)`); setNovosComp([]); toast.success("Comprovantes anexados"); }}>Salvar comprovantes</Button></div>}
            <h3 className="text-lg font-semibold">Comunicações</h3>
            {atual.comunicacoes.length ? <ul className="text-sm">{atual.comunicacoes.map((c) => <li key={c.id}>{fmtDataHora(c.em)} • {c.status} • {c.meio} • {c.destinatario} • {c.por} • {c.id}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma comunicação registrada.</p>}
            <h3 className="text-lg font-semibold">Histórico de alterações</h3>
            <ul className="text-sm">{atual.historico.map((h, i) => <li key={i}>{fmtDataHora(h.em)} • {h.por} • {h.acao}</li>)}</ul>
            {edita && atual.situacao !== "Cancelado" && <div className="flex flex-wrap gap-2 border-t pt-3">
              {podeExcluir(atual)
                ? <Button variant="outline" onClick={() => { despStore.set((s) => ({ ...s, despesas: s.despesas.filter((d) => d.id !== atual.id) })); setVer(null); toast.success("Rascunho excluído"); }}><Trash2 className="h-4 w-4" />Excluir</Button>
                : <p className="w-full text-xs text-muted-foreground">Registros já comunicados ou conciliados não podem ser excluídos — apenas cancelados.</p>}
              <Button variant="outline" onClick={() => { atualizar(atual.id, { situacao: "Cancelado" }, "Despesa cancelada"); toast.success("Despesa cancelada; histórico preservado"); }}><Ban className="h-4 w-4" />Cancelar despesa</Button>
            </div>}
          </>}
        </DialogContent>
      </Dialog>

      {/* Envio individual */}
      <Dialog open={!!env} onOpenChange={(o) => !o && setEnvio(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {env && <>
            <DialogHeader><DialogTitle>Enviar à Administradora</DialogTitle></DialogHeader>
            <Field label="E-mail da administradora"><input type="email" className={inputCls} placeholder="financeiro@administradora.com.br" value={st.emailAdministradora} onChange={(e) => despStore.set((s) => ({ ...s, emailAdministradora: e.target.value }))} /></Field>
            <pre className="whitespace-pre-wrap rounded-xl border bg-muted p-3 text-sm">{msgEnv}</pre>
            <p className="text-sm text-muted-foreground">O portal ainda não envia e-mails sozinho. Copie a mensagem ou abra no seu e-mail e anexe os comprovantes. Depois, marque o envio abaixo.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(msgEnv); registrarCom(env, "Preparado para envio", "Mensagem copiada"); toast.success("Mensagem copiada"); }}><Copy className="h-4 w-4" />Copiar mensagem</Button>
              <a className="inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted" onClick={() => registrarCom(env, "Preparado para envio", "Aplicativo de e-mail")}
                href={`mailto:${encodeURIComponent(st.emailAdministradora)}?subject=${encodeURIComponent(`Registro de despesa para contabilização — Gaudí 360° (${env.codigo})`)}&body=${encodeURIComponent(msgEnv.split("\n").slice(2).join("\n"))}`}><Mail className="h-4 w-4" />Abrir no e-mail</a>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button onClick={() => { registrarCom(env, "Enviado", "E-mail (confirmado pelo usuário)"); toast.success("Envio registrado"); }}>Marcar como enviado</Button>
              <Button variant="outline" disabled={env.comunicacao !== "Enviado"} onClick={() => registrarCom(env, "Recebimento confirmado", "Confirmação da administradora")}>Recebimento confirmado</Button>
              <Button variant="outline" onClick={() => registrarCom(env, "Pendente de correção", "Retorno da administradora")}>Pendente de correção</Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>

      {/* Envio consolidado */}
      <Dialog open={lote} onOpenChange={setLote}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Enviar Despesas do Mês</DialogTitle></DialogHeader>
          {(() => {
            const datas = doLote.map((d) => d.data).sort();
            const porCat = Object.entries(doLote.reduce<Record<string, number>>((a, d) => ({ ...a, [d.categoria]: (a[d.categoria] ?? 0) + d.valor }), {}));
            const jaEnviadas = doLote.filter((d) => d.comunicacao !== "Não enviado" && d.comunicacao !== "Preparado para envio");
            const html = `<p>Período: ${datas.length ? `${br(datas[0]!)} a ${br(datas.at(-1)!)}` : "—"}</p><p>Quantidade: ${doLote.length} • Total: ${brl(doLote.reduce((a, d) => a + d.valor, 0))}</p><table><tr><th>Código</th><th>Data</th><th>Despesa</th><th>Categoria</th><th>Valor</th><th>Situação</th><th>Comprovantes</th></tr>${doLote.map((d) => `<tr><td>${d.codigo}</td><td>${br(d.data)}</td><td>${d.titulo}</td><td>${d.categoria}</td><td>${brl(d.valor)}</td><td>${d.situacao}</td><td>${d.comprovantes.map((c) => c.nome).join(", ")}</td></tr>`).join("")}</table>`;
            return <div className="space-y-3">
              <p>Período: <b>{datas.length ? `${br(datas[0]!)} a ${br(datas.at(-1)!)}` : "—"}</b> • Quantidade: <b>{doLote.length}</b> • Total: <b>{brl(doLote.reduce((a, d) => a + d.valor, 0))}</b></p>
              <ul className="text-sm">{porCat.map(([c, v]) => <li key={c}>{c}: {brl(v)}</li>)}</ul>
              <ul className="text-sm text-muted-foreground">{doLote.map((d) => <li key={d.id}>{d.codigo} • {d.titulo} • {d.situacao} • {d.comprovantes.length} comprovante(s)</li>)}</ul>
              {!!jaEnviadas.length && <p className="rounded-xl bg-warning-soft p-3 text-sm">{jaEnviadas.length} despesa(s) já foram comunicadas. Ao continuar, elas serão reenviadas.</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => exportarExcel("despesas-do-mes.xlsx", doLote.map(linhaExport))}><Download className="h-4 w-4" />Excel</Button>
                <Button variant="outline" onClick={() => imprimir("Despesas do mês — Gaudí 360°", html)}><Download className="h-4 w-4" />PDF</Button>
                <Button onClick={() => { if (jaEnviadas.length && !confirm("Confirmar o reenvio das despesas já comunicadas?")) return; doLote.forEach((d) => registrarCom(d, "Preparado para envio", "Envio consolidado")); setLote(false); setSel([]); toast.success("Despesas preparadas para envio. Marque como enviadas após mandar o e-mail."); }}><Send className="h-4 w-4" />Preparar envio</Button>
              </div>
            </div>;
          })()}
        </DialogContent>
      </Dialog>

      {/* Categorias */}
      <Dialog open={cats} onOpenChange={setCats}>
        <DialogContent>
          <DialogHeader><DialogTitle>Categorias financeiras</DialogTitle></DialogHeader>
          <ul className="space-y-1">{st.categorias.map((c) => <li key={c} className="flex items-center justify-between rounded-lg border px-3 py-2"><span>{c}</span><button aria-label={`Remover ${c}`} className="text-destructive" onClick={() => despStore.set((s) => ({ ...s, categorias: s.categorias.filter((x) => x !== c) }))}><Trash2 className="h-4 w-4" /></button></li>)}</ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("c") ?? "").trim(); if (v && !st.categorias.includes(v)) despStore.set((s) => ({ ...s, categorias: [...s.categorias, v] })); e.currentTarget.reset(); }}>
            <input name="c" maxLength={60} className={inputCls} placeholder="Nova categoria" /><Button type="submit">Adicionar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
