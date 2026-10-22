import Image from "next/image";
import { cn } from "@/lib/utils";

interface FestoLogoProps {
  className?: string;
  height?: number;
}

export function FestoLogo({ className, height = 24 }: FestoLogoProps) {
  // Logo aspect ratio is approximately 5:1 (width:height)
  const width = Math.round(height * 5);

  return (
    <Image
      src="/festo-logo.png"
      alt="FESTO"
      width={width}
      height={height}
      className={cn("select-none", className)}
      priority
    />
  );
}
