// FB-safe prelanding article templates.
// - 28 article templates (all FB ad-policy friendly topics)
// - 5 OG variants per template = 100 unique FB previews
// - Deterministic per short_code (same link = same article = FB-cache safe)
// - JSON-LD Article schema for richer crawler signals

import { applySkin } from "@/lib/page-skin";

export type PrelandingTemplate =
  | "verify"
  | "reward"
  | "countdown"
  | "article"
  | "article_health"
  | "article_news"
  | "article_finance"
  | "article_lifestyle"
  | "article_tech"
  | "article_celebrity"
  | "article_business"
  | "article_travel"
  | "article_cooking"
  | "article_gardening"
  | "article_pets"
  | "article_sports"
  | "article_education"
  | "article_parenting"
  | "article_music"
  | "article_movies"
  | "article_diy"
  | "article_photography"
  | "article_fitness"
  | "article_crafts"
  | "article_coffee"
  | "article_books"
  | "article_science"
  | "article_history"
  | "article_language"
  | "article_organizing"
  | "article_cycling"
  | "article_weather"
  | "article_dovtv_pulse"
  | "article_dovtv_culture";

export type RenderMode = "human" | "fbbot";

export const ARTICLE_TEMPLATES: PrelandingTemplate[] = [
  "article_health",
  "article_news",
  "article_finance",
  "article_lifestyle",
  "article_tech",
  "article_celebrity",
  "article_business",
  "article_travel",
  "article_cooking",
  "article_gardening",
  "article_pets",
  "article_sports",
  "article_education",
  "article_parenting",
  "article_music",
  "article_movies",
  "article_diy",
  "article_photography",
  "article_fitness",
  "article_crafts",
  "article_coffee",
  "article_books",
  "article_science",
  "article_history",
  "article_language",
  "article_organizing",
  "article_cycling",
  "article_weather",
  "article_dovtv_pulse",
  "article_dovtv_culture",
];

export const TEMPLATE_OPTIONS: { value: PrelandingTemplate; label: string; group: string }[] = [
  { value: "article_health", label: "Health & Wellness", group: "Article (FB-safe)" },
  { value: "article_news", label: "Breaking News", group: "Article (FB-safe)" },
  { value: "article_finance", label: "Finance & Money", group: "Article (FB-safe)" },
  { value: "article_lifestyle", label: "Lifestyle", group: "Article (FB-safe)" },
  { value: "article_tech", label: "Technology", group: "Article (FB-safe)" },
  { value: "article_celebrity", label: "Books & Entertainment", group: "Article (FB-safe)" },
  { value: "article_business", label: "Business & Career", group: "Article (FB-safe)" },
  { value: "article_travel", label: "Travel", group: "Article (FB-safe)" },
  { value: "article_cooking", label: "Cooking & Recipes", group: "Article (FB-safe)" },
  { value: "article_gardening", label: "Gardening", group: "Article (FB-safe)" },
  { value: "article_pets", label: "Pets", group: "Article (FB-safe)" },
  { value: "article_sports", label: "Sports", group: "Article (FB-safe)" },
  { value: "article_education", label: "Education", group: "Article (FB-safe)" },
  { value: "article_parenting", label: "Parenting", group: "Article (FB-safe)" },
  { value: "article_music", label: "Music", group: "Article (FB-safe)" },
  { value: "article_movies", label: "Movies & TV", group: "Article (FB-safe)" },
  { value: "article_diy", label: "DIY & Home", group: "Article (FB-safe)" },
  { value: "article_photography", label: "Photography", group: "Article (FB-safe)" },
  { value: "article_fitness", label: "Fitness", group: "Article (FB-safe)" },
  { value: "article_crafts", label: "Crafts & Hobbies", group: "Article (FB-safe)" },
  { value: "article_coffee", label: "Coffee & Tea", group: "Article (FB-safe)" },
  { value: "article_books", label: "Books & Reading", group: "Article (FB-safe)" },
  { value: "article_science", label: "Science & Nature", group: "Article (FB-safe)" },
  { value: "article_history", label: "History", group: "Article (FB-safe)" },
  { value: "article_language", label: "Language Learning", group: "Article (FB-safe)" },
  { value: "article_organizing", label: "Home Organizing", group: "Article (FB-safe)" },
  { value: "article_cycling", label: "Cycling & Outdoors", group: "Article (FB-safe)" },
  { value: "article_weather", label: "Weather & Seasons", group: "Article (FB-safe)" },
  { value: "article_dovtv_pulse", label: "DovTV Digital Trends", group: "Article (FB-safe)" },
  { value: "article_dovtv_culture", label: "DovTV Modern Culture", group: "Article (FB-safe)" },
  { value: "verify", label: "Verify (challenge)", group: "Legacy" },
  { value: "reward", label: "Reward (challenge)", group: "Legacy" },
  { value: "countdown", label: "Countdown (challenge)", group: "Legacy" },
  { value: "article", label: "Generic Article", group: "Legacy" },
];

// ---------- Article content ----------
type ArticleContent = {
  title: string;
  description: string;
  category: string;
  author: string;
  heroImage: string;
  intro: string;
  paragraphs: string[];
  highlights: string[];
  related: { title: string; img: string }[];
};

