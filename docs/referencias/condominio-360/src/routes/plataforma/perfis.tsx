import { createFileRoute } from "@tanstack/react-router";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { PerfisPermissoes } from "@/components/vg/PerfisPermissoes";
import { pageHead, useStore } from "@/lib/store";

export const Route = createFileRoute("/plataforma/perfis")({
  head: pageHead("Perfis e Permissões", "Modelos globais de perfis e permissões estruturais da plataforma.", "ZELLO"),
  component: Page,
});

function Page() {
  const { user } = useStore();
  return (
    <PlatformShell title="Perfis e Permissões" subtitle="Gerencie os acessos e defina o que cada usuário pode visualizar e realizar.">
      <PerfisPermissoes superadmin responsavel={user.nome} />
    </PlatformShell>
  );
}
