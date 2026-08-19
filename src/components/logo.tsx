import { AdspxMark } from "@/components/AdspxLogo";

type LogoProps = {
  className?: string;
  title?: string;
  /** Wrap the logo in an animated radial halo for premium glow. */
  glow?: boolean;
  /** Use smaller halo radius — good for sidebar / inline contexts. */
  glowSize?: "sm" | "md";
};

export function Logo({
  className = "h-8 w-8",
  glow = true,
}: LogoProps) {
  return <AdspxMark className={className} glow={glow} />;
}

export default Logo;
