import { AlertTriangle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TenantLogo } from "../components/shell/Brand";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink, IconButton } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DateChip } from "../components/ui/DateChip";
import { Field, Input, Select } from "../components/ui/Field";
import { ListCard } from "../components/ui/ListCard";
import { Modal } from "../components/ui/Modal";
import { PageTitle } from "../components/ui/PageTitle";
import { Progress } from "../components/ui/Progress";
import { StatCard, StatGrid } from "../components/ui/StatCard";
import { EmptyState, ErrorState, LoadingRows } from "../components/ui/States";
import { Switch } from "../components/ui/Switch";
import {
  COLOR_PRESETS,
  THEME_PREFERENCES,
  parseColorPreset,
  parseThemePreference,
  useBrandPreview,
  useBranding,
  type ColorPreset,
  type ThemePreference,
} from "../contexts/BrandingContext";
import { useTheme } from "../hooks/useTheme";
import "../styles/design-system.css";

const SWATCHES: Array<[string, string]> = [
  ["Primária", "--primary"],
  ["Sidebar", "--sidebar"],
  ["Fundo", "--background"],
  ["Cartão", "--card"],
  ["Terracota", "--accent"],
  ["Sucesso", "--success"],
  ["Alerta", "--warning"],
  ["Erro", "--destructive"],
  ["Info", "--info"],
  ["Sol", "--sun"],
];

const THEME_LABELS: Record<ThemePreference, string> = { light: "Claro", dark: "Escuro", system: "Sistema" };
const PRESET_LABELS: Record<ColorPreset, string> = { verde: "Verde", azul: "Azul", vinho: "Vinho", terracota: "Terracota" };

const SAMPLE_ROWS = [
  { id: "1", title: "Troca de lâmpadas do hall", subtitle: "Bloco A • 12/09", badge: { label: "Concluída", tone: "success" as const } },
  { id: "2", title: "Vazamento na garagem", subtitle: "Subsolo 1 • 10/09", badge: { label: "Em andamento", tone: "warning" as const } },
  { id: "3", title: "Portão com defeito", subtitle: "Entrada principal • 08/09", badge: { label: "Aberta", tone: "danger" as const } },
  { id: "4", title: "Revisão dos elevadores", subtitle: "Torre B • 20/09", badge: { label: "Programada", tone: "info" as const } },
];

