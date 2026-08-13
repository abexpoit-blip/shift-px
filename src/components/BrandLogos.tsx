// Inline SVG brand marks used in the Sponsors / Partners section.
// Each is a small self-contained SVG so we don't depend on external assets.

type Props = { className?: string };

export function FacebookLogo({ className = "h-7 w-7" }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Facebook" role="img">
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.017 1.792-4.683 4.533-4.683 1.313 0 2.686.235 2.686.235v2.965h-1.514c-1.49 0-1.955.93-1.955 1.886v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

export function AdsterraLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 140 28" className={className} aria-label="Adsterra" role="img">
      <defs>
        <linearGradient id="ads-g" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FF4D2D" />
          <stop offset="1" stopColor="#FF8A1F" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ads-g)"
        d="M14 2L2 24h5.4l2.1-4.2h9l2.1 4.2H26L14 2zm-2.2 13l2.2-4.5L16.2 15h-4.4z"
      />
      <text
        x="32"
        y="20"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="15"
        fontWeight="700"
        fill="currentColor"
      >
        Adsterra
      </text>
    </svg>
  );
}

export function PropellerAdsLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 160 28" className={className} aria-label="PropellerAds" role="img">
      <circle cx="14" cy="14" r="11" fill="#00B0FF" />
      <path
        d="M14 6 L17 14 L14 22 L11 14 Z M6 14 L14 11 L22 14 L14 17 Z"
        fill="#fff"
      />
      <text x="32" y="20" fontFamily="ui-sans-serif" fontSize="15" fontWeight="700" fill="currentColor">
        PropellerAds
      </text>
    </svg>
  );
}

export function MonetagLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 130 28" className={className} aria-label="Monetag" role="img">
      <rect x="2" y="4" width="20" height="20" rx="5" fill="#7C3AED" />
      <text x="12" y="20" textAnchor="middle" fontFamily="ui-sans-serif" fontSize="14" fontWeight="800" fill="#fff">M</text>
      <text x="28" y="20" fontFamily="ui-sans-serif" fontSize="15" fontWeight="700" fill="currentColor">Monetag</text>
    </svg>
  );
}

export function MediavineLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 140 28" className={className} aria-label="Mediavine" role="img">
      <path d="M2 22 L8 6 L14 18 L20 6 L26 22" fill="none" stroke="#00C896" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <text x="32" y="20" fontFamily="ui-sans-serif" fontSize="15" fontWeight="700" fill="currentColor">Mediavine</text>
    </svg>
  );
}

export function GoogleAdsLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 150 28" className={className} aria-label="Google Ads" role="img">
      <path d="M9 22 L17 8 L22 16 L14 22 Z" fill="#FBBC04" />
      <path d="M14 22 L22 8 L26 16 L18 22 Z" fill="#34A853" />
      <circle cx="9" cy="20" r="3" fill="#4285F4" />
      <text x="32" y="20" fontFamily="ui-sans-serif" fontSize="15" fontWeight="700" fill="currentColor">Google Ads</text>
    </svg>
  );
}

export function ClickaduLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 140 28" className={className} aria-label="Clickadu" role="img">
      <circle cx="14" cy="14" r="10" fill="none" stroke="#EF4444" strokeWidth="3" />
      <circle cx="14" cy="14" r="3" fill="#EF4444" />
      <text x="32" y="20" fontFamily="ui-sans-serif" fontSize="15" fontWeight="700" fill="currentColor">Clickadu</text>
    </svg>
  );
}

export function HilltopAdsLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 150 28" className={className} aria-label="HilltopAds" role="img">
      <path d="M2 22 L10 10 L16 18 L22 6 L26 22 Z" fill="#0EA5E9" />
      <text x="32" y="20" fontFamily="ui-sans-serif" fontSize="15" fontWeight="700" fill="currentColor">HilltopAds</text>
    </svg>
  );
}

export function AdMavenLogo({ className = "h-7" }: Props) {
  return (
    <svg viewBox="0 0 140 28" className={className} aria-label="AdMaven" role="img">
      <path d="M14 4 L24 22 L14 18 L4 22 Z" fill="#F59E0B" />
      <text x="32" y="20" fontFamily="ui-sans-serif" fontSize="15" fontWeight="700" fill="currentColor">AdMaven</text>
    </svg>
  );
}

export const PARTNER_LOGOS = [
  { name: "Facebook",     Comp: FacebookLogo,     note: "Traffic source we protect for" },
  { name: "Adsterra",     Comp: AdsterraLogo,     note: "Direct CPM / popunder partner" },
  { name: "PropellerAds", Comp: PropellerAdsLogo, note: "Push & onclick partner" },
  { name: "Monetag",      Comp: MonetagLogo,      note: "Smart-link partner" },
  { name: "Mediavine",    Comp: MediavineLogo,    note: "Premium display sponsor" },
  { name: "Google Ads",   Comp: GoogleAdsLogo,    note: "Search & display sponsor" },
  { name: "Clickadu",     Comp: ClickaduLogo,     note: "Video & popunder partner" },
  { name: "HilltopAds",   Comp: HilltopAdsLogo,   note: "Direct-link partner" },
  { name: "AdMaven",      Comp: AdMavenLogo,      note: "Pop & native partner" },
];
