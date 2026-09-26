// Presentational helpers shared by the provider and pages. Keep this file free of
// provider imports so market-provider can use it without a cycle.

export function shortAddress(value?: string) {
  if (!value) return '';
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Avatar({ seed, size = 32 }: { seed: string; size?: number }) {
  const h = hash(seed.toLowerCase()),
    a = h % 360,
    b = (a + 40 + ((h >> 9) % 80)) % 360;
  return (
    <span
      className="mp-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at ${20 + (h % 50)}% ${25 + ((h >> 5) % 40)}%, hsl(${b} 80% 78%), transparent 60%), linear-gradient(135deg, hsl(${a} 55% 42%), hsl(${b} 60% 28%))`,
      }}
    />
  );
}

/** Compact remaining time, e.g. "2d 4h", "3h 12m", "4m 09s". */
export function timeLeft(ms: number) {
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000),
    d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export function relativeTime(at: number, now: number) {
  const diff = Math.round((now - at) / 1000);
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
