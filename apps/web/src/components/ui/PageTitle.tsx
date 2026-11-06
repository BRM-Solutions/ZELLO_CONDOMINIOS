import type { ReactNode } from "react";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageTitle({ title, subtitle, action }: PageTitleProps) {
  return (
    <div className="page-title">
      <div className="page-title__main">
        <h1>{title}</h1>
        {subtitle && <p className="page-title__subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
