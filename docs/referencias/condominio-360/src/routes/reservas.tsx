import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Check, X, Mail, MessageCircle, Bell, FileText, Users, Coins, CalendarDays, Clock, ListChecks } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { MonthCalendar } from "@/components/vg/MonthCalendar";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageHead, useStore, type Reserva } from "@/lib/store";
import { DIAS_SEMANA, ESPACOS, podeCancelar, precoLabel, statusDoDia } from "@/lib/reservas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reservas")({
  head: pageHead("Reservas de Áreas", "Reserve Salão de Festas, Churrasqueira da Piscina e Sala de Relaxamento. O síndico é avisado no portal, e-mail e WhatsApp."),
  component: Reservas,
});

const tone = { Pendente: "warning", Aprovada: "success", Recusada: "danger", Cancelada: "neutral" } as const;
const fmtData = (iso: string) => iso.split("-").reverse().join("/");

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist">
      {items.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={cn("h-12 rounded-xl px-5 text-base font-medium", value === v ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-muted")}>{l}</button>
      ))}
    </div>
  );
}

function Reservas() {
  const { role } = useStore();
  const gestor = role === "sindico" || role === "admin" || role === "superadmin";
  const [tab, setTab] = useState<"nova" | "minhas" | "todas">(gestor ? "todas" : "nova");
  const items: ["nova" | "minhas" | "todas", string][] =
    role === "morador" ? [["nova", "Nova reserva"], ["minhas", "Minhas reservas"]]
    : role === "conselho" ? [["minhas", "Minhas reservas"], ["todas", "Todas as reservas"]]
    : [["todas", "Todas as reservas"], ["nova", "Nova reserva"]];
  const atual = items.some(([v]) => v === tab) ? tab : items[0]![0];
  return (
    <AppShell>
      <PageTitle title="Reservas de Áreas" subtitle="Toda nova reserva ou alteração avisa o síndico automaticamente." />
      <Tabs value={atual} onChange={setTab} items={items} />
      {atual === "nova" && <NovaReserva onDone={() => setTab(role === "morador" ? "minhas" : "todas")} />}
      {atual === "minhas" && <Lista modo="minhas" />}
      {atual === "todas" && <Lista modo="todas" />}
    </AppShell>
  );
}

