import { useSyncExternalStore } from "react";

/** Estado de demonstração compartilhado entre telas (perde-se ao recarregar). */
export function createMiniStore<T>(initial: T) {
  let state = initial;
  const subs = new Set<() => void>();
  const get = () => state;
  const set = (fn: (s: T) => T) => { state = fn(state); subs.forEach((f) => f()); };
  const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
  const use = () => useSyncExternalStore(subscribe, get, get);
  return { get, set, use };
}
