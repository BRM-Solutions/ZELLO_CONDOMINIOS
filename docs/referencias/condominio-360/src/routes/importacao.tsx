import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileUp } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { pageHead, useStore } from "@/lib/store";
import { MODELOS, templateCsv, validarCsv, type LinhaValidada } from "@/lib/importacao";
import { preventivaStore } from "@/lib/preventiva";
import { ordensStore, proximoCodigoOS, ZELADOR } from "@/lib/ordens";
import { obrasStore } from "@/lib/obras";

export const Route = createFileRoute("/importacao")({
  head: pageHead("Central de Configuração e Importação", "Modelos de planilha, validação, pré-visualização e relatório de importação em massa."),
  component: Importacao,
});

type Registro = { data: string; usuario: string; arquivo: string; modulo: string; criados: number; rejeitados: number };

function Importacao() {
  const { user, ocorrencias, criarOcorrencia } = useStore();
  const [i, setI] = useState(0);
  const [arquivo, setArquivo] = useState("");
  const [res, setRes] = useState<{ erroEstrutura: string | null; linhas: LinhaValidada[] } | null>(null);
  const [trilha, setTrilha] = useState<Registro[]>([]);
  const m = MODELOS[i]!;

  const existentes = () => {
    if (m.modulo === "Manutenção Preventiva") return preventivaStore.get().itens.map((x) => x.item);
    if (m.modulo === "Ordens de Serviço") return ordensStore.get().ordens.map((x) => x.titulo);
    if (m.modulo === "Ocorrências") return ocorrencias.map((x) => x.titulo);
    if (m.modulo === "Obras e Instalações") return obrasStore.get().obras.map((x) => x.nome);
    return [];
  };

  const baixar = () => {
    const url = URL.createObjectURL(new Blob(["\ufeff" + templateCsv(m)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `modelo-${m.modulo.toLowerCase().replace(/\s+/g, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const confirmar = () => {
    if (!res) return;
    const ok = res.linhas.filter((l) => l.situacao === "Criar");
    type D = Partial<Record<"item" | "local" | "periodicidade" | "responsavel" | "criticidade" | "proxima_execucao" | "titulo" | "prioridade" | "prazo" | "categoria" | "descricao" | "nome" | "fornecedor" | "orcamento" | "inicio" | "fim", string>>;
    ok.forEach(({ dados }) => {
      const d = dados as D;
      if (m.modulo === "Manutenção Preventiva") preventivaStore.set((s) => ({ itens: [...s.itens, { id: crypto.randomUUID(), item: d.item!, local: d.local!, periodicidade: (d.periodicidade as never) || "Mensal", responsavel: d.responsavel || "A definir", criticidade: (d.criticidade as never) || "Média", ultima: "", proxima: d.proxima_execucao!, evidencias: [], historico: [] }] }));
      if (m.modulo === "Ordens de Serviço") ordensStore.set((s) => ({ ordens: [...s.ordens, { id: crypto.randomUUID(), codigo: proximoCodigoOS(s.ordens.map((o) => o.codigo)), titulo: d.titulo!, local: d.local!, recorrencia: "Pontual", prioridade: (d.prioridade as never) || "Média", prazo: d.prazo!, responsavel: d.responsavel || ZELADOR, status: "A fazer", checklist: [], evidencias: [], mensagens: [] }] }));
      if (m.modulo === "Ocorrências") criarOcorrencia({ titulo: d.titulo!, categoria: (d.categoria as never) || "Outros", descricao: d.descricao ?? "" });
      if (m.modulo === "Obras e Instalações") obrasStore.set((s) => ({ obras: [...s.obras, { id: crypto.randomUUID(), nome: d.nome!, tipo: "Obra", local: d.local!, responsavel: user.nome, fornecedor: d.fornecedor ?? "", orcamentoAprovado: Number(d.orcamento) || 0, custoRealizado: 0, inicio: d.inicio ?? "", fim: d.fim ?? "", status: "Planejada", etapas: [], documentos: [] }] }));
    });
    setTrilha([{ data: new Date().toLocaleString("pt-BR"), usuario: user.nome, arquivo, modulo: m.modulo, criados: m.modulo === "Contratos" ? 0 : ok.length, rejeitados: res.linhas.length - ok.length }, ...trilha]);
    toast.success(m.modulo === "Contratos" ? "Validação concluída" : `${ok.length} registro(s) importado(s)`, { description: m.modulo === "Contratos" ? "Contratos validados; cadastre os arquivos em Fornecedores." : `${res.linhas.length - ok.length} rejeitado(s) ou duplicado(s).` });
    setRes(null); setArquivo("");
  };

  return (
    <AppShell>
      <PageTitle title="Central de Configuração e Importação" subtitle="Cadastre em massa: baixe o modelo, preencha, envie e confira antes de gravar." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card><CardTitle icon={<FileUp className="h-5 w-5" />} title="1. Escolha o módulo" />
          <Field label="Módulo"><select className={inputCls} value={i} onChange={(e) => { setI(Number(e.target.value)); setRes(null); }}>{MODELOS.map((x, j) => <option key={x.modulo} value={j}>{x.modulo}</option>)}</select></Field>
          <p className="mt-3 text-sm"><strong>Obrigatórios:</strong> {m.obrigatorios.join(", ")}</p>
          <p className="text-sm"><strong>Opcionais:</strong> {m.opcionais.join(", ")}</p>
          <Button className="mt-3 w-full" variant="outline" onClick={baixar}><Download className="h-5 w-5" />Baixar modelo (CSV)</Button>
          <label className="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground"><FileUp className="h-5 w-5" />2. Enviar planilha CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setArquivo(f.name); setRes(validarCsv(await f.text(), m, existentes())); e.target.value = ""; }} />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">Arquivos XLSX: salve como CSV antes de enviar. Arquivos ZIP de contratos ainda não são lidos nesta demonstração.</p>
        </Card>
        <Card><CardTitle title="3. Pré-visualização e validação" />
          {!res && <p className="text-muted-foreground">Envie uma planilha para ver os registros antes de gravar.</p>}
          {res?.erroEstrutura && <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-destructive">{res.erroEstrutura}</p>}
          {res && !res.erroEstrutura && <>
            <p className="mb-2 text-sm">{arquivo}: {res.linhas.filter((l) => l.situacao === "Criar").length} a criar • {res.linhas.filter((l) => l.situacao === "Duplicada").length} duplicada(s) • {res.linhas.filter((l) => l.situacao === "Rejeitada").length} com erro</p>
            <ul className="mb-3 max-h-80 divide-y overflow-y-auto">{res.linhas.map((l) => (
              <li key={l.linha} className="flex items-start justify-between gap-2 py-2 text-sm"><span className="min-w-0">Linha {l.linha}: {l.dados[m.chave] || "—"}{!!l.erros.length && <span className="block text-destructive">{l.erros.join("; ")}</span>}</span>
                <Badge tone={l.situacao === "Criar" ? "success" : l.situacao === "Duplicada" ? "warning" : "danger"}>{l.situacao}</Badge></li>))}</ul>
            <Button size="lg" disabled={!res.linhas.some((l) => l.situacao === "Criar")} onClick={confirmar}>4. Confirmar importação</Button>
          </>}
        </Card>
      </div>
      <Card className="mt-4"><CardTitle title="Trilha de auditoria" />
        <ul className="divide-y text-sm">{trilha.map((t, j) => <li key={j} className="py-2">{t.data} • {t.usuario} • {t.modulo} • {t.arquivo} — {t.criados} criado(s), {t.rejeitados} rejeitado(s)</li>)}{!trilha.length && <li className="py-2 text-muted-foreground">Nenhuma importação nesta sessão.</li>}</ul>
      </Card>
    </AppShell>
  );
}
