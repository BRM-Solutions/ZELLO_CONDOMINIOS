import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Mail, MessageCircle, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, PageTitle } from "@/components/vg/ui";
import { pageHead, useStore, type CanalStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notificacoes")({
  head: pageHead("Notificações", "Central de notificações do Gaudí 360°."),
  component: Notificacoes,
});

const t = (s: CanalStatus) => (s === "entregue" || s === "enviado" ? "success" : s === "desativado" ? "neutral" : "warning");

function Notificacoes() {
  const { role, notificacoes, marcarNotifLida, marcarTodasNotif, comunicados, marcarLido, marcarTodosLidos } = useStore();
  if (role === "morador") {
    return (
      <AppShell>
        <PageTitle title="Notificações" subtitle="Avisos à Comunidade e mensagens do síndico." action={<Button size="sm" variant="outline" onClick={marcarTodosLidos}><CheckCheck className="h-4 w-4" />Marcar todas</Button>} />
        <div className="space-y-3">
          {comunicados.map((c) => (
            <Link key={c.id} to="/comunicados" onClick={() => marcarLido(c.id)} className={cn("card-surface flex items-center gap-4 p-4", !c.lido && "border-l-4 border-l-accent")}>
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", c.lido ? "bg-muted" : "bg-destructive")} />
              <div className="min-w-0"><p className={cn("truncate", !c.lido && "font-bold")}>{c.titulo}</p><p className="text-xs text-muted-foreground">{c.autor} • {c.data}</p></div>
            </Link>
          ))}
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageTitle title="Notificações" subtitle="Avisos de reservas e alterações, com status de envio por canal." action={<Button size="sm" variant="outline" onClick={marcarTodasNotif}><CheckCheck className="h-4 w-4" />Marcar todas</Button>} />
      <div className="space-y-3">
        {notificacoes.length === 0 && <p className="text-muted-foreground">Nada por aqui.</p>}
        {notificacoes.map((n) => (
          <div key={n.id} onClick={() => marcarNotifLida(n.id)} className={cn("card-surface cursor-pointer p-4", !n.lida && "border-l-4 border-l-accent")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <div className="min-w-0"><p className={cn(!n.lida && "font-bold")}>{n.titulo}</p><p className="text-sm text-muted-foreground">{n.detalhe}</p></div>
              <span className="text-xs text-muted-foreground">{n.data}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={t(n.canais.portal)}><Bell className="mr-1 h-3 w-3" />Portal: {n.canais.portal}</Badge>
              <Badge tone={t(n.canais.email)}><Mail className="mr-1 h-3 w-3" />E-mail: {n.canais.email}</Badge>
              <Badge tone={t(n.canais.whatsapp)}><MessageCircle className="mr-1 h-3 w-3" />WhatsApp: {n.canais.whatsapp}</Badge>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
