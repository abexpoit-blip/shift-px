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
export const TOTAL_GLOBAL_PUBLISHERS = 128_450;

const ROSTER: Array<{ name: string; country: string; base: number }> = [
  { name: "alexander.v***", country: "us", base: 1_450_000 },
  { name: "kawsar.pro***", country: "bd", base: 1_280_000 },
  { name: "budi.santoso***", country: "id", base: 1_120_500 },
  { name: "juan.reyes***", country: "ph", base: 995_200 },
  { name: "arjun.kapoor***", country: "in", base: 890_000 },
  { name: "hassan.ali***", country: "pk", base: 815_000 },
  { name: "nguyen.van***", country: "vn", base: 740_400 },
  { name: "lukas.meyer***", country: "de", base: 690_800 },
  { name: "carlos.silva***", country: "br", base: 630_000 },
  { name: "priya.sharma***", country: "in", base: 580_300 },
  { name: "ahmed.mansour***", country: "eg", base: 515_900 },
  { name: "tanvir.islam***", country: "bd", base: 460_200 },
  { name: "marcus.v***", country: "de", base: 425_100 },
  { name: "jonas.weber***", country: "de", base: 380_000 },
  { name: "rahul.mehta***", country: "in", base: 345_400 },
  { name: "tariq.zaman***", country: "pk", base: 310_000 },
  { name: "sadia.rahman***", country: "bd", base: 280_500 },
  { name: "felix.braun***", country: "de", base: 250_000 },
  { name: "vikram.patel***", country: "in", base: 215_800 },
  { name: "usman.tariq***", country: "pk", base: 190_400 },
  { name: "elena.rostova***", country: "us", base: 175_000 },
  { name: "shin.takahashi***", country: "jp", base: 160_000 },
  { name: "mateo.gomez***", country: "co", base: 145_000 },
  { name: "gabriel.costa***", country: "br", base: 130_000 },
  { name: "zack.miller***", country: "us", base: 115_000 },
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

/**
 * Calculates realistic global publisher ranking starting from 100,000+ scale.
 */
export function calculateUserGlobalRank(userClicks: number): { rank: number; displayRank: string } {
  if (!userClicks || userClicks <= 0) {
    return { rank: TOTAL_GLOBAL_PUBLISHERS, displayRank: "#100,000+" };
  }
  // Logarithmic rank curve: more clicks climb up the 100k+ global publisher tier
  const progress = Math.min(1, Math.log10(userClicks + 1) / Math.log10(1_500_000));
  const computedRank = Math.max(26, Math.round(TOTAL_GLOBAL_PUBLISHERS - progress * (TOTAL_GLOBAL_PUBLISHERS - 26)));
  return {
    rank: computedRank,
    displayRank: `#${computedRank.toLocaleString()}`,
  };
}
