import { createFileRoute } from "@tanstack/react-router";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { Badge, Card } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";

export const Route = createFileRoute("/plataforma/planos")({
  head: pageHead("Planos e Assinaturas", "Planos comerciais, funcionalidades e assinaturas ativas.", "ZELLO"),
  component: () => (
    <PlatformShell title="Planos e Assinaturas" subtitle="Planos comerciais, funcionalidades e assinaturas ativas.">
      <Card>
        <ul className="divide-y">
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Essencial — R$ 390/mês</p><p className="text-sm text-muted-foreground">Avisos à Comunidade, reservas, ocorrências, documentos</p></div><Badge tone="success">Ativo</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Profissional — R$ 890/mês</p><p className="text-sm text-muted-foreground">Essencial + financeiro, manutenções, relatórios</p></div><Badge tone="success">Ativo</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Premium — R$ 1.490/mês</p><p className="text-sm text-muted-foreground">Profissional + assistente de IA, WhatsApp, marca própria</p></div><Badge tone="success">Ativo</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Vista Mar 360° • Profissional</p><p className="text-sm text-muted-foreground">Vence em 10/11/2026</p></div><Badge tone="info">Em dia</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Jardim das Flores 360° • Essencial</p><p className="text-sm text-muted-foreground">Implantação — primeira cobrança em 12/2026</p></div><Badge tone="warning">Pendente</Badge></li>
        </ul>
      </Card>
    </PlatformShell>
  ),
});
