import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link, useRouteLoaderData, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, CheckCircle2, Circle, Play, FileText, Beaker,
  FlaskConical, Layers, Clock, Thermometer, Zap, Activity,
  ChevronRight, User, UploadCloud, FileDigit, ShieldAlert, AlertCircle, Sparkles
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
import type {
  Project, Experiment, ProcessData, CalendarLife, StorageSwelling,
  EnergyEfficiency, DcrTest, FastCharge, HtCycle, CellGroup,
} from "../types";
import { RECORD_TYPE_TO_API_TYPE } from "../utils/recordTypes";

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

// ─── Step icon & label config ───────────────────────────────────

const STEP_META: Record<string, { label: string; icon: React.ReactNode; dataType?: string }> = {
  experiment_design: { label: "实验设计", icon: <FileText className="w-4 h-4" /> },
  design_sub: { label: "1. 实验设计", icon: <FileText className="w-3.5 h-3.5" /> },
  procurement_sub: { label: "2. 试剂采购", icon: <Layers className="w-3.5 h-3.5" /> },
  drying_injection: { label: "干燥/注液", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  drying: { label: "干燥", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  liquid_injection: { label: "注液", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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

  const [groups, setGroups] = useState<CellGroup[]>([]);
  const [pickedCells, setPickedCells] = useState<string[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [cellPickerOpen, setCellPickerOpen] = useState(false);

  // Permission check for administrative "Force Complete" override
  const canForceComplete = hasPermission("workflow:force_complete") || hasPermission("workflow:*");

  const [users, setUsers] = useState<any[]>([]);

  // ── User ID & Users ──
  useEffect(() => {
    const stored = localStorage.getItem("currentUserId");
    if (stored) { setCurrentUserId(stored); }
    else {
      api.get<any>("/api/v1/users/me").then((d) => { if (d?.id) { setCurrentUserId(d.id); localStorage.setItem("currentUserId", d.id); } }).catch(() => { });
    }
    api.get<any[]>("/api/v1/users").then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const getUserName = (userId: string) => {
    const u = users.find((u) => u.id === userId);
    return u ? (u.fullName || u.username) : `用户 #${userId.slice(0, 6)}`;
  };

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
          const STEP_ASSAY_MAP: Record<string, string> = {
            drying_injection: 'ProcessData',
            formation: 'ProcessData', second_sealing: 'ProcessData', capacity_grading: 'ProcessData',
            calendar_life: 'CalendarLife', storage_swelling: 'StorageSwelling',
            energy_efficiency: 'EnergyEfficiency', dcr_test: 'DcrTest',
            fast_charge: 'FastCharge', ht_cycle: 'HtCycle',
          };
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



  // ── Load groups & picked cells ──
  useEffect(() => { if (!projectId) return; api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`).then((d) => setPickedCells((d || []).map((p: any) => p.cellId))).catch(() => { }); }, [projectId, refetchTrigger]);
  useEffect(() => { if (!projectId) return; api.get<CellGroup[]>(`/api/v1/projects/${projectId}/groups`).then(setGroups).catch(() => { }); }, [projectId]);

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

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={cn(
              "text-[13px] font-medium flex items-center gap-1.5",
              project.status === "Approved" ? "text-green-600" : "text-blue-600"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", project.status === "Approved" ? "bg-green-500" : "bg-blue-500")}></span>
              {project.status || "In Progress"}
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-1 max-w-2xl line-clamp-2">{project.description || "暂无项目描述"}</p>
        </div>
        {currentStep && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Current Step</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5 flex items-center justify-end gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                {STEP_META[currentStep.stepName]?.label || currentStep.stepName}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs
        items={[
          { key: "workflow", label: t("workflow", "工作流程进度") },
          { key: "summary", label: t("data_summary", "数据对比与统计") },
          { key: "raw_data", label: "数据汇总" },
        ]}
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
      />

      {/* ═══════════ Workflow Tab ═══════════ */}
      {activeTab === "workflow" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: step list */}
          <div className="lg:col-span-2 divide-y divide-gray-100 border-y border-gray-100 bg-transparent">
            {wfLoading ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : !wf.instance ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm text-gray-400 text-sm">
                {t("no_workflow", "当前项目暂无工作流实例")}
              </div>
            ) : (
              stepParents.map((step) => {
                const meta = STEP_META[step.stepName] || { label: step.stepName, icon: <Circle className="w-4 h-4" /> };
                const children = stepChildren(step.stepName);
                const isComplete = step.status === "completed";
                const isInProgress = step.status === "in_progress";
                const isPending = step.status === "pending";
                const route = isPending ? null : stepRoute(step.stepName, projectId!, experiments);

                return (
                  <div key={step.stepName} className={cn("bg-transparent py-1 transition-colors", !isPending && "hover:bg-gray-50/50")}>
                    {/* Step header */}
                    <div className="flex items-center justify-between px-2 py-2">
                      <Link
                        to={route || "#"}
                        onClick={(e) => { 
                          if (!route) e.preventDefault(); 
                          if (step.stepName === "battery_selection" && (isInProgress || isComplete)) {
                            setCellPickerOpen(true);
                          }
                        }}
                        className={cn("flex items-center gap-3 flex-1 min-w-0 no-underline", isPending && "opacity-50 cursor-not-allowed")}
                      >
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-medium text-[11px]",
                          isComplete ? "bg-green-100 text-green-700" :
                            isInProgress ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
                        )}>
                          {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : isInProgress ? <Play className="w-3 h-3 fill-current ml-0.5" /> : step.stepIndex + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[13px] font-medium", isComplete ? "text-gray-900" : isInProgress ? "text-blue-700 font-semibold" : "text-gray-500")}>
                              {meta.label}
                            </span>
                            <StatusBadge status={step.status} />
                          </div>
                          {step.assignedUserId && (
                            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400" /> 负责人: {getUserName(step.assignedUserId)}
                            </p>
                          )}
                        </div>
                      </Link>

                      {/* Right action controls on step card */}
                      <div className="flex items-center gap-2 shrink-0">
                        {step.stepName === "battery_selection" && (isInProgress || isComplete) && (
                          <div 
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCellPickerOpen(true); }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        )}
                        {route && (
                          <Link to={route} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Sub-steps */}
                    {children.length > 0 && (
                      <div className={cn("pl-10 pr-2 pb-3 space-y-2", children[0]?.isParallelGroup ? "pt-0" : "pt-1")}>
                        {children.map((child) => {
                          const cm = STEP_META[child.stepName] || { label: child.stepName, icon: <Circle className="w-3 h-3" /> };
                          const isChildPending = child.status === "pending";
                          const childRoute = isChildPending ? null : stepRoute(child.stepName, projectId!, experiments);
                          return (
                            <div
                              key={child.stepName}
                              className={cn(
                                "flex items-center justify-between px-3 py-2.5 rounded-md transition-colors",
                                child.isParallelGroup
                                  ? cn("border-l-2", child.status === "in_progress" ? "border-blue-500 bg-gray-50/50" : child.status === "completed" ? "border-green-500 bg-transparent" : "border-transparent hover:bg-gray-50/50")
                                  : cn("bg-gray-50 border border-gray-100", !isChildPending && "hover:bg-gray-100/70")
                              )}
                            >
                              <Link
                                to={childRoute || "#"}
                                onClick={(e) => { if (!childRoute) e.preventDefault(); }}
                                className={cn("flex items-center gap-3 flex-1 min-w-0 no-underline", isChildPending && "opacity-50 cursor-not-allowed")}
                              >
                                <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0",
                                  child.status === "completed" ? "bg-green-100/50 text-green-600" :
                                    child.status === "in_progress" ? "bg-blue-100/50 text-blue-600" : "bg-white text-gray-400 border border-gray-200"
                                )}>
                                  {React.isValidElement(cm.icon) ? React.cloneElement(cm.icon as React.ReactElement, { className: "w-3 h-3" }) : cm.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={cn("text-[13px] block", child.status === "completed" ? "text-gray-900" : child.status === "in_progress" ? "text-blue-600 font-medium" : "text-gray-600")}>
                                    {cm.label}
                                  </span>
                                  {child.assignedUserId && (
                                    <p className={cn("text-[11px] mt-0.5 flex items-center gap-1", isChildPending ? "text-gray-300" : "text-gray-400")}>
                                      <User className="w-3 h-3" /> 负责人: {getUserName(child.assignedUserId)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <StatusBadge status={child.status} />
                                  {childRoute && <ChevronRight className="w-4 h-4 text-gray-300" />}
                                </div>
                              </Link>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right panel: Task info & Submission Guidelines */}
          <div className="space-y-4 lg:pl-6">
            {currentStep ? (
              <div className="bg-transparent space-y-4">
                <div className="border-b border-gray-100 pb-2">
                  <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    当前任务
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded flex items-center justify-center bg-gray-50 text-gray-700 shrink-0">
                      {STEP_META[currentStep.stepName]?.icon || <Circle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-900">
                        {STEP_META[currentStep.stepName]?.label || currentStep.stepName}
                      </p>
                    </div>
                  </div>

                  <div className="bg-transparent border-l-2 border-gray-200 pl-3 py-1 text-[13px] text-gray-600">
                    <div className="flex items-center gap-1.5 font-medium text-gray-800 mb-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span>操作规范</span>
                    </div>
                    <p className="leading-relaxed text-gray-500">
                      该步骤需要先录入或上传符合规范的线下汇总表数据。校验无误后方可推进至下一环节。
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100">


                    {currentStep.stepName === "experiment_design" && (
                      <Link to={`/projects/${projectId}/design`} className="block no-underline">
                        <Button variant="primary" className="w-full justify-center">
                          前往实验设计
                        </Button>
                      </Link>
                    )}

                    {currentStep.stepName === "battery_selection" && (
                      <Button variant="primary" className="w-full justify-center" onClick={() => setCellPickerOpen(true)}>
                        <Layers className="w-4 h-4" />
                        挑选实验电芯 ({pickedCells.length})
                      </Button>
                    )}

                    {/* Force complete button (Admin / Owner privilege only) */}
                    {canForceComplete && (
                      <div className="pt-2">
                        <Popconfirm
                          title="确定要强制标记此步骤为完成吗？"
                          description="此特权操作不可撤销。"
                          onConfirm={handleTransition}
                          placement="top"
                        >
                          <Button variant="danger" size="sm" loading={transitioning} className="w-full justify-center text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            管理员: 强制完成
                          </Button>
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-transparent border border-gray-100 rounded-lg p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <h3 className="text-[13px] font-medium text-gray-900">暂无待办任务</h3>
                <p className="text-xs text-gray-500 mt-1">所有步骤已完成或尚未启动</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ Summary Tab ═══════════ */}
      {activeTab === "summary" && (dataLoading ? <SkeletonCard rows={5} /> :
        <DataSummary loadedTypes={loadedTypes} processData={processData} calendarLife={calendarLife}
          storageSwelling={storageSwelling} energyEfficiency={energyEfficiency} dcrTest={dcrTest}
          fastCharge={fastCharge} htCycle={htCycle} groups={groups} />
      )}

      {/* ═══════════ Raw Data Tab ═══════════ */}
      {activeTab === "raw_data" && (dataLoading ? <SkeletonCard rows={5} /> :
        <ProjectRawData loadedTypes={loadedTypes} processData={processData} calendarLife={calendarLife}
          storageSwelling={storageSwelling} energyEfficiency={energyEfficiency} dcrTest={dcrTest}
          fastCharge={fastCharge} htCycle={htCycle} groups={groups} projectId={projectId!} />
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
    in_progress: { label: "进行中", cls: "bg-blue-100/80 text-blue-700 font-medium" },
    completed: { label: "已完成", cls: "bg-emerald-100/80 text-emerald-700 font-medium" },
    skipped: { label: "已跳过", cls: "bg-gray-100 text-gray-400" },
  };
  const s = map[status] || map.pending;
  return <span className={cn("text-[10px] px-2 py-0.5 rounded-md shrink-0", s.cls)}>{s.label}</span>;
}
