import { AdspxMark } from "@/components/AdspxLogo";

type WordmarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Wrap the wordmark in a glass pill chip. */
  chip?: boolean;
};

const SIZE: Record<
  NonNullable<WordmarkProps["size"]>,
  { text: string; mark: string; pad: string }
> = {
  sm: { text: "text-sm", mark: "h-5 w-5", pad: "px-2.5 py-1" },
  md: { text: "text-lg", mark: "h-7 w-7", pad: "px-3 py-1.5" },
  lg: { text: "text-2xl", mark: "h-9 w-9", pad: "px-4 py-2" },
  xl: { text: "text-4xl sm:text-5xl", mark: "h-12 w-12", pad: "px-5 py-2.5" },
};

/**
 * Premium glass wordmark — transparent animated AdsPx mark + gradient typography.
 */
export function Wordmark({ className = "", size = "md", chip = false }: WordmarkProps) {
  const s = SIZE[size];

  const inner = (
    <span
      className={`inline-flex items-center gap-2.5 font-extrabold tracking-tight ${s.text} ${className}`}
    >
      <AdspxMark className={s.mark} glow />
      <span className="font-display tracking-tight leading-none">
        Ads<span className="text-gradient">Px</span>
      </span>
    </span>
  );

  if (!chip) return inner;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_24px_-12px_rgba(99,102,241,0.4)] ${s.pad}`}
    >
      {inner}
    </span>
  );
}

export default Wordmark;
