import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Download, Eye, Pencil, Plus, History, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, useStore } from "@/lib/store";
import { STATUS_TONE, contratoAtivo, contratosStore, statusContrato, type Contrato } from "@/lib/contratos";
import { brl } from "@/lib/financeiro";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fornecedores")({
  head: pageHead("Fornecedores", "Prestadores de serviço e contratos ativos do condomínio."),
  validateSearch: (s: Record<string, unknown>) => ({ contrato: typeof s["contrato"] === "string" ? (s["contrato"] as string) : undefined }),
  component: Fornecedores,
});

const br = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");
type Form = Omit<Contrato, "id" | "cadastradoEm"> & { id?: string };

function Fornecedores() {
  const { role } = useStore();
  const { contrato: abrirId } = Route.useSearch();
  const st = contratosStore.use();
  const gestor = role === "sindico" || role === "admin";
  const [ver, setVer] = useState<Contrato | null>(() => (abrirId ? contratosStore.get().contratos.find((c) => c.id === abrirId) ?? null : null));
  const [pdf, setPdf] = useState<string | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);

  if (role === "morador" || role === "superadmin") return <AppShell><PageTitle title="Fornecedores" /><Card>Os contratos internos do condomínio não estão disponíveis para este perfil.</Card></AppShell>;

  const nomeF = (id: string) => st.fornecedores.find((f) => f.id === id)?.nome ?? "";
  const novo = (fornecedorId: string, base?: Contrato): Form => ({ fornecedorId, servico: base?.servico ?? st.fornecedores.find((f) => f.id === fornecedorId)!.servico, numero: "", assinatura: "", inicio: "", vencimento: "", valor: base?.valor ?? null, periodicidade: base?.periodicidade ?? "Mensal", observacoes: base ? `Renovação de ${base.numero}` : "" });
  const salvar = () => {
    if (!form) return;
    if (!form.numero || !form.inicio || !form.vencimento) { toast.error("Preencha identificação, início e vencimento."); return; }
    if (form.vencimento < form.inicio) { toast.error("O vencimento deve ser depois do início."); return; }
    contratosStore.set((s) => ({ ...s, contratos: form.id ? s.contratos.map((c) => (c.id === form.id ? { ...c, ...form } as Contrato : c)) : [{ ...form, id: crypto.randomUUID(), cadastradoEm: new Date().toISOString().slice(0, 10) } as Contrato, ...s.contratos] }));
    setForm(null); setVer(null); toast.success("Contrato salvo. Contratos anteriores continuam no histórico.");
  };

  return (
    <AppShell>
      <PageTitle title="Fornecedores" subtitle="Prestadores de serviço e contratos." />
      <div className="space-y-3">
        {st.fornecedores.map((f) => {
          const c = contratoAtivo(f.id, st.contratos);
          const s = c && statusContrato(c);
          return (
            <Card key={f.id}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{f.nome}</p>
                  <p className="text-sm text-muted-foreground">{f.servico}{c ? ` • Vence em ${br(c.vencimento)}${c.valor ? ` • ${brl(c.valor)}/${c.periodicidade.toLowerCase()}` : ""}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c && s ? <><Badge tone={STATUS_TONE[s]}>{s}</Badge><Button onClick={() => setVer(c)}><FileText className="h-4 w-4" />Ver Contrato Ativo</Button></>
                    : <><span className="text-sm text-muted-foreground">Sem contrato ativo</span>{gestor && <Button variant="outline" onClick={() => setForm(novo(f.id))}><Plus className="h-4 w-4" />Cadastrar contrato</Button>}</>}
                  <Button variant="ghost" onClick={() => setHist(f.id)}><History className="h-4 w-4" />Histórico</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!ver} onOpenChange={(o) => !o && setVer(null)}>
        <DialogContent className="sm:max-w-lg">
          {ver && <>
            <DialogHeader><DialogTitle>{nomeF(ver.fornecedorId)}</DialogTitle></DialogHeader>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[["Serviço", ver.servico], ["Contrato", ver.numero], ["Início", br(ver.inicio)], ["Vencimento", br(ver.vencimento)], ["Valor", ver.valor ? brl(ver.valor) : "—"], ["Periodicidade", ver.periodicidade], ["Situação", statusContrato(ver) + (ver.prorrogado ? " (prorrogado)" : "")], ["Documento", ver.arquivo?.nome ?? "Nenhum anexo"]].map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!ver.arquivo} onClick={() => setPdf(ver.arquivo!.url)}><Eye className="h-4 w-4" />Visualizar documento</Button>
              {ver.arquivo ? <a href={ver.arquivo.url} download={ver.arquivo.nome} className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium"><Download className="h-4 w-4" />Baixar contrato</a> : <Button variant="outline" disabled><Download className="h-4 w-4" />Baixar contrato</Button>}
              {gestor && <Button variant="outline" onClick={() => setForm({ ...ver })}><Pencil className="h-4 w-4" />Editar informações</Button>}
              {gestor && <Button variant="outline" onClick={() => setForm(novo(ver.fornecedorId, ver))}><RefreshCw className="h-4 w-4" />Renovar</Button>}
            </div>
            {!ver.arquivo && <p className="text-xs text-muted-foreground">Nenhum PDF anexado a este contrato de exemplo.</p>}
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pdf} onOpenChange={(o) => !o && setPdf(null)}>
        <DialogContent className="h-[90vh] sm:max-w-4xl">{pdf && <iframe src={pdf} title="Contrato" className="h-full w-full rounded-lg border" />}</DialogContent>
      </Dialog>

      <Dialog open={!!hist} onOpenChange={(o) => !o && setHist(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Histórico de contratos — {hist && nomeF(hist)}</DialogTitle></DialogHeader>
          <ul className="divide-y">{st.contratos.filter((c) => c.fornecedorId === hist).map((c) => { const s = statusContrato(c); return <li key={c.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{c.numero}</p><p className="text-sm text-muted-foreground">{br(c.inicio)} a {br(c.vencimento)}</p></div><div className="flex items-center gap-2"><Badge tone={STATUS_TONE[s]}>{s}</Badge><Button size="sm" variant="outline" onClick={() => { setHist(null); setVer(c); }}>Ver</Button></div></li>; })}
            {!st.contratos.some((c) => c.fornecedorId === hist) && <p className="py-4 text-muted-foreground">Nenhum contrato cadastrado.</p>}</ul>
        </DialogContent>
      </Dialog>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Editar contrato" : "Cadastrar contrato"}</DialogTitle></DialogHeader>
          {form && <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
            <Field label="Fornecedor"><select className={inputCls} value={form.fornecedorId} onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })}>{st.fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></Field>
            <Field label="Tipo de serviço"><input required className={inputCls} value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} /></Field>
            <Field label="Identificação do contrato"><input required className={inputCls} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Field>
            <Field label="Data de assinatura"><input type="date" className={inputCls} value={form.assinatura} onChange={(e) => setForm({ ...form, assinatura: e.target.value })} /></Field>
            <Field label="Início"><input type="date" required className={inputCls} value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></Field>
            <Field label="Vencimento"><input type="date" required className={inputCls} value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>
            <Field label="Valor (R$)"><input type="number" step="0.01" min="0" className={inputCls} value={form.valor ?? ""} onChange={(e) => setForm({ ...form, valor: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Periodicidade"><select className={inputCls} value={form.periodicidade} onChange={(e) => setForm({ ...form, periodicidade: e.target.value })}>{["Mensal", "Trimestral", "Semestral", "Anual", "Única"].map((p) => <option key={p}>{p}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Observações"><textarea rows={2} className={cn(inputCls, "h-auto py-2")} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Anexo em PDF"><input type="file" accept=".pdf,application/pdf" className={cn(inputCls, "py-2")} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.name.toLowerCase().endsWith(".pdf")) { toast.error("Envie um arquivo PDF."); return; } setForm({ ...form, arquivo: { nome: f.name, url: URL.createObjectURL(f) } }); }} /></Field></div>
            {form.id && <div className="flex flex-wrap gap-4 sm:col-span-2">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!form.prorrogado} onChange={(e) => setForm({ ...form, prorrogado: e.target.checked })} />Prorrogado</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!form.encerrado} onChange={(e) => setForm({ ...form, encerrado: e.target.checked })} />Encerrado administrativamente</label>
            </div>}
            <p className="text-xs text-muted-foreground sm:col-span-2">Demonstração: o PDF fica só nesta sessão.</p>
            <Button size="lg" type="submit" className="sm:col-span-2">Salvar contrato</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
