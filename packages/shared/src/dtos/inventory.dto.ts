import { InventoryStatus } from '../enums';

export interface InventoryDto {
  id: string;
  name: string;
  type: string;
  lotNumber: string | null;
  quantity: string | null;
  storageLocation: string | null;
  purity: string | null;
  status: InventoryStatus | string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  experimentId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}