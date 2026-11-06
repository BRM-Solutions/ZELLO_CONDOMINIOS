import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Check, Filter, Paperclip, Eye } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnexosLista, AnexosPicker } from "@/components/vg/AnexosPicker";
import { pageHead, useStore } from "@/lib/store";
import { CATEGORIAS, STATUS_OCORRENCIA, fmtDataHora, statusTone, type Categoria, type OcorrStatus } from "@/lib/ocorrencias";
import { PRIORIDADES, prioridadeTone, type Prioridade } from "@/lib/ordens";
import type { Anexo } from "@/lib/anexos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ocorrencias")({
  head: pageHead("Ocorrências do Condomínio", "Registros de moradores e da administração, com filtros por status, categoria e mês."),
  component: Ocorrencias,
});

function Ocorrencias() {
  const { ocorrencias, criarOcorrencia, alterarOcorrencia, anexarOcorrencia, role, user } = useStore();
  const gestor = role === "sindico" || role === "admin";
  const [st, setSt] = useState<OcorrStatus | "">("");
  const [cat, setCat] = useState<Categoria | "">("");
  const [mes, setMes] = useState("");
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ titulo: "", categoria: CATEGORIAS[0] as Categoria, descricao: "", anexos: [] as Anexo[] });
  const [ver, setVer] = useState<string | null>(null);
  const [extra, setExtra] = useState<Anexo[]>([]);

  const [concluir, setConcluir] = useState<string | null>(null);
  const [solucao, setSolucao] = useState("");
  const [minhas, setMinhas] = useState(role === "morador");
  const meses = [...new Set(ocorrencias.map((o) => o.criadaEm.slice(0, 7)))].sort().reverse();
  const lista = ocorrencias.filter((o) => (!minhas || o.autor === user.nome) && (!st || o.status === st) && (!cat || o.categoria === cat) && (!mes || o.criadaEm.startsWith(mes)) && (!q || (o.protocolo ?? "").toLowerCase().includes(q.trim().toLowerCase())));
  const atual = ocorrencias.find((o) => o.id === ver);
  // Morador só vê anexos das próprias ocorrências; gestão vê todos.
  const podeVerAnexos = (autor: string) => role !== "morador" || autor === user.nome;
  const fase = (s: OcorrStatus) => (s === "Concluída" ? "Conclusão" : "Acompanhamento");

  return (
    <AppShell>
      <PageTitle title="Ocorrências do Condomínio" subtitle="Registros de moradores e da administração."
        action={role !== "conselho" && <Button size="lg" onClick={() => setNovo(true)}><Plus className="h-5 w-5" />Nova ocorrência</Button>} />
      {role === "morador" && <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        <Button role="tab" aria-selected={minhas} size="lg" variant={minhas ? "primary" : "outline"} onClick={() => setMinhas(true)}>Minhas Solicitações</Button>
        <Button role="tab" aria-selected={!minhas} size="lg" variant={!minhas ? "primary" : "outline"} onClick={() => setMinhas(false)}>Todas</Button>
      </div>}
      <Card className="mb-4">
        <CardTitle icon={<Filter className="h-5 w-5" />} title="Filtros" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Protocolo"><input className={inputCls} placeholder="Ex.: OC-2026-0001" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Status"><select className={inputCls} value={st} onChange={(e) => setSt(e.target.value as OcorrStatus)}><option value="">Todos</option>{STATUS_OCORRENCIA.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Categoria"><select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value as Categoria)}><option value="">Todas</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Mês"><select className={inputCls} value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos</option>{meses.map((m) => <option key={m} value={m}>{m.split("-").reverse().join("/")}</option>)}</select></Field>
        </div>
      </Card>
      <Card>
        <ul className="divide-y">
          {lista.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma ocorrência com esses filtros.</p>}
          {lista.map((o) => (
            <li key={o.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">Protocolo {o.protocolo}</p>
                <p className="text-base font-semibold">{o.titulo}</p>
                <p className="text-sm text-muted-foreground">{o.categoria} • {o.autor} ({o.apto}) • Aberta em {fmtDataHora(o.criadaEm)}</p>
                {o.concluidaEm && <p className="text-sm font-medium text-primary">Concluída em {fmtDataHora(o.concluidaEm)}</p>}
                {podeVerAnexos(o.autor) && !!o.anexos?.length && <p className="flex items-center gap-1 text-sm text-muted-foreground"><Paperclip className="h-4 w-4" />{o.anexos.length} anexo(s)</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[o.status]}>{o.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => { setVer(o.id); setExtra([]); }}><Eye className="h-4 w-4" />Ver detalhes</Button>
                {o.prioridade && <Badge tone={prioridadeTone[o.prioridade]}>Prioridade {o.prioridade}</Badge>}
                {gestor && o.status === "Aberta" && (
                  <select aria-label="Prioridade" className={cn(inputCls, "h-9 w-auto")} value={o.prioridade ?? ""} onChange={(e) => { alterarOcorrencia(o.id, "Em andamento", { prioridade: e.target.value as Prioridade }); toast.success("Triagem feita: ocorrência em andamento"); }}>
                    <option value="">Triar (prioridade)</option>{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                )}
                {gestor && (o.status === "Em andamento" || o.status === "Executada") && (
                  <Button size="sm" variant="outline" onClick={() => { setConcluir(o.id); setSolucao(""); }}>
                    <Check className="h-4 w-4" />Validar e concluir
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Demonstração: os anexos ficam só nesta sessão.</p>
      </Card>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Nova ocorrência</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const p = criarOcorrencia(f); setF({ titulo: "", categoria: CATEGORIAS[0], descricao: "", anexos: [] }); setNovo(false); toast.success(`Ocorrência registrada — Protocolo ${p}`, { description: "Enviado conforme suas preferências em Configurações." }); }}>
            <Field label="Título"><input required className={inputCls} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Field>
            <Field label="Categoria"><select className={inputCls} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as Categoria })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Descrição"><textarea rows={4} className={cn(inputCls, "h-auto py-2")} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
            <div>
              <h3 className="text-lg font-semibold">Anexos da Ocorrência</h3>
              <p className="mb-2 text-sm text-muted-foreground">Adicione fotos, vídeos ou documentos para registrar e acompanhar esta ocorrência.</p>
              <AnexosPicker value={f.anexos} onChange={(anexos) => setF({ ...f, anexos })} autor={user.nome} fase="Abertura" />
            </div>
            <Button size="lg" type="submit" className="w-full">Registrar ocorrência</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!concluir} onOpenChange={(o) => !o && setConcluir(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Concluir ocorrência</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (concluir) alterarOcorrencia(concluir, "Concluída", { solucao }); setConcluir(null); toast.success("Ocorrência concluída", { description: "O solicitante recebe o protocolo e o resumo da solução conforme as preferências dele." }); }}>
            <Field label="Resumo da solução"><textarea required rows={3} className={cn(inputCls, "h-auto py-2")} value={solucao} onChange={(e) => setSolucao(e.target.value)} /></Field>
            <Button size="lg" type="submit" className="w-full">Concluir e avisar o solicitante</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!atual} onOpenChange={(o) => !o && setVer(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {atual && <>
            <DialogHeader><DialogTitle>{atual.protocolo} — {atual.titulo}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{atual.categoria} • {atual.autor} • {fmtDataHora(atual.criadaEm)}</p>
            {atual.descricao && <p>{atual.descricao}</p>}
            {atual.solucao && <p className="rounded-xl bg-success-soft p-3 text-sm"><strong>Solução:</strong> {atual.solucao}</p>}
            <h3 className="mt-2 text-lg font-semibold">Anexos da Ocorrência</h3>
            {podeVerAnexos(atual.autor) ? <AnexosLista anexos={atual.anexos ?? []} /> : <p className="text-sm text-muted-foreground">Os anexos desta ocorrência são privados.</p>}
            {(gestor || atual.autor === user.nome) && <div className="space-y-2 border-t pt-3">
              <p className="font-semibold">Adicionar anexo de {fase(atual.status).toLowerCase()}</p>
              <AnexosPicker value={extra} onChange={setExtra} autor={user.nome} fase={fase(atual.status)} />
              <Button disabled={!extra.length} onClick={() => { anexarOcorrencia(atual.id, extra); setExtra([]); toast.success("Anexos adicionados"); }}>Salvar anexos</Button>
            </div>}
          </>}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
