/**
 * @eln/shared — enums shared between backend and future frontend.
 */

export enum RoleName {
  Owner = 'Owner',
  Admin = 'Admin',
  Editor = 'Editor',
  Viewer = 'Viewer',
}

export enum ExperimentStatus {
  Draft = 'Draft',
  InReview = 'In Review',
  Approved = 'Approved',
  Archived = 'Archived',
}

export enum ProjectStatus {
  Active = 'Active',
  Archived = 'Archived',
}

export enum InventoryStatus {
  InStock = 'In Stock',
  LowStock = 'Low Stock',
  OutOfStock = 'Out of Stock',
}

/**
 * Business data table types — used by GET /data/:type/:expId and the ETL pipeline.
 * Keep in sync with the parser registry in apps/backend.
 */
export enum DataType {
  Process = 'process',
  Calendar = 'calendar',
  Swelling = 'swelling',
  Efficiency = 'efficiency',
  Dcr = 'dcr',
  FastCharge = 'fastcharge',
  HtCycle = 'htcycle',
}

export const ALL_DATA_TYPES: DataType[] = [
  DataType.Process,
  DataType.Calendar,
  DataType.Swelling,
  DataType.Efficiency,
  DataType.Dcr,
  DataType.FastCharge,
  DataType.HtCycle,
];

export function isDataType(value: string): value is DataType {
  return (ALL_DATA_TYPES as string[]).includes(value);
}
