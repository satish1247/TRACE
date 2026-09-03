/**
 * Runs in the browser only. Turns keystroke timing on the amount field into one number in 0..1.
 * The raw timings stay on the device; only the index is ever sent (see API.md, Signals).
 */
export interface KeyEvent {
  t: number; // ms
  key: string; // "Backspace" or a digit
}

export const LONG_PAUSE_MS = 1200;

export function hesitationIndex(events: KeyEvent[]): number {
  if (events.length < 2) return 0;
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].t - sorted[i - 1].t);
  const pauses = gaps.filter((g) => g >= LONG_PAUSE_MS).length;
  const backspaces = sorted.filter((e) => e.key === "Backspace").length;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const idx = 0.4 * Math.min(pauses / 2, 1) + 0.3 * Math.min(backspaces / 2, 1) + 0.3 * Math.min(cv / 1.2, 1);
  return Math.round(Math.max(0, Math.min(1, idx)) * 100) / 100;
}
