import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIAS_SEMANA, toISO, type DiaStatus } from "@/lib/reservas";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const cls: Record<DiaStatus, string> = {
  disponivel: "bg-success-soft text-primary hover:ring-2 hover:ring-primary",
  ocupada: "bg-destructive-soft text-destructive line-through cursor-not-allowed",
  indisponivel: "bg-muted text-muted-foreground cursor-not-allowed",
  passada: "text-muted-foreground/50 cursor-not-allowed",
};

export const LEGENDA: [string, string][] = [
  ["Disponível", "bg-success-soft border border-primary/30"],
  ["Ocupada", "bg-destructive-soft border border-destructive/30"],
  ["Indisponível", "bg-muted border"],
  ["Selecionada", "bg-primary"],
];

export function MonthCalendar({ status, selected, onSelect }: { status: (iso: string) => DiaStatus; selected?: string | undefined; onSelect: (iso: string) => void }) {
  const [ref, setRef] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = ref.getDay();
  const total = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => new Date(ref.getFullYear(), ref.getMonth(), i + 1))];
  const mv = (n: number) => setRef(new Date(ref.getFullYear(), ref.getMonth() + n, 1));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => mv(-1)} className="grid h-11 w-11 place-items-center rounded-xl border hover:bg-muted" aria-label="Mês anterior"><ChevronLeft className="h-5 w-5" /></button>
        <p className="text-lg font-semibold">{MESES[ref.getMonth()]} {ref.getFullYear()}</p>
        <button type="button" onClick={() => mv(1)} className="grid h-11 w-11 place-items-center rounded-xl border hover:bg-muted" aria-label="Próximo mês"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d) => <span key={d} className="py-1 text-sm font-medium uppercase text-muted-foreground">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const iso = toISO(d); const st = status(iso); const sel = iso === selected;
          return (
            <button key={iso} type="button" disabled={st !== "disponivel"} onClick={() => onSelect(iso)}
              aria-label={`${d.getDate()} — ${st === "disponivel" ? "disponível" : st}`}
              className={cn("h-11 rounded-lg text-base font-medium transition", sel ? "bg-primary text-primary-foreground" : cls[st])}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {LEGENDA.map(([l, c]) => <span key={l} className="flex items-center gap-2"><span className={cn("h-4 w-4 rounded", c)} />{l}</span>)}
      </div>
    </div>
  );
}
