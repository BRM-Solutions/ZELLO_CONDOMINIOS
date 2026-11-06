import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck, Paperclip, FileText, Image as ImageIcon, Video, Presentation, Link2, Pencil, Trash2, Plus, ExternalLink, X } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, podeEditarAvisos, useStore, type Anexo, type AnexoTipo, type Comunicado } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comunicados")({
  head: pageHead("Avisos à Comunidade", "Informações, novidades e orientações para o dia a dia do nosso condomínio."),
  component: Comunicados,
});

const ICON: Record<AnexoTipo, typeof FileText> = { pdf: FileText, imagem: ImageIcon, video: Video, ppt: Presentation, link: Link2 };
const LABEL: Record<AnexoTipo, string> = { pdf: "PDF", imagem: "Imagem", video: "Vídeo", ppt: "Apresentação", link: "Link" };

export function tipoDoArquivo(nome: string): AnexoTipo | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "imagem";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  return null;
}

type Form = { titulo: string; corpo: string; prioridade: "normal" | "alta"; anexos: Anexo[] };
const vazio: Form = { titulo: "", corpo: "", prioridade: "normal", anexos: [] };

function Comunicados() {
  const { comunicados, marcarLido, marcarTodosLidos, publicarComunicado, editarComunicado, excluirComunicado, role } = useStore();
  const pode = podeEditarAvisos(role);
  const [ver, setVer] = useState<Comunicado | null>(null);
  const [edit, setEdit] = useState<{ id: string | null; f: Form } | null>(null);
  const [link, setLink] = useState({ nome: "", url: "" });

  const abrir = (c: Comunicado) => { setVer(c); marcarLido(c.id); };
  const addArquivos = (files: FileList | null) => {
    if (!files || !edit) return;
    const novos: Anexo[] = [];
    for (const f of Array.from(files)) {
      const t = tipoDoArquivo(f.name);
      if (!t) { toast.error(`Formato não aceito: ${f.name}`); continue; }
      novos.push({ tipo: t, nome: f.name, url: URL.createObjectURL(f) });
    }
    setEdit({ ...edit, f: { ...edit.f, anexos: [...edit.f.anexos, ...novos] } });
  };
  const salvar = () => {
    if (!edit) return;
    if (edit.id) { editarComunicado(edit.id, edit.f); toast.success("Aviso atualizado"); }
    else { publicarComunicado(edit.f); toast.success("Aviso publicado para todos os moradores"); }
    setEdit(null);
  };

  return (
    <AppShell>
      <PageTitle title="Avisos à Comunidade" subtitle="Informações, novidades e orientações para o dia a dia do nosso condomínio."
        action={pode ? <Button size="lg" onClick={() => setEdit({ id: null, f: vazio })}><Plus className="h-5 w-5" />Novo aviso</Button>
          : <Button variant="outline" size="sm" onClick={marcarTodosLidos}><CheckCheck className="h-4 w-4" />Marcar todos</Button>} />
      <div className="space-y-3">
        {comunicados.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum aviso publicado.</p>}
        {comunicados.map((c) => (
          <div key={c.id} className={cn("card-surface grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 p-5", !c.lido && "border-l-4 border-l-accent")}>
            <button onClick={() => abrir(c)} aria-label={`Abrir aviso ${c.titulo}`} className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90">
              {c.anexos?.length ? <Paperclip className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </button>
            <button onClick={() => abrir(c)} className="min-w-0 text-left">
              <p className={cn("text-base", !c.lido ? "font-bold" : "font-medium")}>{c.titulo}</p>
              <p className="text-sm text-muted-foreground">{c.autor} • {c.data}</p>
              {!!c.anexos?.length && <p className="mt-1 flex items-center gap-1 text-sm text-primary"><Paperclip className="h-4 w-4" />{c.anexos.length} anexo(s)</p>}
            </button>
            <div className="flex flex-wrap justify-end gap-2">
              {c.prioridade === "alta" && <Badge tone="danger">Importante</Badge>}
              {!c.lido && <Badge tone="warning">Não lido</Badge>}
              {pode && <>
                <Button size="sm" variant="outline" onClick={() => setEdit({ id: c.id, f: { titulo: c.titulo, corpo: c.corpo, prioridade: c.prioridade ?? "normal", anexos: c.anexos ?? [] } })}><Pencil className="h-4 w-4" />Editar</Button>
                <Button size="sm" variant="ghost" aria-label="Excluir aviso" onClick={() => { if (confirm("Excluir este aviso?")) { excluirComunicado(c.id); toast.success("Aviso excluído"); } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!ver} onOpenChange={(o) => !o && setVer(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {ver && <>
            <DialogHeader><DialogTitle>{ver.titulo}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{ver.autor} • {ver.data}</p>
            <p className="whitespace-pre-line text-base leading-relaxed">{ver.corpo}</p>
            {!!ver.anexos?.length && (
              <div className="space-y-3">
                <p className="font-semibold">Anexos</p>
                {ver.anexos.map((a, i) => {
                  const I = ICON[a.tipo];
                  return (
                    <div key={i} className="rounded-xl border p-3">
                      {a.tipo === "imagem" && <img src={a.url} alt={a.nome} className="mb-2 max-h-80 w-full rounded-lg object-contain" />}
                      {a.tipo === "video" && <video src={a.url} controls className="mb-2 w-full rounded-lg" />}
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2"><I className="h-5 w-5 shrink-0 text-primary" /><span className="truncate">{a.nome}</span></span>
                        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
                          <ExternalLink className="h-4 w-4" />{a.tipo === "link" || a.tipo === "pdf" || a.tipo === "ppt" ? "Abrir documento" : "Abrir"}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar aviso" : "Novo aviso"}</DialogTitle></DialogHeader>
          {edit && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
              <Field label="Título"><input required className={inputCls} value={edit.f.titulo} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, titulo: e.target.value } })} /></Field>
              <Field label="Mensagem"><textarea required rows={5} className={cn(inputCls, "h-auto py-2")} value={edit.f.corpo} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, corpo: e.target.value } })} /></Field>
              <Field label="Prioridade"><select className={inputCls} value={edit.f.prioridade} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, prioridade: e.target.value as "alta" } })}><option value="normal">Normal</option><option value="alta">Alta</option></select></Field>
              <Field label="Anexar arquivos (PDF, PNG/JPG, PPT, vídeo)"><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.mp4,.webm,.mov" className={cn(inputCls, "py-2")} onChange={(e) => addArquivos(e.target.files)} /></Field>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input placeholder="Nome do link" className={inputCls} value={link.nome} onChange={(e) => setLink({ ...link, nome: e.target.value })} />
                <input placeholder="https://..." className={inputCls} value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
                <Button type="button" variant="outline" onClick={() => { if (!/^https?:\/\//.test(link.url)) { toast.error("Informe um link começando com https://"); return; } setEdit({ ...edit, f: { ...edit.f, anexos: [...edit.f.anexos, { tipo: "link", nome: link.nome || link.url, url: link.url }] } }); setLink({ nome: "", url: "" }); }}><Link2 className="h-4 w-4" />Adicionar link</Button>
              </div>
              {edit.f.anexos.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                  <span className="truncate">{LABEL[a.tipo]} • {a.nome}</span>
                  <button type="button" aria-label="Remover anexo" onClick={() => setEdit({ ...edit, f: { ...edit.f, anexos: edit.f.anexos.filter((_, j) => j !== i) } })}><X className="h-4 w-4" /></button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Demonstração: arquivos enviados ficam só nesta sessão e somem ao recarregar a página.</p>
              <Button size="lg" className="w-full" type="submit">{edit.id ? "Salvar alterações" : "Publicar"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
