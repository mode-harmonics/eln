import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText, Layers, FlaskConical, Beaker, Clock, Thermometer, Zap, Activity
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { BuiltInStep, STEP_ASSAY_MAP } from "@eln/shared";
import { toast } from "../components/Toast";
import type { Experiment } from "../types";

export interface WfStep {
  stepName: string;
  stepIndex: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  assignedUserId: string | null;
  isParallelGroup: boolean;
  parentStepName: string | null;
}

export interface WfData {
  instance: { id: string; projectId: string; status: string; currentStepIndex: number } | null;
  steps: WfStep[];
}

export interface StepMetaEntry {
  label: string;
  icon: React.ReactNode;
  dataType?: string;
  builtInStep?: string;
}

export type StepMetaMap = Record<string, StepMetaEntry>;

export const STEP_ICON: Record<string, React.ReactNode> = {
  experiment_design: <FileText className="w-4 h-4" />,
  design: <FileText className="w-3.5 h-3.5" />,
  procurement: <Layers className="w-3.5 h-3.5" />,
  solution_preparation: <FlaskConical className="w-4 h-4" />,
  drying_injection: <FlaskConical className="w-4 h-4" />,
  formation: <FlaskConical className="w-4 h-4" />,
  second_sealing: <FlaskConical className="w-4 h-4" />,
  capacity_grading: <FlaskConical className="w-4 h-4" />,
  battery_selection: <Layers className="w-4 h-4" />,
  testing: <Beaker className="w-4 h-4" />,
  calendar_life: <Clock className="w-3.5 h-3.5" />,
  storage_swelling: <Thermometer className="w-3.5 h-3.5" />,
  energy_efficiency: <Zap className="w-3.5 h-3.5" />,
  dcr_test: <Activity className="w-3.5 h-3.5" />,
  fast_charge: <Zap className="w-3.5 h-3.5" />,
  ht_cycle: <Beaker className="w-3.5 h-3.5" />,
};

/** Resolve a step's builtInStep value (for template-driven branching). */
export function bs(meta: StepMetaMap, stepName: string): string {
  return meta[stepName]?.builtInStep ?? stepName;
}

/** Steps whose builtInStep indicates they should NOT auto-create an experiment. */
export const BS_NO_AUTO_EXP: string[] = [
  BuiltInStep.ExperimentDesign, BuiltInStep.BatterySelection, BuiltInStep.Testing,
];

/** Steps whose builtInStep triggers special sidebar panels. */
export const BS_SPECIAL_PANEL: string[] = [
  BuiltInStep.ExperimentDesign, BuiltInStep.BatterySelection, BuiltInStep.Testing,
];

/** Fetch default template steps from backend using normalized api.get */
async function fetchStepMeta(): Promise<StepMetaMap> {
  const meta: StepMetaMap = {};
  const res = await api.get<any>("/api/v1/workflow/default-steps");
  const data = res?.data ?? res ?? {};
  const steps: Array<{ id: string; label: string; builtInStep?: string | null; dataType?: string | null; children?: any[] }> = data.steps || [];

  const addNode = (n: { id: string; label: string; builtInStep?: string | null; dataType?: string | null }) => {
    const icon = STEP_ICON[n.id] ?? <Beaker className="w-4 h-4" />;
    meta[n.id] = { label: n.label, icon, dataType: n.dataType ?? undefined, builtInStep: n.builtInStep ?? n.id };
  };

  for (const s of steps) {
    addNode(s);
    if (s.children) {
      for (const c of s.children) addNode(c);
    }
  }
  return meta;
}

export function useProjectWorkflow(projectId?: string) {
  const { t } = useTranslation();
  const [wf, setWf] = useState<WfData>({ instance: null, steps: [] });
  const [wfLoading, setWfLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isDesignSubmitted, setIsDesignSubmitted] = useState(false);

  const [perms, setPerms] = useState<{
    canViewInternalCode: boolean;
    visibleStepNames: string[];
    currentStepName: string | null;
  }>({ canViewInternalCode: false, visibleStepNames: [], currentStepName: null });

  const [stepMeta, setStepMeta] = useState<StepMetaMap>({});
  const [stepMetaError, setStepMetaError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStepMeta()
      .then((meta) => { if (!cancelled) { setStepMeta(meta); setStepMetaError(false); } })
      .catch(() => { if (!cancelled) setStepMetaError(true); });
    return () => { cancelled = true; };
  }, []);

  const fetchWf = useCallback(async () => {
    if (!projectId) return;
    setWfLoading(true);
    try {
      const [wfData, permData, exps, designData] = await Promise.all([
        api.get<WfData>(`/api/v1/workflow/instances/${projectId}`).catch(() => ({ instance: null, steps: [] })),
        api.get<any>(`/api/v1/workflow/instances/${projectId}/permissions`).catch(() => ({ visibleStepNames: [], canViewInternalCode: false, currentStepName: null })),
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
          (s) => s.status !== 'pending' && !s.parentStepName && !existingStepNames.has(s.stepName)
            && !BS_NO_AUTO_EXP.includes(bs(stepMeta, s.stepName)),
        );
        if (stepsNeedingExps.length > 0) {
          await Promise.allSettled(
            stepsNeedingExps.map((step) =>
              api.post(`/api/v1/projects/${projectId}/experiments`, {
                title: `${stepMeta[step.stepName]?.label || step.stepName} - ${new Date().toISOString().split('T')[0]}`,
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
  }, [projectId, stepMeta]);

  useEffect(() => { fetchWf(); }, [fetchWf, refetchTrigger]);

  const handleTransition = async () => {
    if (!projectId) return;
    setTransitioning(true);
    try {
      const r = await api.put<any>(`/api/v1/workflow/instances/${projectId}/transition`);
      setWf(r);
      toast.success(t("step_completed", "步骤已标记完成"));
      setRefetchTrigger((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("transition_failed", "提交步骤失败"));
    } finally {
      setTransitioning(false);
    }
  };

  return {
    wf,
    setWf,
    wfLoading,
    perms,
    experiments,
    setExperiments,
    stepMeta,
    stepMetaError,
    refetchTrigger,
    setRefetchTrigger,
    handleTransition,
    transitioning,
    isDesignSubmitted,
  };
}
