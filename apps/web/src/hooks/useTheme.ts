import { useCallback, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "theme";

function readStored(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
  const [stored, setStored] = useState<Theme | undefined>(readStored);
  const theme: Theme = stored ?? (systemPrefersDark() ? "dark" : "light");

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      setStored(next);
      return;
    }
    setStored(next);
  }, [theme]);

  return { theme, toggle };
}
