import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, Ban, Info } from "lucide-react";
import { cn } from "../lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-[18px] h-[18px] text-green-600" />,
  error: <Ban className="w-[18px] h-[18px] text-red-600" />,
  info: <Info className="w-[18px] h-[18px] text-blue-600" />,
};

const bgColors: Record<ToastType, string> = {
  success: "bg-white border-x border-b border-gray-100 border-t-2 border-t-green-600",
  error: "bg-white border-x border-b border-gray-100 border-t-2 border-t-red-700",
  info: "bg-white border-x border-b border-gray-100 border-t-2 border-t-blue-600",
};

let toastId = 0;
let addToastFn: ((t: ToastItem) => void) | null = null;
const pendingToasts: ToastItem[] = [];

interface ToastFunction {
  (message: string, type?: ToastType): void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export const toast: ToastFunction = (message: string, type: ToastType = "info") => {
  const item = { id: ++toastId, type, message };
  if (addToastFn) addToastFn(item);
  else pendingToasts.push(item);
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
    pendingToasts.splice(0).forEach(add);
    return () => { addToastFn = null; };
  }, [add]);

  useEffect(() => {
    return () => { timers.current.forEach((t) => clearTimeout(t)); };
  }, []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="fixed left-4 right-4 top-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none sm:left-auto">
      <style>{`
        @keyframes toast-progress-anim {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
      {items.map((item) => (
        <div
          key={item.id}
          role={item.type === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto relative flex w-full max-w-[420px] items-start gap-2.5 overflow-hidden rounded-control border px-4 py-3 shadow-sm",
            "animate-in slide-in-from-right-2 fade-in duration-200",
            bgColors[item.type],
          )}
        >
          {icons[item.type]}
          <p className="text-[13px] font-medium text-gray-700 flex-1 leading-5 pt-0.5">{item.message}</p>
          <button type="button" aria-label="Dismiss notification" onClick={() => remove(item.id)} className="text-gray-400 hover:text-gray-900 transition-colors shrink-0 p-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35">
            <X className="w-4 h-4 stroke-[2]" aria-hidden="true" />
          </button>
          
          <div 
            className="absolute bottom-0 left-0 h-[3px] bg-gray-200/80"
            style={{ animation: "toast-progress-anim 3500ms linear forwards" }}
          />
        </div>
      ))}
    </div>,
    document.body,
  );
}
