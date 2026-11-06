import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useStore, pageHead, USERS, type Role } from "@/lib/store";
import { PLATFORM_BRAND } from "@/lib/brand";
import { TenantLogo } from "@/components/vg/AppShell";
import { Button, Field, inputCls } from "@/components/vg/ui";

export const Route = createFileRoute("/")({
  head: pageHead("Entrar", "Acesse o Gaudí 360°, portal do Condomínio Vila Gaudí."),
  component: Login,
});

const DEMO: Role[] = ["sindico", "superadmin", "conselho", "zelador", "morador"];

function Login() {
  const { setRole, tenant } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const entrar = (r: Role) => { setRole(r); nav({ to: r === "superadmin" ? "/plataforma/painel" : r === "zelador" ? "/minha-rotina" : "/painel" }); };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={tenant.loginUrl ?? tenant.heroUrl} alt={tenant.legalName} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar/90 to-transparent" />
        <div className="absolute bottom-12 left-12 max-w-md text-sidebar-foreground">
          <h2 className="text-5xl">{tenant.portalName}</h2>
          <p className="mt-3 text-lg">{tenant.slogan ?? `O portal do ${tenant.legalName}.`}</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center text-center">
            <TenantLogo className="h-24 w-24" />
            <h1 className="mt-3 text-4xl">{tenant.portalName}</h1>
            <p className="text-muted-foreground">{tenant.legalName}</p>
          </div>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const r = (["sindico", "admin", "conselho", "zelador", "morador"] as Role[]).find((k) => USERS[k].email === email.trim().toLowerCase());
            if (r) entrar(r); else setErro("E-mail ou senha incorretos. Confira os dados e tente de novo.");
          }}>
            <Field label="E-mail"><input className={inputCls} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro(""); }} placeholder="voce@email.com" required /></Field>
            <Field label="Senha"><input className={inputCls} type="password" placeholder="••••••••" required /></Field>
            {erro && <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive">{erro}</p>}
            <div className="text-right"><Link to="/recuperar-senha" className="text-sm text-primary hover:underline">Esqueci minha senha</Link></div>
            <Button size="lg" className="w-full" type="submit">Entrar</Button>
          </form>

          <section className="rounded-2xl border border-dashed p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4 text-accent" />Ambiente de demonstração</p>
            <p className="mb-3 text-xs text-muted-foreground">Contas fictícias, apenas para conhecer cada perfil. Não é um login real.</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((r) => <Button key={r} variant="outline" size="sm" className="h-auto min-h-10 py-2" onClick={() => entrar(r)}>{USERS[r].cargo}</Button>)}
            </div>
          </section>
          <p className="text-center text-xs text-muted-foreground">
            uma plataforma {PLATFORM_BRAND.name} • <Link to="/plataforma" className="hover:underline">acesso da plataforma</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