export default function DesignSystemPage() {
  const { portalName } = useBranding();
  const { preference, setPreference } = useTheme();
  const { previewPreset, setPreviewPreset } = useBrandPreview();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);

  useEffect(() => () => setPreviewPreset(null), [setPreviewPreset]);

  return (
    <div>
      <PageTitle title="Design System" subtitle="Base única da plataforma ZELLO, personalizável por condomínio — web e mobile." />

      <div className="ds-stack">
        <Card>
          <CardTitle title="Aparência" />
          <div className="ds-controls">
            <Field label="Tema">
              <Select
                value={preference}
                onChange={(event) => {
                  const next = parseThemePreference(event.target.value);
                  if (next) setPreference(next);
                }}
              >
                {THEME_PREFERENCES.map((theme) => (
                  <option key={theme} value={theme}>
                    {THEME_LABELS[theme]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Predefinição de cor">
              <Select value={previewPreset ?? "verde"} onChange={(event) => setPreviewPreset(parseColorPreset(event.target.value))}>
                {COLOR_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {PRESET_LABELS[preset]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle title="Marca" />
          <div className="ds-brand-grid">
            <div className="ds-brand-sample">
              <div className="ds-brand-sample__row">
                <TenantLogo size="md" />
                <span className="font-display ds-brand-sample__name">{portalName}</span>
              </div>
              <p className="ds-brand-sample__note">Portal do condomínio. Logotipo, nome e cor institucional vêm da marca configurada.</p>
            </div>
            <div className="ds-row ds-row--loose">
              <div className="ds-swatch">
                <div className="ds-mosaic mosaic-ring" />
                <p className="ds-swatch__name">Mosaico</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="ds-grid">
          <Card>
            <CardTitle title="Cores" />
            <div className="ds-swatches">
              {SWATCHES.map(([name, token]) => (
                <div key={token} className="ds-swatch">
                  <div className="ds-swatch__chip" style={{ background: `var(${token})` }} />
                  <p className="ds-swatch__name">{name}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle title="Tipografia" />
            <p className="font-display ds-display">DM Serif Display</p>
            <p className="muted">Títulos e saudações</p>
            <p className="ds-lead">Figtree — textos e interface</p>
            <p className="muted">400 / 500 / 600 / 700</p>
          </Card>

          <Card>
            <CardTitle title="Botões" />
            <div className="ds-row">
              <Button>Primário</Button>
              <Button variant="accent">Destaque</Button>
              <Button variant="outline">Contorno</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button variant="danger">Excluir</Button>
              <Button size="sm">Pequeno</Button>
              <Button size="lg">Grande</Button>
              <Button disabled>Desabilitado</Button>
              <Button loading>Salvando</Button>
              <IconButton aria-label="Adicionar" variant="outline">
                <Plus size={20} aria-hidden="true" />
              </IconButton>
              <ButtonLink to="/design-system" variant="outline">
                Link como botão
              </ButtonLink>
            </div>
          </Card>

          <Card>
            <CardTitle title="Status" />
            <div className="ds-row">
              <Badge tone="success">Concluída</Badge>
              <Badge tone="warning">Em andamento</Badge>
              <Badge tone="danger">Aberta</Badge>
              <Badge tone="info">Programada</Badge>
              <Badge tone="neutral">Arquivada</Badge>
            </div>
            <div className="ds-bars">
              <Progress value={64} label="Progresso 64%" />
              <Progress value={42} tone="success" label="Progresso 42%" />
              <Progress value={20} tone="danger" label="Progresso 20%" />
            </div>
          </Card>

          <Card>
            <CardTitle title="Formulários" />
            <div className="ds-stack">
              <Field label="Campo">
                <Input placeholder="Digite..." />
              </Field>
              <Field label="Seleção">
                <Select defaultValue="opcao">
                  <option value="opcao">Opção</option>
                </Select>
              </Field>
              <Field label="Com erro" error="Informe um valor válido">
                <Input defaultValue="abc" />
              </Field>
              <Alert tone="danger">E-mail ou senha incorretos. Confira os dados e tente de novo.</Alert>
            </div>
          </Card>

          <Card>
            <CardTitle title="Data e interruptor" />
            <div className="ds-row ds-row--loose">
              <DateChip day="04" month="set" />
            </div>
            <Switch
              checked={switchOn}
              onCheckedChange={setSwitchOn}
              label="Receber avisos por e-mail"
              description="Você pode mudar quando quiser."
            />
            <Switch checked={false} onCheckedChange={() => undefined} label="Desabilitado" disabled />
          </Card>
        </div>

        <Alert
          tone="warning"
          icon={<AlertTriangle size={24} />}
          action={<Button size="md">Ver detalhes</Button>}
        >
          <strong>Contrato vence em 30 dias</strong>
          <p className="muted">Faixa de aviso da página.</p>
        </Alert>

        <div>
          <StatGrid>
            <StatCard label="Abertas" value="12" />
            <StatCard label="Em andamento" value="7" />
            <StatCard label="Concluídas" value="48" />
            <StatCard label="Programadas" value="5" />
          </StatGrid>
          <ListCard rows={SAMPLE_ROWS} />
        </div>

        <div className="ds-grid">
          <div className="ds-stack">
            <EmptyState message="Nenhum item por aqui ainda." action={<Button variant="outline">Criar o primeiro</Button>} />
            <LoadingRows count={2} />
          </div>
          <ErrorState message="Não foi possível carregar os dados." onRetry={() => toast.info("Tentando de novo")} />
        </div>

        <Card>
          <CardTitle title="Modal e aviso" />
          <div className="ds-row">
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              Abrir modal
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Confirmar exclusão
            </Button>
            <Button variant="outline" onClick={() => toast.success("Salvo com sucesso", { description: "Descrição do aviso." })}>
              Mostrar aviso
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova ocorrência"
        description="Descreva o que aconteceu. A equipe recebe o aviso na hora."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModalOpen(false)}>Registrar</Button>
          </>
        }
      >
        <Field label="Título">
          <Input placeholder="Ex.: lâmpada queimada" />
        </Field>
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Excluir este item?"
        description="Essa ação não pode ser desfeita."
      />
    </div>
  );
}
