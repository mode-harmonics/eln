import React from "react";
import { cn } from "../lib/utils";
import { Dropdown } from "./Dropdown";

export interface ButtonGroupItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  dropdownContent?: React.ReactNode;
}

interface ButtonGroupProps {
  items: ButtonGroupItem[];
  activeId?: string;
  className?: string;
  size?: "sm" | "md";
}

export function ButtonGroup({ items, activeId, className, size = "sm" }: ButtonGroupProps) {
  return (
    <div className={cn("flex items-center bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/60 gap-0.5", className)}>
      {items.map((item) => {
        const isActive = activeId === item.id;
        const btn = (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            title={item.title}
            aria-pressed={activeId !== undefined ? isActive : undefined}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-control transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 whitespace-nowrap",
              size === "sm" ? "px-2 py-1.5 text-xs h-7" : "px-3 py-2 text-sm h-8",
              isActive
                ? "bg-white text-gray-900 shadow-sm border border-gray-200/60"
                : "text-gray-500 hover:text-gray-900 hover:bg-white border border-transparent",
              item.className
            )}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span className={cn(item.icon ? "sr-only sm:not-sr-only" : "inline")}>{item.label}</span>
            {item.badge}
          </button>
        );

        if (item.dropdownContent) {
          return (
            <Dropdown key={item.id} trigger={btn}>
              {item.dropdownContent}
            </Dropdown>
          );
        }
        return btn;
      })}
    </div>
  );
}
