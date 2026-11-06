import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Upload, FileSpreadsheet, FileText, AlertTriangle, Check, History, ArrowLeft, Paperclip, ReceiptText, Scale, Gavel } from "lucide-react";
import { NotasFiscais } from "@/components/vg/NotasFiscais";
import { ConferenciaMensal } from "@/components/vg/ConferenciaMensal";
import { OrcamentosPropostas } from "@/components/vg/OrcamentosPropostas";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { pageHead, useStore } from "@/lib/store";
import { brl, finStore, linhasDoTexto, montarLinhas, validarArquivo, type Importacao, type Linha } from "@/lib/financeiro";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro")({
  head: pageHead("Financeiro", "Receitas, despesas, importação de planilhas e documentos financeiros do condomínio."),
  component: Financeiro,
});

const CAMPOS = ["data", "descricao", "categoria", "tipo", "valor"] as const;
const NOME_CAMPO: Record<(typeof CAMPOS)[number], string> = { data: "Data", descricao: "Descrição", categoria: "Categoria", tipo: "Tipo (Receita/Despesa)", valor: "Valor" };
const ETAPAS = ["Enviar arquivo", "Analisar dados", "Conferir informações", "Confirmar importação"];
const br = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

type Planilha = { abas: string[]; aba: string; linhas: Record<string, unknown>[]; colunas: string[]; mapa: Partial<Record<"data" | "descricao" | "categoria" | "tipo" | "valor", string>>; wb: unknown };

