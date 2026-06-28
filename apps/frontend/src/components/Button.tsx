import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "text";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1d74f5] text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-[#1d74f5] focus:ring-offset-2",
  secondary:
    "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
  ghost:
    "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
  text:
    "text-gray-500 hover:text-gray-900",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded",
  md: "px-4 py-2 text-sm rounded",
  lg: "px-5 py-2.5 text-sm rounded",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        variantStyles[variant],
        variant !== "text" && sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
