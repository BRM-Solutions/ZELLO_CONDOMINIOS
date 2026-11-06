import { useState } from "react";
import { toast } from "sonner";
import { Check, Minus, Plus, ShieldCheck, Users, History, Grid3x3, UserPlus, Ban, RotateCcw } from "lucide-react";
import { Badge, Button, Card, Field, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACOES, MODULOS, NOMES_PROIBIDOS, chave, permStore, podeConceder, podeDesativarSindico } from "@/lib/permissoes";
import { moradoresStore, semAcento } from "@/lib/moradores";
import { cn } from "@/lib/utils";

export function PerfisPermissoes({ superadmin, responsavel }: { superadmin: boolean; responsavel: string }) {
  const st = permStore.use();
  const pessoas = moradoresStore.use();
  const [aba, setAba] = useState<"perfis" | "matriz" | "usuarios" | "historico">("perfis");
  const [perfilId, setPerfilId] = useState("admin");
  const [novo, setNovo] = useState<{ nome: string; descricao: string } | null>(null);
  const [busca, setBusca] = useState({ q: "", perfil: "", status: "" });
  const [fh, setFh] = useState("");
  const eu = st.perfis.find((p) => p.id === "sindico")!;
  const perfil = st.perfis.find((p) => p.id === perfilId)!;
  const agora = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const log = (afetado: string, tipo: string, anterior: string, novoV: string) => permStore.set((s) => ({ ...s, auditoria: [{ data: agora(), responsavel, afetado, tipo, anterior, novo: novoV, resultado: "Concluído" }, ...s.auditoria] }));
  const contar = (nome: string) => pessoas.filter((p) => p.acesso.perfil.startsWith(nome.replace("(a)", ""))).length;

  const alternar = (m: string, a: (typeof ACOES)[number]) => {
    const k = chave(m, a);
    if (perfil.id === "sindico" && !superadmin) { toast.error("O(a) Síndico(a) não altera as próprias permissões."); return; }
    const tem = perfil.perms.includes(k);
    if (!tem && !podeConceder(eu, k, superadmin)) { toast.error("Você não pode conceder uma permissão que não possui ou que é estrutural."); return; }
    if (["Excluir", "Aprovar", "Publicar"].includes(a) && !confirm(`${tem ? "Remover" : "Conceder"} "${a}" em ${m} para ${perfil.nome}?`)) return;
    permStore.set((s) => ({ ...s, perfis: s.perfis.map((p) => (p.id === perfil.id ? { ...p, perms: tem ? p.perms.filter((x) => x !== k) : [...p.perms, k] } : p)) }));
    log(perfil.nome, tem ? "Permissão removida" : "Permissão concedida", tem ? `${m}: ${a}` : "—", tem ? "—" : `${m}: ${a}`);
  };

  const usuarios = pessoas.filter((p) => (!busca.q || semAcento(p.nome + p.email + p.unidades.map((u) => u.bloco + u.apto).join()).includes(semAcento(busca.q))) && (!busca.perfil || p.acesso.perfil === busca.perfil) && (!busca.status || p.acesso.status === busca.status));
  const sindicosAtivos = pessoas.filter((p) => p.acesso.perfil === "Síndico(a)" && p.acesso.status === "Ativo").length;
  const setAcesso = (id: string, patch: Partial<(typeof pessoas)[0]["acesso"]>, tipo: string, ant: string, nv: string) => {
    const p = pessoas.find((x) => x.id === id)!;
    moradoresStore.set((all) => all.map((x) => (x.id === id ? { ...x, acesso: { ...x.acesso, ...patch } } : x)));
    log(p.nome, tipo, ant, nv);
  };

  const tabs = [["perfis", "Perfis", ShieldCheck], ["matriz", "Matriz de Permissões", Grid3x3], ["usuarios", "Usuários e Acessos", Users], ["historico", "Histórico de Alterações", History]] as const;
  return (
    <div>
      {superadmin && <p className="mb-4 rounded-xl bg-muted p-3 text-sm">Você edita modelos globais e permissões estruturais. Isso não dá acesso aos dados privados do condomínio.</p>}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">{tabs.filter(([k]) => !(superadmin && k === "usuarios")).map(([k, l, I]) => <Button key={k} role="tab" aria-selected={aba === k} size="lg" variant={aba === k ? "primary" : "outline"} onClick={() => setAba(k)}><I className="h-5 w-5" />{l}</Button>)}</div>

      {aba === "perfis" && <>
        <div className="mb-3 flex justify-end"><Button size="lg" onClick={() => setNovo({ nome: "", descricao: "" })}><Plus className="h-5 w-5" />Criar perfil personalizado</Button></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{st.perfis.map((p) => (
          <Card key={p.id}>
            <div className="mb-2 flex items-start justify-between gap-2"><p className="text-lg font-semibold">{p.nome}</p><div className="flex gap-1"><Badge tone={p.tipo === "Padrão" ? "info" : "neutral"}>{p.tipo}</Badge><Badge tone={p.ativo ? "success" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></div></div>
            <p className="text-sm text-muted-foreground">{p.descricao}</p>
            <p className="mt-2 text-sm">{contar(p.nome)} usuário(s) • {p.perms.length} permissões</p>
            <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => { setPerfilId(p.id); setAba("matriz"); }}>Ver permissões</Button>
              {p.tipo === "Personalizado" && <Button size="sm" variant="outline" onClick={() => { permStore.set((s) => ({ ...s, perfis: s.perfis.map((x) => (x.id === p.id ? { ...x, ativo: !x.ativo } : x)) })); log(p.nome, p.ativo ? "Perfil desativado" : "Perfil ativado", "", ""); }}>{p.ativo ? "Desativar" : "Ativar"}</Button>}</div>
          </Card>))}</div>
      </>}

      {aba === "matriz" && <Card>
        <div className="mb-4 max-w-xs"><Field label="Perfil"><select className={inputCls} value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>{st.perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Field></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">Módulo</th>{ACOES.map((a) => <th key={a} className="px-1 text-center">{a}</th>)}</tr></thead>
            <tbody>{MODULOS.map((m) => <tr key={m.nome} className="border-b"><td className="py-2 font-medium">{m.nome}</td>{ACOES.map((a) => {
              if (!m.acoes.includes(a)) return <td key={a} className="text-center text-muted-foreground">—</td>;
              const on = perfil.perms.includes(chave(m.nome, a));
              return <td key={a} className="text-center"><button onClick={() => alternar(m.nome, a)} aria-label={`${a} em ${m.nome}: ${on ? "permitido" : "negado"}`} aria-pressed={on} className={cn("inline-grid h-9 w-9 place-items-center rounded-lg border", on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>{on ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</button></td>;
            })}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Tudo começa negado. Ações sensíveis pedem confirmação.</p>
      </Card>}

      {aba === "usuarios" && <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Field label="Nome, e-mail, bloco ou apto"><input className={inputCls} value={busca.q} onChange={(e) => setBusca({ ...busca, q: e.target.value })} /></Field>
          <Field label="Perfil"><select className={inputCls} value={busca.perfil} onChange={(e) => setBusca({ ...busca, perfil: e.target.value })}><option value="">Todos</option>{[...new Set(pessoas.map((p) => p.acesso.perfil))].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Situação"><select className={inputCls} value={busca.status} onChange={(e) => setBusca({ ...busca, status: e.target.value })}><option value="">Todas</option><option>Ativo</option><option>Suspenso</option><option>Convidado</option></select></Field>
          <div className="flex items-end"><Button size="lg" className="w-full" onClick={() => { const email = prompt("E-mail do convidado"); if (email && /^\S+@\S+\.\S+$/.test(email)) { toast.success(`Convite registrado para ${email} (envio real de e-mail ainda não conectado)`); log(email, "Convite", "—", "Morador"); } }}><UserPlus className="h-5 w-5" />Convidar usuário</Button></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b text-left"><th className="py-2">Nome</th><th>E-mail</th><th>Unidade</th><th>Perfil</th><th>Acesso</th><th>Último acesso</th><th>Ações</th></tr></thead>
          <tbody>{usuarios.map((p) => <tr key={p.id} className="border-b">
            <td className="py-2 font-medium">{p.nome}</td><td>{p.email}</td><td>{p.unidades.map((u) => `${u.bloco} ${u.apto}`).join(", ")}</td>
            <td><select className="h-9 rounded-lg border bg-card px-2" value={p.acesso.perfil} onChange={(e) => { const v = e.target.value; if (!superadmin && p.acesso.perfil === "Síndico(a)") { toast.error("Alteração do perfil de Síndico(a) exige o SuperAdministrador."); return; } if (confirm(`Alterar perfil de ${p.nome} para ${v}?`)) setAcesso(p.id, { perfil: v }, "Perfil alterado", p.acesso.perfil, v); }}>{[...new Set(["Síndico(a)", ...st.perfis.filter((x) => x.ativo && x.id !== "sindico").map((x) => x.nome), p.acesso.perfil])].map((n) => <option key={n} disabled={n === "Síndico(a)" && !superadmin && p.acesso.perfil !== n}>{n}</option>)}</select></td>
            <td><Badge tone={p.acesso.status === "Ativo" ? "success" : p.acesso.status === "Suspenso" ? "danger" : "warning"}>{p.acesso.status}</Badge></td>
            <td>{p.acesso.ultimoAcesso ?? "—"}</td>
            <td>{p.acesso.status === "Suspenso"
              ? <Button size="sm" variant="outline" onClick={() => setAcesso(p.id, { status: "Ativo" }, "Acesso reativado", "Suspenso", "Ativo")}><RotateCcw className="h-4 w-4" />Reativar</Button>
              : <Button size="sm" variant="outline" onClick={() => { if (p.acesso.perfil === "Síndico(a)" && !podeDesativarSindico(sindicosAtivos, p.nome === responsavel)) { toast.error("Você é o único síndico ativo e não pode suspender o próprio acesso."); return; } if (confirm(`Suspender acesso de ${p.nome}? O histórico é mantido.`)) setAcesso(p.id, { status: "Suspenso" }, "Acesso suspenso", p.acesso.status, "Suspenso"); }}><Ban className="h-4 w-4" />Suspender</Button>}</td>
          </tr>)}</tbody>
        </table></div>
      </Card>}

      {aba === "historico" && <Card>
        <div className="mb-3 max-w-sm"><Field label="Filtrar (responsável, perfil ou tipo)"><input className={inputCls} value={fh} onChange={(e) => setFh(e.target.value)} /></Field></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b text-left"><th className="py-2">Data</th><th>Responsável</th><th>Afetado</th><th>Tipo</th><th>Anterior</th><th>Novo</th><th>Resultado</th></tr></thead>
          <tbody>{st.auditoria.filter((a) => !fh || semAcento(Object.values(a).join(" ")).includes(semAcento(fh))).map((a, i) => <tr key={i} className="border-b"><td className="py-2">{a.data}</td><td>{a.responsavel}</td><td>{a.afetado}</td><td>{a.tipo}</td><td>{a.anterior}</td><td>{a.novo}</td><td>{a.resultado}</td></tr>)}</tbody>
        </table></div>
        <p className="mt-3 text-sm text-muted-foreground">Registros somente leitura.</p>
      </Card>}

      <Dialog open={!!novo} onOpenChange={(o) => !o && setNovo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar perfil personalizado</DialogTitle></DialogHeader>
          {novo && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (NOMES_PROIBIDOS.includes(semAcento(novo.nome).replace(/\s/g, ""))) { toast.error("Não é permitido criar perfil equivalente ao SuperAdministrador."); return; } const id = crypto.randomUUID(); permStore.set((s) => ({ ...s, perfis: [...s.perfis, { id, nome: novo.nome, descricao: novo.descricao, tipo: "Personalizado", ativo: true, perms: ["Painel:Visualizar"] }] })); log(novo.nome, "Perfil criado", "—", "Painel: Visualizar"); setNovo(null); setPerfilId(id); setAba("matriz"); toast.success("Perfil criado. Defina as permissões."); }}>
            <Field label="Nome do perfil"><input required placeholder="ex.: Subsíndico, Zelador" className={inputCls} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Field>
            <Field label="Descrição"><input className={inputCls} value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></Field>
            <p className="text-sm text-muted-foreground">Condomínio vinculado: Condomínio Vila Gaudí</p>
            <Button size="lg" className="w-full" type="submit">Criar</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
