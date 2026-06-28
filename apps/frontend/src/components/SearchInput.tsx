import React from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  className,
}: SearchInputProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className={cn("relative w-full max-w-sm flex items-center", className)}
    >
      <button
        type="submit"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 py-1.5 text-sm placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] transition-colors"
      />
    </form>
  );
}
