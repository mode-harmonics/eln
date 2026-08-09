import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface PopconfirmProps {
  title: string;
  onConfirm: () => void;
  onCancel?: () => void;
  children: React.ReactElement<any>;
  confirmText?: string;
  cancelText?: string;
  placement?: "top" | "bottom" | "left" | "right";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popconfirm({
  title,
  onConfirm,
  onCancel,
  children,
  confirmText,
  cancelText,
  placement = "top",
  open: controlledOpen,
  onOpenChange,
}: PopconfirmProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : localOpen;
  
  const setOpen = (newOpen: boolean) => {
    setLocalOpen(newOpen);
    if (onOpenChange) onOpenChange(newOpen);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const [popupSize, setPopupSize] = useState({ width: 320, height: 96 });
  const { t } = useTranslation();

  const finalConfirmText = confirmText || t("confirm", "确定");
  const finalCancelText = cancelText || t("cancel", "取消");

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const portalContainer = document.getElementById("popconfirm-portal");
        if (portalContainer && portalContainer.contains(event.target as Node)) {
          return;
        }
        setOpen(false);
        if (onCancel) onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      if (containerRef.current) {
        setTriggerRect(containerRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    setPopupSize({ width: rect.width, height: rect.height });
  }, [open, title, finalConfirmText, finalCancelText]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    onConfirm();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    if (onCancel) onCancel();
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-white border-x-transparent border-b-transparent border-[6px] drop-shadow-[0_1px_0_rgba(0,0,0,0.08)]",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-white border-x-transparent border-t-transparent border-[6px] drop-shadow-[0_-1px_0_rgba(0,0,0,0.08)]",
    left: "left-full top-1/2 -translate-y-1/2 border-l-white border-y-transparent border-r-transparent border-[6px] drop-shadow-[1px_0_0_rgba(0,0,0,0.08)]",
    right: "right-full top-1/2 -translate-y-1/2 border-r-white border-y-transparent border-l-transparent border-[6px] drop-shadow-[-1px_0_0_rgba(0,0,0,0.08)]",
  };

  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 1000,
    maxWidth: "calc(100vw - 24px)",
  };

  if (triggerRect) {
    const margin = 12;
    const gap = 8;
    const clampX = (left: number) => Math.max(margin, Math.min(left, window.innerWidth - popupSize.width - margin));
    const clampY = (top: number) => Math.max(margin, Math.min(top, window.innerHeight - popupSize.height - margin));
    if (placement === "top") {
      style.top = clampY(triggerRect.top - popupSize.height - gap);
      style.left = clampX(triggerRect.left + triggerRect.width / 2 - popupSize.width / 2);
    } else if (placement === "bottom") {
      style.top = clampY(triggerRect.bottom + gap);
      style.left = clampX(triggerRect.left + triggerRect.width / 2 - popupSize.width / 2);
    } else if (placement === "left") {
      style.top = clampY(triggerRect.top + triggerRect.height / 2 - popupSize.height / 2);
      style.left = clampX(triggerRect.left - popupSize.width - gap);
    } else if (placement === "right") {
      style.top = clampY(triggerRect.top + triggerRect.height / 2 - popupSize.height / 2);
      style.left = clampX(triggerRect.right + gap);
    }
  }

  // Clone children to attach onClick handler
  const trigger = React.cloneElement(children, {
    onClick: handleTriggerClick,
  });

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {trigger}
      {open && createPortal(
        <div
          id="popconfirm-portal"
          ref={popupRef}
          style={style}
          className="w-max min-w-[200px] max-w-[min(360px,calc(100vw-24px))] rounded-md border border-gray-100 bg-white p-3.5 shadow-sm"
        >
          <div className="mb-2.5 whitespace-normal break-words text-left text-[12px] font-semibold leading-5 text-gray-700">
            {title}
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              onClick={handleCancel}
              className="px-2.5 py-1 text-[10px] font-bold text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer"
            >
              {finalCancelText}
            </button>
            <button
              onClick={handleConfirm}
              className="px-2.5 py-1 text-[10px] font-bold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors cursor-pointer"
            >
              {finalConfirmText}
            </button>
          </div>
          <div className={`absolute border-solid ${arrowClasses[placement]}`} />
        </div>,
        document.body
      )}
    </div>
  );
}
