import { useState, useRef, useEffect, ReactNode } from "react";
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

  const setIsOpen = (newOpen: boolean) => {
    if (!isControlled) setInternalIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer inline-block w-full">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            "absolute rounded bg-white py-1 shadow-2xl z-50 min-w-[12rem]",
            position === "up" ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "right-0" : "left-0",
            className
          )}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
