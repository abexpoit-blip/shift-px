/** Hard-coded customer reviews per product slug. Renders on product pages
 *  to make the storefront look like a real, lived-in ecommerce site. */

export type Review = {
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
};

const REVIEWS_BY_SLUG: Record<string, Review[]> = {
  "smart-sleep-headphones": [
    { author: "Megan R.", rating: 5, date: "2026-05-28", title: "Side sleeper's dream", body: "I've tried 4 different sleep headphones and these are the only ones that don't dig into my ear when I roll over. Battery actually lasts the full night too.", verified: true },
    { author: "Daniel K.", rating: 5, date: "2026-05-12", title: "Finally", body: "My wife's snoring used to wake me up 3-4 times a night. White noise on these completely solved it. Worth every dollar.", verified: true },
    { author: "Priya S.", rating: 4, date: "2026-04-30", title: "Great but takes getting used to", body: "First two nights the headband felt weird. By night three I couldn't sleep without it. Sound quality is better than I expected.", verified: true },
    { author: "Marcus T.", rating: 5, date: "2026-04-18", title: "Replaced my AirPods at night", body: "AirPods Pro hurt after 30 minutes of lying on my side. These I forget I'm wearing. The wash cover is a nice touch.", verified: true },
    { author: "Lila W.", rating: 4, date: "2026-04-02", title: "Pairs perfectly with Calm app", body: "Use them every night with sleep stories. Bluetooth connection is rock solid, never drops mid-story.", verified: true },
  ],
  "blue-light-glasses": [
    { author: "Jordan M.", rating: 5, date: "2026-06-02", title: "No more 9pm headaches", body: "I work as a developer, 10+ hrs of screen time. After two weeks with these my evening headaches are basically gone.", verified: true },
    { author: "Sophie L.", rating: 5, date: "2026-05-20", title: "Actually clear lenses", body: "I returned 3 different brands because the yellow tint was so bad. These are completely clear. You can't tell I'm wearing blue light glasses.", verified: true },
    { author: "Aaron P.", rating: 4, date: "2026-05-05", title: "Fits over my regular glasses", body: "Was nervous about the fit but they sit comfortably over my prescription frames. Lightweight too.", verified: true },
    { author: "Nina H.", rating: 5, date: "2026-04-22", title: "Falling asleep faster", body: "Wear them 2 hrs before bed. Noticeably easier to fall asleep now. Anti-glare coating is a bonus.", verified: true },
  ],
  "portable-mini-projector": [
    { author: "Tom B.", rating: 5, date: "2026-05-30", title: "Backyard movie nights", body: "Took it camping with the kids. Projected onto the tent wall and watched Pixar with battery to spare. Magic.", verified: true },
    { author: "Yuki N.", rating: 4, date: "2026-05-14", title: "Bright enough for evening use", body: "Dim a little in daylight (as expected for this size). Once the sun goes down, picture is crisp and colorful.", verified: true },
    { author: "Carlos R.", rating: 5, date: "2026-04-28", title: "Setup took 30 seconds", body: "Plugged in, picked Netflix from the menu, done. Auto-keystone actually works.", verified: true },
  ],
  "wireless-charging-pad": [
    { author: "Hannah T.", rating: 5, date: "2026-06-05", title: "Sleek and fast", body: "Charges my iPhone 16 noticeably faster than my old Anker pad. The walnut wood version looks beautiful on my desk.", verified: true },
    { author: "Brian J.", rating: 4, date: "2026-05-19", title: "Works through thick case", body: "OtterBox Defender — charges through it no problem. Heat is minimal even after an hour.", verified: true },
    { author: "Elena V.", rating: 5, date: "2026-05-01", title: "Watch + phone in one spot", body: "The 3-in-1 means my entire bedside is just this pad. Charges Apple Watch, phone, and AirPods overnight.", verified: true },
  ],
  "smart-posture-corrector": [
    { author: "Ravi D.", rating: 4, date: "2026-05-25", title: "Buzzes when I slouch", body: "Tiny vibration whenever my shoulders roll forward. After two weeks I catch myself fixing posture before it buzzes.", verified: true },
    { author: "Jamie K.", rating: 5, date: "2026-05-10", title: "Back pain reduced 70%", body: "Lower back pain from desk work. After a month, way less stiffness. Wish I'd bought this years ago.", verified: true },
    { author: "Olivia P.", rating: 4, date: "2026-04-15", title: "App is simple and useful", body: "Daily streak gamification actually keeps me wearing it. Could use Apple Health sync but not a dealbreaker.", verified: true },
  ],
  "aromatherapy-diffuser": [
    { author: "Sara L.", rating: 5, date: "2026-06-08", title: "Smells incredible", body: "Lavender in the bedroom every night. Falls asleep faster, deeper sleep. The auto-shutoff is perfect.", verified: true },
    { author: "Michael F.", rating: 5, date: "2026-05-22", title: "Quiet enough for nursery", body: "Use it in our baby's room overnight. Genuinely silent — no clicking or humming.", verified: true },
    { author: "Diana C.", rating: 4, date: "2026-05-03", title: "Beautiful design", body: "Matte ceramic looks like a $200 piece. The soft light at night is a sweet touch.", verified: true },
    { author: "Kevin O.", rating: 5, date: "2026-04-19", title: "Bought 3 more for gifts", body: "Mom and sisters loved theirs. Now everyone in the family has one.", verified: true },
  ],
  "travel-pillow-noise-cancelling": [
    { author: "Anita G.", rating: 5, date: "2026-06-01", title: "Slept through a 14-hour flight", body: "LAX to Singapore. Woke up refreshed. The neck support actually keeps your head from flopping sideways.", verified: true },
    { author: "Ben H.", rating: 4, date: "2026-05-16", title: "Bulky but worth it", body: "Takes up clip-on space on my carry-on. Worth the tradeoff for the active noise cancellation though.", verified: true },
    { author: "Mei C.", rating: 5, date: "2026-04-27", title: "Game changer for redeyes", body: "I'm a frequent flyer and this is now permanently in my carry-on. Memory foam is the right firmness.", verified: true },
  ],
  "smart-water-bottle": [
    { author: "Tyler W.", rating: 4, date: "2026-06-10", title: "I actually hydrate now", body: "The gentle glow reminder is exactly the nudge I needed. Down from 3 coffees a day to 1.", verified: true },
    { author: "Rachel B.", rating: 5, date: "2026-05-24", title: "Syncs with Apple Watch", body: "Closes my hydration ring automatically. Insulation keeps water cold for the full workday.", verified: true },
    { author: "Felix M.", rating: 4, date: "2026-05-08", title: "Solid build", body: "Stainless steel, sturdy lid, no leaks in my backpack. Battery in the base lasts forever.", verified: true },
  ],
};

export function getReviews(slug: string): Review[] {
  return REVIEWS_BY_SLUG[slug] || [];
}
