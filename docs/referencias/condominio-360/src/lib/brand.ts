import logoAsset from "@/assets/logo-gaudi-mosaico.png.asset.json";
import fotoAsset from "@/assets/foto-vila-gaudi.png.asset.json";
import hero from "@/assets/hero-condo.jpg";
import oficialAsset from "@/assets/vila-gaudi-oficial.png.asset.json";

export type Tenant = {
  id: string;
  portalName: string; // ex.: "Gaudí 360°"
  legalName: string; // ex.: "Condomínio Vila Gaudí"
  logoUrl: string | null;
  heroUrl: string;
  loginUrl?: string;
  slogan?: string;
  address: string;
  colors: { primary: string; sidebar: string } | null; // null = paleta padrão do Design System
  status: "Ativo" | "Implantação" | "Suspenso";
  plano: string;
  unidades: number;
  usuarios: number;
  mosaico: boolean;
};

export const PLATFORM_BRAND = {
  name: "ZELLO",
  tagline: "Gestão inteligente. Cuidado em cada detalhe.",
};

export const TENANTS: Tenant[] = [
  { id: "vila-gaudi", portalName: "Gaudí 360°", legalName: "Condomínio Vila Gaudí", logoUrl: logoAsset.url, heroUrl: oficialAsset.url, loginUrl: fotoAsset.url, slogan: "Seu condomínio conectado a você.",
    address: "Rua Vereador Agostinho de Paula Santos, 548 — Piratininga, Niterói - RJ", colors: null, status: "Ativo", plano: "Premium", unidades: 248, usuarios: 612, mosaico: true },
  { id: "jardim-flores", portalName: "Jardim das Flores 360°", legalName: "Condomínio Jardim das Flores", logoUrl: null, heroUrl: hero,
    address: "Exemplo fictício", colors: { primary: "oklch(0.45 0.12 340)", sidebar: "oklch(0.35 0.1 340)" }, status: "Implantação", plano: "Essencial", unidades: 96, usuarios: 140, mosaico: false },
  { id: "vista-mar", portalName: "Vista Mar 360°", legalName: "Condomínio Vista Mar", logoUrl: null, heroUrl: hero,
    address: "Exemplo fictício", colors: { primary: "oklch(0.45 0.1 230)", sidebar: "oklch(0.33 0.08 235)" }, status: "Ativo", plano: "Profissional", unidades: 180, usuarios: 390, mosaico: false },
];

export const portalNameFor = (legalName: string) =>
  `${legalName.replace(/^Condom[ií]nio\s+/i, "").replace(/^Vila\s+/i, "")} 360°`;
