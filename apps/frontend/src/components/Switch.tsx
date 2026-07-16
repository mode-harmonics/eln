import React, { useId } from "react";
import { cn } from "../lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Switch({ checked, onChange, disabled, size = "md" }: SwitchProps) {
  const id = useId();
  const trackW = size === "sm" ? "w-7" : "w-9";
  const trackH = size === "sm" ? "h-4" : "h-5";
  const thumbS = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const thumbTx = size === "sm" ? "translate-x-3" : "translate-x-4";

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(!checked); }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1d74f5] focus:ring-offset-2",
        trackW,
        trackH,
        checked ? "bg-[#1d74f5]" : "bg-gray-200",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out",
          thumbS,
          checked ? thumbTx : "translate-x-0",
        )}
      />
    </button>
  );
}
