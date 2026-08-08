import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2, Circle, FileText, Layers, ChevronRight, User, AlertCircle, LockKeyhole
} from "lucide-react";
import { Button } from "../Button";
import { BuiltInStep, isExperimentDesignStep, resolveStepRoute } from "@eln/shared";
import type { WfStep, StepMetaMap } from "../../hooks/useProjectWorkflow";
import type { Experiment } from "../../types";
import { bs, BS_SPECIAL_PANEL } from "../../hooks/useProjectWorkflow";

interface WorkflowTaskSidebarProps {
  focusedStep: WfStep | null;
  projectId: string;
  isArchived: boolean;
  pickedCellsCount: number;
  experiments: Experiment[];
  stepMeta: StepMetaMap;
}

export function WorkflowTaskSidebar({
  focusedStep,
  projectId,
  isArchived,
  pickedCellsCount,
  experiments,
  stepMeta,
}: WorkflowTaskSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isExpDesign = focusedStep
    ? isExperimentDesignStep(focusedStep.stepName, bs(stepMeta, focusedStep.stepName))
    : false;

  return (
    <aside className="lg:sticky lg:top-6 self-start">
      {focusedStep ? (
        <div className="overflow-hidden rounded-lg bg-gray-50">
          <div className="bg-action-subtle px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-medium text-action-muted">
              <span className="h-2 w-2 rounded-full bg-action" />
              {t("current_task", "当前任务")}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-action-muted">
                {stepMeta[focusedStep.stepName]?.icon || <Circle className="h-4 w-4" />}
              </div>
              <h3 className="text-[15px] font-semibold text-gray-900">
                {t(stepMeta[focusedStep.stepName]?.label || focusedStep.stepName, stepMeta[focusedStep.stepName]?.label || focusedStep.stepName)}
              </h3>
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

            {isExpDesign && (
              isArchived ? (
                <Button variant="secondary" className="w-full" disabled>
                  <LockKeyhole className="h-4 w-4" />
                  实验设计已归档
                </Button>
              ) : (
                <Link to={`/projects/${projectId}/design`} className="block no-underline">
                  <Button variant="primary" className="w-full">
                    <FileText className="h-4 w-4" />
                    前往实验设计
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </Button>
                </Link>
              )
            )}

            {bs(stepMeta, focusedStep.stepName) === BuiltInStep.BatterySelection && (
              isArchived ? (
                <Button variant="secondary" className="w-full" disabled>
                  <LockKeyhole className="h-4 w-4" />
                  挑选已归档
                </Button>
              ) : (
                <Button variant="primary" className="w-full" onClick={() => navigate(`/projects/${projectId}/cell-picker`)}>
                  <Layers className="h-4 w-4" />
                  挑选实验电池 ({pickedCellsCount})
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
              )
            )}

            {!BS_SPECIAL_PANEL.includes(bs(stepMeta, focusedStep.stepName)) && !isExpDesign && (() => {
              const taskRoute = resolveStepRoute({ stepName: focusedStep.stepName, projectId, experiments, builtInStep: bs(stepMeta, focusedStep.stepName) });
              return taskRoute ? (
                isArchived ? (
                  <Button variant="secondary" className="w-full" disabled>
                    <LockKeyhole className="h-4 w-4" />
                    记录已归档
                  </Button>
                ) : (
                  <Link to={taskRoute} className="block no-underline">
                    <Button variant="primary" className="w-full">
                      打开实验记录
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </Button>
                  </Link>
                )
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
  );
}
