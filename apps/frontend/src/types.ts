import type {
  RoleDto,
  UserDto,
  ProjectDto,
  ExperimentDto,
  InventoryDto,
  ProcessDataDto,
  CalendarLifeDto,
  StorageSwellingDto,
  EnergyEfficiencyDto,
  DcrTestDto,
  FastChargeDto,
  FastChargeStepDto,
  HtCycleDto,
} from "@eln/shared";

export type Role = RoleDto;
export type User = UserDto & { roleId?: string | null; roleName?: string | null };
export type Project = ProjectDto;
export type Experiment = ExperimentDto;
export type InventoryItem = InventoryDto;

// Battery Data Types mapped directly from the shared package (which matches backend entities)
export type ProcessData = ProcessDataDto;
export type CalendarLife = CalendarLifeDto;
export type StorageSwelling = StorageSwellingDto;
export type EnergyEfficiency = EnergyEfficiencyDto;
export type DcrTest = DcrTestDto;
export type FastChargeStep = FastChargeStepDto;
export type FastCharge = FastChargeDto;
export type HtCycle = HtCycleDto;
