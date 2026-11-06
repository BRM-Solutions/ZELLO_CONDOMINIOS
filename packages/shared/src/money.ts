export type Cents = number;

export function toCents(reais: number): Cents {
  return Math.round(reais * 100);
}

export function parseBrlToCents(input: string): Cents | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (cleaned === "") return null;
  const negative = cleaned.startsWith("-");
  const normalized = cleaned.replace(/-/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return negative ? -cents : cents;
}

export function formatBrl(cents: Cents): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((sum, value) => sum + value, 0);
}

export function splitCents(total: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError("parts must be a positive integer");
  const base = Math.trunc(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}
