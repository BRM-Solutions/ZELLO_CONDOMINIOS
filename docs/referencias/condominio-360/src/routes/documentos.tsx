import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Plus, Archive, Upload, Info } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { pageHead, useStore, type Role } from "@/lib/store";
import { fmtTamanho, validarAnexo } from "@/lib/anexos";
import { CONFIDENCIALIDADE, EXT_DOCUMENTO, STATUS_INICIAL, VINCULOS, docStore, ehDuplicado, novaVersao, podeVerDocumento, proximoCodigo, type Documento } from "@/lib/documentos";

const SUB = "Organize os documentos do condomínio e transforme informações em ações preventivas.";
export const Route = createFileRoute("/documentos")({ head: pageHead("Central de Documentos", SUB), component: Central });

const PERFIS: { id: Role; nome: string }[] = [{ id: "admin", nome: "Administração" }, { id: "conselho", nome: "Conselho" }, { id: "morador", nome: "Moradores" }];

function Central() {
  const { role, user, tenant } = useStore();
  const st = docStore.use();
  const gestor = role === "sindico" || role === "admin";
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [tipo, setTipo] = useState(""); const [verArq, setVerArq] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novaCat, setNovaCat] = useState("");
  const set = (id: string, p: Partial<Documento>) => docStore.set((s) => ({ ...s, lista: s.lista.map((d) => (d.id === id ? { ...d, ...p } : d)) }));

  const lista = st.lista.filter((d) => podeVerDocumento(d, role) && d.arquivado === verArq && (!cat || d.categoria === cat) && (!tipo || d.tipoArquivo === tipo) && (!q || `${d.nome} ${d.descricao} ${d.codigo}`.toLowerCase().includes(q.toLowerCase())));

  const adicionar = (files: FileList | null) => {
    const novos: Documento[] = [];
    for (const f of Array.from(files ?? [])) {
      const e = validarAnexo(f.name, f.size, EXT_DOCUMENTO); if (e) { toast.error(e); continue; }
      if (ehDuplicado([...st.lista, ...novos], f.name, f.size)) toast.warning(`"${f.name}" parece duplicado de um documento existente.`);
      novos.push({ id: crypto.randomUUID(), codigo: proximoCodigo([...st.lista, ...novos]), nome: f.name, categoria: "Outros", descricao: "", condominio: tenant.legalName, dataDocumento: new Date().toISOString().slice(0, 10), enviadoEm: new Date().toISOString(), enviadoPor: user.nome, versao: 1, status: STATUS_INICIAL, confidencialidade: "Interno", perfis: ["sindico", "admin", "conselho"], tamanho: f.size, url: URL.createObjectURL(f), tipoArquivo: (f.name.split(".").pop() ?? "").toUpperCase(), arquivado: false, historico: [] });
    }
    if (novos.length) { docStore.set((s) => ({ ...s, lista: [...novos, ...s.lista] })); toast.success(`${novos.length} documento(s) adicionado(s). Complete a categoria e os detalhes.`); setAberto(novos[0]!.id); }
  };

  return (
    <AppShell>
      <PageTitle title="Central de Documentos" subtitle={SUB} action={gestor && (
        <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-5 w-5" />Adicionar Documentos
          <input type="file" multiple className="sr-only" accept={EXT_DOCUMENTO.map((e) => `.${e}`).join(",")} onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        </label>
      )} />
      {gestor && <p className="mb-4 flex items-start gap-2 rounded-xl bg-info-soft p-3 text-sm text-info"><Info className="mt-0.5 h-4 w-4 shrink-0" />A leitura automática dos documentos ainda não está ativa. Os arquivos ficam como "{STATUS_INICIAL}" e são salvos só até a página ser recarregada.</p>}
      <Card className="mb-4 grid gap-3 md:grid-cols-4">
        <input className={inputCls} placeholder="Pesquisar por nome, código ou descrição" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria"><option value="">Todas as categorias</option>{st.categorias.map((c) => <option key={c}>{c}</option>)}</select>
        <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{[...new Set(st.lista.map((d) => d.tipoArquivo))].map((t) => <option key={t}>{t}</option>)}</select>
        <Button variant="outline" onClick={() => setVerArq(!verArq)}><Archive className="h-4 w-4" />{verArq ? "Ver ativos" : "Ver arquivados"}</Button>
      </Card>
      <Card>
        <CardTitle icon={<FolderOpen className="h-5 w-5" />} title={`${lista.length} documento(s)`} />
        {!lista.length && <p className="text-muted-foreground">Nenhum documento encontrado.</p>}
        <ul className="divide-y">
          {lista.map((d) => (
            <li key={d.id} className="py-3">
              <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 text-left" onClick={() => setAberto(aberto === d.id ? null : d.id)}>
                <span className="min-w-0"><span className="block truncate font-medium">{d.nome}</span><span className="block text-sm text-muted-foreground">{d.codigo} • {d.categoria} • v{d.versao} • {fmtTamanho(d.tamanho)}</span></span>
                <span className="flex flex-wrap justify-end gap-1"><Badge tone={d.confidencialidade === "Público" ? "success" : d.confidencialidade === "Restrito" ? "danger" : "neutral"}>{d.confidencialidade}</Badge>{gestor && <Badge tone="warning">{d.status}</Badge>}</span>
              </button>
              {aberto === d.id && (
                <div className="mt-3 space-y-3">
                  {gestor ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Categoria"><select className={inputCls} value={d.categoria} onChange={(e) => set(d.id, { categoria: e.target.value })}>{st.categorias.map((c) => <option key={c}>{c}</option>)}</select></Field>
                      <Field label="Data do documento"><input type="date" className={inputCls} value={d.dataDocumento} onChange={(e) => set(d.id, { dataDocumento: e.target.value })} /></Field>
                      <Field label="Confidencialidade"><select className={inputCls} value={d.confidencialidade} onChange={(e) => { const c = e.target.value as Documento["confidencialidade"]; set(d.id, { confidencialidade: c, perfis: c === "Público" ? ["sindico", "admin", "conselho", "morador"] : d.perfis.filter((p) => p !== "morador") }); }}>{CONFIDENCIALIDADE.map((c) => <option key={c}>{c}</option>)}</select></Field>
                      <Field label="Vigência inicial"><input type="date" className={inputCls} value={d.vigenciaInicio ?? ""} onChange={(e) => set(d.id, { vigenciaInicio: e.target.value })} /></Field>
                      <Field label="Vigência final"><input type="date" className={inputCls} value={d.vigenciaFim ?? ""} onChange={(e) => set(d.id, { vigenciaFim: e.target.value })} /></Field>
                      <Field label="Vincular a"><select className={inputCls} value={d.vinculo ?? ""} onChange={(e) => set(d.id, { vinculo: e.target.value || undefined })}><option value="">Nenhum</option>{VINCULOS.map((v) => <option key={v}>{v}</option>)}</select></Field>
                      <div className="md:col-span-3"><Field label="Descrição"><input className={inputCls} value={d.descricao} onChange={(e) => set(d.id, { descricao: e.target.value })} /></Field></div>
                      <fieldset className="md:col-span-3"><legend className="mb-1 text-sm font-medium">Perfis autorizados (Síndico(a) sempre tem acesso)</legend>
                        <div className="flex flex-wrap gap-4">{PERFIS.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={p.id === "morador" && d.confidencialidade !== "Público"} checked={d.perfis.includes(p.id)} onChange={(e) => set(d.id, { perfis: e.target.checked ? [...d.perfis, p.id] : d.perfis.filter((x) => x !== p.id) })} />{p.nome}</label>
                        ))}</div>
                      </fieldset>
                    </div>
                  ) : d.descricao && <p className="text-sm">{d.descricao}</p>}
                  <p className="text-xs text-muted-foreground">Enviado por {d.enviadoPor} em {new Date(d.enviadoEm).toLocaleString("pt-BR")}{d.vigenciaFim ? ` • Vigente até ${new Date(d.vigenciaFim + "T00:00").toLocaleDateString("pt-BR")}` : ""}</p>
                  <div className="flex flex-wrap gap-2">
                    {d.url !== "#" ? <a href={d.url} target="_blank" rel="noreferrer" download={d.nome} className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium">Abrir / Baixar</a> : <span className="text-sm text-muted-foreground">Arquivo de exemplo (sem conteúdo)</span>}
                    {gestor && <>
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-medium"><Upload className="h-4 w-4" />Nova versão
                        <input type="file" className="sr-only" accept={EXT_DOCUMENTO.map((e) => `.${e}`).join(",")} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const err = validarAnexo(f.name, f.size, EXT_DOCUMENTO); if (err) { toast.error(err); return; } docStore.set((s) => ({ ...s, lista: s.lista.map((x) => (x.id === d.id ? novaVersao(x, { nome: f.name, tamanho: f.size, url: URL.createObjectURL(f) }, user.nome) : x)) })); toast.success("Nova versão registrada"); }} />
                      </label>
                      <Button variant="outline" onClick={() => set(d.id, { arquivado: !d.arquivado })}><Archive className="h-4 w-4" />{d.arquivado ? "Desarquivar" : "Arquivar"}</Button>
                    </>}
                  </div>
                  {d.historico.length > 0 && <div className="text-sm"><p className="font-medium">Versões anteriores</p><ul className="text-muted-foreground">{d.historico.map((h) => <li key={h.versao}>v{h.versao} • {h.nome} • {h.enviadoPor} • {new Date(h.enviadoEm).toLocaleDateString("pt-BR")}</li>)}</ul></div>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {role === "sindico" && (
        <Card className="mt-4">
          <CardTitle title="Categorias" />
          <div className="mb-3 flex flex-wrap gap-2">{st.categorias.map((c) => <Badge key={c}>{c}</Badge>)}</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = novaCat.trim(); if (!n || st.categorias.includes(n)) return; docStore.set((s) => ({ ...s, categorias: [...s.categorias, n] })); setNovaCat(""); }}>
            <input className={inputCls} placeholder="Nova categoria" value={novaCat} onChange={(e) => setNovaCat(e.target.value)} /><Button type="submit">Adicionar</Button>
          </form>
        </Card>
      )}
    </AppShell>
  );
}
