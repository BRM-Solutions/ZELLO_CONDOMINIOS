import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import {
  Coins, Landmark, PieChart, Heart, Wallet, ArrowUp, CalendarDays, Wrench, ChevronRight, Plus, Bell, FileText,
  CalendarCheck, Folder, Users, User, Droplet, Puzzle, PlusCircle, CalendarClock, AlertTriangle, Clock,
} from "lucide-react";
import { AppShell, HeroBanner } from "@/components/vg/AppShell";
import { Badge, Card, CardTitle, DateChip, Progress } from "@/components/vg/ui";
import { isGestao, pageHead, useStore } from "@/lib/store";
import { doMesAtual, fmtDataHora, statusTone } from "@/lib/ocorrencias";
import { equipeStore } from "@/lib/equipe";
import { contratosStore, faixaAlerta } from "@/lib/contratos";

export const Route = createFileRoute("/painel")({
  head: pageHead("Painel Geral", "Resumo da gestão do Condomínio Vila Gaudí: finanças, ocorrências, manutenções e reservas."),
  component: Painel,
});

const spark = [3, 4, 3.5, 5, 4.6, 6, 5.5, 7, 8].map((v, i) => ({ i, v }));
const fluxo = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set"].map((m, i) => ({
  m, receitas: [380, 520, 400, 410, 500, 420, 460, 500, 530][i]! * 1000, despesas: [240, 250, 240, 170, 250, 240, 280, 250, 290][i]! * 1000, saldo: [300, 300, 310, 320, 340, 360, 370, 370, 380][i]! * 1000,
}));

