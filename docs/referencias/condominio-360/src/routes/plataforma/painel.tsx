import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Home, Users, TrendingUp, CreditCard, UserMinus, LifeBuoy, ShieldCheck } from "lucide-react";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { Badge, Card, CardTitle } from "@/components/vg/ui";
import { pageHead, useStore } from "@/lib/store";

export const Route = createFileRoute("/plataforma/painel")({
  head: pageHead("Visão geral", "Indicadores da plataforma ZELLO: condomínios, assinaturas e MRR.", "ZELLO"),
  component: Painel,
});

function Painel() {
  const { tenants } = useStore();
  const kpis: [typeof Home, string, string][] = [
    [Building2, "Condomínios", String(tenants.length)],
    [Home, "Unidades atendidas", tenants.reduce((a, t) => a + t.unidades, 0).toLocaleString("pt-BR")],
    [Users, "Usuários ativos", tenants.reduce((a, t) => a + t.usuarios, 0).toLocaleString("pt-BR")],
    [TrendingUp, "MRR", "R$ 4.870"],
    [CreditCard, "Assinaturas ativas", String(tenants.filter((t) => t.status === "Ativo").length)],
    [UserMinus, "Cancelamento (90d)", "0%"],
    [LifeBuoy, "Chamados abertos", "3"],
  ];
  return (
    <PlatformShell title="Visão geral" subtitle="Bem-vindo(a) ao seu centro de gestão.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map(([I, l, v]) => <Card key={l}><I className="mb-2 h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></Card>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card><CardTitle title="Condomínios" action={<Link to="/plataforma/condominios" className="text-sm text-muted-foreground">Gerenciar ›</Link>} />
          <ul className="divide-y">{tenants.map((t) => (
            <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0"><p className="truncate font-semibold">{t.portalName}</p><p className="truncate text-sm text-muted-foreground">{t.legalName} • {t.plano} • {t.unidades} unidades</p></div>
              <Badge tone={t.status === "Ativo" ? "success" : t.status === "Suspenso" ? "danger" : "warning"}>{t.status}</Badge>
            </li>))}</ul>
        </Card>
        <Card><CardTitle icon={<ShieldCheck className="h-5 w-5" />} title="Privacidade dos condomínios" />
          <p className="text-sm leading-relaxed">O Superadministrador não vê finanças, documentos internos nem dados pessoais dos condomínios. Acesso de suporte exige autorização do síndico, justificativa, prazo e registro em auditoria.</p>
        </Card>
      </div>
    </PlatformShell>
  );
}