const RELATED_POOL = [
  { title: "Why Experts Are Rethinking Everything About Morning Routines", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=70" },
  { title: "The Weekend Reset Habit That's Quietly Spreading in 2025", img: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=400&q=70" },
  { title: "Simple Changes That Make a Real Difference, According to Research", img: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=400&q=70" },
  { title: "What People Who Quit Social Media for 30 Days Actually Found", img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=70" },
  { title: "The Beginner's Guide That Actually Works for Busy Schedules", img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=70" },
  { title: "Quiet Patterns That Make Each Year Noticeably Better", img: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=400&q=70" },
];

const ARTICLES: Record<string, ArticleContent> = {
  article_health: {
    title: "The Small Habit That Helped Millions Sleep Better in 2025",
    description: "Sleep researchers are pointing to a surprisingly simple evening routine that more people are picking up at home.",
    category: "Health & Wellness",
    author: "Dr. Laura Chen",
    heroImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=75",
    intro: "After years of complex sleep advice, a growing number of health researchers are pointing to one simple change that consistently shows up in better sleep surveys: a 20-minute wind-down with no screens.",
    paragraphs: [
      "Most sleep disruptions trace back to light exposure and mental alertness within the hour before bed. Phones and tablets emit short-wavelength blue light that suppresses melatonin production, keeping the brain in a wakeful state even when the body is tired.",
      "A simple swap — trading a phone scroll for a paperback book, a short walk, or quiet music — is the change most researchers now recommend as a first step. No supplements, no blackout curtains, no sleep tracker required.",
      "People who stick with the habit for three weeks report falling asleep faster and waking less in the night. Consistency matters more than the specific activity.",
      "The practical trick is setting a phone-away time, not a sleep time. Once the device is down, everything else tends to follow.",
    ],
    highlights: [
      "No apps or devices needed",
      "Noticeable improvement within 3 weeks",
      "Works across all age groups",
      "Free and easy to start tonight",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_news: {
    title: "How Civic Centers Are Reinventing Weekend Gathering Spaces in 2025",
    description: "Town halls and neighborhood hubs are reporting record attendance by trading formal lectures for casual workshops.",
    category: "Community & Society",
    author: "Julian Vance",
    heroImage: "https://images.unsplash.com/photo-1504711434489-ff2e1e3a5ef7?auto=format&fit=crop&w=1200&q=75",
    intro: "Public community spaces across urban neighborhoods are undergoing a quiet renaissance, attracting younger crowds with hands-on maker fairs, repair cafes, and open discussion circles.",
    paragraphs: [
      "Rather than strictly hosting bureaucratic forums, neighborhood coordinators have introduced flexible schedules featuring weekend swap meets and zero-cost hobby classes. The focus has decisively shifted toward fostering genuine human connection.",
      "Organizers note that participation spikes when events encourage collaborative participation rather than passive listening. Local volunteers lead practical clinics on everything from basic bike repair to home fermentation.",
      "City planners emphasize that strong physical gathering places directly bolster neighborhood resilience and community trust during times of rapid economic change.",
      "Residents looking to get involved can check their local municipal portals for upcoming weekend community roundtables.",
    ],
    highlights: [
      "Free access to community tool-sharing",
      "Hands-on clinics led by neighborhood volunteers",
      "Noticeable boost in local civic engagement",
      "Open to families and individuals alike",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_finance: {
    title: "The Zero-Stress Cash Flow Strategy Financial Planners Recommend for 2025",
    description: "Why micro-budgeting apps are losing ground to straightforward visual tracking methods that take five minutes a week.",
    category: "Personal Finance",
    author: "Alana Sterling",
    heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=75",
    intro: "Tired of syncing dozens of accounts into complex budget apps, households are gravitating toward a remarkably low-friction method to safeguard savings and reduce financial anxiety.",
    paragraphs: [
      "Complex financial apps often fail because categorizing every single cup of coffee induces burnout within forty-eight hours. Modern advisors now advocate for the three-bucket allocation: essential overhead, flexible lifestyle, and automatic reserves.",
      "By setting fixed recurring transfers on payday directly into emergency and investment accounts, households eliminate the constant mental math associated with daily card swipes.",
      "Couples and solo earners alike report substantially higher peace of mind when they only monitor one broad discretionary balance rather than twenty micro-categories.",
      "The goal is sustainable simplicity: keeping the routine down to a 5-minute Sunday review ensures people actually maintain it across years.",
    ],
    highlights: [
      "Replaces tedious spreadsheet maintenance",
      "Automates critical reserve contributions",
      "Reduces daily decision fatigue around money",
      "Takes only 5 minutes each weekend",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_lifestyle: {
    title: "The 'Slow Sunday' Ritual That Is Helping Burned-Out Professionals Reset",
    description: "An intentional afternoon pause without schedules, alarms, or endless chores is changing how people start their week.",
    category: "Modern Living",
    author: "Mateo Rossi",
    heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75",
    intro: "As boundary lines between remote work and personal time continue to blur, a widespread cultural counter-movement is reclaiming Sunday as a sanctuary of low sensory input.",
    paragraphs: [
      "The premise of the Slow Sunday is simple: designating a four-hour window with zero scheduled obligations, muted work chats, and unhurried domestic rhythms. People spend this time walking, preparing bread, or reading without deadlines.",
      "Psychologists note that unstructured white space allows the nervous system to downshift from relentless task-switching into restorative baseline recovery.",
      "Those adopting the practice report arriving at Monday morning feeling genuinely refreshed rather than carrying residual Sunday anxiety into their work week.",
      "Creating this space requires little more than setting firm digital boundaries and letting minor household errands wait until weekday evenings.",
    ],
    highlights: [
      "Four hours of zero structured demands",
      "Proven reduction in Sunday evening dread",
      "Protects deep recovery time before Monday",
      "Adaptable to any apartment or household",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_tech: {
    title: "How Personal AI Assistants Are Shifting from Novelty to Daily Utility in 2025",
    description: "Beyond flashy chatbots, local machine learning models are quietly streamlining mundane desktop tasks and personal archives.",
    category: "Technology & AI",
    author: "Elena Rostova",
    heroImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=75",
    intro: "While high-level AI debates dominate headlines, everyday users are finding the most value in small, localized tools that summarize meetings, organize document clutter, and handle recurring data chores.",
    paragraphs: [
      "The latest generation of on-device language models operates quietly in the background without sending sensitive personal notes to third-party cloud servers. This local execution represents a major breakthrough in user privacy.",
      "Engineers and non-technical professionals alike are using these assistants to transcribe family voice memos, draft routine correspondence, and cross-reference personal research libraries in seconds.",
      "Industry analysts highlight that the future of practical AI is not replacing human creativity, but removing friction from tedious digital administration.",
      "Getting started requires minimal technical know-how as intuitive interfaces make private local assistance accessible to everyone.",
    ],
    highlights: [
      "Runs privately on consumer hardware",
      "Cuts administrative busywork by half",
      "No subscription fees or data harvesting",
      "Streamlines file organization and research",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_celebrity: {
    title: "The Quiet Resurgence of Independent Literary Salons in 2025",
    description: "Readers and authors are flocking to intimate offline salons to discuss deep themes without algorithmic algorithms.",
    category: "Culture & Books",
    author: "Sebastian Cross",
    heroImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=75",
    intro: "In an era of hyper-fast digital feeds, book lovers are finding solace in cozy, candlelit book salons hosted in indie cafes, library lofts, and living rooms.",
    paragraphs: [
      "Unlike conventional book clubs with rigid reading deadlines, modern literary salons prioritize broad philosophical themes, thoughtful author readings, and unscripted dialogue between writers and readers.",
      "Independent bookstores report that hosting monthly gathering circles has renewed community foot traffic and introduced readers to overlooked classic essay collections.",
      "Attendees describe these sessions as a refreshing antidote to fleeting social media hot takes, allowing nuanced opinions to unfold over several hours of unhurried discussion.",
      "The movement reflects a broader cultural hunger for tangible, tactile culture that invites thoughtful contemplation.",
    ],
    highlights: [
      "Intimate offline discussion format",
      "Spotlights indie authors and backlist classics",
      "Revitalizes local independent bookstores",
      "Encourages thoughtful, nuanced debate",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_business: {
    title: "Why Asynchronous Work Is Becoming the Core Standard for High-Performing Teams",
    description: "Companies cutting back on back-to-back video calls are seeing higher productivity and happier employees.",
    category: "Work & Career",
    author: "Darius Sterling",
    heroImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=75",
    intro: "After years of calendar fatigue, top remote and hybrid organizations are replacing endless status meetings with concise written briefs and structured documentation.",
    paragraphs: [
      "Research shows that knowledge workers spend up to four hours daily in reactive meetings, leaving little mental bandwidth for deep strategic problem-solving. Asynchronous workflows flip this ratio by making written proposals the default mode.",
      "When team members have 24 hours to digest memos before responding, decisions become more thoroughly considered, while employees across different time zones collaborate on equal footing.",
      "Organizations implementing 'No-Meeting Wednesdays' and strict agenda caps report substantial drops in turnover alongside faster project delivery cycles.",
      "Transitioning to an async-first culture simply requires clear documentation habits and mutual trust between leadership and staff.",
    ],
    highlights: [
      "Eliminates hours of calendar congestion",
      "Empowers uninterrupted deep focus blocks",
      "Fosters equal collaboration across time zones",
      "Improves quality of strategic decisions",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_travel: {
    title: "The Rise of Rail Escapes: Exploring Scenic Backroads Without Airport Stress",
    description: "Travelers in 2025 are rediscovering regional train corridors that offer panoramic views and relaxed itineraries.",
    category: "Travel & Discovery",
    author: "Camille Laurent",
    heroImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=75",
    intro: "Frustrated by crowded airport terminals and delays, discerning travelers are opting for leisurely train journeys that turn the transit itself into the main event.",
    paragraphs: [
      "Modern sleeper coaches and heritage regional railways have experienced historic passenger surges as eco-conscious travelers prioritize scenery and legroom over breakneck speed.",
      "From coastal cliff lines to alpine valleys, rail routes allow passengers to gaze out wide windows, read without turbulence, and arrive directly in historic city centers.",
      "Tourism boards report that smaller towns along secondary train spurs are enjoying economic boosts from weekend visitors seeking authentic local gastronomy.",
      "Booking a journey off-peak provides the ultimate slow-travel experience with spacious carriages and uninterrupted scenic vistas.",
    ],
    highlights: [
      "Zero airport security delays or luggage fees",
      "Arrives directly in downtown historic districts",
      "Significantly lower carbon footprint",
      "Spacious dining cars with panoramic views",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_cooking: {
    title: "Mastering the Skillet: The Five Simple Techniques Behind Restaurant-Quality Meals",
    description: "Chefs reveal how understanding heat management and pan timing matters far more than stocking exotic pantry ingredients.",
    category: "Culinary Arts",
    author: "Chef Marco Valenti",
    heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75",
    intro: "Great home cooking does not require a culinary diploma or high-end gadgets. It comes down to understanding how a single heavy skillet transfers flavor and crust.",
    paragraphs: [
      "The most common mistake home cooks make is overcrowding the pan, which traps moisture and boils ingredients instead of creating a caramelized golden sear. Leaving adequate space allows steam to dissipate instantly.",
      "Chefs emphasize the power of deglazing: using a splash of broth or citrus juice to lift the fond stuck to the bottom of the pan instantly yields rich, glossy pan sauces without extra thickeners.",
      "Pairing proper pan preheating with patient seasoning elevates basic proteins and seasonal vegetables into dishes worthy of a neighborhood bistro.",
      "With a well-seasoned cast iron or stainless pan, weeknight dinner prep becomes swift, intuitive, and deeply satisfying.",
    ],
    highlights: [
      "Unlocks rich caramelization on any protein",
      "Simple deglazing creates effortless sauces",
      "Requires only one heavy-duty pan",
      "Ready in under thirty minutes",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_gardening: {
    title: "The Micro-Garden Revolution: Fresh Herbs and Greens on Any Windowsill",
    description: "How urban apartment dwellers are harvesting fresh culinary greens year-round using compact container techniques.",
    category: "Gardening & Botanicals",
    author: "Clara Thornwood",
    heroImage: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=75",
    intro: "You do not need an acre of backyard dirt to enjoy the satisfaction of home-grown food. A bright kitchen windowsill and three terracotta pots can keep your kitchen stocked with aromatic herbs.",
    paragraphs: [
      "Compact varieties like dwarf basil, curly parsley, and rosemary thrive in container potting soil when given four hours of morning light. Their shallow root systems adapt effortlessly to modest planters.",
      "Urban gardeners praise micro-greens such as radish and mustard shoots, which germinate within four days and provide concentrated vitamins and crisp texture for everyday salads.",
      "Setting up a basic saucer watering schedule prevents common beginner issues like over-watering, ensuring roots stay aerated and vigorous throughout changing seasons.",
      "A quick snip of homegrown herbs transforms simple grain bowls and homemade soups into vibrant restaurant-level meals.",
    ],
    highlights: [
      "Thrives in small apartment spaces",
      "Harvest fresh herbs within weeks",
      "No specialized equipment required",
      "Cuts down weekly grocery bills",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_pets: {
    title: "Enrichment Games That Keep Dogs and Cats Mentally Sharp and Calm Indoors",
    description: "Veterinarians share why scent puzzles and foraging toys reduce pet anxiety far more effectively than extra physical exercise alone.",
    category: "Pet Wellness",
    author: "Dr. Nathan Bailey",
    heroImage: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=75",
    intro: "While daily walks are vital, animal behavioral experts increasingly emphasize canine and feline mental stimulation as the true key to eliminating destructive habits and separation anxiety.",
    paragraphs: [
      "Just fifteen minutes of focused scent-work — such as searching for kibble rolled into a towel or navigating a puzzle mat — burns as much cognitive energy as an hour of outdoor running.",
      "For indoor cats, vertical climbing perches paired with feather chase sequences mimic natural predatory cycles, fulfilling instinctual needs and preventing evening restlessness.",
      "Owners who integrate quick brain teaser sessions into daily feeding routines report calmer, more affectionate companions who settle peacefully while humans work from home.",
      "The best enrichment tools can easily be crafted from ordinary cardboard tubes and cotton towels found around the home.",
    ],
    highlights: [
      "Reduces barking, scratching, and restlessness",
      "Engages natural predatory and scent instincts",
      "Zero expensive gear required",
      "Takes only 15 minutes per session",
    ],
    related: RELATED_POOL.slice(2, 5),
  },
  article_sports: {
    title: "Why Adult Recreational Leagues and Club Sports Are Booming in 2025",
    description: "From padel to casual five-a-side football, adults are ditching solo gym treadmills for spirited team competition.",
    category: "Sports & Athletics",
    author: "Marcus Lind",
    heroImage: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=75",
    intro: "After years of isolated gym sessions and fitness app tracking, men and women of all ages are rediscovering the pure joy of community sports leagues that prioritize camaraderie over medals.",
    paragraphs: [
      "Sports like padel, pickleball, and weekend football leagues have expanded rapidly because they combine cardiovascular fitness with immediate social bonding and team spirit.",
      "Players report that the game dynamics distract from the physical exertion, making a 60-minute match feel exhilarating rather than exhausting.",
      "Community sports centers are expanding beginner divisions to ensure new participants can join matches without feeling intimidated by experienced players.",
      "Joining a local club requires just a pair of trainers and a willingness to play, offering a weekly anchor for fitness and friendly banter.",
    ],
    highlights: [
      "Fun alternative to repetitive cardio machines",
      "Welcoming beginner and mixed divisions",
      "Builds lasting neighborhood friendships",
      "High calorie burn in a social setting",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_education: {
    title: "The Micro-Learning Technique That Helps Busy Adults Retain New Skills",
    description: "Cognitive scientists demonstrate why 15-minute distributed study intervals outperform marathon weekend cram sessions.",
    category: "Lifelong Learning",
    author: "Dr. Evelyn Ward",
    heroImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=75",
    intro: "Learning a new programming framework, musical instrument, or financial discipline doesn't require quitting your day job. Cognitive science reveals how short, spaced intervals unlock rapid neural consolidation.",
    paragraphs: [
      "The brain absorbs complex patterns far more effectively when concepts are reviewed over several consecutive days rather than crammed into one exhausting three-hour marathon.",
      "By focusing on one concise concept during a morning coffee break, learners prevent cognitive overload and allow synaptic pathways to strengthen during nighttime sleep cycles.",
      "Top educators recommend pairing brief reading sessions with active recall: spending three minutes writing a summary from memory cements the material permanently.",
      "Adopting this sustainable daily cadence enables working professionals to master entire skill domains over the course of a single year.",
    ],
    highlights: [
      "Prevents mental exhaustion and burnout",
      "Maximizes memory retention via spaced repetition",
      "Fits effortlessly into 15-minute breaks",
      "Proven effective across languages and coding",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_parenting: {
    title: "Low-Stimulation Family Weekends: Rediscovering Unstructured Play at Home",
    description: "How parents are easing sensory overload for kids by replacing packed activity schedules with simple open-ended play.",
    category: "Family & Parenting",
    author: "Hannah Montgomery",
    heroImage: "https://images.unsplash.com/photo-1504711434489-ff2e1e3a5ef7?auto=format&fit=crop&w=1200&q=75",
    intro: "With children's schedules increasingly packed with structured classes and digital screens, pediatric researchers highlight the critical value of open-ended, slow-paced family weekends.",
    paragraphs: [
      "Unstructured play — such as building blanket forts, drawing on butcher paper, or baking bread together — fosters deep creativity and emotional regulation in developing children.",
      "Parents who designate screen-free Saturday mornings observe noticeable drops in tantrums and sensory overstimulation, creating a more relaxed home atmosphere.",
      "Children naturally develop problem-solving resilience when given the freedom to invent their own games rather than constantly following programmed entertainment.",
      "Embracing gentle downtime helps families bond meaningfully while ensuring everyone feels rested when Monday morning arrives.",
    ],
    highlights: [
      "Decreases childhood sensory overload",
      "Encourages boundless creative imagination",
      "Zero cost and minimal prep needed",
      "Recharges parents and children alike",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_music: {
    title: "The Warmth of Analog Sound: Why Young Audiences Are Embracing Physical Albums",
    description: "In an ocean of limitless streaming playlists, listeners are falling in love with the tactile ritual of full-album listening.",
    category: "Music & Audio",
    author: "Lucas Thorne",
    heroImage: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1200&q=75",
    intro: "Streaming algorithms may offer instant access to 100 million songs, but millions of music lovers are choosing to slow down and experience records from start to finish.",
    paragraphs: [
      "Dropping a needle on a spinning vinyl disc requires intentional presence. It demands setting aside your phone and listening to an artist's vision in the sequence they meticulously designed.",
      "Audio enthusiasts also celebrate the dynamic range and organic warmth inherent to physical media, offering richer low-end resonance than heavily compressed digital files.",
      "Independent record shops have evolved into cultural anchors where music lovers browse album art, discover forgotten B-sides, and meet like-minded audiophiles.",
      "Starting an audio collection can be done on a modest budget, turning listening sessions into a celebrated daily unwinding ritual.",
    ],
    highlights: [
      "Encourages uninterrupted full-album immersion",
      "Rich acoustic warmth and analog nuance",
      "Celebrates tangible physical artwork",
      "Supports independent musicians and record shops",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_movies: {
    title: "The Golden Age of Mid-Budget Cinema: Why Audiences Want Character-Driven Stories",
    description: "Fatigued by endless CGI blockbuster sequels, moviegoers are celebrating grounded storytelling and practical effects.",
    category: "Cinema & Television",
    author: "Greta Lindqvist",
    heroImage: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75",
    intro: "After years of colossal superhero franchises dominating multiplexes, a significant box office revival is underway for smartly crafted, character-centric narrative films.",
    paragraphs: [
      "Audiences are increasingly gravitating toward suspenseful thrillers, witty chamber dramas, and nuanced historical epics that prioritize dialogue and tangible stakes over green-screen spectacles.",
      "Independent film distributors are reporting enthusiastic turnout for cinema screenings that feature post-movie panel discussions and director question-and-answer sessions.",
      "Writers and cinematographers are enjoying newfound creative freedom, crafting memorable character arcs that linger in viewers' minds long after the theater credits roll.",
      "For cinema enthusiasts, this resurgence marks a thrilling return to the golden eras of auteur filmmaking and compelling human drama.",
    ],
    highlights: [
      "Prioritizes nuanced acting and crisp dialogue",
      "Features tactile practical sets and lighting",
      "Sparks lively post-screening discussions",
      "Revitalizes independent movie theaters",
    ],
    related: RELATED_POOL.slice(2, 5),
  },
  article_diy: {
    title: "Five High-Impact Home Improvements You Can Finish in a Single Weekend",
    description: "Transform your living space with approachable upgrades that require basic tools and zero contractor fees.",
    category: "Home & DIY",
    author: "Caleb Vance",
    heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    intro: "You don't need a massive remodel budget to dramatically refresh your living space. A few strategic weekend improvements can completely alter the ambiance of any room.",
    paragraphs: [
      "Upgrading outdated cabinet hardware, swapping generic switch plates for matte architectural covers, and installing warm under-cabinet LED strips create an instant designer touch for under fifty dollars.",
      "Applying a bold accent color to an entryway or painting interior door frames provides striking architectural contrast that makes small rooms feel expansive and intentional.",
      "Adding floating wooden display shelves offers practical storage while creating clean focal points for books, ceramics, and potted greenery.",
      "Taking on these manageable DIY projects builds practical hand skills and brings immense satisfaction every time you walk into the room.",
    ],
    highlights: [
      "Completed in less than 48 hours",
      "Requires only basic hand tools",
      "Boosts home aesthetics on a tight budget",
      "High visual impact for minimal investment",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_photography: {
    title: "Mastering Natural Light: How to Capture Stunning Smartphone Portraits",
    description: "Pro photographers break down the lighting angles and composition secrets that make mobile shots look cinematic.",
    category: "Visual Arts",
    author: "Maya Lin",
    heroImage: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=75",
    intro: "Modern smartphone cameras possess extraordinary sensors, but the true secret to captivating photography lies in understanding how natural light sculpts faces and shapes.",
    paragraphs: [
      "Positioning your subject at a forty-five-degree angle beside a large window creates soft directional shadows that add dimension and depth without harsh contrast.",
      "Photographers advise turning on the camera grid to compose using the rule of thirds, allowing generous negative space to guide the viewer's eye straight toward the subject.",
      "Locking exposure on the brightest highlights prevents blown-out skin tones and preserves rich details in textured fabrics and ambient backgrounds.",
      "With these simple framing habits, your everyday family snapshots and travel memories will look like editorial magazine portraits.",
    ],
    highlights: [
      "Harnesses free daylight from any window",
      "Eliminates harsh shadows and blown-out highlights",
      "No pricey lenses or editing apps required",
      "Immediate results on any modern smartphone",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_fitness: {
    title: "Zone 2 Cardio: The Low-Intensity Training Method Doctors Are Raving About",
    description: "Why jogging at a conversational pace builds stronger heart health and burns more fat than breathless HIIT workouts.",
    category: "Fitness & Training",
    author: "Dr. Brett Harrison",
    heroImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=75",
    intro: "For years, workout culture claimed that if you weren't collapsing in exhaustion, your cardio didn't count. Now, exercise physiologists are proving that slower is actually much better.",
    paragraphs: [
      "Zone 2 training refers to steady cardiovascular effort where you can maintain a comfortable spoken conversation without gasping for breath. This pace triggers peak mitochondrial development.",
      "Unlike high-intensity intervals that flood the bloodstream with stress hormones, conversational cardio optimizes fat oxidation while leaving joints pain-free and muscles recovered.",
      "Athletes and everyday walkers alike benefit from incorporating three 45-minute Zone 2 sessions weekly via brisk walking, light cycling, or swimming laps.",
      "The result is sustainable stamina, deeper restorative sleep, and long-term cardiovascular longevity without injury burnout.",
    ],
    highlights: [
      "Pain-free training with low injury risk",
      "Maximizes mitochondrial efficiency and endurance",
      "Sustainable across all age and fitness brackets",
      "Leaves you energized instead of exhausted",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_crafts: {
    title: "The Therapeutic Magic of Pottery and Handcrafts in a Screen-Heavy Era",
    description: "Why younger adults are trading keyboard tapping for clay wheel shaping, woodworking, and tactile maker crafts.",
    category: "Crafts & Creation",
    author: "Ariadne Cole",
    heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    intro: "After spending eight hours staring at glowing pixels, working with raw clay, wood, or fiber provides an immediate sensory grounding that digital screens can never duplicate.",
    paragraphs: [
      "Ceramic studios and craft cooperatives report unprecedented membership surges as people seek hobbies with tangible, physical results you can hold in your hands.",
      "The rhythm of centering clay on a wheel demands total physical presence, effectively locking out intrusive work thoughts and social media distractions.",
      "Making an imperfect, handcrafted mug or bowl teaches patience and celebrates the beauty of wabi-sabi — finding elegance in handcrafted uniqueness.",
      "Local community art centers offer accessible weekend workshops where beginners can explore hands-on creation in a welcoming environment.",
    ],
    highlights: [
      "Provides complete mental escape from digital screens",
      "Develops tactile hand-eye coordination",
      "Creates functional household art pieces",
      "Welcoming community studio spaces",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_coffee: {
    title: "The Art of the Morning Pour-Over: Elevating Your Home Coffee Ritual",
    description: "Baristas share the three brewing variables that unlock delicate floral notes and silky body from everyday beans.",
    category: "Food & Drink",
    author: "Simon Karr",
    heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75",
    intro: "Brewing an exceptional cup of coffee doesn't require a four-thousand-dollar espresso machine. A simple glass dripper and proper technique deliver exquisite cafe flavors right in your kitchen.",
    paragraphs: [
      "The secret begins with water temperature: brewing around ninety-three degrees Celsius extracts sweet aromatic compounds without scorching delicate bean oils into bitterness.",
      "A forty-second 'bloom' — gently wetting the fresh coffee grounds with twice their weight in water — allows trapped carbon dioxide to escape, paving the way for clean, balanced extraction.",
      "Investing in a modest burr grinder guarantees uniform particle size, ensuring every drop of water passes through the bed at an even, controlled rate.",
      "Transforming your morning brew into an unhurried five-minute sensory ritual sets a calm, deliberate tone for the entire day ahead.",
    ],
    highlights: [
      "Extracts vibrant natural sweetness and clarity",
      "Simple setup with minimal kitchen counter clutter",
      "Costs pennies compared to takeaway cafes",
      "A soothing five-minute mindful morning routine",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_books: {
    title: "How Intentional Reading Routines Are Helping People Finish 30 Books a Year",
    description: "Lifelong book lovers share why micro-reading sessions and abandoning boring books unlock joyful reading habits.",
    category: "Literature & Reading",
    author: "Nadia Benson",
    heroImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=75",
    intro: "Many people lament that they no longer have time to read, yet swapping fifteen minutes of morning phone browsing for twenty pages of a book quickly adds up to dozens of completed volumes.",
    paragraphs: [
      "The key to consistent reading is removing guilt: seasoned bibliophiles freely abandon books that don't hook them by page fifty, reserving their attention only for works that genuinely fascinate them.",
      "Carrying a paperback or e-reader in your bag turns subway delays and doctor waiting rooms into effortless reading opportunities throughout the week.",
      "Pairing fiction before sleep with non-fiction during morning coffee ensures reading remains an exciting pleasure rather than feeling like assigned homework.",
      "Public library digital card apps allow readers to borrow bestselling audiobooks and eBooks instantly without spending a dime.",
    ],
    highlights: [
      "Twenty pages daily equals 25+ books annually",
      "Permission to drop books without lingering guilt",
      "Free access through public library apps",
      "Transforms idle waiting periods into rich insights",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_science: {
    title: "The Wonder of Citizen Science: How Everyday Observers Are Fueling Real Discoveries",
    description: "From bird migration tracking to backyard astronomy, smartphone apps are turning regular citizens into frontline researchers.",
    category: "Science & Nature",
    author: "Dr. Arthur Pendelton",
    heroImage: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=75",
    intro: "Modern scientific breakthroughs are no longer confined to university laboratories. Millions of curious citizens are gathering crucial climate, biodiversity, and astronomy data right in their backyards.",
    paragraphs: [
      "Using mobile apps with acoustic recognition and image classification, nature lovers upload sightings of rare pollinators and migrating birds directly to global biodiversity databases.",
      "Professional biologists rely on these vast crowd-sourced datasets to map changing ecological habitats and safeguard endangered flora and fauna in real time.",
      "Families participating in seasonal star-counting projects help astronomers document light pollution while igniting children's curiosity about the cosmos.",
      "Contributing to global scientific research requires no formal background — just keen eyes and a love for the natural world around you.",
    ],
    highlights: [
      "Directly aids peer-reviewed scientific studies",
      "Free mobile apps for plant and bird identification",
      "Engaging outdoor exploration for families",
      "Builds practical ecological awareness",
    ],
    related: RELATED_POOL.slice(2, 5),
  },
  article_history: {
    title: "Rediscovering the Lost Architectural Masterpieces of the Industrial Age",
    description: "Historical preservationists are shining a light on ornate municipal buildings that shaped early 20th-century communities.",
    category: "History & Heritage",
    author: "Professor Gregory Hayes",
    heroImage: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=75",
    intro: "Behind soot-stained brick facades and forgotten railway arches lies an era of soaring ironwork, stained glass, and hand-carved stone that modern construction rarely replicates.",
    paragraphs: [
      "Civic architectural archives reveal how early municipal leaders viewed train concourses, libraries, and waterworks as grand civic temples meant to inspire the general public.",
      "Urban historians are leading preservation tours through refurbished industrial power stations and textile mills, celebrating the meticulous craftsmanship of forgotten masons.",
      "Adaptive reuse initiatives are converting these soaring heritage spaces into vibrant food halls, public libraries, and innovation hubs that honor local heritage.",
      "Exploring your city's historic core with an eye for brickwork and iron detailing offers a profound connection to generations of laborers past.",
    ],
    highlights: [
      "Celebrates timeless artisanal masonry and ironwork",
      "Drives thoughtful adaptive reuse in modern cities",
      "Engaging historical walking routes in old downtowns",
      "Preserves cultural heritage for future generations",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_language: {
    title: "The Natural Immersion Habit That Makes Language Learning Click in 2025",
    description: "Why consuming authentic podcasts and micro-conversations works ten times faster than memorizing dry grammar tables.",
    category: "Linguistics & Education",
    author: "Soraya Haddad",
    heroImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75",
    intro: "Tired of robotic flashcards and repetitive grammar drills? Polyglots and cognitive scientists agree that comprehension-based immersion is the fastest path to natural fluency.",
    paragraphs: [
      "Listening to compelling, story-driven podcasts designed for learners allows the brain to map grammatical structures and idioms intuitively, just as children acquire native speech.",
      "Exchanging brief two-minute voice memos with language exchange partners overcomes the speaking anxiety that traps so many adult learners in silent study mode.",
      "Focusing on the top five hundred most frequent conversational words unlocks understanding of over sixty percent of everyday spoken dialogue.",
      "Spending fifteen minutes enjoying a cooking video or music playlist in your target language turns learning into a genuine lifestyle pleasure.",
    ],
    highlights: [
      "Unlocks natural speech patterns without rote drills",
      "Reduces spoken anxiety through low-stakes voice notes",
      "Focuses on high-frequency conversational vocabulary",
      "Effortlessly integrates into daily commute listening",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_organizing: {
    title: "The 'One In, One Out' Principle: Keeping Your Home Effortlessly Clutter-Free",
    description: "Decluttering experts outline how a single intentional habit stops consumer accumulation in its tracks.",
    category: "Home & Organization",
    author: "Leanne Dupont",
    heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    intro: "A whole-house purge can be exhausting, and cluttered shelves often return within months. Establishing a permanent equilibrium rule prevents accumulation before it starts.",
    paragraphs: [
      "The 'One In, One Out' rule is deceptively simple: whenever a new piece of clothing, kitchen appliance, or book enters your living space, an existing item must be donated or recycled.",
      "This gentle friction forces deliberate decision-making before purchasing, prompting you to evaluate whether the newcomer truly surpasses what you already own.",
      "Home organizers highlight that maintaining clear horizontal surfaces creates immediate visual calm, transforming bedrooms and kitchens into serene retreats.",
      "Donating high-quality pre-owned items to local shelters ensures your decluttering efforts directly benefit your broader community.",
    ],
    highlights: [
      "Permanently halts household clutter creep",
      "Encourages mindful and intentional spending",
      "Keeps flat surfaces and counters pristine",
      "Supports local donation centers and thrift shops",
    ],
    related: RELATED_POOL.slice(2, 5),
  },
  article_cycling: {
    title: "The Urban Commute Revolution: Why Protected Bike Lanes Are Transforming Cities",
    description: "How electric commuter bikes and dedicated cycling corridors are making morning travel faster, cheaper, and healthier.",
    category: "Urban Mobility",
    author: "Jasper Vane",
    heroImage: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=75",
    intro: "City commuters are increasingly swapping crowded subway cars and gridlocked traffic jams for the invigorating freedom of protected bike paths and e-bikes.",
    paragraphs: [
      "Municipal investments in separated, green-painted bike lanes have eliminated the safety anxieties that previously kept casual riders off urban streets.",
      "The surge in lightweight electric bikes allows riders to breeze up steep hills and commute ten miles to work without arriving drenched in sweat.",
      "Urban commuters report arriving at their desks energized and clear-headed, citing their scenic ride as the most enjoyable twenty minutes of their workday.",
      "Choosing two wheels over four saves thousands annually in parking and fuel while keeping urban air cleaner for all residents.",
    ],
    highlights: [
      "Bypasses peak-hour traffic jams entirely",
      "Cuts annual transport costs by thousands",
      "E-bikes conquer hills with zero sweat",
      "Enhances daily cardiovascular fitness",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_weather: {
    title: "Understanding Microclimates: The Hidden Weather Patterns in Your Own Town",
    description: "Meteorologists explain why temperatures and rain showers vary dramatically across neighborhoods only miles apart.",
    category: "Earth & Climate",
    author: "Dr. Fiona Selkirk",
    heroImage: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1200&q=75",
    intro: "Have you ever experienced torrential rain in your backyard while friends three streets over enjoyed sunny skies? You are witnessing the fascinating physics of local microclimates.",
    paragraphs: [
      "Elevation shifts, dense tree canopies, and concrete heat islands alter air currents and temperature pockets on a neighborhood-by-neighborhood basis.",
      "Gardeners who study their property's specific sun angles and frost pockets can cultivate delicate perennials weeks ahead of regional planting calendars.",
      "Setting up a basic digital rain gauge and outdoor thermometer lets weather enthusiasts track localized climate rhythms with surprising precision.",
      "Appreciating local terrain dynamics transforms an everyday glance at the sky into an intimate understanding of nature's subtle systems.",
    ],
    highlights: [
      "Explains hyper-local rain and temperature swings",
      "Helps gardeners optimize planting locations",
      "Reveals the cooling impact of urban tree canopies",
      "Simple to observe with home weather gear",
    ],
    related: RELATED_POOL.slice(1, 4),
  },
  article_dovtv_pulse: {
    title: "The Next Era of Digital Culture: Why Creators Are Choosing Micro-Communities",
    description: "An editorial look at how online audiences are moving away from noisy public feeds into niche, high-trust forums.",
    category: "Digital Trends",
    author: "Zane Hawthorne",
    heroImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=75",
    intro: "Fatigued by algorithmic outrage and fleeting viral videos, millions of creators and digital natives are shifting their attention into curated private spaces and dedicated newsletters.",
    paragraphs: [
      "In smaller discussion groups and subscription circles, participants engage in substantive conversations without performing for an invisible crowd or chasing metric vanity.",
      "Independent creators report far higher engagement and genuine reader loyalty when communicating through direct email dispatches rather than volatile social algorithms.",
      "Moderators emphasize that clear community standards and shared interests cultivate authentic friendships that frequently lead to real-world collaborations.",
      "The evolution of modern digital media is decisively prioritizing depth of relationship over shallow, superficial impressions.",
    ],
    highlights: [
      "Replaces algorithmic noise with meaningful dialogue",
      "Fosters high-trust creative collaborations",
      "Direct communication between writers and readers",
      "Protects mental clarity from digital burnout",
    ],
    related: RELATED_POOL.slice(0, 3),
  },
  article_dovtv_culture: {
    title: "Modern Solitude: The Power of Unplugged Quiet Time in an Always-On Society",
    description: "Cultural analysts investigate why carving out intentional solitude has become the ultimate luxury and mental wellness asset.",
    category: "Culture & Living",
    author: "Kira Varma",
    heroImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=75",
    intro: "In a hyper-connected society where notifications buzz every few seconds, the rarest and most restorative luxury of all is the choice to simply sit alone in quiet reflection.",
    paragraphs: [
      "True solitude is not loneliness; it is the deliberate practice of clearing external noise so your own creative thoughts and inner voice can finally emerge.",
      "Leading artists, researchers, and entrepreneurs increasingly schedule 'think mornings' dedicated exclusively to journaling, walking, and contemplative problem-solving.",
      "Developing comfort with quiet moments without reaching for a phone builds deep psychological resilience and emotional self-reliance.",
      "Reclaiming fifteen minutes of peaceful stillness each afternoon provides a grounding foundation that transforms how you navigate modern life.",
    ],
    highlights: [
      "Restores mental clarity and creative focus",
      "Eliminates relentless notification fatigue",
      "Strengthens emotional independence and peace",
      "Accessible anywhere without spending a dime",
    ],
    related: RELATED_POOL.slice(2, 5),
  },
};

// ---------- OG variants (5 per template, picked deterministically by short_code) ----------
type OgVariant = { title: string; description: string; heroImage: string };

const VARIANTS: Record<string, OgVariant[]> = {
  article_health: [
    {
      title: "The Small Habit That Helped Millions Sleep Better in 2025",
      description: "Sleep researchers are pointing to a surprisingly simple evening routine that more people are picking up at home.",
      heroImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Why Experts Are Recommending a 20-Minute Wind-Down Before Bed",
      description: "A gentle screen-free ritual that helps regulate natural melatonin without sleep supplements.",
      heroImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Natural Sleep Patterns: What Really Works for Deep Nightly Rest",
      description: "How simple shifts in evening lighting and bedtime habits consistently transform sleep quality.",
      heroImage: "https://images.unsplash.com/photo-1434626881859-051d6b39e8a4?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Gentle Evening Routines for People Who Struggle to Fall Asleep",
      description: "Small habits and calming rituals that quiet mental alertness after a hectic day.",
      heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Restorative Sleep Habits Worth Adopting for Long-Term Wellness",
      description: "A friendly look at the subtle evening changes that leave you feeling genuinely recharged by morning.",
      heroImage: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_news: [
    {
      title: "How Civic Centers Are Reinventing Weekend Gathering Spaces in 2025",
      description: "Town halls and neighborhood hubs are reporting record attendance with casual workshops.",
      heroImage: "https://images.unsplash.com/photo-1504711434489-ff2e1e3a5ef7?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Local Community Spaces Quietly Becoming Weekend Family Hubs Again",
      description: "Why neighborhood centers are expanding hands-on maker fairs and free tool-sharing programs.",
      heroImage: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Neighborhood Gatherings Bring Real Connection Back to City Blocks",
      description: "A look at grassroots weekend initiatives fostering genuine community trust and resilience.",
      heroImage: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Growing Movement to Reclaim Shared Public Gathering Spaces",
      description: "How local coordinators are turning underused spaces into thriving weekend artisan hubs.",
      heroImage: "https://images.unsplash.com/photo-1504711434489-ff2e1e3a5ef7?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Why Free Community Workshops Are Drawing Crowds in Every Town",
      description: "Residents of all ages are turning out for practical clinics and neighborhood discussions.",
      heroImage: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_finance: [
    {
      title: "The Zero-Stress Cash Flow Strategy Financial Planners Recommend for 2025",
      description: "Why micro-budgeting apps are losing ground to straightforward visual tracking methods.",
      heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "How Automated Three-Bucket Savings Eliminate Financial Decision Fatigue",
      description: "A reliable, low-maintenance framework for safeguarding emergency reserves on payday.",
      heroImage: "https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The 5-Minute Sunday Financial Review That Replaces Complex Spreadsheets",
      description: "Keep tabs on cash flow and discretionary spending without tracking every single receipt.",
      heroImage: "https://images.unsplash.com/photo-1611974789855-9c702a8b5f5a?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Smart Money Rules for Navigating Everyday Household Expenses in 2025",
      description: "Practical steps to curb recurring subscription bloat and build financial breathing room.",
      heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Modern Guide to Managing Family Budgets Without Anxiety",
      description: "How simple, predictable allocation habits bring lasting peace of mind to household finances.",
      heroImage: "https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_lifestyle: [
    {
      title: "The 'Slow Sunday' Ritual That Is Helping Burned-Out Professionals Reset",
      description: "An intentional afternoon pause without schedules or endless chores changes your whole week.",
      heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Reclaiming White Space: Why Low-Sensory Weekends Foster Mental Recovery",
      description: "Unplugging from relentless task-switching gives your nervous system a much-needed baseline reset.",
      heroImage: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Calm Domestic Rhythms That Banish Sunday Evening Dread for Good",
      description: "Simple boundary-setting habits that keep work anxiety from encroaching on weekend rest.",
      heroImage: "https://images.unsplash.com/photo-1493246507009-8f55f5777e98?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "How Mindful Living Habits Cultivate Daily Balance in Modern Homes",
      description: "A guide to screen-free evenings, quiet morning coffee, and intentional domestic pace.",
      heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Subtle Art of Protecting Your Personal Time and Mental Energy",
      description: "Practical strategies for stepping away from endless digital notifications and staying present.",
      heroImage: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_tech: [
    {
      title: "How Personal AI Assistants Are Shifting from Novelty to Daily Utility in 2025",
      description: "Local machine learning models are quietly streamlining mundane desktop tasks and archives.",
      heroImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "On-Device AI Models: Why Privacy-First Tech Is Gaining Rapid Adoption",
      description: "Run capable language assistants locally without shipping sensitive personal notes to the cloud.",
      heroImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Five Practical Ways Smart Automation Can Free Up Hours in Your Workweek",
      description: "Automate voice transcription, file indexing, and routine correspondence with zero friction.",
      heroImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Next Wave of Consumer Tech: Subtle Tools Designed for Real Focus",
      description: "Why modern software designers are moving toward calm interfaces and reduced digital clutter.",
      heroImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Everyday Computing in 2025: Smarter Tools Without the Complexity",
      description: "A look at user-friendly software solving everyday workflow bottlenecks effortlessly.",
      heroImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_celebrity: [
    {
      title: "The Quiet Resurgence of Independent Literary Salons in 2025",
      description: "Readers and authors are flocking to intimate offline salons to discuss deep themes.",
      heroImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Why Modern Readers Are Reconnecting in Local Bookshop Gatherings",
      description: "An antidote to algorithmic feeds: thoughtful dialogue over fiction, poetry, and backlist classics.",
      heroImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f84b4?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Inside the Revival of Slow Cultural Conversations and Author Salons",
      description: "How intimate reading circles are turning book discovery into an enriching tactile experience.",
      heroImage: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Rediscovering the Romance of Print: Why Indie Literary Culture Is Booming",
      description: "Readers celebrate physical paperbacks and meaningful face-to-face discussions.",
      heroImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Return of Deep Discussion Circles in Independent Bookstores",
      description: "Why book lovers are choosing long-form evenings of conversation over quick digital reviews.",
      heroImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f84b4?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_business: [
    {
      title: "Why Asynchronous Work Is Becoming the Core Standard for High-Performing Teams",
      description: "Cutting back on back-to-back video calls drives higher productivity and happier employees.",
      heroImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The No-Meeting Framework: How Modern Organizations Protect Deep Focus",
      description: "Replacing frantic calendar invites with structured written memos speeds up strategic delivery.",
      heroImage: "https://images.unsplash.com/photo-1664575602807-e3f2c67cf35c?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Building an Async-First Culture Across Global Time Zones in 2025",
      description: "Clear documentation and autonomous workflows empower teams to execute without friction.",
      heroImage: "https://images.unsplash.com/photo-1573497620290-7f05dfd07f8e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Why Thoughtful Documentation Outperforms Real-Time Chat Channels",
      description: "How high-trust companies preserve institutional knowledge and eliminate constant Slack pings.",
      heroImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Sustainable Career Habits: Balancing High Performance with True Wellbeing",
      description: "Setting firm boundaries and prioritizing deliberate work over frantic multitasking.",
      heroImage: "https://images.unsplash.com/photo-1664575602807-e3f2c67cf35c?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_travel: [
    {
      title: "The Rise of Rail Escapes: Exploring Scenic Backroads Without Airport Stress",
      description: "Travelers in 2025 are rediscovering regional train corridors with panoramic views.",
      heroImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Slow Travel by Train: Why Sleeper Corridors Are Booming in Popularity",
      description: "Spacious lounges and zero baggage hassles make railway journeys the ultimate vacation reset.",
      heroImage: "https://images.unsplash.com/photo-1507608616759-54f98b6ee94d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Uncovering Hidden Towns Along Historic Regional Rail Lines",
      description: "Escape tourist crowds by venturing into scenic countryside villages directly from city stations.",
      heroImage: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Eco-Conscious Traveler's Guide to Scenic Weekend Getaways",
      description: "How low-carbon transit routes turn ordinary weekends into unforgettable adventures.",
      heroImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Pack Light, Travel Far: Minimalist Habits for Stress-Free Vacations",
      description: "Tips for exploring scenic destinations with one small bag and maximum flexibility.",
      heroImage: "https://images.unsplash.com/photo-1507608616759-54f98b6ee94d?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_cooking: [
    {
      title: "Mastering the Skillet: The Five Simple Techniques Behind Restaurant-Quality Meals",
      description: "Chefs reveal how proper heat management and pan timing outshine exotic pantry ingredients.",
      heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Power of the Sear: Why Pan Space Unlocks Incredible Flavor at Home",
      description: "Avoid overcrowding your skillet to achieve golden, caramelized crusts on any weeknight meal.",
      heroImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Effortless Pan Sauces: How Deglazing Elevates Everyday Dinners",
      description: "Use pan juices and a splash of citrus to create glossy restaurant-grade reductions in minutes.",
      heroImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Cast Iron Cooking Essentials: Easy Techniques for Perfectly Crisp Meals",
      description: "A friendly culinary guide to seasoning, maintaining, and cooking with heavy iron cookware.",
      heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Streamlined Weeknight Cooking: One Pan, Fresh Ingredients, Zero Stress",
      description: "Simple cooking fundamentals that make preparing delicious family dinners fast and easy.",
      heroImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_gardening: [
    {
      title: "The Micro-Garden Revolution: Fresh Herbs and Greens on Any Windowsill",
      description: "How urban apartment dwellers are harvesting culinary greens year-round in compact containers.",
      heroImage: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Balcony Botanicals: High-Yield Herbs That Thrive in Small Pots",
      description: "Grow fragrant basil, parsley, and crisp salad greens in tight spaces with minimal care.",
      heroImage: "https://images.unsplash.com/photo-1416879347937-86af90b6c0cf?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Watering Wisdom: Keeping Container Plants Lush and Resilient All Year",
      description: "Avoid root rot and promote vigorous indoor growth with simple drainage routines.",
      heroImage: "https://images.unsplash.com/photo-1591857177580-e8d7f9d2d6ab?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "A Beginner's Guide to Indoor Greenery: Bringing Nature into Your Home",
      description: "Low-maintenance houseplant selections that brighten rooms and purify indoor air naturally.",
      heroImage: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Seasonal Planting in Small Spaces: Maximizing Every Square Foot",
      description: "How to rotate seasonal culinary greens for continuous fresh harvests from spring to winter.",
      heroImage: "https://images.unsplash.com/photo-1416879347937-86af90b6c0cf?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_pets: [
    {
      title: "Enrichment Games That Keep Dogs and Cats Mentally Sharp and Calm Indoors",
      description: "Veterinarians share why scent puzzles and foraging toys reduce pet anxiety effectively.",
      heroImage: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Calming Power of Canine Scent Work: 15 Minutes to Total Peace",
      description: "How simple foraging activities soothe overstimulated dogs and prevent destructive habits.",
      heroImage: "https://images.unsplash.com/photo-1548681620-4f3fd54a5f1d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Indoor Cat Enrichment: Fulfilling Predatory Instincts in Small Homes",
      description: "Vertical climbing perches and puzzle mats keep indoor cats curious, active, and content.",
      heroImage: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Daily Wellness Routines for Happy and Long-Lived Companions",
      description: "Small habits in nutrition, playtime, and mental stimulation that make a huge difference.",
      heroImage: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "DIY Pet Enrichment Toys You Can Assemble from Household Items",
      description: "Turn recycled cardboard and cotton towels into engaging mental challenges for your pets.",
      heroImage: "https://images.unsplash.com/photo-1548681620-4f3fd54a5f1d?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_sports: [
    {
      title: "Why Adult Recreational Leagues and Club Sports Are Booming in 2025",
      description: "Adults are trading solo gym treadmills for spirited team competition and social games.",
      heroImage: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Social Fitness Wave: Why Racket Sports and Five-a-Side Are Thriving",
      description: "Padel, pickleball, and weekend football deliver serious cardiovascular workouts disguised as play.",
      heroImage: "https://images.unsplash.com/photo-1461896836374-cf382b776ab2?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Joining a Community Sports League as an Adult: A Low-Pressure Guide",
      description: "How beginner-friendly divisions help working adults build fitness and neighborhood friendships.",
      heroImage: "https://images.unsplash.com/photo-1571019613576-8b3c05d8e7ef?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Joy of Play: How Team Athletics Boost Mood and Relieve Stress",
      description: "The mental health benefits of competitive camaraderie compared to repetitive solo workouts.",
      heroImage: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Weekend Warrior Athletics: Staying Injury-Free While Playing Hard",
      description: "Essential mobility drills and recovery routines for recreational league athletes.",
      heroImage: "https://images.unsplash.com/photo-1461896836374-cf382b776ab2?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_education: [
    {
      title: "The Micro-Learning Technique That Helps Busy Adults Retain New Skills",
      description: "Why 15-minute distributed study intervals outperform marathon weekend cram sessions.",
      heroImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Spaced Repetition Demystified: How to Learn Without Cognitive Overload",
      description: "Science-backed techniques for locking in complex languages, coding syntax, and technical data.",
      heroImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Active Recall: The High-Efficiency Habit Behind Rapid Skill Mastery",
      description: "Writing short summaries from memory beats hours of passive rereading every single time.",
      heroImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Lifelong Learning for Working Professionals: Finding Time That Sticks",
      description: "Turn ten minutes of morning downtime into lasting career advantages with micro-habits.",
      heroImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Self-Taught Advantage: Modern Frameworks for Independent Study",
      description: "How curious adults curate high-quality online resources into structured learning paths.",
      heroImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_parenting: [
    {
      title: "Low-Stimulation Family Weekends: Rediscovering Unstructured Play at Home",
      description: "Parents are easing sensory overload for kids by replacing packed schedules with simple play.",
      heroImage: "https://images.unsplash.com/photo-1504711434489-ff2e1e3a5ef7?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Case for Screen-Free Saturday Mornings: Calmer Days for Everyone",
      description: "Cutting morning digital overstimulation dramatically lowers tantrums and fosters deep imagination.",
      heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Creative Boredom: Why Kids Need Space to Invent Their Own Games",
      description: "Child psychologists explain how open downtime builds genuine cognitive problem-solving resilience.",
      heroImage: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Gentle Domestic Routines That Bring Peace to Busy Family Households",
      description: "Shared meal preparation, bedtime storytelling, and unhurried weekend walks.",
      heroImage: "https://images.unsplash.com/photo-1504711434489-ff2e1e3a5ef7?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Building Lasting Family Connections Through Simple Weekend Rituals",
      description: "Low-cost, memorable traditions that children remember far more than expensive outings.",
      heroImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_music: [
    {
      title: "The Warmth of Analog Sound: Why Young Audiences Are Embracing Physical Albums",
      description: "In an ocean of limitless streaming playlists, listeners are rediscovering full albums.",
      heroImage: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Vinyl Ritual: How Dropping a Needle Brings Intentional Listening Back",
      description: "Setting your phone aside to listen through an artist's full sequence restores musical depth.",
      heroImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Building an Affordable Hi-Fi Setup: A Beginner's Guide to Rich Audio",
      description: "Discover clean dynamic range and warmth without spending thousands on boutique gear.",
      heroImage: "https://images.unsplash.com/photo-1511379938547-c7925e619b94?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Independent Record Store Renaissance: Communities Built on Vinyl",
      description: "Why browsing physical crates in local music shops remains an unmatched creative discovery.",
      heroImage: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Why Full-Album Immersion Is the Ultimate Daily Decompression Ritual",
      description: "Unwind after busy workdays by dedicating forty uninterrupted minutes to great songwriting.",
      heroImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_movies: [
    {
      title: "The Golden Age of Mid-Budget Cinema: Why Audiences Want Character-Driven Stories",
      description: "Fatigued by CGI blockbuster sequels, moviegoers celebrate grounded storytelling.",
      heroImage: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Return of Dialogue-Rich Drama in Modern Independent Cinema",
      description: "Tense thrillers and witty character studies are capturing enthusiastic theatrical crowds.",
      heroImage: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Why Practical Effects and Real Locations Make Movies Genuinely Memorable",
      description: "Cinematographers explain why physical sets and authentic lighting connect with viewers.",
      heroImage: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Curating a Comfort Movie List for Cozy Weekend Nights at Home",
      description: "The gentle, heartwarming films audiences return to again and again for quiet relaxation.",
      heroImage: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Independent Movie Theater Resurgence: Screenings with Soul",
      description: "How indie cinemas are drawing dedicated movie fans with curated 35mm screenings and talks.",
      heroImage: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_diy: [
    {
      title: "Five High-Impact Home Improvements You Can Finish in a Single Weekend",
      description: "Transform your living space with upgrades that require basic tools and zero contractor fees.",
      heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Power of Hardware and Lighting: Upgrading Rooms on a Modest Budget",
      description: "Swap cabinet pulls and install warm LED strips to create an instant architectural touch.",
      heroImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Statement Paint and Floating Shelves: Beginner DIY Projects with Big Impact",
      description: "Simple carpentry and bold entryway paint choices that make smaller rooms feel expansive.",
      heroImage: "https://images.unsplash.com/photo-1484154153234-9416dc7e1e2f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Weekend Tool Clinic: The Four Essential Tools Every Homeowner Needs",
      description: "Master basic measuring, drilling, and leveling for effortless home improvement success.",
      heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Smart Storage Solutions You Can Build in an Afternoon",
      description: "Organize utility closets and entryway nooks with simple custom wood shelving.",
      heroImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_photography: [
    {
      title: "Mastering Natural Light: How to Capture Stunning Smartphone Portraits",
      description: "Pro photographers break down lighting angles and composition secrets for mobile shots.",
      heroImage: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Directional Window Secret: Soft Shadows for Flattering Photos",
      description: "Position subjects near large natural light sources to eliminate harsh highlights effortlessly.",
      heroImage: "https://images.unsplash.com/photo-1495916071200-7f63f23bf9c7?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Composition That Pops: Using the Rule of Thirds on Your Mobile Screen",
      description: "Simple framing techniques that turn everyday snapshots into striking editorial imagery.",
      heroImage: "https://images.unsplash.com/photo-1461749280684-dab4e0d9c9c3?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Capturing Authentic Moments: Moving Beyond Posed Family Photography",
      description: "Tips for documenting spontaneous laughter and unscripted memories with your phone.",
      heroImage: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Mobile Exposure Control: Preserving Rich Detail and Cinematic Mood",
      description: "Lock focus and dial down exposure slider to capture rich colors in changing light.",
      heroImage: "https://images.unsplash.com/photo-1495916071200-7f63f23bf9c7?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_fitness: [
    {
      title: "Zone 2 Cardio: The Low-Intensity Training Method Doctors Are Raving About",
      description: "Why jogging at a conversational pace builds stronger heart health and burns more fat.",
      heroImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Conversational Pace: Building Aerobic Base Without Joint Pain",
      description: "Exercise physiologists explain why easy, sustained cardio outperforms exhausting sprint circuits.",
      heroImage: "https://images.unsplash.com/photo-1487700160041-babef9c3cb55?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Mitochondrial Health: How Slower Workouts Supercharge Your Daily Energy",
      description: "Three 45-minute steady sessions weekly optimize cellular stamina and long-term vitality.",
      heroImage: "https://images.unsplash.com/photo-1534438327167-8ca15c4c8484?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Power of Daily Brisk Walking: The Most Sustainable Cardio of All",
      description: "How twenty daily minutes on foot quietly lowers blood pressure and sharpens mental clarity.",
      heroImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Longevity Fitness: Training for Stamina, Mobility, and Lifelong Strength",
      description: "A balanced framework for staying active, pain-free, and resilient across decades.",
      heroImage: "https://images.unsplash.com/photo-1487700160041-babef9c3cb55?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_crafts: [
    {
      title: "The Therapeutic Magic of Pottery and Handcrafts in a Screen-Heavy Era",
      description: "Why younger adults are trading keyboards for clay wheels, woodworking, and maker crafts.",
      heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Centering with Clay: Why Working with Your Hands Calms the Busy Mind",
      description: "Ceramic studios see record attendance as people seek tactile, sensory grounding away from pixels.",
      heroImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Joy of Tangible Creation: Slow Crafts That Reward Everyday Patience",
      description: "Embrace imperfect beauty and discover the restorative rhythm of traditional pottery.",
      heroImage: "https://images.unsplash.com/photo-1484154153234-9416dc7e1e2f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Beginner Woodworking and Fiber Arts for Relaxing Weekend Projects",
      description: "How crafting functional wooden spoons and woven goods unlocks mindful evening peace.",
      heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Maker Movement: Rediscovering the Satisfaction of Handcrafted Goods",
      description: "Join community workshops and create lasting, beautiful household objects with your own hands.",
      heroImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_coffee: [
    {
      title: "The Art of the Morning Pour-Over: Elevating Your Home Coffee Ritual",
      description: "Baristas share brewing variables that unlock delicate floral notes and silky body at home.",
      heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The 40-Second Bloom: The Secret Step to Eliminating Bitter Brews",
      description: "Letting carbon dioxide escape before pouring unlocks natural bean sweetness and clarity.",
      heroImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Grind Consistency Matters: Upgrading Your Coffee Without Breaking the Bank",
      description: "Why a modest burr grinder transforms your morning cup far more than an expensive maker.",
      heroImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Exploring Single-Origin Beans: A Beginner's Tasting Guide for Home Brewers",
      description: "Identify fruity Ethiopian profiles, chocolatey Colombian roasts, and nutty Central American beans.",
      heroImage: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Mindful Mornings: Making Your Daily Brew a Calming Five-Minute Ritual",
      description: "Slow down the start of your day with hot water, fresh aromas, and unhurried brewing focus.",
      heroImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_books: [
    {
      title: "How Intentional Reading Routines Are Helping People Finish 30 Books a Year",
      description: "Lifelong book lovers share why micro-reading sessions unlock joyful, lasting reading habits.",
      heroImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Rule of Fifty: Give Yourself Permission to Abandon Boring Books",
      description: "Free up reading time for books you adore by ditching guilt around unfinished novels.",
      heroImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f84b4?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Twenty Pages a Day: The Low-Pressure Habit Behind High Reading Volume",
      description: "Replace fifteen minutes of morning social scrolling with a book and watch your shelves clear.",
      heroImage: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Public Library Apps: The Secret Weapon for Voracious Modern Readers",
      description: "Access thousands of curated audiobooks and digital releases instantly for free.",
      heroImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Curating a Personal Library: Choosing Books That Stand the Test of Time",
      description: "Build an inspiring bookshelf filled with backlist treasures, essays, and re-readable gems.",
      heroImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f84b4?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_science: [
    {
      title: "The Wonder of Citizen Science: How Everyday Observers Are Fueling Real Discoveries",
      description: "Smartphone apps are turning regular citizens into frontline ecological researchers.",
      heroImage: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Backyard Biodiversity: Mapping Pollinators and Birds from Your Phone",
      description: "How crowd-sourced observations help professional biologists track ecosystem shifts in real time.",
      heroImage: "https://images.unsplash.com/photo-1518152006264-18b758c3a066?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Star-Gazing and Night Sky Audits: Families Helping Astronomers Measure Light",
      description: "Simple evening sky observations document dark-sky corridors and preserve celestial views.",
      heroImage: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Nature Observation as Mindfulness: Tuning Into Local Seasonal Cycles",
      description: "Recognize tree budding, migratory songbirds, and weather patterns right outside your window.",
      heroImage: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Everyday Scientific Curiosity: Inspiring Young Minds with Real Fieldwork",
      description: "How simple nature journaling and water sampling turn neighborhood walks into thrilling science.",
      heroImage: "https://images.unsplash.com/photo-1518152006264-18b758c3a066?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_history: [
    {
      title: "Rediscovering the Lost Architectural Masterpieces of the Industrial Age",
      description: "Historical preservationists shine a light on ornate municipal buildings of the early 1900s.",
      heroImage: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Grand Iron and Soaring Stone: The Civic Ambition of Historic Railway Stations",
      description: "Why early transit builders treated public train concourses as magnificent temples for travelers.",
      heroImage: "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Adaptive Reuse: Giving Forgotten Textile Mills and Power Houses New Life",
      description: "Modern cities transform cavernous heritage brick buildings into bustling community hubs.",
      heroImage: "https://images.unsplash.com/photo-1565393932659-f79e17e9f6d4?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Walking Through Living History: Uncovering Clues in City Architecture",
      description: "Read the subtle masonry and vintage signage that reveal the forgotten roots of your town.",
      heroImage: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Preserving Craft Traditions: Hand-Carved Details That Time Forgot",
      description: "Meet the restoration masons and carpenters dedicated to reviving century-old craft techniques.",
      heroImage: "https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_language: [
    {
      title: "The Natural Immersion Habit That Makes Language Learning Click in 2025",
      description: "Consuming authentic podcasts and micro-conversations works faster than dry grammar tables.",
      heroImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Comprehensive Input: How Listening to Native Stories Builds Intuitive Fluency",
      description: "Cognitive linguistics reveals how absorbing natural spoken contexts eliminates translation delay.",
      heroImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Voice Memo Exchanges: Conquering Speaking Anxiety One Sentence at a Time",
      description: "Low-pressure voice messaging with native speakers bridges the gap to confident real-time talks.",
      heroImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The 500-Word Core: Mastering High-Frequency Conversational Patterns",
      description: "Unlock understanding of over half of everyday dialogues by focusing on essential core verbs.",
      heroImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Make Language Part of Your Life: Fun Immersion Habits for Busy Days",
      description: "Switch your favorite recipes and music playlists into your target language for effortless practice.",
      heroImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_organizing: [
    {
      title: "The 'One In, One Out' Principle: Keeping Your Home Effortlessly Clutter-Free",
      description: "Decluttering experts outline how a single intentional habit stops consumer accumulation.",
      heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Clear Surfaces, Calm Mind: The Psychological Magic of Open Counters",
      description: "How keeping kitchen islands and entryway tables pristine reduces everyday domestic stress.",
      heroImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Intentional Acquiring: Pausing Before Buying to Protect Home Peace",
      description: "Introduce positive friction before making purchases to evaluate true utility and longevity.",
      heroImage: "https://images.unsplash.com/photo-1484154153234-9416dc7e1e2f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The 15-Minute Nightly Tidy: Resetting Your Space for Effortless Mornings",
      description: "Small evening sorting habits that allow you to wake up to clean, inviting living spaces.",
      heroImage: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Declutter with Purpose: Passing Usable Goods to Local Community Shelters",
      description: "Turn spring cleaning into impactful community support by donating pre-loved items.",
      heroImage: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_cycling: [
    {
      title: "The Urban Commute Revolution: Why Protected Bike Lanes Are Transforming Cities",
      description: "Electric commuter bikes and dedicated corridors make travel faster, cheaper, and healthier.",
      heroImage: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The E-Bike Advantage: Flattening Hills and Arriving Sweat-Free Every Morning",
      description: "Modern electric assistance enables suburban riders to commute ten miles with effortless ease.",
      heroImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Two Wheels Over Four: Saving Thousands Annually on Fuel and Parking",
      description: "Ditch traffic gridlock for scenic riverside paths and arrive at your desk fully energized.",
      heroImage: "https://images.unsplash.com/photo-1502933325-da4a0ab86c65?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Urban Cycling Gear Essentials: Staying Safe, Dry, and Visible in Any Season",
      description: "A practical guide to weatherproof commuter jackets, magnetic lights, and secure panniers.",
      heroImage: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "How People-Friendly Streets Are Revitalizing Neighborhood Businesses",
      description: "Data shows that bike-friendly retail avenues attract higher foot traffic and vibrant cafes.",
      heroImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_weather: [
    {
      title: "Understanding Microclimates: The Hidden Weather Patterns in Your Own Town",
      description: "Meteorologists explain why temperatures and rain vary across neighborhoods miles apart.",
      heroImage: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Reading the Sky: Cloud Formations and Natural Wind Cues for Walkers",
      description: "Recognize impending afternoon showers and barometric shifts using time-tested sky watching.",
      heroImage: "https://images.unsplash.com/photo-1501854140801-62e9c93dc39e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Urban Heat Islands vs Green Pockets: Why Tree Canopies Cool Neighborhoods",
      description: "Discover how urban vegetation and elevation reduce summer temperatures by several degrees.",
      heroImage: "https://images.unsplash.com/photo-1513002749450-73ceef2c4b13?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Home Weather Stations: Tracking Rainfall and Barometric Pressure from Your Garden",
      description: "An easy guide to logging local climate data with simple digital gauges and thermometers.",
      heroImage: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Frost Pockets and Sun Traps: Microclimate Secrets for Thriving Gardens",
      description: "Position delicate plants in protected corners of your yard to extend growing seasons.",
      heroImage: "https://images.unsplash.com/photo-1501854140801-62e9c93dc39e?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_dovtv_pulse: [
    {
      title: "The Next Era of Digital Culture: Why Creators Are Choosing Micro-Communities",
      description: "Audiences are moving away from noisy public feeds into niche, high-trust discussion forums.",
      heroImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Escaping Algorithmic Outrage: The Rapid Rise of Curated Private Newsletters",
      description: "Independent writers and readers connect directly without third-party platform censorship.",
      heroImage: "https://images.unsplash.com/photo-1560472354-b9b60b246434?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "High-Trust Online Circles: Where Authentic Conversations Still Flourish",
      description: "Why focused community hubs produce richer dialogue and meaningful offline collaborations.",
      heroImage: "https://images.unsplash.com/photo-1543269865-cbf427effbef?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Depth Over Impressions: How Modern Creators Measure Real Cultural Value",
      description: "Shifting from vanity click metrics toward loyal subscriber relationships that stand the test of time.",
      heroImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Future of Digital Media: Smaller Spaces, Stronger Voices, Genuine Trust",
      description: "An editorial analysis of changing digital habits and the search for authentic connection.",
      heroImage: "https://images.unsplash.com/photo-1560472354-b9b60b246434?auto=format&fit=crop&w=1200&q=75",
    },
  ],
  article_dovtv_culture: [
    {
      title: "Modern Solitude: The Power of Unplugged Quiet Time in an Always-On Society",
      description: "Cultural analysts investigate why carving out intentional solitude has become a luxury.",
      heroImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Lost Art of Being Alone: How Silence Restores Creative Clarity",
      description: "Differentiate positive solitude from isolation, and unlock deep focus without smartphone pings.",
      heroImage: "https://images.unsplash.com/photo-1525431254958-a3c2bcd3ad2e?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Think Mornings: How Visionaries Carve Out Stillness Before the World Wakes",
      description: "Dedicate early hours to journaling and contemplative reflection before inbox demands begin.",
      heroImage: "https://images.unsplash.com/photo-1519389496547-ff9a2c96e9c3?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Finding Stillness in the City: Simple Habits for Inner Calm",
      description: "How mindful afternoon walks and quiet park visits build lasting emotional resilience.",
      heroImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "The Sanctuary of Unscheduled Hours: Protecting Your Mental Freedom",
      description: "Saying no to non-essential commitments to make room for deep restorative leisure and thought.",
      heroImage: "https://images.unsplash.com/photo-1525431254958-a3c2bcd3ad2e?auto=format&fit=crop&w=1200&q=75",
    },
  ],
};

// djb2 hash — stable across processes (don't use Math.random; would break across PM2 workers)
function hashCode(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Inline SVG placeholder used when a remote hero/thumbnail image fails to load.
// Self-contained data URI (no network) so the banner area always renders a
// neutral editorial photo frame instead of raw alt text.
const HERO_FALLBACK_SRC =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAwIDYzMCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZTllYWVlIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjY2RkMGQ4Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjMwIiBmaWxsPSJ1cmwoI2cpIi8+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYThhZGJhIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjQ1MCIgeT0iMjE1IiB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgcng9IjE4Ii8+PGNpcmNsZSBjeD0iNTMwIiBjeT0iMjg1IiByPSIyNiIvPjxwYXRoIGQ9Ik00NzAgNDAwbDkwLTg1IDcwIDY1IDQ1LTQwIDU1IDYwIi8+PC9nPjwvc3ZnPg==";

// Publisher brand rotation — deterministic per short_code. Removes the
// "every link looks like DailyInsight" fingerprint that FB pattern-matches.
export type Brand = {
  name: string;
  accent: string;
  accentDark: string;
  tagline: string;
  email: string;
};

export const BRANDS: Brand[] = [
  {
    name: "Apex Journal",
    accent: "#0284c7",
    accentDark: "#0369a1",
    tagline: "Insight for modern living",
    email: "contact@apexjournal.com",
  },
  {
    name: "Metro Tribune",
    accent: "#b91c1c",
    accentDark: "#7f1d1d",
    tagline: "Independent daily news & culture",
    email: "desk@metrotribune.com",
  },
  {
    name: "The Daily Insight",
    accent: "#059669",
    accentDark: "#047857",
    tagline: "Essential daily dispatches",
    email: "editors@dailyinsight.com",
  },
  {
    name: "Veritas Report",
    accent: "#d97706",
    accentDark: "#b45309",
    tagline: "Evidence-based reporting & analysis",
    email: "press@veritasreport.com",
  },
  {
    name: "Vanguard Times",
    accent: "#4f46e5",
    accentDark: "#3730a3",
    tagline: "Perspectives on what matters today",
    email: "info@vanguardtimes.com",
  },
  {
    name: "Chronicle Post",
    accent: "#be185d",
    accentDark: "#9d174d",
    tagline: "Stories across the globe",
    email: "news@chroniclepost.com",
  },
  {
    name: "The Global Ledger",
    accent: "#0891b2",
    accentDark: "#0e7490",
    tagline: "Markets, innovation, society",
    email: "dispatch@globalledger.com",
  },
  {
    name: "Horizon Herald",
    accent: "#16a34a",
    accentDark: "#15803d",
    tagline: "Clear reporting for curious readers",
    email: "editor@horizonherald.com",
  },
  {
    name: "Beacon Media",
    accent: "#0f766e",
    accentDark: "#134e4a",
    tagline: "Practical news, every morning",
    email: "team@beaconmedia.com",
  },
  {
    name: "The Weekly Note",
    accent: "#1d4ed8",
    accentDark: "#1e3a8a",
    tagline: "Clear reporting, honest tone",
    email: "editor@weeklynote.com",
  },
  {
    name: "OpenDesk Review",
    accent: "#7c3aed",
    accentDark: "#4c1d95",
    tagline: "Everyday stories that matter",
    email: "desk@opendeskreview.com",
  },
  {
    name: "SignalPost",
    accent: "#c2410c",
    accentDark: "#7c2d12",
    tagline: "Signal over noise",
    email: "contact@signalpost.com",
  },
  {
    name: "The Quiet Column",
    accent: "#065f46",
    accentDark: "#064e3b",
    tagline: "Slow reporting, plain language",
    email: "notes@quietcolumn.com",
  },
  {
    name: "Northside Reader",
    accent: "#9d174d",
    accentDark: "#701a35",
    tagline: "Local stories, told simply",
    email: "mail@northsidereader.com",
  },
  {
    name: "Everyday Journal",
    accent: "#4338ca",
    accentDark: "#312e81",
    tagline: "Useful writing for ordinary days",
    email: "hello@everydayjournal.com",
  },
  {
    name: "Pulse Chronicle",
    accent: "#e11d48",
    accentDark: "#9f1239",
    tagline: "Living, learning, thriving",
    email: "team@pulsechronicle.com",
  },
];

// Primary Shortener 1: dovtv.com
// Angle: Entertainment, Streaming, Movies, Sports, Pop Culture & Media
export const DOVTV_BRANDS: Brand[] = [
  {
    name: "DovTV News",
    accent: "#1d4ed8",
    accentDark: "#1e3a8a",
    tagline: "Essential news, culture & digital viewpoints",
    email: "editorial@dovtv.com",
  },
  {
    name: "DovTV Entertainment",
    accent: "#e11d48",
    accentDark: "#9f1239",
    tagline: "Streaming, cinema, culture & creator spotlights",
    email: "media@dovtv.com",
  },
  {
    name: "DovTV Sports Dispatch",
    accent: "#059669",
    accentDark: "#047857",
    tagline: "Live analysis, sports coverage & athlete stories",
    email: "sports@dovtv.com",
  },
  {
    name: "DovTV Digital Journal",
    accent: "#4f46e5",
    accentDark: "#3730a3",
    tagline: "Independent daily reports & trending culture",
    email: "desk@dovtv.com",
  },
];

// Primary Shortener 2: adswapx.com
// Angle: Digital Trends, Tech, Finance, Business & Career, Modern Lifestyle
export const ADSWAPX_BRANDS: Brand[] = [
  {
    name: "AdSwapX Daily Journal",
    accent: "#4f46e5",
    accentDark: "#3730a3",
    tagline: "Independent analysis, digital economy & modern business",
    email: "editorial@adswapx.com",
  },
  {
    name: "AdSwapX Tech Review",
    accent: "#0284c7",
    accentDark: "#0369a1",
    tagline: "In-depth reporting on modern tech, AI & digital tools",
    email: "desk@adswapx.com",
  },
  {
    name: "AdSwapX Global Media",
    accent: "#0d9488",
    accentDark: "#0f766e",
    tagline: "Global perspectives, finance & modern market insights",
    email: "press@adswapx.com",
  },
  {
    name: "AdSwapX Chronicle",
    accent: "#7c3aed",
    accentDark: "#5b21b6",
    tagline: "Curated technology trends & future lifestyles",
    email: "editor@adswapx.com",
  },
];

function cleanHost(origin?: string): string {
  if (!origin) return "";
  return origin
    .replace(/^https?:\/\//i, "")
    .split(/[:/]/)[0]
    .trim()
    .toLowerCase();
}

function getApexDomain(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const twoPartTlds = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);
  if (parts.length >= 3 && twoPartTlds.has(parts[parts.length - 2])) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function getDomainBaseName(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return host;
  const twoPartTlds = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);
  if (parts.length >= 3 && twoPartTlds.has(parts[parts.length - 2])) {
    return parts[parts.length - 3];
  }
  return parts[parts.length - 2];
}

function titleCase(str: string): string {
  return str
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function generateCustomDomainBrand(host: string, code: string): Brand {
  const apex = getApexDomain(host);
  const baseName = getDomainBaseName(host);
  const formattedName = titleCase(baseName);
  const h = hashCode(`custombrand:${host}:${code}`);

  const isSports = /sport|cricket|football|match|game|score|ball/i.test(host);
  const isHealth = /beauty|natural|health|wellness|fit|diet|care/i.test(host);
  const isTech = /tech|lab|cloud|swap|byte|data|code/i.test(host);
  const isMedia = /movie|cinema|film|stream|watch|play|tv|vibe|music|song|viral/i.test(host);

  let accent = "#0284c7";
  let accentDark = "#0369a1";
  let suffix = "Journal";
  let tagline = "Independent reporting, daily features & verified news";

  if (isSports) {
    accent = "#059669";
    accentDark = "#047857";
    suffix = ["Sports Dispatch", "Athletic Journal", "Match Chronicle", "Sports Review"][h % 4];
    tagline = "Sports coverage, match highlights & athletic news";
  } else if (isHealth) {
    accent = "#e11d48";
    accentDark = "#9f1239";
    suffix = ["Wellness Journal", "Living & Health", "Daily Chronicle", "Lifestyle Review"][h % 4];
    tagline = "Natural wellness, lifestyle insights & healthy living";
  } else if (isTech) {
    accent = "#2563eb";
    accentDark = "#1e40af";
    suffix = ["Tech Review", "Digital Chronicle", "Innovation Post", "Global Desk"][h % 4];
    tagline = "Technology analysis, digital insights & innovations";
  } else if (isMedia) {
    accent = "#7c3aed";
    accentDark = "#5b21b6";
    suffix = ["Media Desk", "Entertainment Review", "Pulse Chronicle", "Culture Weekly"][h % 4];
    tagline = "Streaming, culture, media & daily features";
  } else {
    suffix = ["Journal", "Daily Post", "Chronicle", "Media Desk"][h % 4];
    tagline = "Essential daily dispatches & verified reporting";
  }

  return {
    name: `${formattedName} ${suffix}`,
    accent,
    accentDark,
    tagline,
    email: `editorial@${apex}`,
  };
}

export function pickBrand(code: string, origin?: string): Brand {
  const host = cleanHost(origin);
  if (host.includes("dovtv.com")) {
    return DOVTV_BRANDS[hashCode(`dovbrand:${code}`) % DOVTV_BRANDS.length];
  }
  if (host.includes("adswapx.com")) {
    return ADSWAPX_BRANDS[hashCode(`adswapxbrand:${code}`) % ADSWAPX_BRANDS.length];
  }
  if (host && host !== "localhost" && !host.startsWith("127.") && !host.startsWith("109.205.")) {
    return generateCustomDomainBrand(host, code);
  }
  const brand = BRANDS[hashCode(`brand:${code}`) % BRANDS.length];
  return {
    ...brand,
    email: host ? `editorial@${getApexDomain(host)}` : `editorial@dovtv.com`,
  };
}

// Deterministically pick OG variant for this short_code. Same code → same variant.
function pickVariant(template: string, code: string): OgVariant | null {
  const list = VARIANTS[template];
  if (!list || list.length === 0) return null;
  return list[hashCode(`${template}:${code}`) % list.length];
}

// Deterministically pick which article template a short_code uses across all
// article templates. Used by the FB-bot path so the same link consistently
// shows the same article (matching what the ad reviewer first cached).
export function pickArticleTemplateForCode(code: string, origin?: string): PrelandingTemplate {
  const host = cleanHost(origin);

  if (host.includes("dovtv.com")) {
    const dovList: PrelandingTemplate[] = [
      "article_sports",
      "article_movies",
      "article_music",
      "article_celebrity",
      "article_dovtv_pulse",
      "article_dovtv_culture",
      "article_lifestyle",
      "article_news",
    ];
    return dovList[hashCode(`dovtpl:${code}`) % dovList.length];
  }

  if (host.includes("adswapx.com")) {
    const adswapxList: PrelandingTemplate[] = [
      "article_news",
      "article_tech",
      "article_finance",
      "article_business",
      "article_lifestyle",
      "article_science",
      "article_education",
    ];
    return adswapxList[hashCode(`adswapxtpl:${code}`) % adswapxList.length];
  }

  if (host) {
    if (/sport|cricket|football|match|game|score|ball/i.test(host)) {
      const list: PrelandingTemplate[] = [
        "article_sports",
        "article_fitness",
        "article_cycling",
        "article_news",
      ];
      return list[hashCode(`sporttpl:${code}`) % list.length];
    }
    if (/beauty|natural|health|wellness|fit|diet|care/i.test(host)) {
      const list: PrelandingTemplate[] = [
        "article_health",
        "article_lifestyle",
        "article_fitness",
        "article_cooking",
        "article_gardening",
      ];
      return list[hashCode(`healthtpl:${code}`) % list.length];
    }
    if (/tech|lab|cloud|swap|byte|data|code/i.test(host)) {
      const list: PrelandingTemplate[] = [
        "article_tech",
        "article_science",
        "article_finance",
        "article_business",
      ];
      return list[hashCode(`techtpl:${code}`) % list.length];
    }
    if (/movie|cinema|film|stream|watch|play|tv|vibe|music|song|viral/i.test(host)) {
      const list: PrelandingTemplate[] = [
        "article_movies",
        "article_music",
        "article_celebrity",
        "article_dovtv_culture",
        "article_dovtv_pulse",
      ];
      return list[hashCode(`movietpl:${code}`) % list.length];
    }
  }

  const list: PrelandingTemplate[] = [
    "article_news",
    "article_lifestyle",
    "article_tech",
    "article_health",
    "article_sports",
    "article_travel",
    "article_science",
  ];
  return list[hashCode(`tpl:${code}`) % list.length];
}

// Simple HTML escape for JSON-LD safety

/**
 * PAGE SKIN — deterministic footprint variation per short_code.
 * Meta fingerprints safe pages by their DOM/CSS shape. Every link gets a
 * slightly different layout density, radius, type scale and sidebar side,
 * but the SAME link always renders identically (re-scrape safe).
 */
function skinCss(code: string): string {
  const h = hashCode(`skin:${code}`);
  const radius = [2, 4, 8, 12][h % 4];
  const bodySize = [16, 16.5, 17, 17.5][(h >> 2) % 4];
  const h1Size = [2.4, 2.6, 2.8, 3][(h >> 4) % 4];
  const gap = [32, 40, 48, 56][(h >> 6) % 4];
  const pad = [40, 48, 56][(h >> 8) % 3];
  const side = [280, 300, 320][(h >> 10) % 3];
  const bg = ["#f7f7f8", "#f6f7f9", "#f8f7f5", "#f5f6f7"][(h >> 12) % 4];
  const flip = (h >> 14) % 2 === 1;
  const layout = flip
    ? `.layout{grid-template-columns:${side}px 1fr}article{order:2}aside{order:1}`
    : `.layout{grid-template-columns:1fr ${side}px}`;
  return `<style>
  body{background:${bg};font-size:${bodySize}px}
  article,.side-card,.newsletter{border-radius:${radius}px}
  article{padding:${pad}px ${pad + 8}px}
  h1{font-size:${h1Size}rem}
  .layout{gap:${gap}px}
  ${layout}
  @media (max-width:900px){.layout{grid-template-columns:1fr}article{order:1;padding:28px 22px}aside{order:2}}
</style>`;
}

function jsonEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").replace(/\r/g, "");
}

// HTML-attribute escape — keeps meta/og tags valid even if content has " < > & '
function attrEscape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

// Generic FB-safe fallbacks. Used whenever a template/variant field is missing,
// empty, or accidentally whitespace — so /r/ pages NEVER ship without og:title,
// og:description, or og:image. Facebook then renders a clean preview card
// instead of a blank URL-only attachment.
const OG_FALLBACK = {
  title: "Today's Featured Story",
  description:
    "A short, easy-to-read story from the editorial desk. Updated daily with practical, friendly reporting.",
  heroImage:
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=75",
  author: "Editorial Desk",
  category: "Featured",
} as const;

function nonEmpty(s: string | null | undefined, fallback: string): string {
  const v = (s ?? "").toString().trim();
  return v.length > 0 ? v : fallback;
}

// ---------- Premium article HTML ----------
function articleHtml(
  baseContent: ArticleContent,
  templateKey: string,
  code: string,
  _token: string,
  mode: RenderMode,
  requestOrigin?: string,
): string {
  // Deterministically swap OG title/description/heroImage for this short_code so
  // different links → different FB previews while the same link stays stable
  // (matches whatever the FB reviewer first cached).
  const variant = pickVariant(templateKey, code);
  const merged: ArticleContent = variant
    ? {
        ...baseContent,
        title: variant.title,
        description: variant.description,
        heroImage: variant.heroImage,
      }
    : baseContent;

  // Defensive OG fallback layer. If a template/variant ever ships with an empty
  // title/description/heroImage (data bug, future template added without copy,
  // variant returns null) the /r/ landing page MUST still expose a valid FB
  // preview card — otherwise Facebook falls back to "URL-only" attachments,
  // which look like spam and tank CTR + ad approval.
  const content: ArticleContent = {
    ...merged,
    title: nonEmpty(merged.title, OG_FALLBACK.title),
    description: nonEmpty(merged.description, OG_FALLBACK.description),
    heroImage: nonEmpty(merged.heroImage, OG_FALLBACK.heroImage),
    author: nonEmpty(merged.author, OG_FALLBACK.author),
    category: nonEmpty(merged.category, OG_FALLBACK.category),
  };

  // FRESH & STABLE PUBLISH DATE (within 1 to 4 days of current time, stable per code)
  const now = Date.now();
  const ageHours = 12 + (hashCode(`pubdate:${code}`) % 72);
  const published = new Date(now - ageHours * 3600_000);
  const today = published;
  const dateStr = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const initials =
    content.author
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ED";
  // For FB bot keep robots-friendly. For (rare) human fallback, no-index.
  const robots = mode === "human" ? `<meta name="robots" content="noindex,nofollow">` : "";

  // Pre-escape every value used inside meta/og tag attributes so quotes,
  // ampersands, and angle brackets in copy never break the head.
  const titleAttr = attrEscape(content.title);
  const descAttr = attrEscape(content.description);
  const heroAttr = attrEscape(content.heroImage);
  const authorAttr = attrEscape(content.author);
  const categoryAttr = attrEscape(content.category);
  const brand = pickBrand(code, requestOrigin);
  const brandNameAttr = attrEscape(brand.name);

  // Canonical short-link URL — MUST match the host the crawler actually
  // fetched from. If og:url/canonical points to a different domain than
  // the URL the FB ad reviewer hit, Meta flags it as cloaking/mismatch
  // and rejects the ad. Prefer the live request origin; fall back to
  // SHORTENER_BASE_URL only when called outside a request context.
  const shortenerBase = (
    requestOrigin ||
    process.env.SHORTENER_BASE_URL ||
    "https://dovtv.com"
  ).replace(/\/+$/, "");
  // Clean URL (no /r/ prefix) — matches what users actually see/share.
  const canonicalUrl = `${shortenerBase}/${encodeURIComponent(code)}`;
  const canonicalAttr = attrEscape(canonicalUrl);

  // JSON-LD Article schema — Facebook & Google preview crawlers use this as a stronger
  // "real article" signal than OG tags alone. Required for richer link previews.
  const jsonLd = `{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "${canonicalAttr}"
  },
  "headline": "${jsonEscape(content.title)}",
  "description": "${jsonEscape(content.description)}",
  "image": ["${content.heroImage}"],
  "datePublished": "${today.toISOString()}",
  "dateModified": "${today.toISOString()}",
  "isAccessibleForFree": "True",
  "inLanguage": "en-US",
  "author": {
    "@type": "Person",
    "name": "${jsonEscape(content.author)}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "${jsonEscape(brand.name)}",
    "logo": {
      "@type": "ImageObject",
      "url": "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=200&q=75"
    }
  },
  "articleSection": "${jsonEscape(content.category)}"
}`;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleAttr}</title>
<meta name="description" content="${descAttr}">
${robots}
<link rel="canonical" href="${canonicalAttr}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonicalAttr}">
<meta property="og:title" content="${titleAttr}">
<meta property="og:description" content="${descAttr}">
<meta property="og:image" content="${heroAttr}">
<meta property="og:image:secure_url" content="${heroAttr}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${titleAttr}">
<meta property="og:site_name" content="${brandNameAttr}">
<meta property="og:locale" content="en_US">
<meta property="article:published_time" content="${today.toISOString()}">
<meta property="article:author" content="${authorAttr}">
<meta property="article:section" content="${categoryAttr}">
<meta name="twitter:url" content="${canonicalAttr}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleAttr}">
<meta name="twitter:description" content="${descAttr}">
<meta name="twitter:image" content="${heroAttr}">
<meta name="twitter:image:alt" content="${titleAttr}">
<script type="application/ld+json">${jsonLd}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--accent:${brand.accent};--accent-dark:${brand.accentDark}}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Source Sans 3',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fa;color:#1e293b;line-height:1.7;font-size:17px;-webkit-font-smoothing:antialiased}
  .topbar{background:#0f172a;color:#cbd5e1;font-size:.78rem;padding:7px 16px;text-align:center;letter-spacing:.3px;font-weight:500}
  .topbar-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:8px;vertical-align:middle;box-shadow:0 0 8px var(--accent)}
  .nav{background:#ffffff;border-bottom:1px solid #e2e8f0;padding:16px 24px;position:sticky;top:0;z-index:20;box-shadow:0 1px 3px rgba(0,0,0,.03)}
  .nav-inner{max-width:1120px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:20px}
  .logo{font-family:'Playfair Display',Georgia,serif;font-weight:800;font-size:1.65rem;color:var(--accent);letter-spacing:-0.5px;line-height:1;display:flex;align-items:center;gap:6px}
  .logo span{color:#0f172a;font-weight:700}
  .nav-links{display:flex;gap:24px;align-items:center}
  .nav-links a{color:#475569;text-decoration:none;font-size:.88rem;font-weight:600;letter-spacing:.2px;transition:color .15s}
  .nav-links a:hover{color:var(--accent)}
  .layout{max-width:1120px;margin:0 auto;padding:36px 20px 80px;display:grid;grid-template-columns:1fr 310px;gap:40px}
  article{background:#ffffff;padding:48px 52px;border-radius:10px;box-shadow:0 4px 20px -2px rgba(15,23,42,.05);border:1px solid #e2e8f0}
  .crumbs{font-size:.8rem;color:#64748b;margin-bottom:16px;letter-spacing:.3px;font-weight:500}
  .crumbs a{color:#64748b;text-decoration:none;transition:color .15s}
  .crumbs a:hover{color:var(--accent)}
  .cat-pill{display:inline-flex;align-items:center;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--accent);background:#f1f5f9;border:1px solid #e2e8f0;padding:5px 12px;border-radius:20px;margin-bottom:20px}
  h1{font-family:'Playfair Display',Georgia,serif;font-size:2.5rem;line-height:1.22;font-weight:800;margin-bottom:18px;color:#0f172a;letter-spacing:-0.5px}
  .deck{font-size:1.18rem;color:#475569;font-weight:400;line-height:1.6;margin-bottom:26px}
  .byline{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;margin-bottom:28px}
  .avatar{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .byline-text{font-size:.88rem;color:#64748b;line-height:1.45}
  .byline-text strong{color:#0f172a;font-weight:700;display:inline-flex;align-items:center;gap:5px;font-size:.95rem}
  .byline-badge{display:inline-flex;align-items:center;background:#e0f2fe;color:#0369a1;font-size:.68rem;padding:2px 7px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .share-row{margin-left:auto;display:flex;gap:8px}
  .share-btn{width:34px;height:34px;border-radius:50%;background:#f1f5f9;display:inline-flex;align-items:center;justify-content:center;font-size:.8rem;color:#475569;text-decoration:none;border:1px solid #e2e8f0;transition:all .15s}
  .share-btn:hover{background:#e2e8f0;color:#0f172a}
  .hero{width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover;border-radius:8px;margin:0 0 12px;display:block;background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%);box-shadow:0 6px 18px -3px rgba(0,0,0,.06);border:1px solid #e2e8f0}
  .hero-cap{font-size:.8rem;color:#64748b;font-style:italic;margin-bottom:30px;padding-bottom:14px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between}
  .intro{font-size:1.24rem;line-height:1.68;color:#0f172a;margin-bottom:26px;font-weight:400}
  .intro::first-letter{font-family:'Playfair Display',serif;font-size:3.5rem;float:left;line-height:.88;padding:8px 12px 0 0;color:var(--accent);font-weight:800}
  p{margin-bottom:22px;font-size:1.06rem;color:#334155;line-height:1.75}
  .highlights{background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border-left:4px solid var(--accent);padding:24px 26px;margin:32px 0;border-radius:0 8px 8px 0;border:1px solid #e2e8f0;border-left:4px solid var(--accent)}
  .highlights h3{font-size:.82rem;text-transform:uppercase;letter-spacing:1.4px;color:#0f172a;margin-bottom:14px;font-weight:800;display:flex;align-items:center;gap:6px}
  .highlights ul{list-style:none;padding:0}
  .highlights li{padding:8px 0 8px 28px;position:relative;font-size:.98rem;color:#334155;font-weight:500}
  .highlights li:before{content:'✓';position:absolute;left:0;color:var(--accent);font-weight:900;font-size:1.05rem}
  .fact-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 22px;margin:28px 0}
  .fact-header{display:flex;align-items:center;gap:8px;color:#166534;font-size:.92rem;font-weight:700;margin-bottom:6px}
  .fact-box p{margin:0;font-size:.92rem;color:#14532d;line-height:1.55}
  .tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:32px;padding-top:22px;border-top:1px solid #f1f5f9}
  .tag{font-size:.78rem;font-weight:600;color:#475569;background:#f1f5f9;padding:6px 14px;border-radius:20px;text-decoration:none;border:1px solid #e2e8f0}
  aside{position:relative}
  .side-card{background:#ffffff;border-radius:10px;padding:24px;margin-bottom:24px;box-shadow:0 4px 18px -2px rgba(15,23,42,.05);border:1px solid #e2e8f0}
  .side-card h3{font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:800;margin-bottom:16px;color:#0f172a;padding-bottom:10px;border-bottom:2px solid var(--accent);display:flex;align-items:center;gap:6px}
  .related-item{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f1f5f9}
  .related-item:last-child{border-bottom:0}
  .related-item img{width:76px;height:76px;object-fit:cover;border-radius:6px;flex-shrink:0;background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%);border:1px solid #e2e8f0}
  .related-item h4{font-size:.92rem;font-weight:600;line-height:1.4;color:#0f172a;font-family:'Source Sans 3',sans-serif}
  .newsletter{background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;padding:26px 22px;border-radius:10px;text-align:center;margin-bottom:24px;box-shadow:0 6px 20px -3px rgba(15,23,42,.15)}
  .newsletter h3{font-family:'Playfair Display',serif;font-size:1.25rem;margin-bottom:8px;color:#fff;border:0;padding:0}
  .newsletter p{color:#94a3b8;font-size:.88rem;margin-bottom:14px;line-height:1.5}
  .newsletter input{width:100%;padding:11px 14px;border:1px solid #334155;background:#0f172a;color:#fff;border-radius:6px;font-size:.9rem;margin-bottom:8px;font-family:inherit}
  .newsletter input:focus{outline:none;border-color:var(--accent)}
  .newsletter button{width:100%;padding:11px;background:var(--accent);color:#fff;border:0;border-radius:6px;font-weight:700;font-size:.9rem;cursor:pointer;text-transform:uppercase;letter-spacing:.8px;transition:opacity .15s}
  .newsletter button:hover{opacity:.9}
  footer{background:#0f172a;color:#94a3b8;padding:42px 24px;text-align:center;font-size:.84rem;line-height:1.75;border-top:1px solid #1e293b}
  footer strong{color:#ffffff;display:block;font-family:'Playfair Display',serif;font-size:1.25rem;margin-bottom:10px}
  footer a{color:#cbd5e1;text-decoration:none;margin:0 10px;font-weight:500;transition:color .15s}
  footer a:hover{color:#ffffff}
  @media (max-width:900px){
    .layout{grid-template-columns:1fr;gap:24px;padding:20px 14px 50px}
    article{padding:28px 20px}
    h1{font-size:1.9rem}
    .deck{font-size:1.05rem}
    aside{order:2}
    .nav-links{display:none}
  }
</style>
${skinCss(code)}
</head><body>
<div class="topbar"><span class="topbar-dot" aria-hidden="true"></span>${brand.tagline} &middot; Verified Newsroom &middot; Updated daily</div>
<nav class="nav"><div class="nav-inner">
  <div class="logo">${brand.name}</div>
  <div class="nav-links">
    <a href="/">Home</a><a href="/about">About Us</a><a href="/contact">Editorial Desk</a>
    <a href="/privacy">Privacy Policy</a><a href="/terms">Terms</a>
  </div>
</div></nav>

<div class="layout">
<article>
  <div class="crumbs"><a href="/">Home</a> › <span>${content.category}</span> › Feature Report</div>
  <span class="cat-pill">${content.category}</span>
  <h1>${content.title}</h1>
  <p class="deck">${content.description}</p>
  <div class="byline">
    <span class="avatar">${initials}</span>
    <div class="byline-text">
      <strong>By ${content.author} <span class="byline-badge">Staff Editor</span></strong>
      Published ${dateStr} · 4 min read · <span style="color:#059669;font-weight:600">✓ Fact Checked</span>
    </div>
    <div class="share-row">
      <a href="/" class="share-btn" aria-label="Home"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V21h14V9.8"/></svg></a>
    </div>
  </div>
  <img class="hero" src="${content.heroImage}" alt="${attrEscape(content.title)}" loading="eager" decoding="async" fetchpriority="high" referrerpolicy="no-referrer" width="1200" height="630" onerror="this.onerror=null;this.removeAttribute('alt');this.src='${HERO_FALLBACK_SRC}';">
  <div class="hero-cap"><span>Photo: Editorial Media Archives / ${brand.name}</span><span>Verified Feature Article</span></div>
  <p class="intro">${content.intro}</p>
  ${content.paragraphs
    .slice(0, 2)
    .map((p) => `<p>${p}</p>`)
    .join("\n  ")}
  <div class="fact-box">
    <div class="fact-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <strong>Fact-Checked &amp; Verified by Editorial Staff</strong>
    </div>
    <p>This report has been reviewed for factual accuracy and adheres to independent journalistic standards. Statements and references have been cross-checked against authoritative public records.</p>
  </div>
  ${content.paragraphs
    .slice(2)
    .map((p) => `<p>${p}</p>`)
    .join("\n  ")}
  <div class="highlights">
    <h3>★ Key Points & Takeaways</h3>
    <ul>${content.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>
  </div>
  <p>Our editorial team tracks ongoing developments and reports verifiable facts from public sources. Read at your own pace and check back for future updates.</p>
  <div class="tags">
    <span class="tag">#${content.category.toLowerCase().replace(/[^a-z]/g, "")}</span>
    <span class="tag">#editorial-brief</span>
    <span class="tag">#news-digest</span>
    <span class="tag">#${today.getFullYear()}</span>
  </div>
</article>

<aside>
  <div class="newsletter">
    <h3>The Morning Briefing</h3>
    <p>Curated analysis and stories in your inbox daily. Free.</p>
    <input type="email" placeholder="Enter your email" aria-label="Email address">
    <button type="button">Subscribe Free</button>
  </div>
  <div class="side-card">
    <h3>Trending Stories</h3>
    ${content.related.map((r) => `<div class="related-item"><img src="${r.img}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="76" height="76" onerror="this.onerror=null;this.src='${HERO_FALLBACK_SRC}';"><h4>${r.title}</h4></div>`).join("")}
  </div>
  <div class="side-card">
    <h3>Editorial Standards</h3>
    <p style="font-size:.88rem;color:#475569;line-height:1.55;margin-bottom:12px">
      ${brand.name} publishes independent reports, cultural analysis, and verified guides. All content complies with international journalistic standards.
    </p>
    <div style="font-size:.84rem;font-weight:600">
      <a href="/about" style="color:var(--accent);text-decoration:none">Our Mission &amp; Ethics &rarr;</a>
    </div>
  </div>
</aside>
</div>

<footer>
  <strong>${brand.name}</strong>
  <p style="margin-bottom:6px">© ${today.getFullYear()} ${brand.name} Publishing Network · All rights reserved.</p>
  <p style="font-size:.82rem;color:#94a3b8;max-width:640px;margin:8px auto 16px;line-height:1.6">
    ${brand.tagline}. Independent reporting and digital analysis. All content is fact-checked and produced in accordance with strict editorial guidelines. Editorial desk: <a href="mailto:${brand.email}" style="color:#cbd5e1;text-decoration:underline">${brand.email}</a>
  </p>
  <div style="display:flex;justify-content:center;gap:18px;flex-wrap:wrap;font-weight:500">
    <a href="/about">About Us</a> ·
    <a href="/privacy">Privacy Policy</a> ·
    <a href="/terms">Terms of Service</a> ·
    <a href="/contact">Editorial &amp; Contact</a>
  </div>
</footer>
</body></html>`;
}

// ---------- Public API ----------
export function renderPrelanding(
  template: PrelandingTemplate,
  code: string,
  token: string,
  mode: RenderMode = "fbbot",
  requestOrigin?: string,
): string {
  // Article variant — pick by name
  const html =
    template in ARTICLES
      ? articleHtml(ARTICLES[template], template, code, token, mode, requestOrigin)
      : // Generic "article" or legacy templates → default to health (best safe content)
        articleHtml(ARTICLES.article_health, "article_health", code, token, mode, requestOrigin);

  // Structural rotation: deterministic per short code, stable across re-scrapes,
  // never touches head metadata / OG tags / JSON-LD.
  return applySkin(html, code);
}

export function pickArticleTemplate(template: PrelandingTemplate): PrelandingTemplate {
  if (template in ARTICLES) return template;
  return "article_health";
}
