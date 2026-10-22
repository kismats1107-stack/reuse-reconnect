/** Simulated durations: whole ms when large, one decimal when small, seconds past 10 s. */
export function ms(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 10_000) return `${(value / 1000).toFixed(2)} s`;
  if (value >= 100 || Number.isInteger(value)) return `${Math.round(value)} ms`;
  return `${value.toFixed(1)} ms`;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const STRATEGY_LABEL = { close: "New connection", keepalive: "Keep-Alive" } as const;
export const STRATEGY_TAG = { close: "Connection: close", keepalive: "Connection: keep-alive" } as const;
