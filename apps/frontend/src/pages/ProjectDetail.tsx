import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, Link, useRouteLoaderData, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, CheckCircle2, Circle, Play, FileText, Beaker,
  FlaskConical, Layers, Clock, Thermometer, Zap, Activity,
  ChevronRight, User,
} from "lucide-react";
import { Button } from "../components/Button";
import { cn } from "../lib/utils";
import { usePermissions } from "../hooks/usePermissions";
import { Tabs } from "../components/Tabs";
import { DataSummary } from "../components/DataSummary";
import { SkeletonCard } from "../components/Skeleton";
import { CellPicker } from "../components/CellPicker";
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
  experiment_design:  { label: "实验设计", icon: <FileText className="w-4 h-4" /> },
  drying:             { label: "干燥", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  liquid_injection:   { label: "注液", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  formation:          { label: "化成", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  second_sealing:     { label: "二封", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  capacity_grading:   { label: "定容", icon: <FlaskConical className="w-4 h-4" />, dataType: "process" },
  battery_selection:  { label: "挑选电池", icon: <Layers className="w-4 h-4" /> },
  testing:            { label: "测试", icon: <Beaker className="w-4 h-4" /> },
  calendar_life:      { label: "日历寿命", icon: <Clock className="w-3.5 h-3.5" />, dataType: "calendar" },
  storage_swelling:   { label: "存储胀气", icon: <Thermometer className="w-3.5 h-3.5" />, dataType: "swelling" },
  energy_efficiency:  { label: "能效", icon: <Zap className="w-3.5 h-3.5" />, dataType: "efficiency" },
  dcr_test:           { label: "4C DCR", icon: <Activity className="w-3.5 h-3.5" />, dataType: "dcr" },
  fast_charge:        { label: "快充", icon: <Zap className="w-3.5 h-3.5" />, dataType: "fastcharge" },
  ht_cycle:           { label: "高温循环", icon: <Beaker className="w-3.5 h-3.5" />, dataType: "htcycle" },
};

// ─── Main Component ─────────────────────────────────────────────

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "workflow" | "summary") || "workflow";

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
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
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

  // ── User ID ──
  useEffect(() => {
    const stored = localStorage.getItem("currentUserId");
    if (stored) { setCurrentUserId(stored); return; }
    api.get<any>("/api/v1/users/me").then((d) => { if (d?.id) { setCurrentUserId(d.id); localStorage.setItem("currentUserId", d.id); } }).catch(() => {});
  }, []);

  // ── Fetch workflow + permissions ──
  const fetchWf = useCallback(async () => {
    if (!projectId) return;
    setWfLoading(true);
    try {
      const [wfData, permData, exps] = await Promise.all([
        api.get<WfData>(`/api/v1/workflow/instances/${projectId}`).catch(() => ({ instance: null, steps: [] })),
        api.get<any>(`/api/v1/workflow/instances/${projectId}/permissions`).catch(() => ({ visibleStepNames: [], canViewInternalCode: false })),
        api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).catch(() => []),
      ]);
      setWf(wfData);
      setPerms(permData);
      const expsArr = Array.isArray(exps) ? exps : [];

      // Ensure experiments exist for steps that are in_progress or completed
      // (backfill for existing projects or auto-creation fallback)
      if (wfData.instance && wfData.steps.length > 0) {
        const existingStepNames = new Set(expsArr.map((e: any) => e.workflowStepName));
        const stepsNeedingExps = wfData.steps.filter(
          (s) => s.status !== 'pending' && !s.parentStepName && !existingStepNames.has(s.stepName) && !['experiment_design', 'battery_selection', 'testing'].includes(s.stepName),
        );
        if (stepsNeedingExps.length > 0) {
          // Create experiments silently — ignore errors
          await Promise.allSettled(
            stepsNeedingExps.map((step) =>
              api.post(`/api/v1/projects/${projectId}/experiments`, {
                title: `${STEP_META[step.stepName]?.label || step.stepName} - ${new Date().toISOString().split('T')[0]}`,
                assayType: step.stepName,
                workflowStepName: step.stepName,
              }).catch(() => {}),
            ),
          );
          // Re-fetch experiments
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
    if (s.isParallelGroup) return true; // always show group
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

  // ── Transition ──
  const handleTransition = async () => {
    if (!projectId) return;
    setTransitioning(true);
    try {
      const r = await api.put<any>(`/api/v1/workflow/instances/${projectId}/transition`);
      setWf(r);
      toast.success(t("step_completed"));
      setRefetchTrigger((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("transition_failed"));
    } finally {
      setTransitioning(false);
    }
  };

  // ── Other data loading ──
  useEffect(() => { if (!projectId) return; api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`).then((d) => setPickedCells((d || []).map((p: any) => p.cellId))).catch(() => {}); }, [projectId, refetchTrigger]);
  useEffect(() => { if (!projectId) return; api.get<CellGroup[]>(`/api/v1/projects/${projectId}/groups`).then(setGroups).catch(() => {}); }, [projectId]);

  // Summary data
  useEffect(() => {
    if (!projectId || activeTab !== "summary") return;
    let cancelled = false;
    setDataLoading(true);
    api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`).then((allExps) => {
      if (cancelled || !Array.isArray(allExps)) return;
      const expIdsByType: Record<string, string[]> = {};
      for (const exp of allExps) { const at = exp.metadata?.assayType as string; if (at && RECORD_TYPE_TO_API_TYPE[at]) { if (!expIdsByType[at]) expIdsByType[at] = []; expIdsByType[at].push(exp.id); } }
      const setters: Record<string, any> = { ProcessData: ["process", setProcessData], CalendarLife: ["calendar", setCalendarLife], StorageSwelling: ["swelling", setStorageSwelling], EnergyEfficiency: ["efficiency", setEnergyEfficiency], DcrTest: ["dcr", setDcrTest], FastCharge: ["fastcharge", setFastCharge], HtCycle: ["htcycle", setHtCycle] };
      const tasks = Object.entries(setters).map(([at, [apiType, setter]]) => { const ids = expIdsByType[at] || []; if (!ids.length) { setter([]); setLoadedTypes((p) => [...p, apiType]); return; } return Promise.all(ids.map((eid: string) => api.get<any[]>(`/api/v1/data/${apiType}/${eid}`).catch(() => []))).then((rs) => { if (!cancelled) { setter(rs.flat()); setLoadedTypes((p) => [...p, apiType]); } }); });
      Promise.all(tasks.filter(Boolean)).finally(() => { if (!cancelled) setDataLoading(false); });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, activeTab, refetchTrigger]);

  if (error || !project) return <div className="p-10">{error ?? t("project_not_found")}</div>;

  const stepParents = visibleSteps.filter((s) => !s.parentStepName);
  const stepChildren = (parentName: string) => visibleSteps.filter((s) => s.parentStepName === parentName);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{project.description}</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        items={[
          { key: "workflow", label: t("workflow") },
          { key: "summary", label: t("data_summary") },
        ]}
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
      />

      {/* ═══════════ Workflow Tab ═══════════ */}
      {activeTab === "workflow" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: step list */}
          <div className="lg:col-span-2 space-y-2">
            {wfLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : !wf.instance ? (
              <p className="text-sm text-gray-400 text-center py-8">{t("no_workflow")}</p>
            ) : (
              stepParents.map((step) => {
                const meta = STEP_META[step.stepName] || { label: step.stepName, icon: <Circle className="w-4 h-4" /> };
                const children = stepChildren(step.stepName);
                const route = stepRoute(step.stepName, projectId!, experiments);
                const isCurrent = currentStep?.stepName === step.stepName || allUserSteps.some((s) => s.stepName === step.stepName || s.parentStepName === step.stepName);
                const isComplete = step.status === "completed";
                const isInProgress = step.status === "in_progress";

                return (
                  <div key={step.stepName} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                    {/* Step header — clickable row */}
                    <Link
                      to={route || "#"}
                      onClick={(e) => { if (!route) e.preventDefault(); }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors no-underline",
                        isInProgress ? "bg-blue-50/60" : isComplete ? "bg-green-50/40" : "hover:bg-gray-50",
                      )}
                    >
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        isComplete ? "bg-green-500 text-white" :
                        isInProgress ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-400"
                      )}>
                        {isComplete ? <CheckCircle2 className="w-4 h-4" /> : isInProgress ? <Play className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", isComplete ? "text-green-700" : isInProgress ? "text-blue-700" : "text-gray-600")}>
                            {meta.label}
                          </span>
                          <StatusBadge status={step.status} />
                        </div>
                        {step.assignedUserId && (
                          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3" /> Assigned to user {step.assignedUserId.slice(0, 8)}
                          </p>
                        )}
                      </div>
                      {children.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          {children.filter((c) => c.status === "completed").length}/{children.length}
                        </div>
                      )}
                      {route && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
                    </Link>

                    {/* Parallel children */}
                    {children.length > 0 && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2 space-y-1">
                        {children.map((child) => {
                          const cm = STEP_META[child.stepName] || { label: child.stepName, icon: <Circle className="w-3 h-3" /> };
                          const childRoute = stepRoute(child.stepName, projectId!, experiments);
                          return (
                            <Link
                              key={child.stepName}
                              to={childRoute || "#"}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors no-underline",
                                child.status === "in_progress" ? "bg-blue-50" : child.status === "completed" ? "bg-green-50" : "hover:bg-gray-100",
                              )}
                            >
                              {child.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> :
                               child.status === "in_progress" ? <Play className="w-3 h-3 fill-current text-blue-500" /> :
                               <Circle className="w-3 h-3 text-gray-300" />}
                              <span className={cn("text-xs flex-1", child.status === "completed" ? "text-green-600 line-through" : child.status === "in_progress" ? "text-blue-600 font-medium" : "text-gray-500")}>
                                {cm.label}
                              </span>
                              <StatusBadge status={child.status} />
                              {childRoute && <ChevronRight className="w-3 h-3 text-gray-300" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right: current task */}
          <div className="space-y-3">
            {currentStep && (
              <div className="bg-white border border-blue-200/60 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {t("current_task")}
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      {currentStep.stepName && (STEP_META[currentStep.stepName]?.icon || <Circle className="w-4 h-4" />)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {STEP_META[currentStep.stepName]?.label || currentStep.stepName}
                      </p>
                      {(currentStep.stepName === "experiment_design" || currentStep.stepName === "battery_selection") && (
                        <Link
                          to={currentStep.stepName === "experiment_design" ? `/projects/${projectId}/design` : `/projects/${projectId}`}
                          className="text-[11px] text-blue-600 hover:text-blue-800 mt-0.5 inline-flex items-center gap-0.5"
                        >
                          {t("view_details")} <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <Button size="sm" onClick={handleTransition} loading={transitioning} className="!w-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />{t("complete_step")}
                    </Button>
                  </div>
                </div>
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

      {/* CellPicker */}
      {(() => {
        const pe = experiments.find((e) => (e as any).metadata?.assayType === "ProcessData") as any;
        return pe ? <CellPicker open={cellPickerOpen} onClose={() => setCellPickerOpen(false)} projectId={projectId!} processExperimentId={pe.id} onComplete={(cells) => { setPickedCells(cells); setRefetchTrigger((n) => n + 1); }} /> : null;
      })()}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

/** Map step name to navigation route. Returns null if no dedicated page. */
function stepRoute(stepName: string, projectId: string, experiments: Experiment[]): string | null {
  switch (stepName) {
    case "experiment_design": return `/projects/${projectId}/design`;
    case "battery_selection": return null;
  }
  // Find experiment by workflowStepName (each step gets its own experiment)
  const exp = experiments.find((e) => (e as any).workflowStepName === stepName);
  return exp ? `/projects/${projectId}/experiments/${exp.id}` : null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待处理", cls: "bg-gray-100 text-gray-400" },
    in_progress: { label: "进行中", cls: "bg-blue-50 text-blue-600" },
    completed: { label: "已完成", cls: "bg-green-50 text-green-600" },
    skipped: { label: "已跳过", cls: "bg-gray-100 text-gray-400" },
  };
  const s = map[status] || map.pending;
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", s.cls)}>{s.label}</span>;
}
