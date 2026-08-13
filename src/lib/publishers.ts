/**
 * Shared publishers dataset.
 * Used by both the public Leaderboard and the Recent withdrawals widget
 * so the demo numbers stay consistent across the site.
 *
 * Male names only. Country codes are ISO-3166 alpha-2 lowercase and rendered
 * with real SVG flags from flagcdn.com (see `flagUrl`).
 */

export type CountryCode =
  | "us" | "in" | "bd" | "pk" | "id" | "ng" | "br" | "mx" | "eg" | "tr"
  | "ph" | "vn" | "th" | "ma" | "dz" | "ke" | "za" | "gb" | "de" | "fr"
  | "it" | "es" | "ca" | "au" | "sa" | "ae" | "ir" | "iq" | "ru" | "ua"
  | "pl" | "ar" | "co" | "pe" | "cl" | "my" | "sg" | "lk" | "np" | "pt";

export type Publisher = {
  id: string;
  user: string;
  country: CountryCode;
  /** Daily visits sent today. */
  traffic: number;
  /** Lifetime $ earned. */
  earnings: number;
  /** Lifetime $ withdrawn so far. */
  withdrawn: number;
};

export const flagUrl = (code: string) => `https://flagcdn.com/${code.toLowerCase()}.svg`;

/** Top publishers shown on /leaderboard. Ranked by daily traffic. */
export const TOP_PUBLISHERS: Publisher[] = [
  { id: "p01", user: "arjun.k***",   country: "in", traffic: 184320, earnings: 1842.10, withdrawn: 1750.00 },
  { id: "p02", user: "michael.b***", country: "us", traffic: 162540, earnings: 1604.55, withdrawn: 1525.00 },
  { id: "p03", user: "rakib.h***",   country: "bd", traffic: 148720, earnings: 1487.20, withdrawn: 1400.00 },
  { id: "p04", user: "kevin.r***",   country: "us", traffic: 138210, earnings: 1382.05, withdrawn: 1300.00 },
  { id: "p05", user: "ahmed.s***",   country: "eg", traffic: 121870, earnings: 1218.05, withdrawn: 1175.00 },
  { id: "p06", user: "rahul.m***",   country: "in", traffic: 109450, earnings:  982.65, withdrawn:  900.00 },
  { id: "p07", user: "joao.p***",    country: "br", traffic:  98740, earnings:  874.20, withdrawn:  825.00 },
  { id: "p08", user: "daniel.w***",  country: "us", traffic:  94780, earnings:  847.95, withdrawn:  800.00 },
  { id: "p09", user: "mehmet.y***",  country: "tr", traffic:  86120, earnings:  761.10, withdrawn:  700.00 },
  { id: "p10", user: "vikram.l***",  country: "in", traffic:  82140, earnings:  741.10, withdrawn:  690.00 },
  { id: "p11", user: "imran.a***",   country: "pk", traffic:  76860, earnings:  689.95, withdrawn:  640.00 },
  { id: "p12", user: "carlos.g***",  country: "mx", traffic:  71320, earnings:  628.95, withdrawn:  575.00 },
  { id: "p13", user: "andre.s***",   country: "br", traffic:  64480, earnings:  574.40, withdrawn:  525.00 },
  { id: "p14", user: "budi.h***",    country: "id", traffic:  58210, earnings:  521.85, withdrawn:  475.00 },
];

