'use client';

import * as React from "react"
import { Chip, ChipType } from "@festo-ui/react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
  asChild?: boolean;
}

function Badge({
  className,
  variant = "default",
  children,
  onClick,
  ...props
}: BadgeProps) {
  // Map shadcn variants to Festo Chip types
  // default (primary) -> Category (blue/primary look)
  // secondary -> Choice (neutral look)
  const chipType = variant === 'default' ? ChipType.Category : ChipType.Choice;

  return (
    <Chip
      type={chipType}
      onClick={onClick}
      className={cn(className)}
      {...props}
    >
      {children}
    </Chip>
  );
}

export { Badge }
