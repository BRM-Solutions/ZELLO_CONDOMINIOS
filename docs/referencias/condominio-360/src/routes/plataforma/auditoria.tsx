import { createFileRoute } from "@tanstack/react-router";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { Badge, Card } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";

export const Route = createFileRoute("/plataforma/auditoria")({
  head: pageHead("Auditoria", "Registro de ações administrativas relevantes (demonstração).", "ZELLO"),
  component: () => (
    <PlatformShell title="Auditoria" subtitle="Registro de ações administrativas relevantes (demonstração).">
      <Card>
        <ul className="divide-y">
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Condomínio Jardim das Flores cadastrado</p><p className="text-sm text-muted-foreground">Equipe ZELLO • 28/10/2026 14:02</p></div><Badge tone="info">Cadastro</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Plano do Vista Mar alterado</p><p className="text-sm text-muted-foreground">Equipe ZELLO • 20/10/2026 09:15</p></div><Badge tone="neutral">Assinatura</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Acesso de suporte ao Gaudí 360° solicitado</p><p className="text-sm text-muted-foreground">Equipe ZELLO • 15/10/2026 — autorizado pelo síndico por 2h</p></div><Badge tone="warning">Suporte</Badge></li>
        </ul>
      </Card>
    </PlatformShell>
  ),
});
