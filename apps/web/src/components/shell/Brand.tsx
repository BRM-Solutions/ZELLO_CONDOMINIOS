import { useBranding } from "../../contexts/BrandingContext";
import { cx } from "../../lib/cx";

export const PLATFORM_NAME = "ZELLO";

export type LogoSize = "sm" | "md" | "lg" | "xl";

export function TenantLogo({ size }: { size: LogoSize }) {
  const { logoUrl, portalName, legalName } = useBranding();
  if (logoUrl) {
    return <img src={logoUrl} alt={`Logotipo ${legalName || portalName}`} className={cx("tenant-logo", `tenant-logo--${size}`)} />;
  }
  const initial = Array.from(portalName.trim())[0]?.toUpperCase() ?? "";
  return (
    <span className={cx("tenant-logo", "tenant-logo--initial", `tenant-logo--${size}`)} aria-hidden="true">
      {initial}
    </span>
  );
}

export function Brand() {
  const { portalName, legalName } = useBranding();
  return (
    <div className="brand">
      <TenantLogo size="lg" />
      <span className="brand__name">{portalName}</span>
      {legalName && <span className="brand__legal">{legalName}</span>}
    </div>
  );
}

export function BrandInline() {
  const { portalName } = useBranding();
  return (
    <div className="brand-inline">
      <TenantLogo size="sm" />
      <span className="brand-inline__name">{portalName}</span>
    </div>
  );
}
