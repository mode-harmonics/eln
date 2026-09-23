import { api } from "./api";

type WorkflowTarget = { stepName: string; builtInStep?: string | null; isParallelGroup?: boolean };

export function mergeInstanceStepMeta<T extends { builtInStep?: string }>(
  defaults: Record<string, T>, steps: WorkflowTarget[], fallback: (stepName: string) => T,
): Record<string, T> {
  const result = { ...defaults };
  for (const step of steps) {
    if (!step.builtInStep) continue;
    result[step.stepName] = { ...(defaults[step.stepName] ?? fallback(step.stepName)), builtInStep: step.builtInStep };
  }
  return result;
}

export function findWorkflowStep<T extends WorkflowTarget>(steps: T[], builtInStep: string): T | undefined {
  const exact = steps.find((item) => (item.builtInStep ?? item.stepName) === builtInStep);
  if (exact || builtInStep !== "design") return exact;
  return steps.find((item) => (item.builtInStep ?? item.stepName) === "experiment_design" && item.isParallelGroup === false);
}

/** Reconcile a retry against the intended step before asking the server to advance. */
export async function completeWorkflowStep(projectId: string, builtInStep: string) {
  const workflow = await api.get<{ steps: (WorkflowTarget & { status: string })[] }>(`/api/v1/workflow/instances/${projectId}`);
  const step = findWorkflowStep(workflow.steps, builtInStep);
  if (step?.status === "completed") return;
  if (!step || step.status !== "in_progress") {
    throw new Error("目标工步当前不可提交，请刷新工作流程后重试 / Refresh the workflow before submitting this step.");
  }
  await api.put(`/api/v1/workflow/instances/${projectId}/transition`, { expectedStepName: step.stepName });
}
