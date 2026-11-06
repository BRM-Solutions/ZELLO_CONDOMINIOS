import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { AnexosLista } from "@/components/vg/AnexosPicker";
import { Badge, Button, Card, inputCls } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";
import { PRIORIDADES, STATUS_FEEDBACK, TIPOS_FEEDBACK, feedbackStore, recorrencias, type Feedback } from "@/lib/feedback";

const SUB = "Sugestões e problemas enviados pelos usuários de todos os condomínios.";
export const Route = createFileRoute("/plataforma/feedbacks")({ head: pageHead("Feedback do Portal", SUB, "ZELLO"), component: Gestao });

function exportar(lista: Feedback[]) {
  const linhas = [["Protocolo", "Condomínio", "Tipo", "Título", "Área", "Status", "Prioridade", "Data"], ...lista.map((f) => [f.protocolo, f.condominio, f.tipo, f.titulo, f.area ?? "", f.status, f.prioridade ?? "", new Date(f.criadoEm).toLocaleDateString("pt-BR")])];
  const csv = linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = "feedbacks.csv"; a.click();
}

function Gestao() {
  const st = feedbackStore.use();
  const [cond, setCond] = useState(""); const [tipo, setTipo] = useState(""); const [status, setStatus] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const rec = recorrencias(st.lista);
  const lista = st.lista.filter((f) => (!cond || f.condominio === cond) && (!tipo || f.tipo === tipo) && (!status || f.status === status));
  const upd = (id: string, p: Partial<Feedback>) => feedbackStore.set((s) => ({ ...s, lista: s.lista.map((f) => (f.id === id ? { ...f, ...p } : f)) }));
  return (
    <PlatformShell title="Feedback do Portal" subtitle={SUB}>
      <Card className="mb-4 grid gap-3 md:grid-cols-4">
        <select className={inputCls} value={cond} onChange={(e) => setCond(e.target.value)} aria-label="Condomínio"><option value="">Todos os condomínios</option>{[...new Set(st.lista.map((f) => f.condominio))].map((c) => <option key={c}>{c}</option>)}</select>
        <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{TIPOS_FEEDBACK.map((t) => <option key={t}>{t}</option>)}</select>
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Todos os status</option>{STATUS_FEEDBACK.map((t) => <option key={t}>{t}</option>)}</select>
        <Button variant="outline" onClick={() => exportar(lista)}><Download className="h-4 w-4" />Exportar CSV</Button>
      </Card>
      <Card>
        {!lista.length && <p className="text-muted-foreground">Nenhum feedback encontrado.</p>}
        <ul className="divide-y">
          {lista.map((f) => {
            const n = rec.get(f.titulo.trim().toLowerCase()) ?? 1;
            return (
              <li key={f.id} className="py-3">
                <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 text-left" onClick={() => setAberto(aberto === f.id ? null : f.id)}>
                  <span className="min-w-0"><span className="block font-medium">{f.titulo}{n > 1 && <span className="ml-2"><Badge tone="danger">Recorrente ({n})</Badge></span>}</span>
                    <span className="block text-sm text-muted-foreground">{f.protocolo} • {f.condominio} • {f.tipo}{f.area ? ` • ${f.area}` : ""}</span></span>
                  <Badge tone={f.status === "Resolvido" ? "success" : "info"}>{f.status}</Badge>
                </button>
                {aberto === f.id && (
                  <div className="mt-3 space-y-3 text-sm">
                    <p>{f.descricao}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <select className={inputCls} value={f.status} onChange={(e) => upd(f.id, { status: e.target.value as Feedback["status"] })} aria-label="Situação">{STATUS_FEEDBACK.map((s) => <option key={s}>{s}</option>)}</select>
                      <select className={inputCls} value={f.prioridade ?? ""} onChange={(e) => upd(f.id, { prioridade: (e.target.value || undefined) as Feedback["prioridade"] })} aria-label="Prioridade"><option value="">Sem prioridade</option>{PRIORIDADES.map((s) => <option key={s}>{s}</option>)}</select>
                    </div>
                    <textarea className={`${inputCls} h-20 py-2`} placeholder="Resposta ao usuário" defaultValue={f.resposta} onBlur={(e) => upd(f.id, { resposta: e.target.value })} />
                    <AnexosLista anexos={f.anexos} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </PlatformShell>
  );
}
