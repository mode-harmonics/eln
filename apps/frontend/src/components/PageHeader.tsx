import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badges?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  bordered?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  badges,
  metadata,
  actions,
  onBack,
  bordered = false,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
      bordered && "border-b border-gray-100 pb-4",
      className,
    )}>
      <div className="flex min-w-0 items-start gap-3">
        {onBack && (
          <Button variant="ghost" className="shrink-0 !px-2" onClick={onBack} aria-label="Back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {icon && <div className="mt-0.5 shrink-0 text-gray-500">{icon}</div>}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold text-gray-900">{title}</h1>
            {badges}
          </div>
          {description && <div className="mt-1 text-[13px] leading-5 text-gray-500">{description}</div>}
          {metadata && <div className="mt-2 text-xs text-gray-500">{metadata}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}