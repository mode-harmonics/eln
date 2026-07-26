import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if a cellId or cellName belongs to an invalid procurement group/code.
 * Matches against group names (e.g. "A", "组1") and internal codes (e.g. "ELN-A-001").
 */
export function isCellInvalid(
  cellId: string | undefined | null,
  invalidKeys: string[],
): boolean {
  if (!cellId || !invalidKeys || invalidKeys.length === 0) return false;
  const target = String(cellId).trim().toLowerCase();
  return invalidKeys.some((k) => {
    if (!k) return false;
    const key = k.trim().toLowerCase();
    if (target === key) return true;
    if (
      target.startsWith(key + '-') ||
      target.startsWith(key + '_') ||
      target.startsWith(key + '.')
    ) return true;
    if (target.startsWith(key)) return true;
    return false;
  });
}

