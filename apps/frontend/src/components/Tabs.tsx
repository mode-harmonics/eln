import React from "react";
import { cn } from "../lib/utils";
import { SegmentedControl } from "./SegmentedControl";

interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  variant?: "underline" | "segmented";
}

export function Tabs({ items, activeKey, onChange, className, variant = "underline" }: TabsProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[nextIndex].key);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[nextIndex]?.focus();
  };

  if (variant === "segmented") {
    return (
      <SegmentedControl
        items={items.map((item) => ({ value: item.key, label: item.label }))}
        value={activeKey}
        onValueChange={onChange}
        className={className}
      />
    );
  }

  return (
    <div className={cn("overflow-x-auto border-b border-gray-200", className)}>
      <nav className="-mb-px flex min-w-max space-x-1" role="tablist">
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeKey === item.key}
            tabIndex={activeKey === item.key ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "px-2 py-3 border-b-2 text-[13px] font-medium transition-colors mx-3 first:ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35",
              activeKey === item.key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
