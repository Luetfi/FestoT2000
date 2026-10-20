'use client';

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Button as FestoButton } from "@festo-ui/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Styling for the asChild variant (links rendered as buttons)
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-2 border-primary text-primary bg-background hover:bg-primary hover:text-primary-foreground dark:border-primary dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ShadcnVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ShadcnSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ShadcnVariant;
  size?: ShadcnSize;
  asChild?: boolean;
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  // For asChild pattern (used with Links), use Slot with buttonVariants styling
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  // Map shadcn variants to Festo boolean props
  // Festo uses: primary (default), tertiary, or neither (secondary)
  const isPrimary = variant === 'default' || variant === 'destructive';
  const isTertiary = variant === 'ghost' || variant === 'link';
  // secondary/outline = neither primary nor tertiary (Festo default secondary)

  // Map sizes
  const isLarge = size === 'lg' || size === 'icon-lg';
  const isIconOnly = size === 'icon' || size === 'icon-xs' || size === 'icon-sm' || size === 'icon-lg';

  return (
    <FestoButton
      primary={isPrimary}
      tertiary={isTertiary}
      large={isLarge}
      iconOnly={isIconOnly}
      className={cn(
        // Add destructive styling if needed
        variant === 'destructive' && 'bg-destructive hover:bg-destructive/90',
        className
      )}
      {...props}
    >
      {children}
    </FestoButton>
  );
}

export { Button, buttonVariants }
