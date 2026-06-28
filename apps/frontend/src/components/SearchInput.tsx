import React from "react";
import { Search, X } from "lucide-react";
import { Button } from "./Button";
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
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="absolute left-1.5 top-1/2 -translate-y-1/2"
      >
        <Search className="h-4 w-4" />
      </Button>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-lg border border-gray-300 bg-white pl-9 text-sm placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] transition-colors",
          value ? "pr-9 py-1.5" : "pr-4 py-1.5",
        )}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { onChange(""); onSubmit?.(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
