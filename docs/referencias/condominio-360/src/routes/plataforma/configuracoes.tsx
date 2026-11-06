import { createFileRoute } from "@tanstack/react-router";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { Badge, Card } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";

export const Route = createFileRoute("/plataforma/configuracoes")({
  head: pageHead("Configurações da plataforma", "Modelos de comunicação, integrações, IA e status dos serviços.", "ZELLO"),
  component: () => (
    <PlatformShell title="Configurações da plataforma" subtitle="Modelos de comunicação, integrações, IA e status dos serviços.">
      <Card>
        <ul className="divide-y">
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">E-mail transacional</p><p className="text-sm text-muted-foreground">Envio de avisos e recuperação de senha</p></div><Badge tone="warning">A configurar</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">WhatsApp Business</p><p className="text-sm text-muted-foreground">Avisos de reservas ao síndico</p></div><Badge tone="warning">A configurar</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Assistente de IA</p><p className="text-sm text-muted-foreground">Consulta de regras e convenção</p></div><Badge tone="warning">A configurar</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Modelos de comunicação</p><p className="text-sm text-muted-foreground">3 modelos padrão</p></div><Badge tone="success">Ativo</Badge></li>
        </ul>
      </Card>
    </PlatformShell>
  ),
});