function NovaReserva({ onDone }: { onDone: () => void }) {
  const { reservas, criarReserva, user, settings } = useStore();
  const [espNome, setEsp] = useState(ESPACOS[0]!.nome);
  const esp = ESPACOS.find((e) => e.nome === espNome)!;
  const [data, setData] = useState<string>();
  const [inicio, setInicio] = useState("14:00");
  const [fim, setFim] = useState("18:00");
  const [termos, setTermos] = useState(false);
  const [aceite, setAceite] = useState(false);
  const canais = [settings.portal && "portal", settings.email && "e-mail", settings.whatsapp && "WhatsApp"].filter(Boolean).join(", ");

  const submit = () => {
    if (!data) return;
    criarReserva({ area: esp.nome, data, inicio, fim, morador: user.nome, apto: user.apto ?? "Administração" });
    toast.success("Reserva solicitada", { description: `Síndico avisado por ${canais}.` });
    setData(undefined); setAceite(false); onDone();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card>
        <Field label="Espaço">
          <select className={cn(inputCls, "h-12 text-base")} value={espNome} onChange={(e) => { setEsp(e.target.value); setData(undefined); }}>
            {ESPACOS.map((e) => <option key={e.nome}>{e.nome}</option>)}
          </select>
        </Field>
        <div className="mt-4"><MonthCalendar selected={data} onSelect={setData} status={(iso) => statusDoDia(esp, iso, reservas)} /></div>
      </Card>
      <Card>
        <CardTitle icon={<CalendarCheck className="h-5 w-5" />} title={esp.nome} />
        <p className="text-base">{esp.descricao}</p>
        <ul className="mt-4 space-y-2 text-base">
          <li className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><b>Capacidade:</b> {esp.capacidade} pessoas</li>
          <li className="flex items-center gap-2"><Coins className="h-5 w-5 text-primary" /><b>Preço:</b> {precoLabel(esp.preco)}</li>
          <li className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><b>Dias:</b> {esp.dias.map((d) => DIAS_SEMANA[d]).join(", ")}</li>
          <li className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><b>Cancelamento:</b> {esp.cancelamentoDias} dias</li>
        </ul>
        <Button variant="outline" size="lg" className="mt-4 w-full" onClick={() => setTermos(true)}><FileText className="h-5 w-5" />Ler Termos de uso</Button>

        <div className="mt-5 space-y-4 border-t pt-4">
          <p className="text-base font-medium">{data ? `Data escolhida: ${fmtData(data)}` : "Escolha um dia disponível no calendário."}</p>
          {data && (<>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início"><input type="time" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
              <Field label="Fim"><input type="time" className={inputCls} value={fim} onChange={(e) => setFim(e.target.value)} /></Field>
            </div>
            <label className="flex items-start gap-2 text-base"><input type="checkbox" className="mt-1 h-5 w-5" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />Li e aceito os termos de uso</label>
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="mb-2 font-medium">O síndico será avisado por:</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={settings.portal ? "success" : "neutral"}><Bell className="mr-1 h-3 w-3" />Portal</Badge>
                <Badge tone={settings.email ? "success" : "neutral"}><Mail className="mr-1 h-3 w-3" />E-mail</Badge>
                <Badge tone={settings.whatsapp ? "success" : "neutral"}><MessageCircle className="mr-1 h-3 w-3" />WhatsApp</Badge>
              </div>
            </div>
            <Button size="lg" className="w-full" disabled={!aceite} onClick={submit}><Check className="h-5 w-5" />Solicitar reserva</Button>
          </>)}
        </div>
      </Card>

      <Dialog open={termos} onOpenChange={setTermos}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Termos de uso — {esp.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-base">
            <p>{esp.descricao}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Capacidade máxima: {esp.capacidade} pessoas.</li>
              <li>Valor: {precoLabel(esp.preco)}.</li>
              <li>Dias permitidos: {esp.dias.map((d) => DIAS_SEMANA[d]).join(", ")}.</li>
              <li>Cancelamento até {esp.cancelamentoDias} dias antes da data.</li>
              <li>Proibida a sublocação.</li>
            </ul>
            <p className="rounded-xl bg-warning-soft p-3 text-sm">Texto oficial dos termos a ser fornecido pela administração.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Lista({ modo }: { modo: "minhas" | "todas" }) {
  const { reservas, alterarReserva, role, user } = useStore();
  const gestor = role === "sindico" || role === "admin" || role === "superadmin";
  const [filtro, setFiltro] = useState<Reserva["status"] | "Todas">("Todas");
  const base = modo === "minhas" ? reservas.filter((r) => r.morador === user.nome) : reservas;
  const lista = filtro === "Todas" ? base : base.filter((r) => r.status === filtro);
  const cont = (s: Reserva["status"]) => base.filter((r) => r.status === s).length;

  return (
    <Card>
      <CardTitle icon={<ListChecks className="h-5 w-5" />} title={modo === "minhas" ? "Minhas reservas" : "Todas as reservas"} />
      {modo === "todas" && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["Todas", "Pendente", "Aprovada", "Recusada", "Cancelada"] as const).map((s) => (
            <button key={s} onClick={() => setFiltro(s)} className={cn("rounded-xl border p-3 text-left", filtro === s && "border-primary ring-2 ring-primary")}>
              <p className="text-sm text-muted-foreground">{s === "Todas" ? "Todas" : `${s}s`}</p>
              <p className="text-2xl font-bold">{s === "Todas" ? base.length : cont(s)}</p>
            </button>
          ))}
        </div>
      )}
      <ul className="divide-y">
        {lista.length === 0 && <p className="py-6 text-center text-muted-foreground">Nenhuma reserva.</p>}
        {lista.map((r) => {
          const esp = ESPACOS.find((e) => e.nome === r.area);
          const cancelavel = podeCancelar(r.data, esp?.cancelamentoDias ?? 2);
          return (
            <li key={r.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-base font-semibold">{r.area}</p>
                <p className="text-sm text-muted-foreground">{fmtData(r.data)} • {r.inicio}–{r.fim} • {r.morador} ({r.apto})</p>
              </div>
              <Badge tone={tone[r.status]}>{r.status}</Badge>
              <div className="flex flex-wrap gap-2">
                {gestor && modo === "todas" && r.status === "Pendente" && (<>
                  <Button onClick={() => { alterarReserva(r.id, { status: "Aprovada" }); toast.success("Reserva aprovada"); }}><Check className="h-4 w-4" />Aprovar</Button>
                  <Button variant="danger" onClick={() => { alterarReserva(r.id, { status: "Recusada" }); toast("Reserva recusada"); }}><X className="h-4 w-4" />Recusar</Button>
                </>)}
                {modo === "minhas" && (r.status === "Pendente" || r.status === "Aprovada") && (
                  cancelavel
                    ? <Button variant="outline" onClick={() => { alterarReserva(r.id, { status: "Cancelada" }); toast("Reserva cancelada", { description: "Síndico avisado." }); }}><X className="h-4 w-4" />Cancelar</Button>
                    : <span className="text-sm text-muted-foreground">Cancelamento só até {esp?.cancelamentoDias ?? 2} dias antes</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
