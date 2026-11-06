import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { TenantLogo } from "@/components/vg/AppShell";
import { pageHead } from "@/lib/store";
import { Button, Card, Field, inputCls } from "@/components/vg/ui";

export const Route = createFileRoute("/recuperar-senha")({
  head: pageHead("Recuperar senha", "Receba um link para redefinir sua senha do Gaudí 360°."),
  component: () => {
    const [sent, setSent] = useState(false);
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-sm space-y-5 p-8">
          <div className="flex justify-center"><TenantLogo className="h-16 w-16" /></div>
          {sent ? (
            <div className="space-y-3 text-center">
              <MailCheck className="mx-auto h-10 w-10 text-success" />
              <h1 className="text-2xl">Verifique seu e-mail</h1>
              <p className="text-sm text-muted-foreground">Enviamos um link para redefinir sua senha.</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <h1 className="text-center text-2xl">Recuperar senha</h1>
              <Field label="E-mail cadastrado"><input className={inputCls} type="email" required /></Field>
              <Button className="w-full" type="submit">Enviar link</Button>
            </form>
          )}
          <Link to="/" className="block text-center text-sm text-primary hover:underline">Voltar ao login</Link>
        </Card>
      </div>
    );
  },
});
