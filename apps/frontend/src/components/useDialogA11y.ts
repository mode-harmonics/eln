import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogA11y(open: boolean, onClose: () => void, returnFocusRef?: RefObject<HTMLElement | null>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keep a stable ref to onClose so the focus/keyboard effect doesn't
  // re-run (and steal focus) whenever the parent re-renders with a new
  // function reference — e.g. every keystroke in a controlled input.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousFocus = returnFocusRef?.current ?? document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const previousInert = appRoot?.inert ?? false;
    if (appRoot && !appRoot.contains(dialogRef.current)) appRoot.inert = true;
    document.body.style.overflow = "hidden";

    // Set initial focus once when the dialog opens. Skip the close button
    // (first focusable element in the header) and prefer the first focusable
    // element inside the modal body / form instead.
    const frame = requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      const allFocusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => !el.hasAttribute("hidden") && el.getClientRects().length > 0);

      // The close button is the very first focusable element in the DOM order.
      // Prefer the second one (first real form field) when it exists so that
      // typing immediately goes into the input rather than the close button.
      const closeBtn = allFocusable[0];
      const preferred = allFocusable.find(
        (el) => el !== closeBtn && el.tagName !== "BUTTON",
      ) ?? allFocusable[1] ?? closeBtn ?? dialogRef.current;

      preferred?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs.length && dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previousInert;
      previousFocus?.focus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // intentionally omit onClose — use onCloseRef instead

  return dialogRef;
}
