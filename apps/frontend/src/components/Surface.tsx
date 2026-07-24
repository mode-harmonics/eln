import * as React from "react";
import { cn } from "../lib/utils";

type SurfaceVariant = "plain" | "subtle" | "outlined" | "elevated";
type SurfacePadding = "none" | "sm" | "md" | "lg";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
}

const variants: Record<SurfaceVariant, string> = {
  plain: "bg-surface",
  subtle: "bg-surface-subtle",
  outlined: "border border-border bg-surface",
  elevated: "bg-surface shadow-sm",
};

const paddings: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant = "plain", padding = "none", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-surface", variants[variant], paddings[padding], className)}
      {...props}
    />
  ),
);

Surface.displayName = "Surface";