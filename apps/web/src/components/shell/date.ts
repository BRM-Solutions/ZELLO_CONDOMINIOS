export function formatShellDate(date: Date): { weekday: string; longDate: string } {
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
  const longDate = date
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    .replace(/ de (\p{L})/u, (_, first: string) => ` de ${first.toUpperCase()}`);
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), longDate };
}
