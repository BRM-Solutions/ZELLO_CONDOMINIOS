import { AppShell } from "@/components/vg/AppShell";
import { Badge, Card, PageTitle } from "@/components/vg/ui";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";
export type Row = { title: string; sub: string; badge?: [string, Tone]; right?: string };

export function ListPage({ title, subtitle, rows, stats }: { title: string; subtitle: string; rows: Row[]; stats?: string[][] }) {
  return (
    <AppShell>
      <PageTitle title={title} subtitle={subtitle} />
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map(([l, v]) => <Card key={l}><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p></Card>)}
        </div>
      )}
      <Card>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0"><p className="truncate font-medium">{r.title}</p><p className="truncate text-sm text-muted-foreground">{r.sub}</p></div>
              <div className="flex items-center gap-3">{r.right && <span className="font-semibold">{r.right}</span>}{r.badge && <Badge tone={r.badge[1]}>{r.badge[0]}</Badge>}</div>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
