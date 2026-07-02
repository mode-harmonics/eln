import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const maxWidthStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function Modal({ open, onClose, title, children, footer, maxWidth = "lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity">
      <div
        className={cn(
          "bg-white rounded-2xl shadow-2xl ring-1 ring-gray-900/5 w-full flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 ease-out m-4",
          maxWidthStyles[maxWidth],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Fixed footer */}
        {footer && (
          <div className="flex items-center justify-end w-full gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
