import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareHeart, History } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { AnexosPicker, AnexosLista } from "@/components/vg/AnexosPicker";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { pageHead, useStore } from "@/lib/store";
import { AREAS_FEEDBACK, EXT_FEEDBACK, TIPOS_FEEDBACK, feedbackStore, feedbacksVisiveis, proximoProtocoloFeedback, type Feedback } from "@/lib/feedback";
import type { Anexo } from "@/lib/anexos";

const SUB = "Sua opinião nos ajuda a melhorar. Compartilhe sugestões ou informe problemas encontrados no Gaudí 360°.";
export const Route = createFileRoute("/feedback")({ head: pageHead("Feedback do Portal", SUB), component: FeedbackPage });

const tone = (s: Feedback["status"]) => (s === "Resolvido" ? "success" : s === "Encerrado" ? "neutral" : s === "Recebido" ? "info" : "warning");

function FeedbackPage() {
  const { user, role, tenant } = useStore();
  const st = feedbackStore.use();
  const [tipo, setTipo] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const visiveis = feedbacksVisiveis(st.lista, { autor: user.nome, sindico: role === "sindico", condominio: tenant.legalName }, st.sindicoAcompanha);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || !titulo.trim() || !descricao.trim()) { toast.error("Preencha tipo, título e descrição."); return; }
    const protocolo = proximoProtocoloFeedback(st.lista.map((f) => f.protocolo), new Date().getFullYear());
    feedbackStore.set((s) => ({ ...s, lista: [{ id: crypto.randomUUID(), protocolo, tipo: tipo as Feedback["tipo"], titulo: titulo.trim(), descricao: descricao.trim(), area: area || undefined, anexos, autor: user.nome, perfil: user.cargo, condominio: tenant.legalName, criadoEm: new Date().toISOString(), status: "Recebido" }, ...s.lista] }));
    toast.success(`Obrigado por contribuir! Seu feedback foi registrado e ajudará a melhorar o Gaudí 360°. Protocolo ${protocolo}`);
    setTipo(""); setTitulo(""); setDescricao(""); setArea(""); setAnexos([]);
  };

  return (
    <AppShell>
      <PageTitle title="Feedback do Portal" subtitle={SUB} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<MessageSquareHeart className="h-5 w-5" />} title="Enviar feedback" />
          <form onSubmit={enviar} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tipo de feedback *</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TIPOS_FEEDBACK.map((t) => (
                  <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-base ${tipo === t ? "border-primary bg-primary-soft" : ""}`}>
                    <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} />{t}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Título *"><input className={inputCls} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} /></Field>
            <Field label="Descrição *"><textarea className={`${inputCls} h-32 py-2`} placeholder="Conte o que aconteceu ou o que você gostaria de melhorar." value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Field>
            <Field label="Área do portal (opcional)">
              <select className={inputCls} value={area} onChange={(e) => setArea(e.target.value)}><option value="">Selecione</option>{AREAS_FEEDBACK.map((a) => <option key={a}>{a}</option>)}</select>
            </Field>
            <div><p className="mb-1.5 text-sm font-medium">Anexar evidências (opcional)</p><AnexosPicker value={anexos} onChange={setAnexos} autor={user.nome} permitidas={EXT_FEEDBACK} /></div>
            <Button type="submit" size="lg" className="w-full">Enviar Feedback</Button>
            <p className="text-xs text-muted-foreground">Ambiente de demonstração: o feedback e os anexos ficam salvos só até a página ser recarregada.</p>
          </form>
        </Card>
        <Card>
          <CardTitle icon={<History className="h-5 w-5" />} title={role === "sindico" && st.sindicoAcompanha ? "Feedbacks do condomínio" : "Meus feedbacks"} />
          {!visiveis.length && <p className="text-muted-foreground">Você ainda não enviou feedbacks.</p>}
          <ul className="space-y-3">
            {visiveis.map((f) => (
              <li key={f.id} className="rounded-xl border p-3">
                <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 text-left" onClick={() => setAberto(aberto === f.id ? null : f.id)}>
                  <span className="min-w-0"><span className="block font-medium">{f.titulo}</span><span className="block text-sm text-muted-foreground">{f.protocolo} • {f.tipo} • {new Date(f.criadoEm).toLocaleDateString("pt-BR")}</span></span>
                  <Badge tone={tone(f.status)}>{f.status}</Badge>
                </button>
                {aberto === f.id && <div className="mt-3 space-y-2 text-sm"><p>{f.descricao}</p>{f.resposta && <p className="rounded-lg bg-muted p-2"><b>Resposta:</b> {f.resposta}</p>}<AnexosLista anexos={f.anexos} /></div>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
