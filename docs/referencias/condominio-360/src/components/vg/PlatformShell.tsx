import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LayoutDashboard, Building2, CreditCard, Users, ScrollText, Settings, ShieldCheck, MessageSquareHeart, Menu, X, LogOut } from "lucide-react";
import { PLATFORM_BRAND } from "@/lib/brand";
import { useStore } from "@/lib/store";

const NAV = [
  { to: "/plataforma/feedbacks", label: "Feedback do Portal", icon: MessageSquareHeart },
  { to: "/plataforma/painel", label: "Visão geral", icon: LayoutDashboard },
  { to: "/plataforma/condominios", label: "Condomínios", icon: Building2 },
  { to: "/plataforma/planos", label: "Planos e Assinaturas", icon: CreditCard },
  { to: "/plataforma/usuarios", label: "Usuários e Convites", icon: Users },
  { to: "/plataforma/perfis", label: "Perfis e Permissões", icon: ShieldCheck },
  { to: "/plataforma/auditoria", label: "Auditoria", icon: ScrollText },
  { to: "/plataforma/configuracoes", label: "Configurações", icon: Settings },
];

export function LogoZello({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-platform-accent font-display text-2xl text-platform">Z</span>
      <span className="font-display text-2xl leading-none tracking-wide">{PLATFORM_BRAND.name}</span>
    </span>
  );
}

function Nav({ onNav }: { onNav?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV.map((i) => (
        <Link key={i.to} to={i.to} onClick={onNav} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-platform-foreground/85 hover:bg-platform-foreground/10"
          activeProps={{ className: "!bg-platform-accent !text-platform font-semibold" }}>
          <i.icon className="h-5 w-5 shrink-0" />{i.label}
        </Link>
      ))}
    </nav>
  );
}

export function PlatformShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { setRole } = useStore();
  const nav = useNavigate();
  const sair = () => { setRole("sindico"); nav({ to: "/plataforma", replace: true }); };
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-platform px-3 py-6 text-platform-foreground lg:flex">
        <LogoZello className="mb-1 px-2" />
        <p className="mb-6 px-2 text-xs opacity-75">{PLATFORM_BRAND.tagline}</p>
        <Nav />
        <button onClick={sair} className="mt-auto flex items-center gap-2 px-4 py-2 text-sm opacity-80 hover:opacity-100"><LogOut className="h-4 w-4" />Sair</button>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-platform px-3 py-6 text-platform-foreground">
            <button className="absolute right-3 top-3 p-2" onClick={() => setOpen(false)} aria-label="Fechar menu"><X /></button>
            <LogoZello className="mb-6 px-2" /><Nav onNav={() => setOpen(false)} />
            <button onClick={sair} className="mt-6 flex items-center gap-2 px-4 py-2 text-sm"><LogOut className="h-4 w-4" />Sair</button>
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu /></button>
        <span className="font-display text-xl">{PLATFORM_BRAND.name}</span>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 pb-12 pt-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-platform px-3 py-1 text-platform-foreground">Ambiente {PLATFORM_BRAND.name}</span><span className="rounded-full bg-warning-soft px-3 py-1 text-accent">Dados demonstrativos</span></div>
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {subtitle && <p className="mb-6 mt-1 text-muted-foreground">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
