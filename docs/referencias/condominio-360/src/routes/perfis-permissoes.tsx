import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/vg/AppShell";
import { Card, PageTitle } from "@/components/vg/ui";
import { PerfisPermissoes } from "@/components/vg/PerfisPermissoes";
import { pageHead, useStore } from "@/lib/store";

export const Route = createFileRoute("/perfis-permissoes")({
  head: pageHead("Perfis e Permissões", "Gerencie os acessos e defina o que cada usuário pode visualizar e realizar."),
  component: Page,
});

function Page() {
  const { role, user } = useStore();
  return (
    <AppShell>
      <PageTitle title="Perfis e Permissões" subtitle="Gerencie os acessos e defina o que cada usuário pode visualizar e realizar." />
      {role === "sindico" ? <PerfisPermissoes superadmin={false} responsavel={user.nome} /> : <Card>Disponível apenas para o(a) Síndico(a) e o SuperAdministrador.</Card>}
    </AppShell>
  );
}
