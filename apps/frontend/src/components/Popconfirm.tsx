import React, { useState, useRef, useEffect } from "react";
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
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
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
    zIndex: 300,
  };

  if (triggerRect) {
    if (placement === "top") {
      style.top = `${triggerRect.top}px`;
      style.left = `${triggerRect.left + triggerRect.width / 2}px`;
      style.transform = "translate(-50%, -100%) translateY(-8px)";
    } else if (placement === "bottom") {
      style.top = `${triggerRect.bottom}px`;
      style.left = `${triggerRect.left + triggerRect.width / 2}px`;
      style.transform = "translate(-50%, 0) translateY(8px)";
    } else if (placement === "left") {
      style.top = `${triggerRect.top + triggerRect.height / 2}px`;
      style.left = `${triggerRect.left}px`;
      style.transform = "translate(-100%, -50%) translateX(-8px)";
    } else if (placement === "right") {
      style.top = `${triggerRect.top + triggerRect.height / 2}px`;
      style.left = `${triggerRect.right}px`;
      style.transform = "translate(0, -50%) translateX(8px)";
    }
  }

  // Clone children to attach onClick handler
  const trigger = React.cloneElement(children, {
    onClick: handleTriggerClick,
  });

  return (
    <div className="relative inline-block" ref={containerRef}>
      {trigger}
      {open && createPortal(
        <div
          id="popconfirm-portal"
          style={style}
          className="bg-white rounded-xl shadow-xl border border-gray-200 p-3.5 min-w-[200px]"
        >
          <div className="text-[12px] font-semibold text-gray-700 mb-2.5 whitespace-nowrap text-left">
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
              className="px-2.5 py-1 text-[10px] font-bold text-white bg-red-500 rounded-md hover:bg-red-650 transition-colors shadow-sm shadow-red-500/10 cursor-pointer"
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
