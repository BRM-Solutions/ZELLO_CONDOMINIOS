import { can, type Permission, type Role } from "@app/shared";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FileUp,
  Folder,
  Gavel,
  HardHat,
  HeartPulse,
  Home,
  LineChart,
  MessageSquareHeart,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  // Caminho depois de /o/:organizationId ("" = pagina inicial da organizacao).
  segment: string;
  icon: LucideIcon;
  // null enquanto o modulo nao existe: a permissao e definida na spec do modulo.
  permission: Permission | null;
  available: boolean;
}

// Ordem, rotulos e icones de docs/13 secao 6.2 (AppShell.tsx:14-39 do mock).
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "minha-rotina", label: "Minha Rotina", segment: "minha-rotina", icon: ClipboardCheck, permission: null, available: false },
  { key: "feedback", label: "Feedback do Portal", segment: "feedback", icon: MessageSquareHeart, permission: null, available: false },
  { key: "painel", label: "Painel Geral", segment: "", icon: Home, permission: "organization:read", available: true },
  { key: "comunicados", label: "Avisos à Comunidade", segment: "comunicados", icon: Bell, permission: null, available: false },
  { key: "riscos", label: "Riscos e Pendências", segment: "riscos", icon: AlertTriangle, permission: null, available: false },
  { key: "saude-predial", label: "Saúde Predial", segment: "saude-predial", icon: HeartPulse, permission: null, available: false },
  { key: "financeiro", label: "Financeiro", segment: "financeiro", icon: BarChart3, permission: null, available: false },
  { key: "aprovacoes", label: "Fluxo de Aprovações", segment: "aprovacoes", icon: Gavel, permission: null, available: false },
  { key: "calendario", label: "Calendário", segment: "calendario", icon: CalendarDays, permission: null, available: false },
  { key: "manutencoes", label: "Manutenção Preventiva", segment: "manutencoes", icon: Wrench, permission: null, available: false },
  { key: "ordens-servico", label: "Ordens de Serviço", segment: "ordens-servico", icon: ClipboardList, permission: null, available: false },
  { key: "obras", label: "Obras e Instalações", segment: "obras", icon: HardHat, permission: null, available: false },
  { key: "ocorrencias", label: "Ocorrências do Condomínio", segment: "ocorrencias", icon: FileText, permission: null, available: false },
  { key: "reservas", label: "Reservas de Áreas", segment: "reservas", icon: CalendarCheck, permission: null, available: false },
  { key: "documentos", label: "Central de Documentos", segment: "documentos", icon: Folder, permission: null, available: false },
  { key: "regras", label: "Regras de Convivência", segment: "regras", icon: FileText, permission: null, available: false },
  { key: "moradores", label: "Moradores", segment: "moradores", icon: Building2, permission: null, available: false },
  { key: "fornecedores", label: "Fornecedores", segment: "fornecedores", icon: Briefcase, permission: null, available: false },
  { key: "equipe", label: "Equipe e Escalas", segment: "equipe", icon: UserCog, permission: null, available: false },
  { key: "relatorios", label: "Relatórios", segment: "relatorios", icon: LineChart, permission: null, available: false },
  { key: "importacao", label: "Configuração e Importação", segment: "importacao", icon: FileUp, permission: null, available: false },
  // Ate a spec de configuracoes, aponta para a pagina de organizacao existente.
  { key: "configuracoes", label: "Configurações", segment: "organizacao", icon: Settings, permission: "organization:manage", available: true },
  { key: "perfis-permissoes", label: "Perfis e Permissões", segment: "perfis-permissoes", icon: ShieldCheck, permission: null, available: false },
];

// Bottom nav do mock (AppShell.tsx:170-182): 5 itens; equipe operacional (staff) usa 3.
const BOTTOM_DEFAULT: readonly NavItem[] = [
  { key: "painel", label: "Início", segment: "", icon: Home, permission: "organization:read", available: true },
  { key: "comunicados", label: "Avisos", segment: "comunicados", icon: Bell, permission: null, available: false },
  { key: "reservas", label: "Reservas", segment: "reservas", icon: CalendarCheck, permission: null, available: false },
  { key: "ocorrencias", label: "Ocorrências", segment: "ocorrencias", icon: FileText, permission: null, available: false },
  { key: "perfil", label: "Perfil", segment: "perfil", icon: Users, permission: null, available: false },
];

const BOTTOM_STAFF: readonly NavItem[] = [
  { key: "minha-rotina", label: "Minha Rotina", segment: "minha-rotina", icon: ClipboardCheck, permission: null, available: false },
  { key: "comunicados", label: "Avisos", segment: "comunicados", icon: Bell, permission: null, available: false },
  { key: "perfil", label: "Perfil", segment: "perfil", icon: Users, permission: null, available: false },
];

const MIN_BOTTOM_NAV_ITEMS = 2;

function isVisible(item: NavItem, role: Role | undefined): boolean {
  return item.available && item.permission !== null && can(role, item.permission);
}

export function visibleNavItems(role: Role | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => isVisible(item, role));
}

// Com menos de 2 itens disponiveis a barra nao e renderizada.
export function visibleBottomNavItems(role: Role | undefined): NavItem[] {
  const items = (role === "staff" ? BOTTOM_STAFF : BOTTOM_DEFAULT).filter((item) => isVisible(item, role));
  return items.length >= MIN_BOTTOM_NAV_ITEMS ? items : [];
}

export function navPath(organizationId: string | undefined, item: NavItem): string {
  const base = organizationId ? `/o/${organizationId}` : "/";
  return item.segment && organizationId ? `${base}/${item.segment}` : base;
}
