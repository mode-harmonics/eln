import { useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  position?: "up" | "down";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({ trigger, children, align = "right", position = "down", className, open, onOpenChange }: DropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalIsOpen;
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const setIsOpen = (newOpen: boolean) => {
    if (!isControlled) setInternalIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const measure = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      zIndex: 9999,
      minWidth: "12rem",
      ...(position === "up"
        ? { bottom: window.innerHeight - rect.top + 4, left: align === "right" ? rect.right - 192 : rect.left }
        : { top: rect.bottom + 4, left: align === "right" ? Math.max(8, rect.right - 192) : rect.left }),
    });
  }, [align, position]);

  useEffect(() => {
    if (!isOpen) return;
    measure();
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        portalRef.current && !portalRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [isOpen, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <div className="inline-block" ref={triggerRef}>
      <div onClick={() => { if (!isOpen) measure(); setIsOpen(!isOpen); }} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && createPortal(
        <div
          ref={portalRef}
          style={style}
          className={cn(
            "bg-white rounded-xl shadow-lg border border-gray-200/60 py-1 overflow-hidden",
            className,
          )}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
