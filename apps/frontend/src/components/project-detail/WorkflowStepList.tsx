import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, CheckCircle2, Circle, Play, ChevronRight, User, LockKeyhole, ListChecks
} from "lucide-react";
import { cn } from "../../lib/utils";
import { BuiltInStep, resolveStepRoute } from "@eln/shared";
import type { WfData, WfStep, StepMetaMap } from "../../hooks/useProjectWorkflow";
import type { Experiment } from "../../types";
import { bs } from "../../hooks/useProjectWorkflow";

interface WorkflowStepListProps {
  wf: WfData;
  wfLoading: boolean;
  projectId: string;
  isArchived: boolean;
  experiments: Experiment[];
  stepMeta: StepMetaMap;
}

export function WorkflowStepList({
  wf,
  wfLoading,
  projectId,
  isArchived,
  experiments,
  stepMeta,
}: WorkflowStepListProps) {
  const { t } = useTranslation();
  const visibleSteps = wf.steps.filter((s) => s.status !== "skipped");
  const stepParents = visibleSteps.filter((s) => !s.parentStepName);

  const stepChildren = (parentName: string) => {
    return visibleSteps.filter((s) => s.parentStepName === parentName).sort((a, b) => a.stepIndex - b.stepIndex);
  };

  return (
    <section className="overflow-hidden rounded-lg bg-gray-50/70">
      <div className="px-5 pb-3 pt-5 sm:px-6">
        <h2 className="text-[15px] font-semibold text-gray-900">{t("workflow", "工作流程")}</h2>
        <p className="mt-1 text-xs text-gray-500">{t("workflow_subtitle")}</p>
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
            const meta = stepMeta[step.stepName] || { label: step.stepName, icon: <Circle className="h-4 w-4" /> };
            const children = stepChildren(step.stepName);
            const hasChildren = children.length > 0;
            const isComplete = step.status === "completed";
            const isInProgress = step.status === "in_progress";
            const isPending = step.status === "pending";
            const route = (isPending || hasChildren) ? null : resolveStepRoute({ stepName: step.stepName, projectId, experiments, builtInStep: bs(stepMeta, step.stepName) });
            const canOpen = !isArchived && !!route;

            return (
              <div key={step.stepName} className={cn("relative rounded-surface px-3 py-3 transition-colors sm:px-4", isInProgress && "bg-action-subtle/60")}>
                {index < stepParents.length - 1 && <div className="absolute bottom-[-6px] left-7 top-11 w-px -translate-x-1/2 bg-gray-200 sm:left-8" aria-hidden="true" />}
                <Link
                  to={isArchived ? "#" : (route || "#")}
                  aria-current={isInProgress ? "step" : undefined}
                  onClick={(event) => {
                    if (isArchived || !route) event.preventDefault();
                  }}
                  className={cn(
                    "group flex min-w-0 items-center gap-3 no-underline",
                    canOpen ? "cursor-pointer" : isPending || isArchived ? "cursor-not-allowed" : "cursor-default",
                  )}
                >
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <div className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                      isComplete ? "border-transparent bg-emerald-50 text-emerald-700" :
                        isInProgress ? "border-transparent bg-action text-white" :
                          "border-transparent bg-gray-100 text-gray-400",
                    )}>
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : isInProgress ? <Play className="ml-0.5 h-3.5 w-3.5 fill-current" /> : index + 1}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-sm font-medium", isPending ? "text-gray-500" : "text-gray-900")}>
                        {t(meta.label, meta.label)}
                      </span>
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
                      const childMeta = stepMeta[child.stepName] || { label: child.stepName, icon: <Circle className="h-3 w-3" /> };
                      const childPending = child.status === "pending";
                      const childRoute = childPending ? null : resolveStepRoute({ stepName: child.stepName, projectId, experiments, builtInStep: bs(stepMeta, child.stepName) });
                      const childCanOpen = !isArchived && !!childRoute;
                      return (
                        <Link
                          key={child.stepName}
                          to={isArchived ? "#" : (childRoute || "#")}
                          onClick={(event) => { if (!childCanOpen) event.preventDefault(); }}
                          className={cn(
                            "group flex min-w-0 items-center gap-3 px-3 py-2.5 no-underline transition-colors",
                            childIndex > 0 && "mt-0.5",
                            childCanOpen ? "rounded hover:bg-white" : "cursor-not-allowed",
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
                            <p className={cn("truncate text-[13px]", child.status === "in_progress" ? "font-medium text-action-muted" : "text-gray-700")}>
                              <span className="text-gray-400 font-normal mr-1.5">{index + 1}.{childIndex + 1}</span>
                              {t(childMeta.label, childMeta.label)}
                            </p>
                            {child.assignedUserId && <p className="mt-0.5 truncate text-[11px] text-gray-400">{t("assignee", "执行人")}: {(child as any).assignedUserName || `用户 #${child.assignedUserId.slice(0, 6)}`}</p>}
                          </div>
                          <StatusBadge status={child.status} />
                          {childCanOpen && <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-700" />}
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
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { key: string; cls: string }> = {
    pending: { key: "step_pending", cls: "bg-gray-100 text-gray-500" },
    in_progress: { key: "step_in_progress", cls: "bg-action-subtle text-action-muted font-medium" },
    completed: { key: "step_completed", cls: "bg-emerald-100/80 text-emerald-700 font-medium" },
    skipped: { key: "step_skipped", cls: "bg-gray-100 text-gray-400" },
  };
  const s = map[status] || map.pending;
  return <span className={cn("text-[10px] px-2 py-0.5 rounded-md shrink-0", s.cls)}>{t(s.key)}</span>;
}
