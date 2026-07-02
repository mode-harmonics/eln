import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "../lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  info: <Info className="w-4 h-4 text-blue-500" />,
};

const bgColors: Record<ToastType, string> = {
  success: "bg-green-50 border-green-200",
  error: "bg-red-50 border-red-200",
  info: "bg-blue-50 border-blue-200",
};

let toastId = 0;
let addToastFn: ((t: ToastItem) => void) | null = null;

interface ToastFunction {
  (message: string, type?: ToastType): void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export const toast: ToastFunction = (message: string, type: ToastType = "info") => {
  addToastFn?.({ id: ++toastId, type, message });
};

toast.success = (message: string) => toast(message, "success");
toast.error = (message: string) => toast(message, "error");
toast.info = (message: string) => toast(message, "info");

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const add = useCallback((t: ToastItem) => {
    setItems((prev) => [...prev, t]);
    const timer = setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== t.id));
      timers.current.delete(t.id);
    }, 3500);
    timers.current.set(t.id, timer);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    addToastFn = add;
    return () => { addToastFn = null; };
  }, [add]);

  useEffect(() => {
    return () => { timers.current.forEach((t) => clearTimeout(t)); };
  }, []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-lg",
            "animate-in slide-in-from-right-2 fade-in duration-200",
            bgColors[item.type],
          )}
          style={{ minWidth: 280, maxWidth: 420 }}
        >
          {icons[item.type]}
          <p className="text-sm text-gray-800 flex-1 leading-5">{item.message}</p>
          <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
