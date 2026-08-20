"use client";

import * as React from "react";

export const CONVERT_RATE = 5;

type Limit = { limit: number; rate: number } | null;

/**
 * How much gold this player may still exchange, fetched once per page.
 *
 * Every open bet slip would otherwise ask the same question separately — a
 * match page carries several — so the request is shared through a module-level
 * promise and re-armed whenever an exchange actually happens.
 */
let pending: Promise<Limit> | null = null;
let listeners: Array<() => void> = [];

function read(): Promise<Limit> {
  pending ??= fetch("/api/convert", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => (d.ok && d.ready !== false ? { limit: d.limit ?? 0, rate: d.rate ?? CONVERT_RATE } : null))
    .catch(() => null);
  return pending;
}

/** Call after a successful exchange so every slip re-reads the allowance. */
export function invalidateConvertLimit() {
  pending = null;
  for (const fn of listeners) fn();
}

export function useConvertLimit(enabled: boolean): Limit {
  const [state, setState] = React.useState<Limit>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      read().then((v) => {
        if (!cancelled) setState(v);
      });
    };
    load();
    listeners.push(load);
    return () => {
      cancelled = true;
      listeners = listeners.filter((fn) => fn !== load);
    };
  }, [enabled]);

  return state;
}
