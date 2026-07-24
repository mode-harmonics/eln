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
    <div className={cn("border-b border-gray-200", className)}>
      <nav className="-mb-px flex space-x-1" role="tablist">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeKey === item.key}
            onClick={() => onChange(item.key)}
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
