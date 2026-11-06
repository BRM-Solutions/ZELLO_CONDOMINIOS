import { LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { THEME_PREFERENCES, parseThemePreference, type ThemePreference } from "../../contexts/BrandingContext";
import { useTheme } from "../../hooks/useTheme";
import { Field, Select } from "../ui/Field";

const THEME_LABELS: Record<ThemePreference, string> = { light: "Claro", dark: "Escuro", system: "Sistema" };

export function initialsFromEmail(email: string | null): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const letters = local
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function UserMenu() {
  const { email, memberships, organizationId, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const organizationIds = [...new Set(memberships.map((m) => m.organizationId))];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={email ? `Menu do usuário: ${email}` : "Menu do usuário"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-menu__avatar" aria-hidden="true">
          {initialsFromEmail(email)}
        </span>
        <span className="user-menu__email" aria-hidden="true">
          {email}
        </span>
      </button>
      {open && (
        <div id={panelId} className="card user-menu__panel" role="group" aria-label="Conta e preferências">
          {email && (
            <p className="user-menu__who" title={email}>
              {email}
            </p>
          )}
          {organizationIds.length > 1 && organizationId && (
            <Field label="Organização ativa">
              <Select
                value={organizationId}
                onChange={(event) => {
                  setOpen(false);
                  navigate(`/o/${event.target.value}`);
                }}
              >
                {organizationIds.map((id) => (
                  <option key={id} value={id}>
                    {id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Aparência">
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
          <button type="button" className="user-menu__item user-menu__item--danger" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