function Financeiro() {
  const { role, user } = useStore();
  const st = finStore.use();
  const pode = role === "sindico" || role === "admin";
  const [aba, setAba] = useState<"resumo" | "importar" | "historico" | "notas" | "conferencia" | "propostas">("resumo");
  const [etapa, setEtapa] = useState(0);
  const [arq, setArq] = useState<File | null>(null);
  const [modo, setModo] = useState<"dados" | "anexo">("dados");
  const [plan, setPlan] = useState<Planilha | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [aviso, setAviso] = useState("");
  const [drag, setDrag] = useState(false);

  if (role === "superadmin" || role === "morador") return <AppShell><PageTitle title="Financeiro" /><Card>Os dados financeiros internos não estão disponíveis para este perfil.</Card></AppShell>;

  const conf = st.lancamentos;
  const rec = conf.filter((l) => l.tipo === "Receita").reduce((a, l) => a + l.valor, 0);
  const desp = conf.filter((l) => l.tipo === "Despesa").reduce((a, l) => a + l.valor, 0);
  const importados = conf.some((l) => l.origem !== "Lançamento manual");

  const registrar = (status: Importacao["status"], registros: number, periodo = "") => {
    if (!arq) return;
    finStore.set((s) => ({ ...s, importacoes: [{ id: crypto.randomUUID(), arquivo: arq.name, tipo: arq.name.split(".").pop()!.toUpperCase(), tamanho: arq.size, periodo, data: new Date().toLocaleString("pt-BR"), responsavel: user.nome, registros, status, url: URL.createObjectURL(arq) }, ...s.importacoes] }));
  };
  const reiniciar = () => { setEtapa(0); setArq(null); setPlan(null); setLinhas([]); setAviso(""); };

  const escolher = (f: File | undefined) => { if (!f) return; const e = validarArquivo(f.name, f.size); if (e) { toast.error(e); return; } setArq(f); };

  const analisar = async () => {
    if (!arq) return;
    if (modo === "anexo") { registrar("Anexado", 0); toast.success("Documento anexado ao histórico de balancetes"); reiniciar(); setAba("historico"); return; }
    setEtapa(1); setAviso("");
    try {
      if (arq.name.toLowerCase().endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist");
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const doc = await pdfjs.getDocument({ data: await arq.arrayBuffer() }).promise;
        let texto = "";
        for (let p = 1; p <= doc.numPages; p++) {
          const c = await (await doc.getPage(p)).getTextContent();
          let lastY: number | null = null;
          for (const it of c.items as { str: string; transform: number[] }[]) { const y = it.transform[5]!; texto += lastY !== null && Math.abs(y - lastY) > 2 ? "\n" : " "; texto += it.str; lastY = y; }
          texto += "\n";
        }
        if (texto.replace(/\s/g, "").length < 20) { setAviso("Não encontramos texto neste PDF (pode ser uma imagem digitalizada). Você pode guardá-lo apenas como documento."); setEtapa(0); return; }
        const brutas = linhasDoTexto(texto);
        if (!brutas.length) { setAviso("Não foi possível identificar lançamentos com data e valor com segurança. Você pode guardar o PDF apenas como documento."); setEtapa(0); return; }
        setLinhas(montarLinhas(brutas, arq.name, conf)); setEtapa(2);
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await arq.arrayBuffer(), { type: "array", cellDates: false });
        abrirAba(XLSX, wb, wb.SheetNames[0]!);
      }
    } catch (e) {
      registrar("Falha no processamento", 0); setEtapa(0); setAviso(`Falha ao ler o arquivo: ${(e as Error).message}`);
    }
  };

  const abrirAba = (XLSX: typeof import("xlsx"), wb: import("xlsx").WorkBook, nome: string) => {
    const linhasA = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nome]!, { defval: "" });
    const colunas = Object.keys(linhasA[0] ?? {});
    const achar = (re: RegExp) => colunas.find((c) => re.test(c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) ?? "";
    setPlan({ abas: wb.SheetNames, aba: nome, linhas: linhasA, colunas, wb, mapa: { data: achar(/data|venc|pagam/), descricao: achar(/descr|hist|lanc/), categoria: achar(/categ|conta|grupo/), tipo: achar(/tipo|natur|d\/c/), valor: achar(/valor|montante|total/) } });
    setEtapa(1);
  };

  const aplicarMapa = () => {
    if (!plan || !arq) return;
    if (!plan.mapa.data || !plan.mapa.valor) { toast.error("Relacione pelo menos as colunas de Data e Valor."); return; }
    const brutas = plan.linhas.map((l) => ({ data: l[plan.mapa.data!], descricao: plan.mapa.descricao ? l[plan.mapa.descricao] : "", categoria: plan.mapa.categoria ? l[plan.mapa.categoria] : "", tipo: plan.mapa.tipo ? l[plan.mapa.tipo] : "", valor: l[plan.mapa.valor!] }));
    setLinhas(montarLinhas(brutas, `${arq.name} • ${plan.aba}`, conf)); setEtapa(2);
  };

  const sel = linhas.filter((l) => l.selecionado);
  const confirmar = (rascunho: boolean) => {
    const datas = sel.map((l) => l.data).filter(Boolean).sort();
    const periodo = datas.length ? `${br(datas[0]!)} a ${br(datas.at(-1)!)}` : "";
    if (rascunho) { registrar("Aguardando conferência", sel.length, periodo); toast.success("Rascunho salvo no histórico"); reiniciar(); return; }
    finStore.set((s) => ({ ...s, lancamentos: [...sel.map((l) => ({ id: crypto.randomUUID(), data: l.data, descricao: l.descricao, categoria: l.categoria || "Sem categoria", tipo: l.tipo, valor: l.valor, situacao: "Previsto" as const, origem: l.origem })), ...s.lancamentos] }));
    registrar(sel.length === linhas.length ? "Importado" : "Importado parcialmente", sel.length, periodo);
    toast.success(`${sel.length} registros importados`); reiniciar(); setAba("resumo");
  };
  const upd = (id: string, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => { if (l.id !== id) return l; const n = { ...l, ...p }; n.problemas = [!n.data && "Data não identificada", !n.descricao && "Sem descrição", !(n.valor > 0) && "Valor não identificado"].filter(Boolean) as string[]; return n; }));

  const tabs = [["resumo", "Resumo", FileSpreadsheet], ...(pode ? [["importar", "Importar Balancete Mensal", FileUp]] : []), ["notas", "Notas Fiscais e Recibos", ReceiptText], ["conferencia", "Conferência Mensal", Scale], ["propostas", "Orçamentos e Propostas", Gavel], ["historico", "Histórico de Importações", History]] as [typeof aba, string, typeof FileUp][];

  return (
    <AppShell>
      <PageTitle title="Financeiro" subtitle="Receitas, despesas e saldo do condomínio."
        action={pode && aba !== "importar" && <Button size="lg" onClick={() => setAba("importar")}><FileUp className="h-5 w-5" />Importar Balancete Mensal</Button>} />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">{tabs.map(([k, l, I]) => <Button key={k} role="tab" aria-selected={aba === k} size="lg" variant={aba === k ? "primary" : "outline"} onClick={() => setAba(k)}><I className="h-5 w-5" />{l}</Button>)}</div>

      {aba === "resumo" && <>
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card><p className="text-sm text-muted-foreground">Receitas</p><p className="text-2xl font-bold">{brl(rec)}</p></Card>
          <Card><p className="text-sm text-muted-foreground">Despesas</p><p className="text-2xl font-bold">{brl(desp)}</p></Card>
          <Card><p className="text-sm text-muted-foreground">Resultado calculado</p><p className="text-2xl font-bold">{brl(rec - desp)}</p>{importados && <p className="text-xs text-muted-foreground">Calculado a partir de documentos — não é saldo bancário confirmado.</p>}</Card>
        </div>
        <Card><CardTitle title="Lançamentos" />
          <ul className="divide-y">{conf.map((l) => <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="truncate font-medium">{l.descricao}</p><p className="truncate text-sm text-muted-foreground">{br(l.data)} • {l.tipo} • {l.categoria} • {l.origem}</p></div><div className="flex items-center gap-2"><span className="font-semibold">{brl(l.valor)}</span><Badge tone={l.situacao === "Previsto" ? "warning" : "success"}>{l.situacao}</Badge></div></li>)}</ul>
        </Card>
      </>}

      {aba === "importar" && pode && <Card>
        <h2 className="text-2xl">Importar Balancete Mensal</h2>
        <p className="mb-4 text-muted-foreground">Envie o balancete mensal da administradora (Excel ou PDF). Os lançamentos importados não alteram as despesas registradas em Notas Fiscais e Recibos.</p>
        <ol className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">{ETAPAS.map((e, i) => <li key={e} className={cn("rounded-xl border p-3 text-sm", i === etapa && "border-primary bg-success-soft font-semibold", i < etapa && "text-primary")} aria-current={i === etapa ? "step" : undefined}>{i < etapa ? <Check className="mr-1 inline h-4 w-4" /> : `${i + 1}. `}{e}</li>)}</ol>

        {etapa === 0 && <div className="space-y-4">
          <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); escolher(e.dataTransfer.files[0]); }}
            className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center", drag && "border-primary bg-success-soft")}>
            <Upload className="h-10 w-10 text-primary" /><span className="text-lg font-medium">Arraste o arquivo aqui ou clique para escolher</span><span className="text-sm text-muted-foreground">.xlsx, .xls ou .pdf • até 15 MB</span>
            <input type="file" accept=".xlsx,.xls,.pdf" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
          </label>
          {arq && <div className="rounded-xl border p-3 text-sm"><p className="font-semibold">{arq.name}</p><p>Formato: {arq.name.split(".").pop()!.toUpperCase()} • Tamanho: {(arq.size / 1024).toFixed(0)} KB • Envio: {new Date().toLocaleDateString("pt-BR")} • Responsável: {user.nome}</p></div>}
          <div className="grid gap-2 sm:grid-cols-2">
            {([["dados", "Importar dados financeiros", "Lê o arquivo e mostra os lançamentos para conferência."], ["anexo", "Anexar documento", "Guarda o arquivo sem alterar os dados financeiros."]] as const).map(([k, t, d]) => <button key={k} onClick={() => setModo(k)} className={cn("rounded-xl border p-4 text-left", modo === k && "border-primary ring-2 ring-primary")}><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></button>)}
          </div>
          {aviso && <div className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm"><AlertTriangle className="h-5 w-5 shrink-0" /><div>{aviso}<Button size="sm" variant="outline" className="ml-2" onClick={() => { setModo("anexo"); setAviso(""); }}>Guardar como documento</Button></div></div>}
          <Button size="lg" disabled={!arq} onClick={analisar}>{modo === "anexo" ? "Anexar documento" : "Analisar arquivo"}</Button>
        </div>}

        {etapa === 1 && !plan && <p className="py-6 text-center">Analisando o arquivo…</p>}
        {etapa === 1 && plan && <div className="space-y-4">
          {plan.abas.length > 1 && <Field label="Aba da planilha"><select className={inputCls} value={plan.aba} onChange={async (e) => abrirAba(await import("xlsx"), plan.wb as import("xlsx").WorkBook, e.target.value)}>{plan.abas.map((a) => <option key={a}>{a}</option>)}</select></Field>}
          <p className="text-sm">{plan.linhas.length} linhas encontradas. Relacione as colunas da planilha aos campos:</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{CAMPOS.map((c) => <Field key={c} label={NOME_CAMPO[c]}><select className={inputCls} value={plan.mapa[c] ?? ""} onChange={(e) => setPlan({ ...plan, mapa: { ...plan.mapa, [c]: e.target.value } })}><option value="">— não usar —</option>{plan.colunas.map((col) => <option key={col}>{col}</option>)}</select></Field>)}</div>
          <div className="flex gap-2"><Button variant="outline" size="lg" onClick={reiniciar}><ArrowLeft className="h-5 w-5" />Voltar</Button><Button size="lg" onClick={aplicarMapa}>Continuar</Button></div>
        </div>}

        {etapa === 2 && <div className="space-y-4">
          <h3 className="text-xl font-semibold">Conferir Balancete Importado</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">{[["Identificados", linhas.length], ["Receitas", linhas.filter((l) => l.tipo === "Receita").length], ["Despesas", linhas.filter((l) => l.tipo === "Despesa").length], ["Possíveis duplicidades", linhas.filter((l) => l.duplicado).length], ["Com inconsistências", linhas.filter((l) => l.problemas.length).length], ["Prontos", sel.length]].map(([k, v]) => <div key={k} className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-xl font-bold">{v}</p></div>)}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">Usar</th><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor (R$)</th><th>Validação</th></tr></thead>
            <tbody>{linhas.map((l) => <tr key={l.id} className={cn("border-b", (l.problemas.length || l.duplicado) && "bg-warning-soft/50")}>
              <td className="py-1"><input type="checkbox" className="h-5 w-5" checked={l.selecionado} disabled={!!l.problemas.length} onChange={(e) => upd(l.id, { selecionado: e.target.checked })} aria-label="Selecionar registro" /></td>
              <td><input type="date" className="h-9 rounded-lg border bg-card px-2" value={l.data} onChange={(e) => upd(l.id, { data: e.target.value })} /></td>
              <td><input className="h-9 w-full rounded-lg border bg-card px-2" value={l.descricao} onChange={(e) => upd(l.id, { descricao: e.target.value })} /></td>
              <td><input className="h-9 w-32 rounded-lg border bg-card px-2" value={l.categoria} onChange={(e) => upd(l.id, { categoria: e.target.value })} /></td>
              <td><select className="h-9 rounded-lg border bg-card px-2" value={l.tipo} onChange={(e) => upd(l.id, { tipo: e.target.value as "Receita" })}><option>Receita</option><option>Despesa</option></select></td>
              <td><input type="number" step="0.01" className="h-9 w-28 rounded-lg border bg-card px-2" value={l.valor || ""} onChange={(e) => upd(l.id, { valor: Number(e.target.value) })} /></td>
              <td>{l.problemas.length ? <Badge tone="danger">Revisar: {l.problemas.join(", ")}</Badge> : l.duplicado ? <Badge tone="warning">Possível duplicidade</Badge> : <Badge tone="success">Pronto</Badge>}</td>
            </tr>)}</tbody></table></div>
          <div className="flex gap-2"><Button variant="outline" size="lg" onClick={reiniciar}><ArrowLeft className="h-5 w-5" />Cancelar</Button><Button size="lg" disabled={!sel.length} onClick={() => setEtapa(3)}>Continuar ({sel.length})</Button></div>
        </div>}

        {etapa === 3 && <div className="space-y-4">
          <h3 className="text-xl font-semibold">Resumo do Balancete</h3>
          <ul className="space-y-1">
            <li>Documento: <b>{arq?.name}</b></li>
            <li>Receitas: <b>{brl(sel.filter((l) => l.tipo === "Receita").reduce((a, l) => a + l.valor, 0))}</b></li>
            <li>Despesas: <b>{brl(sel.filter((l) => l.tipo === "Despesa").reduce((a, l) => a + l.valor, 0))}</b></li>
            <li>Registros selecionados: <b>{sel.length}</b> • Ignorados: <b>{linhas.length - sel.length}</b></li>
          </ul>
          <p className="text-sm text-muted-foreground">Os lançamentos entram como "Previsto" e seguem a conferência do Financeiro.</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="lg" onClick={() => setEtapa(2)}><ArrowLeft className="h-5 w-5" />Voltar e corrigir</Button><Button variant="outline" size="lg" onClick={() => confirmar(true)}>Salvar como rascunho</Button><Button size="lg" onClick={() => confirmar(false)}><Check className="h-5 w-5" />Confirmar importação</Button></div>
        </div>}
      </Card>}

      {aba === "notas" && <NotasFiscais />}
      {aba === "conferencia" && <ConferenciaMensal />}
      {aba === "propostas" && <OrcamentosPropostas />}

      {aba === "historico" && <Card>
        <ul className="divide-y">
          {st.importacoes.map((i) => <li key={i.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0"><p className="flex items-center gap-2 truncate font-medium">{i.tipo === "PDF" ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}{i.arquivo}</p><p className="text-sm text-muted-foreground">{i.data} • {i.responsavel}{i.periodo && ` • ${i.periodo}`} • {i.registros} registros</p></div>
            <div className="flex items-center gap-2"><Badge tone={i.status.startsWith("Importado") || i.status === "Anexado" ? "success" : i.status.startsWith("Falha") || i.status === "Rejeitado" ? "danger" : "warning"}>{i.status}</Badge>{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary">Arquivo original</a>}</div>
          </li>)}
          {!st.importacoes.length && <p className="py-6 text-center text-muted-foreground">Nada por aqui ainda.</p>}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Demonstração: os arquivos ficam só nesta sessão.</p>
      </Card>}
    </AppShell>
  );
}
