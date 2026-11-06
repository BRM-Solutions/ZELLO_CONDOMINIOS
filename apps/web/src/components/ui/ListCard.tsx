import { Badge, type BadgeTone } from "./Badge";
import { Card } from "./Card";

export interface ListCardRow {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: { label: string; tone: BadgeTone };
}

export function ListCard({ rows }: { rows: ListCardRow[] }) {
  return (
    <Card>
      <ul className="list-card">
        {rows.map((row) => (
          <li key={row.id} className="list-card__row">
            <div className="list-card__main">
              <p className="list-card__title">{row.title}</p>
              {row.subtitle && <p className="list-card__sub">{row.subtitle}</p>}
            </div>
            {(row.value || row.badge) && (
              <div className="list-card__side">
                {row.value && <span className="list-card__value">{row.value}</span>}
                {row.badge && <Badge tone={row.badge.tone}>{row.badge.label}</Badge>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
