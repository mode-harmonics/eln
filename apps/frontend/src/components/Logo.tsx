import React from "react";
import { cn } from "../lib/utils";
import logoSrc from "../../assets/logo.png";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  iconClassName?: string;
  textClassName?: string;
  src?: string;
}

export function Logo({ className, iconOnly, iconClassName, src = logoSrc }: LogoProps) {
  return (
    <span className={cn("flex items-center", className)}>
      <img
        src={src}
        alt="溪遥新能源"
        className={cn(iconOnly ? "h-7 w-auto" : "h-9 w-auto", iconClassName)}
      />
    </span>
  );
}
