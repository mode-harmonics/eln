import { GROUP_PALETTE, UNGROUPED_COLOR } from "@eln/shared";
import type { CellGroupDto } from "@eln/shared";

// Re-export shared constants
export { GROUP_PALETTE, UNGROUPED_COLOR };

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
