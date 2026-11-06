import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, Hash, Mail, MessageCircle, Shield, Building2 } from "lucide-react";
import { AppShell } from "@/components/vg/AppShell";
import { Button, Card, CardTitle, Field, PageTitle, inputCls } from "@/components/vg/ui";
import { Switch } from "@/components/ui/switch";
import { pageHead, useStore } from "@/lib/store";
import { feedbackStore } from "@/lib/feedback";
import { MessageSquareHeart } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: pageHead("Configurações", "Preferências de notificação, segurança e dados do condomínio."),
  component: Config,
});

function Row({ icon, title, desc, checked, onChange }: { icon: React.ReactNode; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary">{icon}</span>
      <div className="min-w-0"><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Config() {
  const { settings, setSettings, role, tenant, protocoloPrefs: pp, setProtocoloPrefs } = useStore();
  const fb = feedbackStore.use();
  const setPP = (k: "portal" | "email" | "whatsapp", v: boolean) => {
    const n = { ...pp, [k]: v };
    if (!n.portal && !n.email && !n.whatsapp) { toast.error("Mantenha pelo menos um canal ativo"); return; }
    setProtocoloPrefs(n);
  };
  return (
    <AppShell>
      <PageTitle title="Configurações" subtitle="Ajuste como e onde você recebe avisos." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Bell className="h-5 w-5" />} title={role !== "morador" ? "Avisos de reservas" : "Notificações"} />
          <div className="divide-y">
            <Row icon={<Bell className="h-4 w-4" />} title="No portal" desc="Sininho e central de notificações" checked={settings.portal} onChange={(v) => setSettings({ ...settings, portal: v })} />
            <Row icon={<Mail className="h-4 w-4" />} title="Por e-mail" desc={settings.emailDestino} checked={settings.email} onChange={(v) => setSettings({ ...settings, email: v })} />
            <Row icon={<MessageCircle className="h-4 w-4" />} title="Por WhatsApp" desc={settings.whatsappDestino} checked={settings.whatsapp} onChange={(v) => setSettings({ ...settings, whatsapp: v })} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="E-mail de destino"><input className={inputCls} value={settings.emailDestino} onChange={(e) => setSettings({ ...settings, emailDestino: e.target.value })} /></Field>
            <Field label="WhatsApp de destino"><input className={inputCls} value={settings.whatsappDestino} onChange={(e) => setSettings({ ...settings, whatsappDestino: e.target.value })} /></Field>
          </div>
        </Card>
        {role !== "superadmin" && <Card>
          <CardTitle icon={<Hash className="h-5 w-5" />} title="Receber número de protocolo" />
          <p className="text-muted-foreground">Ao registrar uma ocorrência, você recebe o número de protocolo pelos canais escolhidos.</p>
          <div className="divide-y">
            <Row icon={<Bell className="h-4 w-4" />} title="No portal" desc="Sininho e central de notificações" checked={pp.portal} onChange={(v) => setPP("portal", v)} />
            <Row icon={<Mail className="h-4 w-4" />} title="Por e-mail" desc={pp.emailDestino || "Informe o e-mail abaixo"} checked={pp.email} onChange={(v) => setPP("email", v)} />
            <Row icon={<MessageCircle className="h-4 w-4" />} title="Por WhatsApp" desc={pp.whatsappDestino || "Informe o número abaixo"} checked={pp.whatsapp} onChange={(v) => setPP("whatsapp", v)} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="E-mail para protocolo"><input type="email" className={inputCls} value={pp.emailDestino} onChange={(e) => setProtocoloPrefs({ ...pp, emailDestino: e.target.value })} /></Field>
            <Field label="WhatsApp para protocolo"><input className={inputCls} placeholder="+55 21 99999-0000" value={pp.whatsappDestino} onChange={(e) => setProtocoloPrefs({ ...pp, whatsappDestino: e.target.value })} /></Field>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">E-mail e WhatsApp ainda aguardam integração: por enquanto o protocolo chega apenas no portal.</p>
        </Card>}
        <Card>
          <CardTitle icon={<Shield className="h-5 w-5" />} title="Segurança" />
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); toast.success("Senha atualizada"); }}>
            <Field label="Senha atual"><input type="password" className={inputCls} /></Field>
            <Field label="Nova senha"><input type="password" className={inputCls} /></Field>
            <Button type="submit">Alterar senha</Button>
          </form>
        </Card>
        {role === "sindico" && (
          <Card>
            <CardTitle icon={<MessageSquareHeart className="h-5 w-5" />} title="Feedback do Portal" />
            <Row icon={<MessageSquareHeart className="h-4 w-4" />} title="Síndico acompanha feedbacks" desc="Ver em Feedback do Portal os feedbacks enviados pelos usuários do condomínio" checked={fb.sindicoAcompanha} onChange={(v) => feedbackStore.set((s) => ({ ...s, sindicoAcompanha: v }))} />
          </Card>
        )}
        {(role === "sindico" || role === "admin") && (
          <Card className="lg:col-span-2">
            <CardTitle icon={<Building2 className="h-5 w-5" />} title="Dados do condomínio" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Nome"><input className={inputCls} defaultValue={tenant.legalName} /></Field>
              <Field label="CNPJ"><input className={inputCls} defaultValue="00.000.000/0001-00" /></Field>
              <Field label="Endereço"><input className={inputCls} defaultValue="Rua Ver. Agostinho de Paula Santos, 548" /></Field>
            </div>
            <Button className="mt-4" onClick={() => toast.success("Dados salvos")}>Salvar</Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
