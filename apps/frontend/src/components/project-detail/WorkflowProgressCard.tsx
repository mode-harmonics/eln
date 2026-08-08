import React from "react";
import { useTranslation } from "react-i18next";
import { ListChecks } from "lucide-react";
import type { WfStep } from "../../hooks/useProjectWorkflow";

interface WorkflowProgressCardProps {
  steps: WfStep[];
}

export function WorkflowProgressCard({ steps }: WorkflowProgressCardProps) {
  const { t } = useTranslation();
  const visibleSteps = steps.filter((s) => s.status !== "skipped");
  const stepParents = visibleSteps.filter((s) => !s.parentStepName);

  const completedStepCount = stepParents.filter((step) => step.status === "completed").length;
  const activeStepCount = stepParents.filter((step) => step.status === "in_progress").length;
  const workflowProgress = stepParents.length > 0
    ? Math.round((completedStepCount / stepParents.length) * 100)
    : 0;

  return (
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
  );
}
