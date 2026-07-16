export interface ReagentProcurementDto {
  id: string;
  projectId: string;
  experimentDesignId: string | null;
  moleculeName: string;
  supplier: string | null;
  batchNo: string | null;
  purity: string | null;
  quantity: string | null;
  isValid: boolean;
  remark: string | null;
  createdAt: string;
}

export interface UpdateProcurementDto {
  supplier?: string;
  batchNo?: string;
  purity?: string;
  quantity?: string;
  isValid?: boolean;
  remark?: string;
}
