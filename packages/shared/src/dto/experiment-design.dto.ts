export interface ExperimentDesignDto {
  id: string;
  projectId: string;
  rowIndex: number;
  group: string;
  moleculeName: string;
  chineseName: string;
  molecularStructure: string | null;
  cas: string;
  designPrinciple: string | null;
  internalCode: string;
  isRedundancy: boolean;
  createdAt: string;
}

export interface CreateExperimentDesignDto {
  group: string;
  moleculeName: string;
  chineseName: string;
  molecularStructure?: string;
  cas: string;
  designPrinciple?: string;
}

export interface BatchCreateDesignDto {
  defaultCount: number;
  redundancyCount: number;
  rows: CreateExperimentDesignDto[];
}
