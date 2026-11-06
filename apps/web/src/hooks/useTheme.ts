import { useCallback, useEffect, useSyncExternalStore } from "react";
import { parseThemePreference, useBranding, type ThemePreference } from "../contexts/BrandingContext";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();
let memoryFallback: ThemePreference | undefined;

function readStored(): ThemePreference | undefined {
  try {
    return parseThemePreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    return memoryFallback;
  }
}

function writeStored(value: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    memoryFallback = value;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function useTheme() {
  const { defaultTheme } = useBranding();
  const stored = useSyncExternalStore(subscribe, readStored, () => undefined);
  const preference: ThemePreference = stored ?? defaultTheme;

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => writeStored(next), []);
  return { preference, setPreference };
}
