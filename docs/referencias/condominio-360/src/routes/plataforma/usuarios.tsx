import { createFileRoute } from "@tanstack/react-router";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { Badge, Card } from "@/components/vg/ui";
import { pageHead } from "@/lib/store";

export const Route = createFileRoute("/plataforma/usuarios")({
  head: pageHead("Usuários e Convites", "Responsáveis por cada condomínio e convites enviados.", "ZELLO"),
  component: () => (
    <PlatformShell title="Usuários e Convites" subtitle="Responsáveis por cada condomínio e convites enviados.">
      <Card>
        <ul className="divide-y">
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Elton Grativol</p><p className="text-sm text-muted-foreground">Síndico • Gaudí 360°</p></div><Badge tone="success">Ativo</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Paula Reis</p><p className="text-sm text-muted-foreground">Administradora • Gaudí 360°</p></div><Badge tone="success">Ativo</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">Marcos Teixeira</p><p className="text-sm text-muted-foreground">Síndico • Vista Mar 360°</p></div><Badge tone="success">Ativo</Badge></li>
            <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="font-medium">convite: sindico@jardimdasflores.com.br</p><p className="text-sm text-muted-foreground">Síndico • Jardim das Flores 360°</p></div><Badge tone="warning">Convite enviado</Badge></li>
        </ul>
      </Card>
    </PlatformShell>
  ),
});
