import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  /** When true, shows multi-line tooltip (uses pre-wrap) */
  multiline?: boolean;
}

/**
 * Custom tooltip component — shows a styled popover on hover.
 * Uses a portal to avoid clipping by overflow containers.
 *
 * Usage:
 *   <Tooltip content="Explanation text">
 *     <span>Column Name</span>
 *   </Tooltip>
 */
export function Tooltip({ content, children, className, multiline }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (!triggerRef.current || !content) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
    // Delay to avoid flash on quick hover
    timeoutRef.current = setTimeout(() => setVisible(true), 80);
  }, [content]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
    setPosition(null);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  if (!content) return <>{children}</>;

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
      {visible && position && createPortal(
        <span
          className={cn(
            "fixed z-[9999]",
            "px-2.5 py-1.5 rounded-lg bg-gray-800 text-white text-xs leading-relaxed shadow-lg",
            "whitespace-nowrap",
            multiline && "whitespace-pre-wrap text-left max-w-[260px]",
          )}
          style={{
            top: position.top,
            left: position.left,
            transform: "translate(-50%, -100%)",
          }}
          role="tooltip"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-800" />
        </span>,
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
        "px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap",
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
