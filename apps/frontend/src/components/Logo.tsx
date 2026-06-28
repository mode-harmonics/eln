import React from "react";
import { cn } from "../lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  iconClassName?: string;
  textClassName?: string;
}

export function Logo({ className, iconOnly, iconClassName, textClassName }: LogoProps) {
  return (
    <span className={cn("text-red-500 font-bold tracking-tight flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("w-6 h-6 shrink-0", iconClassName)}
      >
        <path d="M9 2v5l-5 13a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3L13 7V2" />
        <path d="M5.5 15a5.2 5.2 0 0 0 3.5 1.5 5.2 5.2 0 0 0 3.5-1.5" />
      </svg>
      {!iconOnly && <span className={textClassName}>ELN</span>}
    </span>
  );
}
