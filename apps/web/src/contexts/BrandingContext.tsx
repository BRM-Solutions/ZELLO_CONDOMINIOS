import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const COLOR_PRESETS = ["verde", "azul", "vinho", "terracota"] as const;
export type ColorPreset = (typeof COLOR_PRESETS)[number];
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export interface Branding {
  portalName: string;
  legalName: string;
  address: string;
  slogan: string;
  logoUrl: string | null;
  portalPhotoUrl: string | null;
  loginPhotoUrl: string | null;
  colorPreset: ColorPreset;
  mosaic: boolean;
  defaultTheme: ThemePreference;
}

export const DEFAULT_BRANDING: Branding = {
  portalName: "Portal",
  legalName: "",
  address: "",
  slogan: "",
  logoUrl: null,
  portalPhotoUrl: null,
  loginPhotoUrl: null,
  colorPreset: "verde",
  mosaic: false,
  defaultTheme: "light",
};

export function parseColorPreset(value: unknown): ColorPreset {
  return COLOR_PRESETS.find((preset) => preset === value) ?? "verde";
}

export function parseThemePreference(value: unknown): ThemePreference | undefined {
  return THEME_PREFERENCES.find((theme) => theme === value);
}

interface BrandingContextValue {
  branding: Branding;
  previewPreset: ColorPreset | null;
  setPreviewPreset: (preset: ColorPreset | null) => void;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  previewPreset: null,
  setPreviewPreset: () => undefined,
});

function normalize(input: Partial<Branding> | undefined): Branding {
  const merged = { ...DEFAULT_BRANDING, ...input };
  const portalName = merged.portalName.trim() || merged.legalName.trim() || DEFAULT_BRANDING.portalName;
  return {
    ...merged,
    portalName,
    colorPreset: parseColorPreset(merged.colorPreset),
    defaultTheme: parseThemePreference(merged.defaultTheme) ?? DEFAULT_BRANDING.defaultTheme,
  };
}

export function BrandingProvider({ branding, children }: { branding?: Partial<Branding>; children: ReactNode }) {
  const [previewPreset, setPreviewPreset] = useState<ColorPreset | null>(null);
  const normalized = useMemo(() => normalize(branding), [branding]);
  const effectivePreset = previewPreset ?? normalized.colorPreset;

  useEffect(() => {
    const root = document.documentElement;
    if (effectivePreset === "verde") root.removeAttribute("data-brand");
    else root.setAttribute("data-brand", effectivePreset);
    return () => root.removeAttribute("data-brand");
  }, [effectivePreset]);

  const value = useMemo(
    () => ({ branding: { ...normalized, colorPreset: effectivePreset }, previewPreset, setPreviewPreset }),
    [normalized, effectivePreset, previewPreset],
  );
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  return useContext(BrandingContext).branding;
}

export function useBrandPreview() {
  const { previewPreset, setPreviewPreset } = useContext(BrandingContext);
  return { previewPreset, setPreviewPreset };
}
