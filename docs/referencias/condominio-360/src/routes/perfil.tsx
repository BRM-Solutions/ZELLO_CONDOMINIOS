import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/vg/AppShell";
import { Badge, Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { pageHead, useStore, USERS } from "@/lib/store";

export const Route = createFileRoute("/perfil")({
  head: pageHead("Meu perfil", "Dados pessoais do síndico, administração ou morador."),
  component: Perfil,
});

function Perfil() {
  const { user, role } = useStore();
  return (
    <AppShell>
      <PageTitle title="Meu perfil" subtitle={role === "morador" ? "Perfil de morador" : `Perfil de ${user.cargo.toLowerCase()}`} />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground">{user.nome.split(" ").map((p) => p[0]).join("")}</div>
          <h2 className="mt-3 text-2xl">{user.nome}</h2>
          <p className="text-muted-foreground">{user.cargo}{user.apto ? ` • ${user.apto}` : ""}</p>
          <div className="mt-3 flex justify-center"><Badge tone="success">{role === "morador" ? "Proprietária" : "Mandato 2025–2027"}</Badge></div>
        </Card>
        <Card>
          <CardTitle title="Dados pessoais" />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome completo"><input className={inputCls} defaultValue={user.nome} /></Field>
            <Field label="E-mail"><input className={inputCls} defaultValue={USERS[role].email} /></Field>
            <Field label="Telefone / WhatsApp"><input className={inputCls} defaultValue="+55 21 99999-0000" /></Field>
            {role === "morador" ? (<>
              <Field label="Unidade"><input className={inputCls} defaultValue={user.apto} disabled /></Field>
              <Field label="Veículo (placa)"><input className={inputCls} defaultValue="ABC1D23" /></Field>
              <Field label="Dependentes"><input className={inputCls} defaultValue="2" /></Field>
            </>) : (<>
              <Field label="Função"><select className={inputCls}><option>{user.cargo}</option></select></Field>
              <Field label="Início do mandato"><input type="date" className={inputCls} defaultValue="2025-01-01" /></Field>
            </>)}
          </div>
          <Button className="mt-4" onClick={() => toast.success("Perfil atualizado")}>Salvar alterações</Button>
        </Card>
      </div>
    </AppShell>
  );
}
