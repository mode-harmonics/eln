import React from "react";
import { cn } from "../lib/utils";

interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ items, activeKey, onChange, className }: TabsProps) {
  return (
    <div className={cn("border-b border-gray-200", className)}>
      <nav className="-mb-px flex space-x-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "px-6 py-2 border-b-[3px] text-xs font-medium transition-colors -mb-[1px]",
              activeKey === item.key
                ? "border-[#1d74f5] text-[#1d74f5]"
                : "border-transparent text-gray-400",
            )}
          >
            <span className="px-3 py-1 rounded-md transition-colors hover:bg-gray-100">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
