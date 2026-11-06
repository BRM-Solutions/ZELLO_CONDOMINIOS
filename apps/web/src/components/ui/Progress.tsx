export type ProgressTone = "primary" | "success" | "danger";

interface ProgressProps {
  value: number;
  tone?: ProgressTone;
  label: string;
}

export function Progress({ value, tone = "primary", label }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
      <div className={tone === "primary" ? "progress__bar" : `progress__bar progress__bar--${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
