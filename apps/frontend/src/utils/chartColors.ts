import type { CellGroupDto } from "@eln/shared";

/** Cell group palette — duplicated from @eln/shared to avoid CJS tree-shaking issues */
export const GROUP_PALETTE = [
  '#1d74f5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
] as const;

export const UNGROUPED_COLOR = '#9ca3af';

/**
 * Returns the hex colour for a given group name, looking it up in the groups list.
 * Falls back to gray for ungrouped cells.
 */
export function getGroupColor(
  groupName: string | null,
  groups: CellGroupDto[],
): string {
  if (!groupName) return UNGROUPED_COLOR;
  const group = groups.find((g) => g.name === groupName);
  return group?.color ?? UNGROUPED_COLOR;
}

/**
 * For Recharts: returns a fill colour per data entry based on its cellName's group.
 * Accepts a groupMap (from the server response) keyed by cellIdentifier.
 */
export function cellColorFromGroupMap(
  cellIdentifier: string,
  groupMap: Record<string, { groupId: string | null; groupName: string | null; color: string }>,
): string {
  return groupMap[cellIdentifier]?.color ?? UNGROUPED_COLOR;
}
