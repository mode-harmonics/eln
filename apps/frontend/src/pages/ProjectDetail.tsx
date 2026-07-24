import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link, useRouteLoaderData, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, CheckCircle2, Circle, Play, FileText, Beaker,
  FlaskConical, Layers, Clock, Thermometer, Zap, Activity,
  ChevronRight, User, AlertCircle, LockKeyhole, ListChecks
} from "lucide-react";
import { Button } from "../components/Button";
import { cn } from "../lib/utils";
import { usePermissions } from "../hooks/usePermissions";
import { Tabs } from "../components/Tabs";
import { DataSummary } from "../components/DataSummary";
import { ProjectRawData } from "../components/ProjectRawData";
import { SkeletonCard } from "../components/Skeleton";
import { CellPicker } from "../components/CellPicker";
import { Popconfirm } from "../components/Popconfirm";
import { toast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import { STEP_ASSAY_MAP, getChildStepLabel } from "@eln/shared";
import { RECORD_TYPE_TO_API_TYPE } from "../utils/recordTypes";
import { PageHeader } from "../components/PageHeader";
import type {
  Project, Experiment, ProcessData, CalendarLife, StorageSwelling,
  EnergyEfficiency, DcrTest, FastCharge, HtCycle,
} from "../types";

// ─── Types ──────────────────────────────────────────────────────

interface WfStep {
  stepName: string;
  stepIndex: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  assignedUserId: string | null;
  isParallelGroup: boolean;
  parentStepName: string | null;
}

interface WfData {
  instance: { id: string; projectId: string; status: string; currentStepIndex: number } | null;
  steps: WfStep[];
}

// ─── Step icon & label config (icons stay frontend-only) ────────────

const STEP_META: Record<string, { label: string; icon: React.ReactNode; dataType?: string }> = {
  experiment_design: { label: "实验设计", icon: <FileText className="w-4 h-4" /> },
  design_sub: { label: "1. 实验设计", icon: <FileText className="w-3.5 h-3.5" /> },
  procurement_sub: { label: "2. 试剂采购", icon: <Layers className="w-3.5 h-3.5" /> },
  drying_injection: { label: "干燥/注液", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  formation: { label: "化成", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  second_sealing: { label: "二封", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  capacity_grading: { label: "定容", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  battery_selection: { label: "挑选电池", icon: <Layers className="w-4 h-4" /> },
  testing: { label: "测试", icon: <Beaker className="w-4 h-4" /> },
  calendar_life: { label: "日历寿命", icon: <Clock className="w-3.5 h-3.5" />, dataType: "calendar" },
  storage_swelling: { label: "存储胀气", icon: <Thermometer className="w-3.5 h-3.5" />, dataType: "swelling" },
  energy_efficiency: { label: "能效", icon: <Zap className="w-3.5 h-3.5" />, dataType: "efficiency" },
  dcr_test: { label: "4C DCR", icon: <Activity className="w-3.5 h-3.5" />, dataType: "dcr" },
  fast_charge: { label: "快充", icon: <Zap className="w-3.5 h-3.5" />, dataType: "fastcharge" },
  ht_cycle: { label: "高温循环", icon: <Beaker className="w-3.5 h-3.5" />, dataType: "htcycle" },
};

// ─── Main Component ─────────────────────────────────────────────

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "workflow" | "summary" | "raw_data") || "workflow";

  const loaderProject = useRouteLoaderData("project") as Project | null;
  const [project, setProject] = useState<Project | null>(loaderProject);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Workflow
  const [wf, setWf] = useState<WfData>({ instance: null, steps: [] });
  const [wfLoading, setWfLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem("currentUserId"));
  const [perms, setPerms] = useState<{ canViewInternalCode: boolean; visibleStepNames: string[]; currentStepName: string | null }>({ canViewInternalCode: false, visibleStepNames: [], currentStepName: null });



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

  // Cell groups removed - experiment design groups are used instead
  const [pickedCells, setPickedCells] = useState<string[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [cellPickerOpen, setCellPickerOpen] = useState(false);

  // ── User ID ──
  useEffect(() => {
    const stored = localStorage.getItem("currentUserId");
    if (stored) { setCurrentUserId(stored); }
    else {
      api.get<any>("/api/v1/users/me").then((d) => { if (d?.id) { setCurrentUserId(d.id); localStorage.setItem("currentUserId", d.id); } }).catch(() => { });
    }
  }, []);

  const [isDesignSubmitted, setIsDesignSubmitted] = useState(false);

  // ── Fetch workflow + permissions ──
  const fetchWf = useCallback(async () => {
    if (!projectId) return;
    setWfLoading(true);
    try {
      const [wfData, permData, exps, designData] = await Promise.all([
        api.get<WfData>(`/api/v1/workflow/instances/${projectId}`).catch(() => ({ instance: null, steps: [] })),
        api.get<any>(`/api/v1/workflow/instances/${projectId}/permissions`).catch(() => ({ visibleStepNames: [], canViewInternalCode: false })),
        api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).catch(() => []),
        api.get<any[]>(`/api/v1/projects/${projectId}/design`).catch(() => []),
      ]);
      setWf(wfData);
      setPerms(permData);
      setIsDesignSubmitted(Array.isArray(designData) && designData.length > 0);
      const expsArr = Array.isArray(exps) ? exps : [];

      if (wfData.instance && wfData.steps.length > 0) {
        const existingStepNames = new Set(expsArr.map((e: any) => e.workflowStepName));
        const stepsNeedingExps = wfData.steps.filter(
          (s) => s.status !== 'pending' && !s.parentStepName && !existingStepNames.has(s.stepName) && !['experiment_design', 'battery_selection', 'testing'].includes(s.stepName),
        );
        if (stepsNeedingExps.length > 0) {
          await Promise.allSettled(
            stepsNeedingExps.map((step) =>
              api.post(`/api/v1/projects/${projectId}/experiments`, {
                title: `${STEP_META[step.stepName]?.label || step.stepName} - ${new Date().toISOString().split('T')[0]}`,
                assayType: STEP_ASSAY_MAP[step.stepName] || step.stepName,
                workflowStepName: step.stepName,
              }).catch(() => { }),
            ),
          );
          const updatedExps = await api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).catch(() => []);
          setExperiments(Array.isArray(updatedExps) ? updatedExps : expsArr);
        } else {
          setExperiments(expsArr);
        }
      } else {
        setExperiments(expsArr);
      }
    } catch { /* ignore */ }
    finally { setWfLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchWf(); }, [fetchWf, refetchTrigger]);

  // ── Derive visible steps ──
  const isCreator = project?.createdBy === currentUserId;
  const visibleSteps = wf.steps.filter((s) => {
    if (s.status === "skipped") return false;
    if (isCreator) return true;
    if (s.isParallelGroup) return true;
    if (perms.visibleStepNames.includes(s.stepName)) return true;
    return false;
  });

  // ── Current user steps ──
  const userActiveSteps = wf.steps.filter(
    (s) => s.status === "in_progress" && s.assignedUserId === currentUserId && !s.isParallelGroup,
  );
  const parallelActiveSteps = wf.steps.filter(
    (s) => s.status === "in_progress" && s.assignedUserId === currentUserId && !!s.parentStepName,
  );
  const currentStep = userActiveSteps[0] || null;
  const allUserSteps = [...userActiveSteps, ...parallelActiveSteps];

  // ── Admin Force Transition ──
  const handleTransition = async () => {
    if (!projectId) return;
    setTransitioning(true);
    try {
      const r = await api.put<any>(`/api/v1/workflow/instances/${projectId}/transition`);
      setWf(r);
      toast.success(t("step_completed", "步骤已强制标记完成"));
      setRefetchTrigger((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("transition_failed", "提交步骤失败"));
    } finally {
      setTransitioning(false);
    }
  };



  // ── Load picked cells ──
  useEffect(() => { if (!projectId) return; api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`).then((d) => setPickedCells((d || []).map((p: any) => p.cellId))).catch(() => { }); }, [projectId, refetchTrigger]);

  // Summary / Raw data fetch — loads when either summary or raw_data tab is active
  useEffect(() => {
    if (!projectId || (activeTab !== "summary" && activeTab !== "raw_data")) return;
    let cancelled = false;
    setDataLoading(true);
    setLoadedTypes([]);
    api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).then((allExps) => {
      if (cancelled || !Array.isArray(allExps)) return;
      const expIdsByType: Record<string, string[]> = {};
      for (const exp of allExps) { const at = exp.metadata?.assayType as string; if (at && RECORD_TYPE_TO_API_TYPE[at]) { if (!expIdsByType[at]) expIdsByType[at] = []; expIdsByType[at].push(exp.id); } }
      const setters: Record<string, any> = { ProcessData: ["process", setProcessData], CalendarLife: ["calendar", setCalendarLife], StorageSwelling: ["swelling", setStorageSwelling], EnergyEfficiency: ["efficiency", setEnergyEfficiency], DcrTest: ["dcr", setDcrTest], FastCharge: ["fastcharge", setFastCharge], HtCycle: ["htcycle", setHtCycle] };
      const tasks = Object.entries(setters).map(([at, [apiType, setter]]) => {
        const ids = expIdsByType[at] || [];
        if (!ids.length) { setter([]); setLoadedTypes((p) => [...p, apiType]); return; }
        return Promise.all(ids.map((eid: string) => api.get<any[]>(`/api/v1/data/${apiType}/${eid}`).catch(() => []))).then((rs) => {
          if (!cancelled) {
            let rows = rs.flat();
            // Deduplicate ProcessData by cellId (multiple experiments may share the same cellId)
            if (at === "ProcessData") {
              const seen = new Map<string, any>();
              for (const row of rows) {
                const key = row.cellId || row.id;
                if (!seen.has(key)) seen.set(key, row);
                else {
                  // Merge non-null fields from later rows
                  const existing = seen.get(key);
                  for (const [k, v] of Object.entries(row)) {
                    if (v != null && v !== '' && (existing[k] == null || existing[k] === '')) existing[k] = v;
                  }
                }
              }
              rows = Array.from(seen.values());
            }
            setter(rows);
            setLoadedTypes((p) => [...p, apiType]);
          }
        });
      });
      Promise.all(tasks.filter(Boolean)).finally(() => { if (!cancelled) setDataLoading(false); });
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [projectId, activeTab, refetchTrigger]);

  if (error || !project) return <div className="p-10 text-red-500">{error ?? t("project_not_found")}</div>;

  const stepParents = visibleSteps.filter((s) => !s.parentStepName);
  const stepChildren = (parentName: string) => {
    const children = visibleSteps.filter((s) => s.parentStepName === parentName).sort((a, b) => a.stepIndex - b.stepIndex);
    if (parentName === "experiment_design") {
      const parentStep = visibleSteps.find(s => s.stepName === "experiment_design");
      if (parentStep) {
        let designStatus = parentStep.status;
        let procStatus = parentStep.status;
        if (parentStep.status === "in_progress") {
          designStatus = isDesignSubmitted ? "completed" : "in_progress";
          procStatus = isDesignSubmitted ? "in_progress" : "pending";
        }
        children.push({
          stepName: "design_sub",
          stepIndex: 0,
          status: designStatus,
          assignedUserId: null,
          isParallelGroup: false,
          parentStepName: "experiment_design"
        });
        children.push({
          stepName: "procurement_sub",
          stepIndex: 1,
          status: procStatus,
          assignedUserId: null,
          isParallelGroup: false,
          parentStepName: "experiment_design"
        });
      }
    }
    return children;
  };

  const completedStepCount = stepParents.filter((step) => step.status === "completed").length;
  const activeStepCount = stepParents.filter((step) => step.status === "in_progress").length;
  const workflowProgress = stepParents.length > 0
    ? Math.round((completedStepCount / stepParents.length) * 100)
    : 0;
  const focusedStep = currentStep || (isCreator
    ? wf.steps.find((step) => step.status === "in_progress" && !step.isParallelGroup) || null
    : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description || "暂无项目描述"}
        badges={<span className={cn(
              "inline-flex items-center gap-1.5 rounded bg-gray-100 px-2 py-1 text-xs font-medium",
              project.status === "Approved" ? "text-green-700" : "text-gray-700"
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", project.status === "Approved" ? "bg-green-500" : "bg-gray-500")}></span>
              {project.status || "In Progress"}
            </span>}
        actions={currentStep ? (
          <div className="flex shrink-0 items-center gap-2 text-[13px] sm:pt-1">
            <span className="text-gray-400">{t("current_step", "当前步骤")}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-action"></span>
            <span className="font-medium text-gray-700">{STEP_META[currentStep.stepName]?.label || currentStep.stepName}</span>
          </div>
        ) : undefined}
      />

      {/* ── Tabs ── */}
      <Tabs
        variant="segmented"
        items={[
          { key: "workflow", label: t("workflow", "工作流程进度") },
          ...(isCreator ? [
            { key: "summary", label: t("data_summary", "数据概览") },
            { key: "raw_data", label: "数据汇总" },
          ] : []),
        ]}
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
      />

      {/* ═══════════ Workflow Tab ═══════════ */}
      {activeTab === "workflow" && (
        <div className="space-y-5">
          <section className="rounded-lg bg-gray-50 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-gray-600" />
                  <h2 className="text-[15px] font-semibold text-gray-900">{t("workflow_progress", "流程进度")}</h2>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {completedStepCount} / {stepParents.length} {t("step_completed", "步骤已完成")}
                  {activeStepCount > 0 && ` · ${activeStepCount} ${t("step_in_progress", "进行中")}`}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:min-w-64">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={workflowProgress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-action transition-[width] duration-500" style={{ width: `${workflowProgress}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-semibold tabular-nums text-gray-900">{workflowProgress}%</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="overflow-hidden rounded-lg bg-gray-50/70">
              <div className="px-5 pb-3 pt-5 sm:px-6">
                <h2 className="text-[15px] font-semibold text-gray-900">{t("workflow", "工作流程")}</h2>
                <p className="mt-1 text-xs text-gray-500">按实验阶段查看任务状态、负责人和数据记录</p>
              </div>

              {wfLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>
              ) : !wf.instance ? (
                <div className="px-6 py-16 text-center text-sm text-gray-500">
                  <ListChecks className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                  {t("no_workflow", "当前项目暂无工作流实例")}
                </div>
              ) : (
                <div className="space-y-1 px-2 pb-2 sm:px-3 sm:pb-3">
                  {stepParents.map((step, index) => {
                    const meta = STEP_META[step.stepName] || { label: step.stepName, icon: <Circle className="h-4 w-4" /> };
                    const children = stepChildren(step.stepName);
                    const isComplete = step.status === "completed";
                    const isInProgress = step.status === "in_progress";
                    const isPending = step.status === "pending";
                    const route = isPending ? null : stepRoute(step.stepName, projectId!, experiments);
                    const canOpen = !!route || (step.stepName === "battery_selection" && !isPending);

                    return (
                      <div key={step.stepName} className={cn("relative rounded-surface px-3 py-3 transition-colors sm:px-4", isInProgress && "bg-action-subtle/60")}>
                        {index < stepParents.length - 1 && <div className="absolute bottom-[-6px] left-7 top-11 w-px -translate-x-1/2 bg-gray-200 sm:left-8" aria-hidden="true" />}
                        <Link
                          to={route || "#"}
                          aria-current={isInProgress ? "step" : undefined}
                          onClick={(event) => {
                            if (!route) event.preventDefault();
                            if (step.stepName === "battery_selection" && !isPending) setCellPickerOpen(true);
                          }}
                          className={cn(
                            "group flex min-w-0 items-center gap-3 no-underline",
                            canOpen ? "cursor-pointer" : isPending ? "cursor-not-allowed" : "cursor-default",
                          )}
                        >
                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                            <div className={cn(
                              "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                              isComplete ? "border-transparent bg-emerald-50 text-emerald-700" :
                                isInProgress ? "border-transparent bg-action text-white" :
                                  "border-transparent bg-gray-100 text-gray-400",
                            )}>
                              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : isInProgress ? <Play className="ml-0.5 h-3.5 w-3.5 fill-current" /> : step.stepIndex + 1}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("text-sm font-medium", isPending ? "text-gray-500" : "text-gray-900")}>{meta.label}</span>
                              <StatusBadge status={step.status} />
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                              {step.assignedUserId ? (
                                <><User className="h-3 w-3" /><span className="truncate">{t("assignee", "执行人")}: {(step as any).assignedUserName || `用户 #${step.assignedUserId.slice(0, 6)}`}</span></>
                              ) : isPending ? (
                                <><LockKeyhole className="h-3 w-3" /><span>{t("step_pending", "等待前置步骤完成")}</span></>
                              ) : null}
                            </div>
                          </div>
                          {canOpen && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-700" />}
                        </Link>

                        {children.length > 0 && (
                          <div className="ml-11 mt-3 overflow-hidden rounded-md bg-gray-100/80 p-1">
                            {children.map((child, childIndex) => {
                              const childMeta = STEP_META[child.stepName] || { label: child.stepName, icon: <Circle className="h-3 w-3" /> };
                              const childPending = child.status === "pending";
                              const childRoute = childPending ? null : stepRoute(child.stepName, projectId!, experiments);
                              return (
                                <Link
                                  key={child.stepName}
                                  to={childRoute || "#"}
                                  onClick={(event) => { if (!childRoute) event.preventDefault(); }}
                                  className={cn(
                                    "group flex min-w-0 items-center gap-3 px-3 py-2.5 no-underline transition-colors",
                                    childIndex > 0 && "mt-0.5",
                                    childRoute ? "rounded hover:bg-white" : childPending ? "cursor-not-allowed" : "cursor-default",
                                  )}
                                >
                                  <div className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                                    child.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                                      child.status === "in_progress" ? "bg-action-subtle text-action-muted" : "bg-white text-gray-400",
                                  )}>
                                    {React.isValidElement(childMeta.icon)
                                      ? React.cloneElement(childMeta.icon as React.ReactElement<{ className?: string }>, { className: "h-3 w-3" })
                                      : childMeta.icon}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={cn("truncate text-[13px]", child.status === "in_progress" ? "font-medium text-action-muted" : "text-gray-700")}>{childMeta.label}</p>
                                    {child.assignedUserId && <p className="mt-0.5 truncate text-[11px] text-gray-400">{t("assignee", "执行人")}: {(child as any).assignedUserName || `用户 #${child.assignedUserId.slice(0, 6)}`}</p>}
                                  </div>
                                  <StatusBadge status={child.status} />
                                  {childRoute && <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-700" />}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="lg:sticky lg:top-5">
              {focusedStep ? (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="bg-action-subtle px-5 py-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-action-muted">
                      <span className="h-2 w-2 rounded-full bg-action" />
                      {t("current_task", "当前任务")}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-action-muted">
                        {STEP_META[focusedStep.stepName]?.icon || <Circle className="h-4 w-4" />}
                      </div>
                      <h3 className="text-[15px] font-semibold text-gray-900">{STEP_META[focusedStep.stepName]?.label || focusedStep.stepName}</h3>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex gap-2.5 text-[13px] text-gray-600">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <p className="leading-5">完成当前阶段的数据录入与校验后，可在对应实验页面提交并推进流程。</p>
                    </div>

                    {focusedStep.assignedUserId && (
                      <div className="flex items-center gap-2 pt-1 text-xs text-gray-500">
                        <User className="h-3.5 w-3.5" />
                        <span>{t("assignee", "执行人")}: {(focusedStep as any).assignedUserName || `用户 #${focusedStep.assignedUserId.slice(0, 6)}`}</span>
                      </div>
                    )}

                    {focusedStep.stepName === "experiment_design" && (
                      <Link to={`/projects/${projectId}/design`} className="block no-underline">
                        <Button variant="primary" className="w-full">
                          <FileText className="h-4 w-4" />
                          前往实验设计
                          <ChevronRight className="ml-auto h-4 w-4" />
                        </Button>
                      </Link>
                    )}

                    {focusedStep.stepName === "battery_selection" && (
                      <Button variant="primary" className="w-full" onClick={() => setCellPickerOpen(true)}>
                        <Layers className="h-4 w-4" />
                        挑选实验电芯 ({pickedCells.length})
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </Button>
                    )}

                    {!['experiment_design', 'battery_selection', 'testing'].includes(focusedStep.stepName) && (() => {
                      const taskRoute = stepRoute(focusedStep.stepName, projectId!, experiments);
                      return taskRoute ? (
                        <Link to={taskRoute} className="block no-underline">
                          <Button variant="primary" className="w-full">
                            打开实验记录
                            <ChevronRight className="ml-auto h-4 w-4" />
                          </Button>
                        </Link>
                      ) : null;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
                  <h3 className="text-sm font-medium text-gray-900">{t("workflow_completed", "暂无待办任务")}</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{t("workflow_completed_desc", "所有步骤已完成或尚未启动")}</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {/* ═══════════ Summary Tab ═══════════ */}
      {activeTab === "summary" && (dataLoading ? <SkeletonCard rows={5} /> :
        <DataSummary loadedTypes={loadedTypes} processData={processData} calendarLife={calendarLife}
          storageSwelling={storageSwelling} energyEfficiency={energyEfficiency} dcrTest={dcrTest}
          fastCharge={fastCharge} htCycle={htCycle} />
      )}

      {/* ═══════════ Raw Data Tab ═══════════ */}
      {activeTab === "raw_data" && (dataLoading ? <SkeletonCard rows={5} /> :
        <ProjectRawData loadedTypes={loadedTypes} processData={processData} calendarLife={calendarLife}
          storageSwelling={storageSwelling} energyEfficiency={energyEfficiency} dcrTest={dcrTest}
          fastCharge={fastCharge} htCycle={htCycle} projectId={projectId!} />
      )}


      {/* CellPicker */}
      {(() => {
        const pe = experiments.find((e) => (e as any).metadata?.assayType === "ProcessData") as any;
        const isBatterySelectionCompleted = visibleSteps.find((s) => s.stepName === "battery_selection")?.status === "completed";
        return pe ? <CellPicker open={cellPickerOpen} onClose={() => setCellPickerOpen(false)} projectId={projectId!} processExperimentId={pe.id} readonly={isBatterySelectionCompleted} onComplete={(cells) => { setPickedCells(cells); setRefetchTrigger((n) => n + 1); }} /> : null;
      })()}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function stepRoute(stepName: string, projectId: string, experiments: Experiment[]): string | null {
  switch (stepName) {
    case "experiment_design": return null; // Unify with testing: parent steps have no arrow
    case "testing": return null;
    case "design_sub": return `/projects/${projectId}/design?tab=design`;
    case "procurement_sub": return `/projects/${projectId}/design?tab=procurement`;
    case "battery_selection": return null;
    case "drying":
    case "liquid_injection": {
      const exp = experiments.find((e) => (e as any).workflowStepName === "drying_injection");
      return exp ? `/projects/${projectId}/experiments/${exp.id}` : null;
    }
  }
  const exp = experiments.find((e) => (e as any).workflowStepName === stepName);
  return exp ? `/projects/${projectId}/experiments/${exp.id}` : null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待处理", cls: "bg-gray-100 text-gray-500" },
    in_progress: { label: "进行中", cls: "bg-action-subtle text-action-muted font-medium" },
    completed: { label: "已完成", cls: "bg-emerald-100/80 text-emerald-700 font-medium" },
    skipped: { label: "已跳过", cls: "bg-gray-100 text-gray-400" },
  };
  const s = map[status] || map.pending;
  return <span className={cn("text-[10px] px-2 py-0.5 rounded-md shrink-0", s.cls)}>{s.label}</span>;
}
