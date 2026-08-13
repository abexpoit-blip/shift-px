type WordmarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Wrap the wordmark in a glass pill chip. */
  chip?: boolean;
};

const SIZE: Record<NonNullable<WordmarkProps["size"]>, { text: string; dot: string; mark: string; pad: string }> = {
  sm: { text: "text-sm",  dot: "w-5 h-5",  mark: "w-2 h-2",   pad: "px-2.5 py-1" },
  md: { text: "text-lg",  dot: "w-7 h-7",  mark: "w-2.5 h-2.5", pad: "px-3 py-1.5" },
  lg: { text: "text-2xl", dot: "w-9 h-9",  mark: "w-3 h-3",   pad: "px-4 py-2" },
  xl: { text: "text-4xl sm:text-5xl", dot: "w-12 h-12", mark: "w-4 h-4", pad: "px-5 py-2.5" },
};

/**
 * Premium glass wordmark — frosted gem + gradient SLEEPOX.
 *
 * The gem is a stacked glass disc: outer gradient ring, inner navy core,
 * and a tiny sky-blue dot that gives it a refracted-jewel feel. Pair with
 * the gradient wordmark for a true premium glassmorphic identity.
 */
export function Wordmark({ className = "", size = "md", chip = false }: WordmarkProps) {
  const s = SIZE[size];

  const inner = (
    <span className={`inline-flex items-center gap-2.5 font-extrabold tracking-[0.14em] uppercase ${s.text} ${className}`}>
      {/* Glass gem */}
      <span
        aria-hidden
        className={`relative ${s.dot} rounded-[0.6em] p-[1.5px] bg-gradient-to-br from-[#38BDF8] via-[#0EA5E9] to-[#6366F1] shadow-[0_0_18px_-2px_rgba(56,189,248,0.55)]`}
      >
        <span className="block w-full h-full rounded-[0.5em] bg-[#050B1F]/85 backdrop-blur-md border border-white/10 relative overflow-hidden">
          {/* glossy highlight */}
          <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
          {/* core dot */}
          <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${s.mark} rounded-full bg-gradient-to-br from-[#7DD3FC] to-[#6366F1] shadow-[0_0_8px_rgba(56,189,248,0.9)]`} />
        </span>
      </span>

      {/* Wordmark */}
      <span className="inline-flex items-baseline">
        <span className="bg-gradient-to-r from-[#7DD3FC] via-[#38BDF8] to-[#6366F1] bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">
          sleep
        </span>
        <span className="text-white/95">ox</span>
      </span>
    </span>
  );

  if (!chip) return inner;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_24px_-12px_rgba(56,189,248,0.4)] ${s.pad}`}
    >
      {inner}
    </span>
  );
}
