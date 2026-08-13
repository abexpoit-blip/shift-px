/**
 * AdsPx brand mark — premium animated monogram.
 * Layered gradient tile featuring:
 *   • Rotating conic-style aurora ring (outer premium halo)
 *   • Sweeping diagonal sheen across the tile
 *   • Crisp custom "Px" monogram
 *   • Twinkling pixel corner accents (fintech / pixel motif)
 *   • Subtle breathing glow
 */
type LogoMarkProps = {
  className?: string;
  glow?: boolean;
};

function MarkTile({ idPrefix }: { idPrefix: string }) {
  const gid = `${idPrefix}-tile`;
  const sid = `${idPrefix}-sheen`;
  const rid = `${idPrefix}-ring`;
  const cid = `${idPrefix}-clip`;
  return (
    <>
      <defs>
        {/* Base tile gradient */}
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5">
            <animate
              attributeName="stop-color"
              values="#4f46e5;#6366f1;#7c3aed;#4f46e5"
              dur="6s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="55%" stopColor="#7c3aed">
            <animate
              attributeName="stop-color"
              values="#7c3aed;#a855f7;#ec4899;#7c3aed"
              dur="6s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="#ec4899">
            <animate
              attributeName="stop-color"
              values="#ec4899;#f472b6;#4f46e5;#ec4899"
              dur="6s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>

        {/* Sheen */}
        <linearGradient id={sid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Outer rotating aurora ring gradient */}
        <linearGradient id={rid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#ec4899" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.9" />
        </linearGradient>

        <clipPath id={cid}>
          <rect width="40" height="40" rx="11" />
        </clipPath>
      </defs>

      {/* Outer rotating halo ring (behind tile) */}
      <g style={{ transformOrigin: "20px 20px" }}>
        <rect
          x="-1"
          y="-1"
          width="42"
          height="42"
          rx="12"
          fill="none"
          stroke={`url(#${rid})`}
          strokeWidth="1.2"
          opacity="0.9"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 20 20"
            to="360 20 20"
            dur="8s"
            repeatCount="indefinite"
          />
        </rect>
      </g>

      {/* Base rounded tile */}
      <rect width="40" height="40" rx="11" fill={`url(#${gid})`}>
        <animate
          attributeName="opacity"
          values="0.96;1;0.96"
          dur="3.6s"
          repeatCount="indefinite"
        />
      </rect>

      {/* Sweeping sheen */}
      <g clipPath={`url(#${cid})`}>
        <rect x="-40" y="0" width="22" height="40" fill={`url(#${sid})`} transform="skewX(-18)">
          <animate
            attributeName="x"
            values="-40;60"
            dur="4.5s"
            repeatCount="indefinite"
          />
        </rect>
      </g>

      {/* Glass inner border */}
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="10.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.3"
      />

      {/* Monogram "Px" */}
      <g clipPath={`url(#${cid})`}>
        {/* P */}
        <path
          d="M10 10 h6.6 a5.4 5.4 0 0 1 0 10.8 h-3.4 v9.2 h-3.2 z M13.2 12.8 v5.2 h3.4 a2.6 2.6 0 0 0 0 -5.2 z"
          fill="#fff"
        />
        {/* x */}
        <path
          d="M20.6 18.4 h3.1 l2.5 3.6 l2.5 -3.6 h3.1 l -3.95 5.7 l 4.15 6 h -3.2 l -2.6 -3.9 l -2.6 3.9 h -3.2 l 4.15 -6 z"
          fill="#fff"
        />
      </g>

      {/* Twinkling pixel accents at corners */}
      <g>
        <rect x="4.5" y="4.5" width="2" height="2" rx="0.4" fill="#fff" opacity="0.9">
          <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" repeatCount="indefinite" />
        </rect>
        <rect x="33.5" y="4.5" width="1.6" height="1.6" rx="0.3" fill="#fff" opacity="0.7">
          <animate attributeName="opacity" values="1;0.15;1" dur="2.4s" begin="0.4s" repeatCount="indefinite" />
        </rect>
        <rect x="33.5" y="33.5" width="2.2" height="2.2" rx="0.4" fill="#fff" opacity="0.85">
          <animate attributeName="opacity" values="0.25;1;0.25" dur="2.4s" begin="0.8s" repeatCount="indefinite" />
        </rect>
        <rect x="5" y="33.6" width="1.4" height="1.4" rx="0.3" fill="#fff" opacity="0.6">
          <animate attributeName="opacity" values="1;0.2;1" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
        </rect>
      </g>
    </>
  );
}

export function AdspxMark({ className, glow = true }: LogoMarkProps) {
  return (
    <svg
      viewBox="-2 -2 44 44"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AdsPx"
      className={`block h-8 w-8 shrink-0 ${className ?? ""}`}
      style={
        glow
          ? { filter: "drop-shadow(0 8px 18px oklch(0.55 0.22 280 / 32%))" }
          : undefined
      }
    >
      <MarkTile idPrefix="adspx-mark" />
    </svg>
  );
}

export function AdspxWordmark({
  className,
  imgClassName,
}: {
  className?: string;
  imgClassName?: string;
}) {
  const sizeClass = imgClassName ?? "h-9 w-auto";
  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      <svg
        viewBox="-2 -2 172 44"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="AdsPx"
        className={sizeClass}
      >
        <defs>
          <linearGradient id="adspx-word-px" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5">
              <animate
                attributeName="stop-color"
                values="#4f46e5;#7c3aed;#ec4899;#4f46e5"
                dur="5s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#ec4899">
              <animate
                attributeName="stop-color"
                values="#ec4899;#4f46e5;#7c3aed;#ec4899"
                dur="5s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        <MarkTile idPrefix="adspx-word" />

        <text
          x="50"
          y="27"
          fontFamily="Outfit, Inter, system-ui, sans-serif"
          fontWeight="700"
          fontSize="22"
          letterSpacing="-0.6"
          fill="currentColor"
        >
          Ads
        </text>
        <text
          x="97"
          y="27"
          fontFamily="Outfit, Inter, system-ui, sans-serif"
          fontWeight="800"
          fontSize="22"
          letterSpacing="-0.6"
          fill="url(#adspx-word-px)"
        >
          Px
        </text>
        <circle cx="140" cy="26" r="2" fill="oklch(0.72 0.20 340)">
          <animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>
    </span>
  );
}
