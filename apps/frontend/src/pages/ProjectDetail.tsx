import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouteLoaderData } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn, isCellInvalid } from "../lib/utils";
import { Tabs } from "../components/Tabs";
import { DataSummary } from "../components/DataSummary";
import { ProjectRawData } from "../components/ProjectRawData";
import { SkeletonCard } from "../components/Skeleton";
import { api } from "../lib/api";
import { RECORD_TYPE_TO_API_TYPE } from "../utils/recordTypes";
import { PageHeader } from "../components/PageHeader";
import { useProjectWorkflow } from "../hooks/useProjectWorkflow";
import { WorkflowProgressCard } from "../components/project-detail/WorkflowProgressCard";
import { WorkflowStepList } from "../components/project-detail/WorkflowStepList";
import { WorkflowTaskSidebar } from "../components/project-detail/WorkflowTaskSidebar";
import type {
  Project, Experiment, ProcessData, CalendarLife, StorageSwelling,
  EnergyEfficiency, DcrTest, FastCharge, HtCycle,
} from "../types";

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "workflow" | "summary" | "raw_data") || "workflow";

  const loaderProject = useRouteLoaderData("project") as Project | null;
  const [project] = useState<Project | null>(loaderProject);
  const [error] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem("currentUserId"));

  // Workflow state & handlers via custom hook
  const {
    wf,
    wfLoading,
    experiments,
    stepMeta,
    stepMetaError,
    refetchTrigger,
    setRefetchTrigger,
  } = useProjectWorkflow(projectId);

  // Summary data
  const [processData, setProcessData] = useState<ProcessData[]>([]);
  const [calendarLife, setCalendarLife] = useState<CalendarLife[]>([]);
  const [storageSwelling, setStorageSwelling] = useState<StorageSwelling[]>([]);
  const [energyEfficiency, setEnergyEfficiency] = useState<EnergyEfficiency[]>([]);
  const [dcrTest, setDcrTest] = useState<DcrTest[]>([]);
  const [fastCharge, setFastCharge] = useState<FastCharge[]>([]);
  const [htCycle, setHtCycle] = useState<HtCycle[]>([]);
  const [loadedTypes, setLoadedTypes] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [pickedCells, setPickedCells] = useState<string[]>([]);

  // Current User ID
  useEffect(() => {
    const stored = localStorage.getItem("currentUserId");
    if (stored) {
      setCurrentUserId(stored);
    } else {
      api.get<any>("/api/v1/users/me")
        .then((d) => {
          if (d?.id) {
            setCurrentUserId(d.id);
            localStorage.setItem("currentUserId", d.id);
          }
        })
        .catch(() => { });
    }
  }, []);

  // Load picked cells
  useEffect(() => {
    if (!projectId) return;
    api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`)
      .then((d) => setPickedCells((d || []).map((p: any) => p.cellId)))
      .catch(() => { });
  }, [projectId, refetchTrigger]);

  // Summary / Raw data fetch — loads when either summary or raw_data tab is active
  useEffect(() => {
    if (!projectId || (activeTab !== "summary" && activeTab !== "raw_data")) return;
    let cancelled = false;
    setDataLoading(true);
    setLoadedTypes([]);
    api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).then((allExps) => {
      if (cancelled || !Array.isArray(allExps)) return;
      const expIdsByType: Record<string, string[]> = {};
      for (const exp of allExps) {
        const at = exp.metadata?.assayType as string;
        if (at && RECORD_TYPE_TO_API_TYPE[at]) {
          if (!expIdsByType[at]) expIdsByType[at] = [];
          expIdsByType[at].push(exp.id);
        }
      }
      const setters: Record<string, (data: any[]) => void> = {
        ProcessData: setProcessData,
        CalendarLife: setCalendarLife,
        StorageSwelling: setStorageSwelling,
        EnergyEfficiency: setEnergyEfficiency,
        DcrTest: setDcrTest,
        FastCharge: setFastCharge,
        HtCycle: setHtCycle,
      };
      api.get<string[]>(`/api/v1/projects/${projectId}/procurement/invalid-internalcodes`).catch(() => []).then((invalidCodesData) => {
        const invalidCodes = Array.isArray(invalidCodesData) ? invalidCodesData : [];
        const tasks = Object.entries(setters).map(([at, setter]) => {
          const apiType = RECORD_TYPE_TO_API_TYPE[at];
          if (!apiType) return null;
          const ids = expIdsByType[at] || [];
          if (!ids.length) { setter([]); setLoadedTypes((p) => [...p, apiType]); return null; }
          return Promise.all(ids.map((eid: string) => api.get<any[]>(`/api/v1/data/${apiType}/${eid}`).catch(() => []))).then((rs) => {
            if (!cancelled) {
              let rows = rs.flat();
              if (at === "ProcessData") {
                const seen = new Map<string, any>();
                for (const row of rows) {
                  const key = row.cellId || row.id;
                  if (!seen.has(key)) seen.set(key, row);
                  else {
                    const existing = seen.get(key);
                    for (const [k, v] of Object.entries(row)) {
                      if (v != null && v !== '' && (existing[k] == null || existing[k] === '')) existing[k] = v;
                    }
                  }
                }
                rows = Array.from(seen.values());
              }
              if (invalidCodes.length > 0) {
                rows = rows.filter((r: any) => !isCellInvalid(r.cellId || r.cellName, invalidCodes));
              }
              rows = rows.filter((r: any) => !r.scrapped);
              setter(rows);
              setLoadedTypes((p) => [...p, apiType]);
            }
          });
        });
        Promise.all(tasks.filter(Boolean)).finally(() => { if (!cancelled) setDataLoading(false); });
      });
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [projectId, activeTab, refetchTrigger]);

  if (error || !project) return <div className="p-10 text-red-500">{error ?? t("project_not_found")}</div>;
  if (stepMetaError) return <div className="p-10 text-red-500">{t("load_steps_failed", "无法加载流程步骤定义，请确保后端已配置默认流程模板")}</div>;

  const isCreator = project?.createdBy === currentUserId;
  const isArchived = project.status === "Archived";

  const userActiveSteps = wf.steps.filter(
    (s) => s.status === "in_progress" && s.assignedUserId === currentUserId && !s.isParallelGroup,
  );
  const currentStep = userActiveSteps[0] || null;
  const focusedStep = currentStep || (isCreator
    ? wf.steps.find((step) => step.status === "in_progress" && !step.isParallelGroup) || null
    : null);

  return (
    <div className="flex min-h-0 flex-col space-y-4">
      <PageHeader
        title={project.name}
        description={project.description || t("no_description")}
        badges={
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
            project.status === "Approved" && "bg-green-50 text-green-700 border border-green-200",
            isArchived && "bg-gray-50 text-gray-400 border border-gray-200",
            !project.status || (project.status !== "Approved" && !isArchived) && "bg-gray-100 text-gray-700",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", project.status === "Approved" ? "bg-green-500" : isArchived ? "bg-gray-400" : "bg-gray-500")} />
            {t(project.status === "Approved" ? "status_approved" : isArchived ? "status_inactive" : project.status === "Active" || !project.status ? "status_active" : project.status === "Draft" ? "status_draft" : project.status === "In Review" ? "status_in_review" : "status_active")}
          </span>
        }
        actions={currentStep ? (
          <div className="flex shrink-0 items-center gap-2 text-[13px] sm:pt-1">
            <span className="text-gray-400">{t("current_step", "当前步骤")}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-action" />
            <span className="font-medium text-gray-700">{t(stepMeta[currentStep.stepName]?.label || currentStep.stepName, stepMeta[currentStep.stepName]?.label || currentStep.stepName)}</span>
          </div>
        ) : undefined}
      />

      <Tabs
        variant="segmented"
        items={[
          { key: "workflow", label: t("workflow", "工作流程进度") },
          ...(isCreator ? [
            { key: "summary", label: t("data_summary", "数据概览") },
            { key: "raw_data", label: t("project_data_overview") },
          ] : []),
        ]}
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
      />

      <div className="flex-1 min-h-0">
        {/* Workflow Tab */}
        {activeTab === "workflow" && (
          <div className="space-y-5">
            <WorkflowProgressCard steps={wf.steps} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <WorkflowStepList
                wf={wf}
                wfLoading={wfLoading}
                projectId={projectId!}
                isArchived={isArchived}
                experiments={experiments}
                stepMeta={stepMeta}
              />

              <WorkflowTaskSidebar
                focusedStep={focusedStep}
                projectId={projectId!}
                isArchived={isArchived}
                pickedCellsCount={pickedCells.length}
                experiments={experiments}
                stepMeta={stepMeta}
              />
            </div>
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === "summary" && (dataLoading ? <SkeletonCard rows={5} /> :
          <DataSummary loadedTypes={loadedTypes} processData={processData} calendarLife={calendarLife}
            storageSwelling={storageSwelling} energyEfficiency={energyEfficiency} dcrTest={dcrTest}
            fastCharge={fastCharge} htCycle={htCycle} />
        )}

        {/* Raw Data Tab */}
        {activeTab === "raw_data" && (dataLoading ? <SkeletonCard rows={5} /> :
          <ProjectRawData loadedTypes={loadedTypes} processData={processData} calendarLife={calendarLife}
            storageSwelling={storageSwelling} energyEfficiency={energyEfficiency} dcrTest={dcrTest}
            fastCharge={fastCharge} htCycle={htCycle} projectId={projectId!}
            onImported={() => setRefetchTrigger((n) => n + 1)} />
        )}
      </div>
    </div>
  );
}
