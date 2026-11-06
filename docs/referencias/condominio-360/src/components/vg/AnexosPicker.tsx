import { useState } from "react";
import { toast } from "sonner";
import { Paperclip, Trash2, FileText } from "lucide-react";
import { criarAnexo, EXT_OCORRENCIA, fmtTamanho, validarAnexo, type Anexo } from "@/lib/anexos";
import { fmtDataHora } from "@/lib/ocorrencias";

/** Seleção de vários anexos com prévia, descrição opcional e remoção antes de salvar. */
export function AnexosPicker({ value, onChange, autor, permitidas = EXT_OCORRENCIA, fase }: { value: Anexo[]; onChange: (a: Anexo[]) => void; autor: string; permitidas?: string[]; fase?: string }) {
  const [k, setK] = useState(0);
  const add = (files: FileList | null) => {
    const novos: Anexo[] = [];
    for (const f of Array.from(files ?? [])) { const e = validarAnexo(f.name, f.size, permitidas); if (e) toast.error(e); else novos.push(criarAnexo(f, autor, "", fase)); }
    onChange([...value, ...novos]); setK(k + 1);
  };
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-base font-medium text-primary hover:bg-muted">
        <Paperclip className="h-5 w-5" />Escolher arquivos
        <input key={k} type="file" multiple accept={permitidas.map((e) => `.${e}`).join(",")} className="sr-only" onChange={(e) => add(e.target.files)} />
      </label>
      <p className="text-xs text-muted-foreground">{permitidas.map((e) => e.toUpperCase()).join(", ")} • até 20 MB cada</p>
      {value.map((a) => (
        <div key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border p-2">
          <AnexoThumb a={a} />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-medium">{a.nome}</p>
            <p className="text-xs text-muted-foreground">{a.tipo} • {fmtTamanho(a.tamanho)}</p>
            <input className="h-9 w-full rounded-lg border bg-card px-2 text-sm" placeholder="Descrição (opcional)" value={a.descricao} onChange={(e) => onChange(value.map((x) => (x.id === a.id ? { ...x, descricao: e.target.value } : x)))} />
          </div>
          <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => onChange(value.filter((x) => x.id !== a.id))} className="rounded-lg p-2 text-destructive hover:bg-muted"><Trash2 className="h-5 w-5" /></button>
        </div>
      ))}
    </div>
  );
}

export function AnexoThumb({ a, big }: { a: Anexo; big?: boolean }) {
  const cls = big ? "max-h-72 w-full rounded-xl object-contain bg-muted" : "h-14 w-14 rounded-lg object-cover";
  if (a.tipo === "Imagem") return <img src={a.url} alt={a.descricao || a.nome} className={cls} />;
  if (a.tipo === "Vídeo") return big ? <video src={a.url} controls className={cls} /> : <video src={a.url} muted className={cls} />;
  return <span className={big ? "hidden" : "grid h-14 w-14 place-items-center rounded-lg bg-muted"}><FileText className="h-6 w-6" /></span>;
}

export function AnexosLista({ anexos }: { anexos: Anexo[] }) {
  if (!anexos.length) return <p className="text-sm text-muted-foreground">Nenhum anexo.</p>;
  return (
    <ul className="space-y-3">
      {anexos.map((a) => (
        <li key={a.id} className="space-y-2 rounded-xl border p-3">
          <AnexoThumb a={a} big />
          <p className="font-medium">{a.nome}{a.fase && <span className="ml-2 text-xs text-muted-foreground">({a.fase})</span>}</p>
          {a.descricao && <p className="text-sm">{a.descricao}</p>}
          <p className="text-xs text-muted-foreground">{a.tipo} • {fmtTamanho(a.tamanho)} • {fmtDataHora(a.enviadoEm)} • {a.enviadoPor}</p>
          <a href={a.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary">Abrir arquivo</a>
        </li>
      ))}
    </ul>
  );
}
