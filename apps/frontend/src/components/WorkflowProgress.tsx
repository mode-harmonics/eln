import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Check, Circle, Loader2, Play } from "lucide-react";

export interface WorkflowStepDef {
  stepName: string;
  stepIndex: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  assignedUserId: string | null;
  isParallelGroup: boolean;
  parentStepName: string | null;
}

interface WorkflowProgressProps {
  steps: WorkflowStepDef[];
  currentStepIndex: number;
  workflowStatus: string;
  className?: string;
}

export function WorkflowProgress({
  steps,
  currentStepIndex,
  workflowStatus,
  className,
}: WorkflowProgressProps) {
  const { t } = useTranslation();

  // Separate into serial + parallel groups
  const visibleSteps = steps.filter((s) => !s.parentStepName);

  return (
    <div className={cn("space-y-3", className)}>
      {workflowStatus === "Completed" && (
        <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium flex items-center gap-2">
          <Check className="w-4 h-4" />
          {t("workflow_completed", "All steps completed")}
        </div>
      )}

      {visibleSteps.map((step, idx) => {
        const isCompleted = step.status === "completed";
        const isCurrent = step.status === "in_progress" && !step.isParallelGroup;

        // Find parallel children
        const children = step.isParallelGroup
          ? steps.filter((s) => s.parentStepName === step.stepName)
          : [];

        return (
          <div key={step.stepName}>
            <div className="flex items-start gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-colors",
                    isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : isCurrent
                        ? "border-blue-500 text-blue-500 bg-blue-50"
                        : step.isParallelGroup && step.status === "in_progress"
                          ? "border-amber-400 text-amber-500 bg-amber-50"
                          : "border-gray-300 text-gray-400 bg-white",
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : isCurrent || (step.isParallelGroup && step.status === "in_progress") ? (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <span className="text-xs font-bold">{idx + 1}</span>
                  )}
                </div>
                {idx < visibleSteps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-6 mt-1",
                      isCompleted ? "bg-green-300" : "bg-gray-200",
                    )}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isCurrent
                        ? "text-blue-700"
                        : isCompleted
                          ? "text-green-700"
                          : "text-gray-700",
                    )}
                  >
                    {stepLabel(step.stepName)}
                  </span>
                  <StatusBadge status={step.status} />
                </div>

                {/* Parallel sub-steps */}
                {children.length > 0 && (
                  <div className="mt-2 ml-2 space-y-1">
                    {children.map((child) => {
                      const childDone = child.status === "completed";
                      const childActive = child.status === "in_progress";
                      return (
                        <div key={child.stepName} className="flex items-center gap-2 text-xs">
                          {childDone ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : childActive ? (
                            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                          ) : (
                            <Circle className="w-3 h-3 text-gray-300" />
                          )}
                          <span
                            className={cn(
                              childDone && "text-green-600 line-through",
                              childActive && "text-blue-600 font-medium",
                              !childDone && !childActive && "text-gray-400",
                            )}
                          >
                            {stepLabel(child.stepName)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t("step_pending", "Pending"), cls: "bg-gray-100 text-gray-500" },
    in_progress: { label: t("step_in_progress", "In Progress"), cls: "bg-blue-100 text-blue-700" },
    completed: { label: t("status_approved"), cls: "bg-green-100 text-green-700" },
    skipped: { label: t("step_skipped", "Skipped"), cls: "bg-gray-100 text-gray-400" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

const LABEL_MAP: Record<string, string> = {
  experiment_design: "Experiment Design",
  drying: "Drying",
  liquid_injection: "Liquid Injection",
  formation: "Formation",
  second_sealing: "Second Sealing",
  capacity_grading: "Capacity Grading",
  battery_selection: "Battery Selection",
  testing: "Testing",
  calendar_life: "Calendar Life",
  storage_swelling: "Storage Swelling",
  energy_efficiency: "Energy Efficiency",
  dcr_test: "DCR Test",
  fast_charge: "Fast Charge",
  ht_cycle: "HT Cycle",
};

function stepLabel(stepName: string): string {
  return LABEL_MAP[stepName] || stepName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
