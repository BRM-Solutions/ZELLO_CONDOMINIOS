import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card-surface p-5", className)}>{children}</div>;
}

export function CardTitle({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">{icon}</span>}
        <h3 className="truncate text-lg font-semibold">{title}</h3>
      </div>
      {action}
    </div>
  );
}

const badge = cva("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      success: "bg-success-soft text-primary",
      warning: "bg-warning-soft text-accent",
      danger: "bg-destructive-soft text-destructive",
      info: "bg-info-soft text-info",
      neutral: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export function Badge({ tone, children }: VariantProps<typeof badge> & { children: ReactNode }) {
  return <span className={badge({ tone })}>{children}</span>;
}

const btn = cva("inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50", {
  variants: {
    variant: {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      accent: "bg-accent text-accent-foreground hover:bg-accent/90",
      outline: "border border-input bg-card hover:bg-muted",
      ghost: "hover:bg-muted",
      danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    },
    size: { sm: "h-8 px-3", md: "h-10 px-4", lg: "h-12 px-6 text-base" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});
export function Button({ variant, size, className, ...p }: VariantProps<typeof btn> & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(btn({ variant, size }), className)} {...p} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "danger" }) {
  const c = tone === "success" ? "bg-success" : tone === "danger" ? "bg-destructive" : "bg-primary";
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div className={cn("h-2 rounded-full", c)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function DateChip({ d, m }: { d: string; m: string }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted leading-none">
      <span className="text-lg font-semibold">{d}</span>
      <span className="text-[10px] uppercase text-muted-foreground">{m}</span>
    </div>
  );
}
