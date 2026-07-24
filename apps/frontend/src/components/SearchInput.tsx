import React from "react";
import { Search, X } from "lucide-react";

import { cn } from "../lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  ariaLabel,
  className,
}: SearchInputProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className={cn("relative w-full max-w-lg flex items-center", className)}
    >
      <button
        type="submit"
        aria-label="Search"
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 transition-colors rounded"
      >
        <Search className="h-4 w-4" />
      </button>
      <input
        type="text"
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full bg-transparent border-0 border-b border-gray-200 pl-9 text-[13px] text-gray-900 placeholder-gray-400 transition-colors rounded-none",
          "focus:border-gray-900 focus:outline-none focus:ring-0",
          value ? "pr-9 py-2" : "pr-4 py-2",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => { onChange(""); onSubmit?.(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-900 transition-colors rounded"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
