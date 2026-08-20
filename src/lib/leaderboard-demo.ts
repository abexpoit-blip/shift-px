/**
 * Global Publisher Leaderboard data generator.
 * Realistically maps verified visits to accurate platform earnings ($1 per 50,000 human clicks = $0.02 / 1k).
 */

export type DemoEntry = {
  name: string;
  country: string;
  humanClicks: number;
  earnings: number;
};

export const LEADERBOARD_SLOT_MS = 30 * 60_000;

const ROSTER: Array<{ name: string; country: string; base: number }> = [
  { name: "alexander.v***", country: "us", base: 1_250_000 },
  { name: "kawsar.pro***", country: "bd", base: 1_120_000 },
  { name: "budi.santoso***", country: "id", base: 980_500 },
  { name: "juan.reyes***", country: "ph", base: 895_200 },
  { name: "arjun.kapoor***", country: "in", base: 820_000 },
  { name: "hassan.ali***", country: "pk", base: 745_000 },
  { name: "nguyen.van***", country: "vn", base: 690_400 },
  { name: "lukas.meyer***", country: "de", base: 640_800 },
  { name: "carlos.silva***", country: "br", base: 580_000 },
  { name: "priya.sharma***", country: "in", base: 520_300 },
  { name: "ahmed.mansour***", country: "eg", base: 475_900 },
  { name: "tanvir.islam***", country: "bd", base: 430_200 },
  { name: "marcus.v***", country: "de", base: 395_100 },
  { name: "jonas.weber***", country: "de", base: 360_000 },
  { name: "rahul.mehta***", country: "in", base: 325_400 },
  { name: "tariq.zaman***", country: "pk", base: 290_000 },
  { name: "sadia.rahman***", country: "bd", base: 260_500 },
  { name: "felix.braun***", country: "de", base: 230_000 },
  { name: "vikram.patel***", country: "in", base: 195_800 },
  { name: "usman.tariq***", country: "pk", base: 170_400 },
];

function noise(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function currentSlot(now = Date.now()): number {
  return Math.floor(now / LEADERBOARD_SLOT_MS);
}

// Rate used by AdsPx payout engine: $1.00 per 50,000 verified human visits ($0.02 / 1k)
const RATE_PER_CLICK = 1 / 50_000;

export function demoLeaderboard(now = Date.now()): DemoEntry[] {
  const slot = currentSlot(now);
  return ROSTER.map((p, i) => {
    const drift = 1 + ((slot % 480) / 480) * 0.25;
    const jitter = 0.90 + noise(slot, i) * 0.20;
    const humanClicks = Math.round(p.base * drift * jitter);
    return {
      name: p.name,
      country: p.country,
      humanClicks,
      earnings: Math.round(humanClicks * RATE_PER_CLICK * 100) / 100,
    };
  }).sort((a, b) => b.earnings - a.earnings);
}
