/**
 * @eln/shared — cell grouping color palette
 *
 * Shared constant so frontend tooltip-legends, chart renders, and
 * backend auto-assignment all use the exact same 15-color sequence.
 */

export const GROUP_PALETTE: readonly string[] = [
  '#1d74f5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
] as const;

export const UNGROUPED_COLOR = '#9ca3af';

/**
 * Returns the hex color for the group at the given index (0-based).
 * Cycles through the palette if index exceeds palette length.
 */
export function getGroupColor(index: number): string {
  return GROUP_PALETTE[index % GROUP_PALETTE.length];
}
