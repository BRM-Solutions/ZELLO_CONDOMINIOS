import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBranding } from "../../contexts/BrandingContext";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { cx } from "../../lib/cx";
import { IconButton } from "../ui/Button";
import { Brand, BrandInline, PLATFORM_NAME } from "./Brand";
import { formatShellDate } from "./date";
import { navPath, visibleBottomNavItems, visibleNavItems, type NavItem } from "./nav";
import { UserMenu } from "./UserMenu";

const DRAWER_ID = "app-drawer";

function NavList({ items, organizationId, onNavigate }: { items: NavItem[]; organizationId: string | undefined; onNavigate?: () => void }) {
  return (
    <div className="nav-list">
      {items.map((item) => (
        <NavLink key={item.key} to={navPath(organizationId, item)} end={item.segment === ""} className="nav-item" onClick={onNavigate}>
          <item.icon size={20} className="nav-item__icon" aria-hidden="true" />
          <span className="nav-item__label">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export function AppShell() {
  const { organizationId, role } = useAuth();
  const { legalName, address, portalPhotoUrl } = useBranding();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const items = visibleNavItems(role);
  const bottomItems = visibleBottomNavItems(role);
  const { weekday, longDate } = formatShellDate(new Date());
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useDialogFocus(panelRef, drawerOpen, closeDrawer);

  useEffect(() => {
    if (!drawerOpen || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) setDrawerOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [drawerOpen]);

  return (
    <div className={cx("app-shell", bottomItems.length > 0 && "app-shell--bottom-nav")}>
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Principal">
          <NavList items={items} organizationId={organizationId} />
        </nav>
        <div className="sidebar__footer">
          {portalPhotoUrl && <img src={portalPhotoUrl} alt="" loading="lazy" className="sidebar__photo" />}
          <div className="sidebar__about">
            {legalName && <p className="sidebar__legal">{legalName}</p>}
            {address && <p>{address}</p>}
            <p className="sidebar__platform">uma plataforma {PLATFORM_NAME}</p>
          </div>
        </div>
      </aside>

      <div id={DRAWER_ID} className="drawer" hidden={!drawerOpen}>
        <div className="drawer__overlay" onClick={closeDrawer} />
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} className="drawer__panel">
          <button type="button" className="drawer__close" aria-label="Fechar menu" onClick={closeDrawer}>
            <X size={24} aria-hidden="true" />
          </button>
          <Brand />
          <nav aria-label="Menu principal">
            <NavList items={items} organizationId={organizationId} onNavigate={closeDrawer} />
          </nav>
        </div>
      </div>

      <header className="topbar">
        {items.length > 0 && (
          <IconButton
            className="topbar__menu"
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            aria-controls={DRAWER_ID}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={24} aria-hidden="true" />
          </IconButton>
        )}
        <BrandInline />
        <div className="topbar__date">
          <p className="topbar__weekday">{weekday}</p>
          <p className="topbar__long-date">{longDate}</p>
        </div>
        <UserMenu />
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      {bottomItems.length > 0 && (
        <nav className="bottom-nav" aria-label="Navegação rápida">
          {bottomItems.map((item) => (
            <NavLink key={item.key} to={navPath(organizationId, item)} end={item.segment === ""} className="bottom-nav__item">
              <item.icon size={20} aria-hidden="true" />
              <span className="bottom-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
