/**
 * AdsPx brand mark — Advanced Animated 3D Glass Prism & Neon Aurora Emblem.
 * Fully transparent background, matching site aesthetic (Indigo/Violet/Electric Cyan/Hot Magenta).
 * Features:
 *   • Dual counter-rotating neon laser halo rings
 *   • Faceted refractive glass shield prism with animated caustics
 *   • Glowing electric quantum core with dynamic color-shift
 *   • Twinkling hyper-speed particle accents
 *   • Sleek modern typography with animated gradient
 */
type LogoMarkProps = {
  className?: string;
  glow?: boolean;
  size?: number;
};

export function AdspxMark({ className = "h-8 w-8", glow = true }: LogoMarkProps) {
  const id = "adspx-mark-" + Math.random().toString(36).slice(2, 6);
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AdsPx Logo"
      className={`block shrink-0 ${className}`}
      style={glow ? { filter: "drop-shadow(0 0 14px rgba(99, 102, 241, 0.45))" } : undefined}
    >
      <defs>
        {/* Core Electric Gradient */}
        <linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00F5FF">
            <animate
              attributeName="stop-color"
              values="#00F5FF;#6366F1;#D946EF;#00F5FF"
              dur="4s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor="#6366F1">
            <animate
              attributeName="stop-color"
              values="#6366F1;#D946EF;#00F5FF;#6366F1"
              dur="4s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="#D946EF">
            <animate
              attributeName="stop-color"
              values="#D946EF;#00F5FF;#6366F1;#D946EF"
              dur="4s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>

        {/* Outer Laser Ring 1 */}
        <linearGradient id={`${id}-ring1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00F5FF" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#6366F1" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#D946EF" stopOpacity="0.9" />
        </linearGradient>

        {/* Outer Laser Ring 2 */}
        <linearGradient id={`${id}-ring2`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EC4899" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
        </linearGradient>

        {/* Glass Shimmer Sheen */}
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 1. Outer Counter-Rotating Laser Halo 1 */}
      <g style={{ transformOrigin: "24px 24px" }}>
        <rect
          x="3"
          y="3"
          width="42"
          height="42"
          rx="14"
          fill="none"
          stroke={`url(#${id}-ring1)`}
          strokeWidth="1.2"
          strokeDasharray="18 6"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 24 24"
            to="360 24 24"
            dur="10s"
            repeatCount="indefinite"
          />
        </rect>
      </g>

      {/* 2. Outer Counter-Rotating Laser Halo 2 (Reverse) */}
      <g style={{ transformOrigin: "24px 24px" }}>
        <circle
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke={`url(#${id}-ring2)`}
          strokeWidth="0.9"
          strokeDasharray="8 12"
          opacity="0.75"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="360 24 24"
            to="0 24 24"
            dur="14s"
            repeatCount="indefinite"
          />
        </circle>
      </g>

      {/* 3. Base Glass Prism Shield with Ambient Drop-Glow */}
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="11"
        fill="#070913"
        fillOpacity="0.82"
        stroke={`url(#${id}-core)`}
        strokeWidth="1.6"
      >
        <animate attributeName="stroke-opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
      </rect>

      {/* 4. Sweeping Glass Caustic Sheen */}
      <g style={{ clipPath: "inset(6px round 11px)" }}>
        <rect
          x="-35"
          y="0"
          width="24"
          height="48"
          fill={`url(#${id}-sheen)`}
          transform="skewX(-25)"
          opacity="0.6"
        >
          <animate attributeName="x" values="-40;65" dur="3.8s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* 5. Aerodynamic Quantum Monogram "A" + "X" Fusion */}
      <g>
        {/* Left Dynamic Wing / "A" Leg */}
        <path
          d="M13 33 L21 15 C21.6 13.8 23.4 13.8 24 15 L26 19.5 L19 33 Z"
          fill={`url(#${id}-core)`}
          opacity="0.95"
        />
        {/* Right Dynamic Cross / "X" Speed Wing */}
        <path
          d="M35 33 L25 15 C24.4 13.8 22.6 13.8 22 15 L20 19.5 L31 33 Z"
          fill="#00F5FF"
          opacity="0.85"
        />
        {/* Central Speed Connector Bar */}
        <path
          d="M16.5 25.5 L31.5 25.5"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.95"
        >
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
        </path>
        {/* Glowing Center Core Jewel */}
        <circle cx="24" cy="20" r="2.2" fill="#FFFFFF">
          <animate
            attributeName="r"
            values="1.8;2.6;1.8"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>

      {/* 6. Twinkling Precision Laser Sparks */}
      <circle cx="9" cy="9" r="1" fill="#00F5FF">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="39" cy="9" r="1.2" fill="#D946EF">
        <animate attributeName="opacity" values="1;0.2;1" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="39" cy="39" r="1" fill="#00F5FF">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function AdspxWordmark({
  className = "",
  imgClassName = "h-8 w-auto",
}: {
  className?: string;
  imgClassName?: string;
}) {
  const id = "adspx-wm-" + Math.random().toString(36).slice(2, 6);
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <AdspxMark className="h-8 w-8" glow />
      <svg
        viewBox="0 0 110 32"
        xmlns="http://www.w3.org/2000/svg"
        className={imgClassName}
        role="img"
        aria-label="AdsPx"
      >
        <defs>
          <linearGradient id={`${id}-text`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00F5FF">
              <animate
                attributeName="stop-color"
                values="#00F5FF;#6366F1;#D946EF;#00F5FF"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#D946EF">
              <animate
                attributeName="stop-color"
                values="#D946EF;#00F5FF;#6366F1;#D946EF"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        <text
          x="2"
          y="23"
          fontFamily="Outfit, system-ui, sans-serif"
          fontWeight="800"
          fontSize="23"
          letterSpacing="-0.7"
          fill="currentColor"
        >
          Ads
        </text>
        <text
          x="44"
          y="23"
          fontFamily="Outfit, system-ui, sans-serif"
          fontWeight="900"
          fontSize="23"
          letterSpacing="-0.7"
          fill={`url(#${id}-text)`}
        >
          Px
        </text>
        <circle cx="82" cy="21" r="2.4" fill="#00F5FF">
          <animate attributeName="opacity" values="1;0.35;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    </span>
  );
}

export default AdspxMark;
