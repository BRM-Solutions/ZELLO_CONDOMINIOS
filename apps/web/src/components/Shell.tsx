import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCan } from "../hooks/useCan";
import { useTheme } from "../hooks/useTheme";

export function Shell() {
  const { email, memberships, organizationId, signOut } = useAuth();
  const canManage = useCan("organization:manage");
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const organizationIds = [...new Set(memberships.map((m) => m.organizationId))];
  const base = organizationId ? `/o/${organizationId}` : "/";
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "nav-link active" : "nav-link");

  return (
    <div className="shell">
      <header className="header">
        <span className="brand">{"{{PROJETO}}"}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          onClick={toggle}
        >
          {theme === "dark" ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
        </button>
        <button
          type="button"
          className="icon-button menu-toggle"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
        <nav id="main-nav" className={open ? "nav open" : "nav"} aria-label="Principal">
          <NavLink to={base} end className={linkClass} onClick={() => setOpen(false)}>
            Workspaces
          </NavLink>
          {canManage && (
            <NavLink to={`${base}/organizacao`} className={linkClass} onClick={() => setOpen(false)}>
              Organização
            </NavLink>
          )}
          {organizationIds.length > 1 && organizationId && (
            <select
              className="nav-select"
              aria-label="Organização ativa"
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
            </select>
          )}
          <span className="nav-user" title={email ?? undefined}>
            {email}
          </span>
          <button type="button" className="button button-ghost" onClick={() => void signOut()}>
            <LogOut size={18} aria-hidden /> Sair
          </button>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
