import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Optional icon element rendered in the header */
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Footer content, typically action buttons */
  footer?: React.ReactNode;
  /** Side to slide in from — default "right" */
  side?: "left" | "right";
  /** Max-width class override — default "max-w-lg" */
  size?: string;
  className?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  side = "right",
  size = "max-w-lg",
  className,
}: DrawerProps) {
  if (!open) return null;

  const alignClass = side === "right" ? "justify-end" : "justify-start";
  const slideClass = side === "right" ? "animate-in slide-in-from-right" : "animate-in slide-in-from-left";

  return createPortal(
    <div className={cn("fixed inset-0 z-[200] flex", alignClass)}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "relative w-full bg-white shadow-2xl flex flex-col duration-300",
          size,
          slideClass,
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-[#f0f4ff] flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-gray-900 truncate">{title}</h2>
              {description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
