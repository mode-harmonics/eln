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
    "bg-action text-white hover:bg-action-hover focus:outline-none",
  secondary:
    "text-gray-700 bg-gray-100/80 hover:bg-gray-200/80 focus:outline-none",
  danger:
    "bg-red-500 text-white hover:bg-red-600 focus:outline-none",
  ghost:
    "text-gray-600 hover:text-gray-900 bg-transparent hover:bg-gray-100/80 focus:outline-none",
  text:
    "text-gray-500 hover:text-gray-900 bg-transparent focus:outline-none",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded",
  md: "px-4 py-2 text-sm rounded",
  lg: "px-5 py-2.5 text-sm rounded",
};

export function Button({
  type = "button",
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
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed",
        variantStyles[variant],
        variant !== "text" && sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
