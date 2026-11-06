import type { ReactNode } from "react";
import { Card } from "./Card";

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
    </Card>
  );
}
