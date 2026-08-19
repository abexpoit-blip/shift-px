import { AdspxMark } from "@/components/AdspxLogo";

type Props = {
  className?: string;
  /** dark | light controls text color */
  variant?: "dark" | "light";
  /** show only the mark (no wordmark) */
  markOnly?: boolean;
};

/**
  * Adspx brand wordmark — modern transparent animated vector logo.
  */
export function BrandLogo({ className = "", variant = "dark", markOnly = false }: Props) {
  const text = variant === "light" ? "#FFF9F5" : "currentColor";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <AdspxMark className="h-7 w-7" glow />
      {!markOnly && (
        <span
          className="text-xl font-extrabold tracking-tight leading-none"
          style={{
            color: text,
            fontFamily: "'Outfit', system-ui, sans-serif",
            letterSpacing: "-0.03em",
          }}
        >
          Ads<span className="text-gradient">Px</span>
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
