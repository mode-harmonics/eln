import { useState, useRef, useEffect, useLayoutEffect, ReactNode, useCallback } from "react";
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
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const portalRect = portalRef.current?.getBoundingClientRect();
    const panelWidth = portalRect?.width ?? 192;
    const panelHeight = portalRect?.height ?? 0;
    const gap = 4;
    const margin = 8;
    const preferredLeft = align === "right" ? triggerRect.right - panelWidth : triggerRect.left;
    const left = Math.min(
      Math.max(margin, preferredLeft),
      Math.max(margin, window.innerWidth - panelWidth - margin),
    );
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin;
    const openUp = position === "up" || (panelHeight > spaceBelow && triggerRect.top > spaceBelow);
    const top = openUp
      ? Math.max(margin, triggerRect.top - panelHeight - gap)
      : Math.min(triggerRect.bottom + gap, Math.max(margin, window.innerHeight - panelHeight - margin));
    setStyle({
      position: "fixed",
      zIndex: 9999,
      minWidth: "12rem",
      top,
      left,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
      maxHeight: `calc(100vh - ${margin * 2}px)`,
    });
  }, [align, position]);

  useLayoutEffect(() => {
    if (isOpen) measure();
  }, [isOpen, measure, children]);

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
    const handleViewportChange = () => measure();
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.querySelector<HTMLElement>("button, [href], [tabindex]")?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <div className="inline-block" ref={triggerRef}>
      <div onClick={() => { if (!isOpen) measure(); setIsOpen(!isOpen); }} className="cursor-pointer" aria-expanded={isOpen}>
        {trigger}
      </div>
      {isOpen && createPortal(
        <div
          ref={portalRef}
          style={style}
          className={cn(
            "overflow-auto rounded-surface border border-border bg-surface py-1 shadow-lg",
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
