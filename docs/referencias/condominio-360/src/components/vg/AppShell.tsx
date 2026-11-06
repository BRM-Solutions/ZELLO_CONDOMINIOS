import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Home, BarChart3, Wrench, FileText, CalendarCheck, CalendarDays, Folder, Users, Briefcase,
  UserCog, LineChart, Settings, Bell, Menu, X, LogOut, User, Palette, Building2, ShieldCheck, MessageSquareHeart,
  ClipboardCheck, AlertTriangle, HeartPulse, Gavel, ClipboardList, HardHat, FileUp,
} from "lucide-react";
import { useStore, type Role } from "@/lib/store";
import { PLATFORM_BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const NAO_ZEL: Role[] = ["superadmin", "sindico", "admin", "conselho", "morador"];
type Item = { to: string; label: string; icon: typeof Home; roles?: Role[] };
const NAV: Item[] = [
  { to: "/minha-rotina", label: "Minha Rotina", icon: ClipboardCheck, roles: ["zelador"] },
  { to: "/feedback", label: "Feedback do Portal", icon: MessageSquareHeart, roles: NAO_ZEL },
  { to: "/painel", label: "Painel Geral", icon: Home, roles: NAO_ZEL },
  { to: "/comunicados", label: "Avisos à Comunidade", icon: Bell, roles: NAO_ZEL },
  { to: "/riscos", label: "Riscos e Pendências", icon: AlertTriangle, roles: ["sindico", "admin"] },
  { to: "/saude-predial", label: "Saúde Predial", icon: HeartPulse, roles: ["conselho", "admin"] },
  { to: "/financeiro", label: "Financeiro", icon: BarChart3, roles: ["sindico", "admin", "conselho"] },
  { to: "/aprovacoes", label: "Fluxo de Aprovações", icon: Gavel, roles: ["sindico", "admin", "conselho"] },
  { to: "/calendario", label: "Calendário", icon: CalendarDays, roles: NAO_ZEL },
  { to: "/manutencoes", label: "Manutenção Preventiva", icon: Wrench, roles: ["sindico", "admin", "conselho"] },
  { to: "/ordens-servico", label: "Ordens de Serviço", icon: ClipboardList, roles: ["sindico", "admin"] },
  { to: "/obras", label: "Obras e Instalações", icon: HardHat, roles: ["sindico", "admin", "conselho"] },
  { to: "/ocorrencias", label: "Ocorrências do Condomínio", icon: FileText, roles: NAO_ZEL },
  { to: "/reservas", label: "Reservas de Áreas", icon: CalendarCheck, roles: NAO_ZEL },
  { to: "/documentos", label: "Central de Documentos", icon: Folder, roles: NAO_ZEL },
  { to: "/regras", label: "Regras de Convivência", icon: FileText, roles: NAO_ZEL },
  { to: "/moradores", label: "Moradores", icon: Building2, roles: ["sindico", "admin"] },
  { to: "/fornecedores", label: "Fornecedores", icon: Briefcase, roles: ["sindico", "admin", "conselho"] },
  { to: "/equipe", label: "Equipe e Escalas", icon: UserCog, roles: ["sindico", "admin", "conselho"] },
  { to: "/relatorios", label: "Relatórios", icon: LineChart, roles: ["sindico", "admin", "conselho"] },
  { to: "/importacao", label: "Configuração e Importação", icon: FileUp, roles: ["sindico", "admin"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/perfis-permissoes", label: "Perfis e Permissões", icon: ShieldCheck, roles: ["sindico"] },
  { to: "/design-system", label: "Design System", icon: Palette, roles: NAO_ZEL },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useStore();
  return (
    <nav className="space-y-1">
      {NAV.filter((i) => !i.roles || i.roles.includes(role)).map((i) => (
        <Link
          key={i.to}
          to={i.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-sidebar-foreground/90 transition-colors hover:bg-sidebar-foreground/10"
          activeProps={{ className: "!bg-sidebar-active !text-sidebar-active-foreground font-semibold shadow-sm" }}
        >
          <i.icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function TenantLogo({ className }: { className?: string }) {
  const { tenant } = useStore();
  return tenant.logoUrl ? (
    <img src={tenant.logoUrl} alt={`Logotipo ${tenant.legalName}`} className={cn("object-contain", className)} />
  ) : (
    <span className={cn("grid place-items-center rounded-full bg-primary font-display text-2xl text-primary-foreground", className)}>{tenant.portalName[0]}</span>
  );
}

function Brand() {
  const { tenant } = useStore();
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <TenantLogo className="h-20 w-20" />
      <span className="font-display text-3xl text-sidebar-foreground">{tenant.portalName}</span>
      <span className="-mt-2 text-xs text-sidebar-foreground/80">{tenant.legalName}</span>
    </div>
  );
}

export function NotificationBell() {
  const { unread } = useStore();
  return (
    <Link to="/notificacoes" aria-label={`Notificações${unread ? `: ${unread} não lidas` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-muted">
      <Bell className={cn("h-5 w-5", unread > 0 && "text-primary")} />
      {unread > 0 && (
        <span className="bell-pulse absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function UserMenu() {
  const { user, setRole } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 rounded-full p-1 pr-3 hover:bg-muted">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
          {user.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block font-semibold">{user.nome}</span>
          <span className="block text-xs text-muted-foreground">{user.cargo}{user.apto ? ` • ${user.apto}` : ""}</span>
        </span>
      </button>
      {open && (
        <div className="card-surface absolute right-0 z-50 mt-2 w-56 p-2" onMouseLeave={() => setOpen(false)}>
          <Link to="/perfil" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><User className="h-4 w-4" />Meu perfil</Link>
          <Link to="/configuracoes" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><Settings className="h-4 w-4" />Configurações</Link>
          <button onClick={() => { setRole("sindico"); nav({ to: "/", replace: true }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-muted"><LogOut className="h-4 w-4" />Sair</button>
        </div>
      )}
    </div>
  );
}

const today = new Date();
const weekday = today.toLocaleDateString("pt-BR", { weekday: "long" });
const dateLong = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export function AppShell({ children, hero: showHero }: { children: ReactNode; hero?: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { tenant, role } = useStore();
  const vars = tenant.colors ? ({ "--primary": tenant.colors.primary, "--sidebar": tenant.colors.sidebar } as React.CSSProperties) : undefined;
  return (
    <div className="min-h-screen lg:pl-64" style={vars}>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto bg-sidebar px-3 lg:flex">
        <Brand />
        <NavList />
        <div className="mt-auto -mx-3 pt-6">
          <img src={tenant.heroUrl} alt="" loading="lazy" className="h-24 w-full object-cover" />
          <div className="bg-secondary p-4 text-xs text-secondary-foreground">
            <p className="font-semibold">{tenant.legalName}</p>
            <p>{tenant.address}</p>
            <p className="mt-2 text-muted-foreground">uma plataforma {PLATFORM_BRAND.name}</p>
          </div>
        </div>
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-sidebar px-3 pb-6">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-3 p-2 text-sidebar-foreground" aria-label="Fechar menu"><X /></button>
            <Brand />
            <NavList onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      {/* Topbar */}
      {/* Desktop: o cabeçalho ocupa sua própria faixa (sticky, no fluxo), sem sobrepor o conteúdo. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card/90 px-4 py-2 backdrop-blur lg:top-4 lg:mx-6 lg:mb-2 lg:ml-auto lg:mt-4 lg:w-fit lg:gap-6 lg:rounded-2xl lg:border lg:shadow-sm">
        <button className="p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Abrir menu"><Menu /></button>
        <div className="flex items-center gap-2 lg:hidden">
          <TenantLogo className="h-8 w-8" />
          <span className="font-display text-xl">{tenant.portalName}</span>
        </div>
        <div className="hidden text-xs leading-tight text-muted-foreground lg:block">
          <p className="text-sm capitalize text-foreground">{weekday}</p><p>{dateLong.replace(/ de ([a-zç]+)/, (_, m: string) => ` de ${m[0]!.toUpperCase()}${m.slice(1)}`)}</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <span className="hidden lg:block"><UserMenu /></span>
        </div>
      </header>

      {showHero}
      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 md:px-6 lg:pb-10">{children}</main>

      {/* Bottom nav mobile */}
      <nav className={cn("fixed inset-x-0 bottom-0 z-30 grid border-t bg-card lg:hidden", role === "zelador" ? "grid-cols-3" : "grid-cols-5")}>
        {(role === "zelador" ? [
          { to: "/minha-rotina", icon: ClipboardCheck, label: "Minha Rotina" },
          { to: "/notificacoes", icon: Bell, label: "Avisos" },
          { to: "/perfil", icon: Users, label: "Perfil" },
        ] : [
          { to: "/painel", icon: Home, label: "Início" },
          { to: "/comunicados", icon: Bell, label: "Avisos" },
          { to: "/reservas", icon: CalendarCheck, label: "Reservas" },
          { to: "/ocorrencias", icon: FileText, label: "Ocorrências" },
          { to: "/perfil", icon: Users, label: "Perfil" },
        ]).map((i) => (
          <Link key={i.to} to={i.to} className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground" activeProps={{ className: "!text-primary font-semibold" }}>
            <i.icon className="h-5 w-5" />{i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function HeroBanner({ title, subtitle }: { title: string; subtitle: string }) {
  const { tenant } = useStore();
  return (
    <section className="relative h-56 overflow-hidden md:h-64">
      <img src={tenant.heroUrl} alt={`Área de lazer do ${tenant.legalName}`} width={1600} height={640} className="absolute inset-0 h-full w-full object-cover object-right" />
      <div className="hero-fade absolute inset-0" />
      <div className="relative flex h-full flex-col justify-end px-4 pb-8 md:px-10">
        <h1 className="text-4xl md:text-6xl">{title}</h1>
        <p className="mt-2 max-w-md text-base md:text-lg">{subtitle}</p>
      </div>
    </section>
  );
}
