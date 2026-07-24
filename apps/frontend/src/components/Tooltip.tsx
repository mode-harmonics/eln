import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  /** When true, shows multi-line tooltip (uses pre-wrap) */
  multiline?: boolean;
  /** Preferred position: 'top' (default) or 'bottom' */
  position?: "top" | "bottom";
}

/**
 * Custom tooltip component — shows a styled popover on hover.
 * Uses a portal to avoid clipping by overflow containers.
 * Auto-adjusts position to stay within viewport.
 */
export function Tooltip({ content, children, className, multiline, position = "top" }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const measure = useCallback(() => {
    if (!triggerRef.current || !content) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 6;
    const tooltipWidth = Math.min(260, content.length * 7 + 32);
    const isTop = position === "top";

    let top = isTop ? rect.top - gap : rect.bottom + gap;
    let left = rect.left + rect.width / 2;

    // Clamp horizontal so tooltip doesn't overflow viewport edges
    const halfW = tooltipWidth / 2;
    if (left - halfW < 8) left = halfW + 8;
    if (left + halfW > window.innerWidth - 8) left = window.innerWidth - 8 - halfW;

    // If not enough space on preferred side, flip
    if (isTop && top < 4) {
      top = rect.bottom + gap;
    } else if (!isTop && top + 40 > window.innerHeight) {
      top = rect.top - gap;
    }

    setPos({ top, left });
  }, [content, position]);

  const show = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (!content) return;
    measure();
    timeoutRef.current = setTimeout(() => setVisible(true), 80);
  }, [content, measure]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  if (!content) return <>{children}</>;

  const isTop = pos ? (pos.top < (triggerRef.current?.getBoundingClientRect().top ?? 0)) : position === "top";

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn("inline-flex", className)}
      >
        {children}
      </span>
      {visible && pos && createPortal(
        <div
          className={cn(
            "fixed z-[9999] px-2.5 py-1.5 rounded-md bg-gray-800 text-white text-xs leading-relaxed shadow-lg",
            "whitespace-nowrap select-none pointer-events-none",
            "transition-opacity duration-150",
            visible ? "opacity-100" : "opacity-0",
            multiline && "whitespace-pre-wrap text-left max-w-[260px]",
          )}
          style={{
            top: pos.top,
            left: pos.left,
            transform: `translate(-50%, ${isTop ? "-100%" : "0"})`,
          }}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 w-0 h-0 border-[5px] border-transparent",
              isTop ? "top-full border-t-gray-800" : "bottom-full border-b-gray-800",
            )}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

/** Convenience: renders a column header <th> with a dotted-underline hint and tooltip. */
export function TooltipTh({
  content,
  label,
  className,
}: {
  content: string;
  label: string;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 w-[150px] min-w-[150px] max-w-[150px] text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap",
        className,
      )}
    >
      <Tooltip content={content}>
        <span className="underline decoration-dotted underline-offset-2 cursor-help">
          {label}
        </span>
      </Tooltip>
    </th>
  );
}