/** Smaller publishers — used to vary the recent withdrawals feed. */
export const OTHER_PUBLISHERS: Publisher[] = [
  { id: "o01", user: "shakib.r***",   country: "bd", traffic: 41200, earnings: 342.40, withdrawn: 300.00 },
  { id: "o02", user: "ethan.s***",    country: "us", traffic: 38110, earnings: 318.10, withdrawn: 275.00 },
  { id: "o03", user: "tarek.b***",    country: "ma", traffic: 34840, earnings: 286.65, withdrawn: 250.00 },
  { id: "o04", user: "sandeep.a***",  country: "in", traffic: 31620, earnings: 261.30, withdrawn: 230.00 },
  { id: "o05", user: "ali.k***",      country: "pk", traffic: 28410, earnings: 234.75, withdrawn: 200.00 },
  { id: "o06", user: "noah.z***",     country: "us", traffic: 26840, earnings: 218.20, withdrawn: 190.00 },
  { id: "o07", user: "kwame.o***",    country: "ng", traffic: 24080, earnings: 198.10, withdrawn: 170.00 },
  { id: "o08", user: "yash.h***",     country: "in", traffic: 22410, earnings: 184.20, withdrawn: 160.00 },
  { id: "o09", user: "diego.f***",    country: "ar", traffic: 20540, earnings: 168.55, withdrawn: 145.00 },
  { id: "o10", user: "tyler.k***",    country: "us", traffic: 18840, earnings: 152.10, withdrawn: 130.00 },
  { id: "o11", user: "javier.m***",   country: "es", traffic: 17320, earnings: 142.40, withdrawn: 120.00 },
  { id: "o12", user: "samir.l***",    country: "dz", traffic: 16080, earnings: 132.95, withdrawn: 110.00 },
  { id: "o13", user: "agus.p***",     country: "id", traffic: 14620, earnings: 119.30, withdrawn: 100.00 },
  { id: "o14", user: "ryan.p***",     country: "ca", traffic: 13580, earnings: 110.40, withdrawn:  92.00 },
  { id: "o15", user: "deepak.f***",   country: "in", traffic: 12240, earnings:  98.55, withdrawn:  80.00 },
  { id: "o16", user: "hassan.j***",   country: "ae", traffic: 11470, earnings:  92.10, withdrawn:  75.00 },
  { id: "o17", user: "viktor.s***",   country: "ua", traffic: 10840, earnings:  86.65, withdrawn:  70.00 },
  { id: "o18", user: "kofi.a***",     country: "ke", traffic:  9920, earnings:  78.20, withdrawn:  64.00 },
  { id: "o19", user: "tomasz.w***",   country: "pl", traffic:  9210, earnings:  72.55, withdrawn:  60.00 },
  { id: "o20", user: "lucas.r***",    country: "br", traffic:  8540, earnings:  66.40, withdrawn:  54.00 },
  { id: "o21", user: "raj.t***",      country: "np", traffic:  7910, earnings:  61.05, withdrawn:  50.00 },
  { id: "o22", user: "iqbal.m***",    country: "my", traffic:  7320, earnings:  56.20, withdrawn:  46.00 },
  { id: "o23", user: "dmitry.k***",   country: "ru", traffic:  6740, earnings:  51.55, withdrawn:  42.00 },
  { id: "o24", user: "minh.n***",     country: "vn", traffic:  6210, earnings:  47.10, withdrawn:  38.00 },
  { id: "o25", user: "nathan.b***",   country: "gb", traffic:  5780, earnings:  43.65, withdrawn:  35.00 },
  { id: "o26", user: "felix.h***",    country: "de", traffic:  5310, earnings:  39.85, withdrawn:  32.00 },
  { id: "o27", user: "matteo.v***",   country: "it", traffic:  4920, earnings:  36.20, withdrawn:  28.00 },
  { id: "o28", user: "kabir.s***",    country: "lk", traffic:  4560, earnings:  33.10, withdrawn:  26.00 },
  { id: "o29", user: "omar.f***",     country: "sa", traffic:  4220, earnings:  30.40, withdrawn:  23.00 },
  { id: "o30", user: "harith.z***",   country: "sg", traffic:  3910, earnings:  27.85, withdrawn:  21.00 },
  // Extended pool — unique male names, no duplicates with above.
  { id: "o31", user: "tanvir.c***",   country: "bd", traffic: 39840, earnings: 331.20, withdrawn: 285.00 },
  { id: "o32", user: "jonas.e***",    country: "de", traffic: 37210, earnings: 308.50, withdrawn: 260.00 },
  { id: "o33", user: "youssef.n***",  country: "eg", traffic: 35670, earnings: 296.40, withdrawn: 245.00 },
  { id: "o34", user: "rico.d***",     country: "ph", traffic: 33420, earnings: 275.80, withdrawn: 225.00 },
  { id: "o35", user: "adnan.i***",    country: "pk", traffic: 32180, earnings: 267.10, withdrawn: 218.00 },
  { id: "o36", user: "bilal.q***",    country: "tr", traffic: 30240, earnings: 250.75, withdrawn: 205.00 },
  { id: "o37", user: "hiro.t***",     country: "th", traffic: 29350, earnings: 242.60, withdrawn: 198.00 },
  { id: "o38", user: "chetan.v***",   country: "in", traffic: 27810, earnings: 229.80, withdrawn: 188.00 },
  { id: "o39", user: "gabriel.c***",  country: "br", traffic: 26520, earnings: 218.90, withdrawn: 176.00 },
  { id: "o40", user: "mateo.a***",    country: "co", traffic: 25190, earnings: 208.40, withdrawn: 168.00 },
  { id: "o41", user: "logan.t***",    country: "us", traffic: 24380, earnings: 200.75, withdrawn: 162.00 },
  { id: "o42", user: "jacob.o***",    country: "us", traffic: 23610, earnings: 194.20, withdrawn: 156.00 },
  { id: "o43", user: "farhan.d***",   country: "bd", traffic: 22740, earnings: 187.30, withdrawn: 150.00 },
  { id: "o44", user: "sameer.b***",   country: "in", traffic: 21870, earnings: 179.60, withdrawn: 145.00 },
  { id: "o45", user: "kaan.o***",     country: "tr", traffic: 20960, earnings: 172.40, withdrawn: 138.00 },
  { id: "o46", user: "rafael.q***",   country: "mx", traffic: 20120, earnings: 165.20, withdrawn: 132.00 },
  { id: "o47", user: "leo.n***",      country: "au", traffic: 19340, earnings: 158.85, withdrawn: 126.00 },
  { id: "o48", user: "mustafa.g***",  country: "iq", traffic: 18620, earnings: 153.10, withdrawn: 122.00 },
  { id: "o49", user: "dariush.h***",  country: "ir", traffic: 17920, earnings: 147.20, withdrawn: 117.00 },
  { id: "o50", user: "isaac.p***",    country: "gb", traffic: 17240, earnings: 141.65, withdrawn: 112.00 },
  { id: "o51", user: "aleksandr.v***",country: "ru", traffic: 16580, earnings: 136.10, withdrawn: 108.00 },
  { id: "o52", user: "santiago.l***", country: "cl", traffic: 15940, earnings: 130.80, withdrawn: 103.00 },
  { id: "o53", user: "bruno.k***",    country: "pt", traffic: 15320, earnings: 125.55, withdrawn:  99.00 },
  { id: "o54", user: "khaled.r***",   country: "sa", traffic: 14780, earnings: 121.10, withdrawn:  95.00 },
  { id: "o55", user: "asad.n***",     country: "pk", traffic: 14210, earnings: 116.40, withdrawn:  91.00 },
  { id: "o56", user: "krishna.b***",  country: "in", traffic: 13680, earnings: 112.05, withdrawn:  87.00 },
  { id: "o57", user: "mahmoud.g***",  country: "eg", traffic: 13120, earnings: 107.40, withdrawn:  84.00 },
  { id: "o58", user: "oliver.m***",   country: "gb", traffic: 12610, earnings: 103.20, withdrawn:  80.00 },
  { id: "o59", user: "hunter.c***",   country: "us", traffic: 12140, earnings:  99.30, withdrawn:  77.00 },
  { id: "o60", user: "wahyu.s***",    country: "id", traffic: 11680, earnings:  95.55, withdrawn:  74.00 },
  { id: "o61", user: "arif.h***",     country: "my", traffic: 11250, earnings:  92.05, withdrawn:  71.00 },
  { id: "o62", user: "kenji.o***",    country: "th", traffic: 10820, earnings:  88.55, withdrawn:  68.00 },
  { id: "o63", user: "victor.e***",   country: "ng", traffic: 10420, earnings:  85.20, withdrawn:  66.00 },
  { id: "o64", user: "elias.t***",    country: "ke", traffic: 10050, earnings:  82.15, withdrawn:  63.00 },
  { id: "o65", user: "sipho.z***",    country: "za", traffic:  9680, earnings:  79.10, withdrawn:  61.00 },
  { id: "o66", user: "andres.q***",   country: "pe", traffic:  9340, earnings:  76.30, withdrawn:  58.00 },
  { id: "o67", user: "pablo.d***",    country: "es", traffic:  9010, earnings:  73.55, withdrawn:  56.00 },
  { id: "o68", user: "giovanni.r***", country: "it", traffic:  8720, earnings:  71.10, withdrawn:  54.00 },
  { id: "o69", user: "erik.b***",     country: "de", traffic:  8420, earnings:  68.60, withdrawn:  52.00 },
  { id: "o70", user: "yuriy.p***",    country: "ua", traffic:  8140, earnings:  66.20, withdrawn:  50.00 },
  { id: "o71", user: "kacper.t***",   country: "pl", traffic:  7880, earnings:  64.05, withdrawn:  48.00 },
  { id: "o72", user: "nikolai.c***",  country: "ru", traffic:  7620, earnings:  61.90, withdrawn:  46.00 },
  { id: "o73", user: "aarav.g***",    country: "in", traffic:  7380, earnings:  59.85, withdrawn:  44.00 },
  { id: "o74", user: "rohan.d***",    country: "in", traffic:  7150, earnings:  57.90, withdrawn:  43.00 },
  { id: "o75", user: "juwel.h***",    country: "bd", traffic:  6920, earnings:  56.05, withdrawn:  41.00 },
  { id: "o76", user: "sohel.t***",    country: "bd", traffic:  6710, earnings:  54.25, withdrawn:  40.00 },
  { id: "o77", user: "aiden.w***",    country: "ca", traffic:  6500, earnings:  52.50, withdrawn:  38.00 },
  { id: "o78", user: "mason.h***",    country: "au", traffic:  6300, earnings:  50.80, withdrawn:  37.00 },
  { id: "o79", user: "caleb.r***",    country: "us", traffic:  6110, earnings:  49.15, withdrawn:  35.00 },
  { id: "o80", user: "owen.f***",     country: "gb", traffic:  5930, earnings:  47.55, withdrawn:  34.00 },
  { id: "o81", user: "chinedu.i***",  country: "ng", traffic:  5760, earnings:  46.05, withdrawn:  33.00 },
  { id: "o82", user: "tunde.a***",    country: "ng", traffic:  5590, earnings:  44.55, withdrawn:  32.00 },
  { id: "o83", user: "reza.k***",     country: "ir", traffic:  5430, earnings:  43.10, withdrawn:  31.00 },
  { id: "o84", user: "amir.v***",     country: "ir", traffic:  5280, earnings:  41.75, withdrawn:  30.00 },
  { id: "o85", user: "kiran.p***",    country: "np", traffic:  5130, earnings:  40.40, withdrawn:  29.00 },
  { id: "o86", user: "suresh.k***",   country: "lk", traffic:  4990, earnings:  39.10, withdrawn:  28.00 },
  { id: "o87", user: "hakim.b***",    country: "ma", traffic:  4850, earnings:  37.85, withdrawn:  27.00 },
  { id: "o88", user: "yassine.o***",  country: "dz", traffic:  4720, earnings:  36.65, withdrawn:  26.00 },
  { id: "o89", user: "faisal.a***",   country: "sa", traffic:  4600, earnings:  35.50, withdrawn:  25.00 },
  { id: "o90", user: "salem.r***",    country: "ae", traffic:  4480, earnings:  34.40, withdrawn:  24.00 },
];