function Spark({ id }: { id: string }) {
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={spark}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
        <Area dataKey="v" stroke="var(--primary)" fill={`url(#${id})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Painel() {
  const { user, role, reservas, comunicados, tenant, ocorrencias } = useStore();
  const gestao = isGestao(role);
  const eq = equipeStore.use();
  const ct = contratosStore.use();
  const alertas = ct.contratos.map((c) => ({ c, f: faixaAlerta(c) })).filter((x) => x.f);
  const [titulo, sub] = role === "sindico" ? [`Bem-vindo(a)! ${user.nome}`, "Sua gestão começa por aqui."]
    : role === "morador" ? ["Bem-vindo(a) ao nosso espaço de convivência!", `${user.nome} • ${tenant.legalName}`]
    : ["Informação organizada. Gestão transparente.", `${user.nome} • ${user.cargo}`];
  return (
    <AppShell hero={<HeroBanner title={titulo} subtitle={sub} />}>
      {role === "sindico" && alertas.length > 0 && (
        <div className="mb-4 space-y-2">{alertas.map(({ c, f }) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-warning-soft p-4">
            <AlertTriangle className="h-6 w-6 text-accent" />
            <div className="min-w-0 flex-1"><p className="font-semibold">Contrato próximo do vencimento (até {f} dias)</p>
              <p className="text-sm">Fornecedor: {ct.fornecedores.find((x) => x.id === c.fornecedorId)?.nome} • Serviço: {c.servico} • Vencimento: {c.vencimento.split("-").reverse().join("/")}</p></div>
            <Link to="/fornecedores" search={{ contrato: c.id }} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Ver contrato</Link>
          </div>))}</div>
      )}
      {gestao ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardTitle icon={<Coins className="h-5 w-5" />} title="Saldo Operacional" /><p className="text-3xl font-bold">R$ 276.883,39</p><p className="mt-1 flex items-center gap-1 text-success"><ArrowUp className="h-4 w-4" />12,5%</p><Spark id="s1" /></Card>
          <Card><CardTitle icon={<Landmark className="h-5 w-5" />} title="Fundo de Reserva" /><p className="text-3xl font-bold">R$ 346.594,43</p><p className="mt-1 flex items-center gap-1 text-success"><ArrowUp className="h-4 w-4" />8,4%</p><Spark id="s2" /></Card>
          <Card><CardTitle icon={<PieChart className="h-5 w-5" />} title="Inadimplência" /><p className="text-4xl font-bold text-destructive">6,8%</p><p className="mt-2 font-medium">R$ 34.230,00</p><p className="text-sm text-muted-foreground">em aberto</p></Card>
          <Card><CardTitle icon={<Heart className="h-5 w-5" />} title="Saúde Financeira" />
            <div className="flex items-center gap-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(var(--success) 82%, var(--muted) 0)" }}><div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-card text-2xl font-bold">82%</div></div>
              <ul className="space-y-1 text-sm"><li className="font-semibold text-success">● Boa</li><li>Receitas em dia</li><li>Despesas controladas</li><li>Fundo saudável</li></ul>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardTitle icon={<Wallet className="h-5 w-5" />} title="Minha cota" /><p className="text-3xl font-bold">R$ 890,00</p><p className="text-sm text-muted-foreground">Vence em 10/09</p><Badge tone="success">Em dia</Badge></Card>
          <Card><CardTitle icon={<Bell className="h-5 w-5" />} title="Avisos à Comunidade" /><p className="text-3xl font-bold">{comunicados.filter((c) => !c.lido).length}</p><p className="text-sm text-muted-foreground">não lidos</p></Card>
          <Card><CardTitle icon={<CalendarCheck className="h-5 w-5" />} title="Minhas reservas" /><p className="text-3xl font-bold">{reservas.filter((r) => r.morador === user.nome).length}</p><p className="text-sm text-muted-foreground">agendadas</p></Card>
        </div>
      )}

      {role === "morador" && (
        <Card className="mt-4"><CardTitle icon={<Clock className="h-5 w-5" />} title="Horários e Serviços" />
          <div className="grid gap-4 md:grid-cols-2">
            <ul className="space-y-2">{eq.categorias.filter((c) => c.ativa).map((c) => { const i = eq.integrantes.find((x) => x.categoriaId === c.id && x.ativo); return i ? <li key={c.id} className="flex justify-between gap-3"><span>{c.nome}</span><span className="font-medium">{i.dias.join(", ")} • {i.horario}</span></li> : null; })}</ul>
            <div><p className="mb-2 font-semibold">Alterações temporárias</p>
              {eq.alteracoes.filter((a) => a.publicada).length === 0 && <p className="text-muted-foreground">Nenhuma alteração publicada.</p>}
              <ul className="space-y-2">{eq.alteracoes.filter((a) => a.publicada).map((a) => { const i = eq.integrantes.find((x) => x.id === a.integranteId); const cat = eq.categorias.find((c) => c.id === i?.categoriaId)?.nome; return <li key={a.id} className="rounded-xl bg-warning-soft p-3 text-sm"><b>{cat}</b> — {a.data.split("-").reverse().join("/")}: {a.novoHorario || (a.tipo === "Horário temporário" ? "" : "sem atendimento")}</li>; })}</ul>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        {gestao && (
          <Card><CardTitle icon={<CalendarDays className="h-5 w-5" />} title="Fluxo de Caixa" />
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={fluxo}>
                <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip />
                <Bar dataKey="receitas" fill="var(--success)" radius={[3, 3, 0, 0]} barSize={10} />
                <Bar dataKey="despesas" fill="var(--warning)" radius={[3, 3, 0, 0]} barSize={10} />
                <Line dataKey="saldo" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}
        {gestao && (
          <Card><CardTitle title="Principais Despesas do Mês" />
            <ul className="space-y-4">
              {([[User, "Pessoal", 32], [Wrench, "Manutenção", 21], [FileText, "Serviços Terceirizados", 18], [Droplet, "Água e Energia", 12], [PlusCircle, "Outros", 17]] as const).map(([I, l, v]) => (
                <li key={l} className="grid grid-cols-[auto_1fr_80px_36px] items-center gap-3 text-sm"><I className="h-4 w-4" /><span className="truncate">{l}</span><Progress value={v * 2} /><span className="text-right">{v}%</span></li>
              ))}
            </ul>
          </Card>
        )}
        <div className="card-surface overflow-hidden xl:col-span-1">
          <div className="flex items-center justify-between bg-primary px-5 py-3 text-primary-foreground">
            <span className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5" />Próximos 7 dias</span>
            <Link to="/calendario" className="flex items-center text-sm">Ver todos<ChevronRight className="h-4 w-4" /></Link>
          </div>
          <ul className="divide-y">
            {[["04", "Carro da fruta", "Amanhã - 10h às 12h", Wrench], ["05", "Manutenção preventiva", "Bombas de água - 08h às 12h", Wrench], ["06", "Reserva do Salão de Festas", "Aprovada - 14h às 22h", CalendarCheck], ["07", "Dedetização", "08h às 10h (áreas comuns)", Puzzle]].map(([d, t, s, I]) => {
              const Ic = I as typeof Wrench;
              return (
                <li key={t as string} className="flex items-center gap-3 px-5 py-3"><DateChip d={d as string} m="set" /><Ic className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{t as string}</p><p className="truncate text-sm text-muted-foreground">{s as string}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
        <Card><CardTitle icon={<FileText className="h-5 w-5" />} title="Ocorrências do mês" action={<Link to="/ocorrencias" className="text-sm text-muted-foreground">Ver todas ›</Link>} />
          <ul className="space-y-3">
            {doMesAtual(ocorrencias).length === 0 && <p className="text-muted-foreground">Nenhuma ocorrência neste mês.</p>}
            {doMesAtual(ocorrencias).slice(0, 4).map((o) => (
              <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0"><p className="truncate font-medium">{o.titulo}</p><p className="truncate text-sm text-muted-foreground">{o.protocolo} • {o.categoria} • {o.apto}</p>{o.concluidaEm && <p className="text-sm text-primary">Concluída em {fmtDataHora(o.concluidaEm)}</p>}</div><Badge tone={statusTone[o.status]}>{o.status}</Badge></li>
            ))}
          </ul>
        </Card>
        <Card><CardTitle icon={<Wrench className="h-5 w-5" />} title="Manutenções Programadas" action={<Link to="/manutencoes" className="text-sm text-muted-foreground">Ver todas ›</Link>} />
          <ul className="space-y-3">
            {[["04/09", "Revisão dos automáticos"], ["12/09", "Limpeza das caixas de gordura"], ["17/09", "Higienização dos reservatórios"], ["23/09", "Sistema de irrigação"]].map(([d, t]) => (
              <li key={t} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"><span className="rounded-lg bg-muted px-2 py-1 text-sm font-semibold">{d}</span><span className="truncate">{t}</span><Badge tone="info">Programada</Badge></li>
            ))}
          </ul>
        </Card>
        <Card><CardTitle icon={<Plus className="h-5 w-5" />} title="Ações Rápidas" />
          <div className="grid grid-cols-2 gap-3">
            {(role === "sindico" || role === "admin"
              ? [[Bell, "Novo aviso", "/comunicados"], [FileText, "Registrar Ocorrência", "/ocorrencias"], [CalendarCheck, "Aprovar Reserva", "/reservas"], [Folder, "Documentos", "/documentos"], [Wrench, "Manutenção", "/manutencoes"], [Users, "Fornecedor", "/fornecedores"], ...(role === "sindico" ? [[CalendarClock, "Equipe e Escalas\nAtualizar horários e folgas", "/equipe"]] : [])]
              : [[CalendarCheck, "Reservar área", "/reservas"], [FileText, "Abrir ocorrência", "/ocorrencias"], [Bell, "Avisos à Comunidade", "/comunicados"], [Folder, "Documentos", "/documentos"]]
            ).map(([I, l, to]) => {
              const Ic = I as typeof Wrench;
              return <Link key={l as string} to={to as string} className="flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-sm hover:bg-muted"><Ic className="h-5 w-5 text-primary" /><span className="whitespace-pre-line">{l as string}</span></Link>;
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
