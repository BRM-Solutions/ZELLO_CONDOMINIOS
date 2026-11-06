import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, DateChip, Field, PageTitle, Progress, inputCls } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";
import { LogoZello } from "@/components/vg/PlatformShell";
import { TenantLogo } from "@/components/vg/AppShell";

export const Route = createFileRoute("/design-system")({
  head: pageHead("Design System", "Cores, tipografia e componentes da plataforma ZELLO e do portal Gaudí 360°."),
  component: DS,
});

const cores = [["Primária", "bg-primary"], ["Sidebar", "bg-sidebar"], ["Fundo", "bg-background"], ["Cartão", "bg-card"], ["Terracota", "bg-accent"], ["Sucesso", "bg-success"], ["Alerta", "bg-warning"], ["Erro", "bg-destructive"], ["Info", "bg-info"], ["Sol", "bg-sun"]];

function DS() {
  return (
    <AppShell>
      <PageTitle title="Design System" subtitle="Base única da plataforma ZELLO, personalizável por condomínio — web e mobile." />
      <Card className="mb-4"><CardTitle title="Marcas" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-platform p-6 text-platform-foreground"><LogoZello /><p className="mt-3 text-sm opacity-80">Marca do produto • Superadministrador, planos e páginas comerciais. Sem mosaico.</p></div>
          <div className="rounded-xl bg-sidebar p-6 text-sidebar-foreground"><div className="flex items-center gap-3"><TenantLogo className="h-14 w-14" /><span className="font-display text-3xl">Gaudí 360°</span></div><p className="mt-3 text-sm opacity-80">Portal do Condomínio Vila Gaudí • Síndico, Administração/Conselho e Moradores. Logotipo oficial, verde e mosaico.</p></div>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardTitle title="Cores" />
          <div className="grid grid-cols-5 gap-3">{cores.map(([n, c]) => <div key={n} className="text-center text-xs"><div className={`${c} h-14 rounded-xl border`} /><p className="mt-1">{n}</p></div>)}</div>
        </Card>
        <Card><CardTitle title="Tipografia" />
          <p className="font-display text-5xl">DM Serif Display</p><p className="text-muted-foreground">Títulos e saudações</p>
          <p className="mt-4 text-xl font-semibold">Figtree — textos e interface</p><p className="text-sm text-muted-foreground">400 / 500 / 600 / 700</p>
        </Card>
        <Card><CardTitle title="Botões" />
          <div className="flex flex-wrap gap-2"><Button>Primário</Button><Button variant="accent">Destaque</Button><Button variant="outline">Contorno</Button><Button variant="ghost">Fantasma</Button><Button variant="danger">Excluir</Button><Button size="sm">Pequeno</Button></div>
        </Card>
        <Card><CardTitle title="Status" />
          <div className="flex flex-wrap gap-2"><Badge tone="success">Concluída</Badge><Badge tone="warning">Em andamento</Badge><Badge tone="danger">Aberta</Badge><Badge tone="info">Programada</Badge><Badge tone="neutral">Arquivada</Badge></div>
          <div className="mt-4 space-y-2"><Progress value={64} /><Progress value={42} tone="success" /><Progress value={20} tone="danger" /></div>
        </Card>
        <Card><CardTitle title="Formulários" /><div className="space-y-3"><Field label="Campo"><input className={inputCls} placeholder="Digite..." /></Field><Field label="Seleção"><select className={inputCls}><option>Opção</option></select></Field></div></Card>
        <Card><CardTitle title="Sininho e data" />
          <div className="flex items-center gap-6">
            <div className="relative grid h-10 w-10 place-items-center"><Bell className="h-5 w-5" /></div>
            <div className="relative grid h-10 w-10 place-items-center"><Bell className="h-5 w-5 text-primary" /><span className="bell-pulse absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">3</span></div>
            <DateChip d="04" m="set" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Sem mensagens / com mensagens não lidas do síndico.</p>
        </Card>
      </div>
    </AppShell>
  );
}