/** Combined pool used by the recent-withdrawals feed. */
export const ALL_PUBLISHERS: Publisher[] = [...TOP_PUBLISHERS, ...OTHER_PUBLISHERS];

export type PayoutMethod = "USDT TRC20" | "USDT BEP20";

export type RecentPayout = {
  user: string;
  country: CountryCode;
  amount: number;
  method: PayoutMethod;
  minutesAgo: number;
};

const METHODS: PayoutMethod[] = ["USDT TRC20", "USDT BEP20"];

function pickRand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Recently used names — avoids showing the same publisher back-to-back in the
 * live withdrawals feed. Sized so ~30% of the pool must rotate through before
 * a name can repeat.
 */
const RECENT_WINDOW = 30;
const _recentUsers: string[] = [];

function rememberUser(name: string) {
  _recentUsers.push(name);
  if (_recentUsers.length > RECENT_WINDOW) _recentUsers.shift();
}

/** Build a recent withdrawal entry that is consistent with the publisher pool. */
export function makeRecentPayout(minutesAgo: number, filterCountry?: CountryCode): RecentPayout {
  const basePool = filterCountry
    ? ALL_PUBLISHERS.filter((p) => p.country === filterCountry)
    : ALL_PUBLISHERS;
  const source = basePool.length ? basePool : ALL_PUBLISHERS;
  // Filter out recently-used names when possible, otherwise fall back to full pool.
  const fresh = source.filter((p) => !_recentUsers.includes(p.user));
  const pool = fresh.length ? fresh : source;
  const p = pickRand(pool);
  rememberUser(p.user);
  const cap = Math.max(10, Math.min(57, p.withdrawn));
  const amount = Math.round((10 + Math.random() * (cap - 10)) * 100) / 100;
  return {
    user: p.user,
    country: p.country,
    amount,
    method: pickRand(METHODS),
    minutesAgo,
  };
}

