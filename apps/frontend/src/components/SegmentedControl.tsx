import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface SegmentedControlItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: "sm" | "md";
  iconOnly?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onValueChange,
  size = "md",
  iconOnly = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("max-w-full overflow-x-auto", className)}>
      <div className="inline-flex min-w-max gap-1 rounded-control bg-gray-100 p-1" role="tablist">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={iconOnly && typeof item.label === "string" ? item.label : undefined}
              title={item.title}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded px-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 disabled:cursor-not-allowed disabled:opacity-45",
                size === "sm" ? "h-7 text-xs" : "h-8 text-[13px]",
                iconOnly && "w-8 px-0",
                active ? "bg-white text-gray-900" : "text-gray-500 hover:text-gray-800",
              )}
            >
              {item.icon}
              {!iconOnly && item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}