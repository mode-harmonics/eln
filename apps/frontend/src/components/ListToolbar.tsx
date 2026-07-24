import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface ListToolbarProps {
  search?: ReactNode;
  leading?: ReactNode;
  view?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ListToolbar({ search, leading, view, actions, className }: ListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{search}{leading}</div>
      <div className="flex flex-wrap items-center gap-2">{view}{actions}</div>
    </div>
  );
}