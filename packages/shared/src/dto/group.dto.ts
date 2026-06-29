/**
 * @eln/shared — DTOs for the cell-grouping feature.
 * Framework-agnostic interfaces shared by backend + frontend.
 */

export interface CellGroupDto {
  id: string;
  projectId: string;
  name: string;
  color: string;
  sortOrder: number;
  matchMode: 'prefix' | 'manual';
  matchValue: string | null;
  createdAt: string;
}

export interface CreateCellGroupDto {
  name: string;
  color?: string;
  sortOrder?: number;
  matchMode: 'prefix' | 'manual';
  matchValue?: string;
}

export interface UpdateCellGroupDto {
  name?: string;
  color?: string;
  sortOrder?: number;
  matchMode?: 'prefix' | 'manual';
  matchValue?: string;
}

/** Per-cell group assignment returned by the resolve API */
export interface CellGroupAssignment {
  groupId: string | null;
  groupName: string | null;
  color: string;
}
