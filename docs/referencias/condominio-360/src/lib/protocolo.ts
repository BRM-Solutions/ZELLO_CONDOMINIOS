/** Protocolo sequencial anual de ocorrências: OC-AAAA-0001. Nunca reutiliza números. */
export const proximoProtocolo = (existentes: (string | undefined)[], ano: number) => {
  const pre = `OC-${ano}-`;
  const max = existentes.reduce((m, p) => (p?.startsWith(pre) ? Math.max(m, Number(p.slice(pre.length)) || 0) : m), 0);
  return `${pre}${String(max + 1).padStart(4, "0")}`;
};

/** Atribui protocolos em ordem cronológica a uma lista sem protocolo. */
export function numerarEmOrdem<T extends { criadaEm: string; protocolo?: string }>(lista: T[]): (T & { protocolo: string })[] {
  const usados: string[] = [];
  const porId = new Map<T, string>();
  [...lista].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm)).forEach((o) => {
    const p = proximoProtocolo(usados, new Date(o.criadaEm).getFullYear());
    usados.push(p); porId.set(o, p);
  });
  return lista.map((o) => ({ ...o, protocolo: porId.get(o)! }));
}

export type ProtocoloPrefs = { portal: boolean; email: boolean; whatsapp: boolean; emailDestino: string; whatsappDestino: string };
