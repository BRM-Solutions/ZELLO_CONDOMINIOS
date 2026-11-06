import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Search, X, ArrowLeft, Pencil, Power, Plus, History, Mail, Phone, Home, Users } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { USERS, pageHead, useStore } from "@/lib/store";
import { BLOCOS, FILTROS_VAZIOS, SITUACOES, VINCULOS, filtrar, moradoresStore, type Filtros, type Pessoa, type Vinculo } from "@/lib/moradores";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/moradores")({
  head: pageHead("Moradores", "Consulte os cadastros e encontre moradores com facilidade."),
  component: Moradores,
});

const tom = (s: Pessoa["situacao"]) => (s === "Ativo" ? "success" : s === "Inativo" ? "neutral" : "warning") as "success";
const iniciais = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("");

function Moradores() {
  const { role } = useStore();
  const todos = moradoresStore.use();
  const gestor = role === "sindico" || role === "admin";
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS);
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState<Pessoa | null>(null);

  if (role === "superadmin") return <AppShell><PageTitle title="Moradores" /><Card>O SuperAdministrador não tem acesso aos dados pessoais dos moradores.</Card></AppShell>;

  const base = role === "morador" ? todos.filter((p) => p.nome === USERS.morador.nome) : todos;
  const lista = filtrar(base, f);
  const atual = todos.find((p) => p.id === sel) ?? null;
  const set = (k: keyof Filtros, v: string) => setF({ ...f, [k]: v });
  const atualizar = (p: Pessoa, texto: string) => { moradoresStore.set((all) => all.map((x) => (x.id === p.id ? { ...p, historico: [{ data: new Date().toLocaleString("pt-BR"), texto }, ...p.historico] } : x))); };

  const ficha = atual && (
    <Card className="lg:sticky lg:top-24">
      <button className="mb-3 flex items-center gap-2 text-primary lg:hidden" onClick={() => setSel(null)}><ArrowLeft className="h-5 w-5" />Voltar aos moradores</button>
      <div className="flex items-center gap-4">
        {atual.foto ? <img src={atual.foto} alt="" className="h-20 w-20 rounded-full object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">{iniciais(atual.nome)}</span>}
        <div><p className="text-2xl font-semibold">{atual.nome}</p><p>{atual.unidades[0]?.vinculo}</p><Badge tone={tom(atual.situacao)}>{atual.situacao}</Badge></div>
      </div>
      {role !== "conselho" && <div className="mt-5"><p className="mb-2 font-semibold">Contato</p>
        <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />{atual.email}</p>
        <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />{atual.telefone}</p></div>}
      <div className="mt-5"><p className="mb-2 font-semibold">Unidades vinculadas</p>
        <ul className="space-y-1">{atual.unidades.map((u, i) => <li key={i} className="flex items-center gap-2"><Home className="h-4 w-4 text-primary" />Condomínio Vila Gaudí — {u.bloco}, Apto {u.apto} • {u.vinculo}</li>)}</ul></div>
      {(gestor || role === "morador") && <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => setEdit({ ...atual, unidades: atual.unidades.map((u) => ({ ...u })) })}><Pencil className="h-4 w-4" />Editar cadastro</Button>
        {gestor && <Button variant="outline" onClick={() => { const s = atual.situacao === "Inativo" ? "Ativo" : "Inativo"; if (confirm(`${s === "Ativo" ? "Ativar" : "Desativar"} o cadastro de ${atual.nome}?`)) { atualizar({ ...atual, situacao: s }, `Cadastro ${s === "Ativo" ? "ativado" : "desativado"}`); toast.success("Cadastro atualizado"); } }}><Power className="h-4 w-4" />{atual.situacao === "Inativo" ? "Ativar" : "Desativar"}</Button>}
      </div>}
      {gestor && <div className="mt-5"><p className="mb-2 flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Histórico</p>
        <ul className="space-y-1 text-sm text-muted-foreground">{atual.historico.map((h, i) => <li key={i}>{h.data} — {h.texto}</li>)}</ul></div>}
    </Card>
  );

  return (
    <AppShell>
      <PageTitle title="Moradores" subtitle="Consulte os cadastros e encontre moradores com facilidade." />
      <Card className={cn("mb-4", sel && "hidden lg:block")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome"><div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" /><input className={cn(inputCls, "pl-10")} placeholder="Digite o nome" value={f.nome} onChange={(e) => set("nome", e.target.value)} /></div></Field>
          {gestor && <Field label="E-mail"><input className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>}
          <Field label="Bloco"><select className={inputCls} value={f.bloco} onChange={(e) => set("bloco", e.target.value)}><option value="">Todos</option>{BLOCOS.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Apartamento"><input className={inputCls} inputMode="numeric" value={f.apto} onChange={(e) => set("apto", e.target.value)} /></Field>
          <Field label="Vínculo"><select className={inputCls} value={f.vinculo} onChange={(e) => set("vinculo", e.target.value)}><option value="">Todos</option>{VINCULOS.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Situação"><select className={inputCls} value={f.situacao} onChange={(e) => set("situacao", e.target.value)}><option value="">Todas</option>{SITUACOES.map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Ordem"><select className={inputCls} value={f.ordem} onChange={(e) => set("ordem", e.target.value)}><option value="az">A–Z</option><option value="za">Z–A</option></select></Field>
          <div className="flex items-end"><Button variant="outline" size="lg" className="w-full" onClick={() => setF(FILTROS_VAZIOS)}><X className="h-5 w-5" />Limpar filtros</Button></div>
        </div>
        <p className="mt-3 flex items-center gap-2 font-medium" aria-live="polite"><Users className="h-5 w-5 text-primary" />{lista.length} {lista.length === 1 ? "morador encontrado" : "moradores encontrados"}</p>
      </Card>

      <div className={cn("grid gap-4", atual && "lg:grid-cols-[minmax(0,1fr)_420px]")}>
        <div className={cn("grid content-start gap-3 md:grid-cols-2", atual && "hidden lg:grid lg:grid-cols-1 xl:grid-cols-2")}>
          {lista.length === 0 && <p className="col-span-full py-8 text-center text-muted-foreground">Nenhum morador encontrado com esses filtros.</p>}
          {lista.map((p) => (
            <button key={p.id} onClick={() => setSel(p.id)} className={cn("card-surface flex items-center gap-4 p-4 text-left hover:bg-muted/50", sel === p.id && "ring-2 ring-primary")}>
              {p.foto ? <img src={p.foto} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">{iniciais(p.nome)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{p.nome}</p>
                <p className="text-sm">{p.unidades.map((u) => `${u.bloco} — Apto ${u.apto}`).join(" • ")}</p>
                <p className="text-sm text-muted-foreground">{p.unidades[0]?.vinculo} | Cadastro {p.situacao.toLowerCase()}</p>
              </div>
              <span className="hidden text-sm font-medium text-primary sm:block">Ver perfil ›</span>
            </button>
          ))}
        </div>
        {ficha}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar cadastro</DialogTitle></DialogHeader>
          {edit && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!edit.nome.trim() || !/^\S+@\S+\.\S+$/.test(edit.email)) { toast.error("Informe nome e um e-mail válido."); return; } atualizar(edit, "Cadastro editado"); setEdit(null); toast.success("Cadastro atualizado com sucesso"); }}>
            <Field label="Nome completo"><input required disabled={!gestor} className={inputCls} value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <Field label="E-mail"><input required type="email" className={inputCls} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Telefone"><input className={inputCls} value={edit.telefone} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} /></Field>
            <Field label="Foto"><input type="file" accept="image/*" className={cn(inputCls, "py-2")} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) setEdit({ ...edit, foto: URL.createObjectURL(fl) }); }} /></Field>
            {gestor && <>
              <p className="font-medium">Unidades</p>
              {edit.unidades.map((u, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <select className={inputCls} value={u.bloco} onChange={(e) => { const us = [...edit.unidades]; us[i] = { ...u, bloco: e.target.value }; setEdit({ ...edit, unidades: us }); }}>{BLOCOS.map((b) => <option key={b}>{b}</option>)}</select>
                  <input className={inputCls} value={u.apto} onChange={(e) => { const us = [...edit.unidades]; us[i] = { ...u, apto: e.target.value }; setEdit({ ...edit, unidades: us }); }} />
                  <select className={inputCls} value={u.vinculo} onChange={(e) => { const us = [...edit.unidades]; us[i] = { ...u, vinculo: e.target.value as Vinculo }; setEdit({ ...edit, unidades: us }); }}>{VINCULOS.map((b) => <option key={b}>{b}</option>)}</select>
                  <Button type="button" variant="ghost" aria-label="Remover unidade" disabled={edit.unidades.length === 1} onClick={() => setEdit({ ...edit, unidades: edit.unidades.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
                </div>))}
              <Button type="button" variant="outline" onClick={() => setEdit({ ...edit, unidades: [...edit.unidades, { bloco: "Bloco 1", apto: "", vinculo: "Morador" }] })}><Plus className="h-4 w-4" />Vincular apartamento</Button>
            </>}
            <Button size="lg" className="w-full" type="submit">Salvar</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
