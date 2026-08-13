/**
 * Demo leaderboard population.
 *
 * The board must never look empty on a fresh install, so we blend in a stable
 * roster of publishers from our main traffic regions (IN / PK / BD / DE).
 * Everything is derived from a 30-minute time slot, so every visitor sees the
 * same board and it re-shuffles (traffic + rank up/down) every 30 minutes.
 */

export type DemoEntry = {
  name: string;
  country: "in" | "pk" | "bd" | "de";
  humanClicks: number;
  earnings: number;
};

export const LEADERBOARD_SLOT_MS = 30 * 60_000;

const ROSTER: Array<{ name: string; country: DemoEntry["country"]; base: number }> = [
  { name: "arjun.k***", country: "in", base: 412_000 },
  { name: "hassan.a***", country: "pk", base: 388_500 },
  { name: "rakib.h***", country: "bd", base: 361_200 },
  { name: "lukas.m***", country: "de", base: 344_800 },
  { name: "priya.s***", country: "in", base: 318_400 },
  { name: "bilal.k***", country: "pk", base: 296_900 },
  { name: "tanvir.i***", country: "bd", base: 271_300 },
  { name: "jonas.w***", country: "de", base: 254_600 },
  { name: "rahul.m***", country: "in", base: 233_100 },
  { name: "ayesha.n***", country: "pk", base: 214_700 },
  { name: "sadia.r***", country: "bd", base: 198_200 },
  { name: "felix.b***", country: "de", base: 176_500 },
  { name: "vikram.p***", country: "in", base: 158_900 },
  { name: "usman.t***", country: "pk", base: 141_400 },
  { name: "nusrat.j***", country: "bd", base: 126_800 },
  { name: "mila.h***", country: "de", base: 109_300 },
];

/** Deterministic 0..1 pseudo-random from two integers. */
function noise(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function currentSlot(now = Date.now()): number {
  return Math.floor(now / LEADERBOARD_SLOT_MS);
}

/** Rate used by the payout engine: $1 per 50,000 verified human visits. */
const RATE_PER_CLICK = 1 / 50_000;

export function demoLeaderboard(now = Date.now()): DemoEntry[] {
  const slot = currentSlot(now);
  return ROSTER.map((p, i) => {
    // Slow upward drift + per-slot jitter → ranks swap around every 30 min.
    const drift = 1 + ((slot % 480) / 480) * 0.35;
    const jitter = 0.86 + noise(slot, i) * 0.34;
    const humanClicks = Math.round(p.base * drift * jitter);
    return {
      name: p.name,
      country: p.country,
      humanClicks,
      earnings: Math.round(humanClicks * RATE_PER_CLICK * 100) / 100,
    };
  }).sort((a, b) => b.earnings - a.earnings);
}
