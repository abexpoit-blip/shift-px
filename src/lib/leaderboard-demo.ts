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
  { name: "alexander.v***", country: "us", base: 3_850_000 },
  { name: "kawsar.pro***", country: "bd", base: 3_420_000 },
  { name: "budi.santoso***", country: "id", base: 2_980_500 },
  { name: "juan.reyes***", country: "ph", base: 2_650_200 },
  { name: "arjun.kapoor***", country: "in", base: 2_340_000 },
  { name: "hassan.ali***", country: "pk", base: 2_110_000 },
  { name: "nguyen.van***", country: "vn", base: 1_890_400 },
  { name: "lukas.meyer***", country: "de", base: 1_720_800 },
  { name: "carlos.silva***", country: "br", base: 1_540_000 },
  { name: "priya.sharma***", country: "in", base: 1_380_300 },
  { name: "ahmed.mansour***", country: "eg", base: 1_220_900 },
  { name: "tanvir.islam***", country: "bd", base: 1_090_200 },
  { name: "marcus.v***", country: "de", base: 980_100 },
  { name: "jonas.weber***", country: "de", base: 870_000 },
  { name: "rahul.mehta***", country: "in", base: 760_400 },
  { name: "tariq.zaman***", country: "pk", base: 680_000 },
  { name: "sadia.rahman***", country: "bd", base: 590_500 },
  { name: "felix.braun***", country: "de", base: 510_000 },
  { name: "vikram.patel***", country: "in", base: 440_800 },
  { name: "usman.tariq***", country: "pk", base: 380_400 },
  { name: "elena.rostova***", country: "us", base: 320_000 },
  { name: "shin.takahashi***", country: "jp", base: 280_000 },
  { name: "mateo.gomez***", country: "co", base: 240_000 },
  { name: "gabriel.costa***", country: "br", base: 195_000 },
  { name: "zack.miller***", country: "us", base: 160_000 },
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
 * Users with < 100k clicks are unranked (#100,000+).
 * Users with >= 100k clicks rank among the top global publishers based on their traffic.
 */
export function calculateUserGlobalRank(userClicks: number): {
  rank: number;
  displayRank: string;
  isQualified: boolean;
} {
  const clicks = Number(userClicks ?? 0);

  if (clicks < 100_000) {
    return {
      rank: TOTAL_GLOBAL_PUBLISHERS,
      displayRank: "#100,000+",
      isQualified: false,
    };
  }

  if (clicks >= 3_500_000) return { rank: 1, displayRank: "#1", isQualified: true };
  if (clicks >= 3_200_000) return { rank: 3, displayRank: "#3", isQualified: true };
  if (clicks >= 2_500_000) return { rank: 5, displayRank: "#5", isQualified: true };
  if (clicks >= 2_000_000) return { rank: 7, displayRank: "#7", isQualified: true };
  if (clicks >= 1_500_000) return { rank: 10, displayRank: "#10", isQualified: true };
  if (clicks >= 1_000_000) return { rank: 14, displayRank: "#14", isQualified: true };
  if (clicks >= 500_000) return { rank: 19, displayRank: "#19", isQualified: true };

  const scaled = Math.max(21, Math.round(100 - ((clicks - 100_000) / 400_000) * 79));
  return {
    rank: scaled,
    displayRank: `#${scaled}`,
    isQualified: true,
  };
}
