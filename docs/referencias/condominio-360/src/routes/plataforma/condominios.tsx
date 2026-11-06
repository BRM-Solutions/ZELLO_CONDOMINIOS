import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/vg/PlatformShell";
import { Badge, Button, Card, CardTitle, Field, inputCls } from "@/components/vg/ui";
import { pageHead, useStore } from "@/lib/store";
import { portalNameFor, TENANTS } from "@/lib/brand";

export const Route = createFileRoute("/plataforma/condominios")({
  head: pageHead("Condomínios", "Cadastre condomínios e configure o portal personalizado de cada um.", "ZELLO"),
  component: Condominios,
});

const CORES = [["Verde", "oklch(0.38 0.075 155)", "oklch(0.33 0.065 155)"], ["Azul", "oklch(0.45 0.1 230)", "oklch(0.33 0.08 235)"], ["Vinho", "oklch(0.45 0.12 340)", "oklch(0.35 0.1 340)"], ["Terracota", "oklch(0.52 0.13 40)", "oklch(0.38 0.09 40)"]] as const;

function Condominios() {
  const { tenants, setTenants } = useStore();
  const [nome, setNome] = useState("Condomínio Bela Vista");
  const [portal, setPortal] = useState("");
  const [cor, setCor] = useState(1);
  const portalName = portal || portalNameFor(nome);
  const c = CORES[cor]!;

  const criar = (e: React.FormEvent) => {
    e.preventDefault();
    setTenants([...tenants, { ...TENANTS[2]!, id: crypto.randomUUID(), legalName: nome, portalName, logoUrl: null, colors: { primary: c[1], sidebar: c[2] }, status: "Implantação", plano: "Essencial", unidades: 0, usuarios: 0, address: "A preencher" }]);
    toast.success(`${portalName} criado`, { description: "Status: em implantação (demonstração)." });
    setNome(""); setPortal("");
  };

  return (
    <PlatformShell title="Condomínios" subtitle="Cada condomínio ganha seu portal com nome, logotipo e cores próprios, sobre a mesma base ZELLO.">
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card><CardTitle title="Cadastrados" />
          <ul className="divide-y">{tenants.map((t) => (
            <li key={t.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0"><p className="font-semibold">{t.portalName}</p><p className="text-sm text-muted-foreground">{t.legalName} • {t.unidades} unidades • {t.usuarios} usuários • plano {t.plano}</p></div>
              <Badge tone={t.status === "Ativo" ? "success" : t.status === "Suspenso" ? "danger" : "warning"}>{t.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => setTenants(tenants.map((x) => x.id === t.id ? { ...x, status: x.status === "Suspenso" ? "Ativo" : "Suspenso" } : x))}>{t.status === "Suspenso" ? "Reativar" : "Suspender"}</Button>
            </li>))}</ul>
        </Card>
        <Card><CardTitle title="Novo condomínio" />
          <form className="space-y-4" onSubmit={criar}>
            <Field label="Nome oficial do condomínio"><input required className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            <Field label="Nome do portal (opcional)"><input className={inputCls} value={portal} placeholder={portalNameFor(nome || "Exemplo")} onChange={(e) => setPortal(e.target.value)} /></Field>
            <div><p className="mb-2 text-sm font-medium">Cor institucional</p>
              <div className="flex gap-2">{CORES.map(([n, p], i) => <button type="button" key={n} onClick={() => setCor(i)} aria-label={n} className={`h-9 w-9 rounded-full border-2 ${i === cor ? "border-foreground" : "border-transparent"}`} style={{ background: p }} />)}</div>
            </div>
            <div><p className="mb-2 text-sm font-medium">Pré-visualização</p>
              <div className="overflow-hidden rounded-xl border">
                <div className="px-4 py-3" style={{ background: c[2], color: "var(--primary-foreground)" }}><p className="font-display text-xl">{portalName}</p><p className="text-xs opacity-80">{nome || "Nome do condomínio"}</p></div>
                <div className="bg-background p-4 text-xs text-muted-foreground">uma plataforma ZELLO</div>
              </div>
            </div>
            <Button className="w-full" type="submit">Cadastrar condomínio</Button>
          </form>
        </Card>
      </div>
    </PlatformShell>
  );
}
