import { cn } from "@/lib/utils";

interface FestoLogoProps {
  className?: string;
}

export function FestoLogo({ className }: FestoLogoProps) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-festo)] text-[#0091DC] tracking-tight select-none",
        className
      )}
    >
      FESTO
    </span>
  );
}
