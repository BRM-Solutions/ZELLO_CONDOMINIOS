import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { pageHead, useStore } from "@/lib/store";
import { PLATFORM_BRAND } from "@/lib/brand";
import { LogoZello } from "@/components/vg/PlatformShell";
import { Button, Field, inputCls } from "@/components/vg/ui";

export const Route = createFileRoute("/plataforma/")({
  head: pageHead("Acesso da plataforma", "Entrada do Superadministrador da plataforma ZELLO.", "ZELLO"),
  component: () => {
    const { setRole } = useStore();
    const nav = useNavigate();
    const entrar = () => { setRole("superadmin"); nav({ to: "/plataforma/painel" }); };
    return (
      <div className="flex min-h-screen items-center justify-center bg-platform px-6">
        <div className="card-surface w-full max-w-sm space-y-5 p-8">
          <div className="flex flex-col items-center gap-2 text-center"><LogoZello /><p className="text-sm text-muted-foreground">{PLATFORM_BRAND.tagline}</p></div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); entrar(); }}>
            <Field label="E-mail"><input type="email" required className={inputCls} /></Field>
            <Field label="Senha"><input type="password" required className={inputCls} /></Field>
            <Button className="w-full" size="lg" type="submit">Entrar na plataforma</Button>
          </form>
          <div className="rounded-xl border border-dashed p-3 text-center">
            <p className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4 text-accent" />Ambiente de demonstração</p>
            <Button variant="outline" size="sm" onClick={entrar}>Entrar como Superadministrador (fictício)</Button>
          </div>
        </div>
      </div>
    );
  },
});
