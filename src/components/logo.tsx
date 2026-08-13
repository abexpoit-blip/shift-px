type LogoProps = {
  className?: string;
  title?: string;
  /** Wrap the logo in an animated radial halo for premium glow. */
  glow?: boolean;
  /** Use smaller halo radius — good for sidebar / inline contexts. */
  glowSize?: "sm" | "md";
};

export function Logo({
  className,
  title = "LinkShield",
  glow = false,
  glowSize = "md",
}: LogoProps) {
  const svg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id="ls-logo-g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path
        d="M32 3 L57 11 V31 C57 45 46 56 32 61 C18 56 7 45 7 31 V11 Z"
        fill="url(#ls-logo-g)"
      />
      <g
        stroke="#ffffff"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M27 28 L22.5 32.5 a6 6 0 0 0 8.5 8.5 L35.5 36.5" />
        <path d="M37 36 L41.5 31.5 a6 6 0 0 0 -8.5 -8.5 L28.5 27.5" />
        <path d="M26 38 L38 26" />
      </g>
    </svg>
  );

  if (!glow) return svg;

  return (
    <span
      className={`logo-halo ${glowSize === "sm" ? "logo-halo-sm" : ""} inline-flex items-center justify-center`}
    >
      {svg}
    </span>
  );
}
