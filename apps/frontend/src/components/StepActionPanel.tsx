import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Upload, Beaker, FlaskConical, TestTube,
  Layers, CheckCircle2,
} from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { cn } from "../lib/utils";

interface StepAction {
  stepName: string;
  status: string;
  isParallelGroup: boolean;
  parentStepName: string | null;
}

interface StepActionPanelProps {
  projectId: string;
  currentStep: StepAction | null;
  userActiveSteps: StepAction[];
  workflowStatus: string;
  onTransition: () => void;
  transitioning: boolean;
}

export function StepActionPanel({
  projectId,
  currentStep,
  userActiveSteps,
  workflowStatus,
  onTransition,
  transitioning,
}: StepActionPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (workflowStatus === "Completed") {
    return (
      <Card className="border-green-200 bg-green-50/40">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-500" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              {t("workflow_completed", "All Steps Completed")}
            </p>
            <p className="text-xs text-green-600">
              {t("workflow_completed_desc", "This project has finished all workflow steps.")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentStep && userActiveSteps.length === 0) {
    return null;
  }

  const activeStep = currentStep || userActiveSteps[0];

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          {t("current_task", "Current Task")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {userActiveSteps.length > 1 ? (
          // Multiple parallel steps
          <div className="space-y-3">
            {userActiveSteps.map((step) => (
              <div key={step.stepName} className="flex items-center justify-between">
                <span className="text-sm font-medium">{stepLabel(step.stepName)}</span>
                {stepActionButton(step, projectId, navigate, onTransition, transitioning)}
              </div>
            ))}
          </div>
        ) : (
          // Single step
          <>
            <div className="flex items-center gap-3">
              <ActionIcon stepName={activeStep.stepName} />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {stepLabel(activeStep.stepName)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {stepDescription(activeStep.stepName)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-blue-100">
              {stepActionButton(activeStep, projectId, navigate, onTransition, transitioning)}
              {activeStep.stepName === "battery_selection" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/projects/${projectId}?tab=experiments`)}
                >
                  <Layers className="w-4 h-4" />
                  {t("pick_cells")}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ActionIcon({ stepName }: { stepName: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    experiment_design: <Beaker className="w-5 h-5 text-blue-500" />,
    drying: <FlaskConical className="w-5 h-5 text-orange-500" />,
    liquid_injection: <TestTube className="w-5 h-5 text-purple-500" />,
    formation: <FlaskConical className="w-5 h-5 text-red-500" />,
    second_sealing: <FlaskConical className="w-5 h-5 text-teal-500" />,
    capacity_grading: <FlaskConical className="w-5 h-5 text-green-500" />,
    battery_selection: <Layers className="w-5 h-5 text-amber-500" />,
    testing: <TestTube className="w-5 h-5 text-indigo-500" />,
  };
  return iconMap[stepName] || <ArrowRight className="w-5 h-5 text-gray-400" />;
}

function stepLabel(stepName: string): string {
  const map: Record<string, string> = {
    experiment_design: "Experiment Design",
    drying: "Drying",
    liquid_injection: "Liquid Injection",
    formation: "Formation",
    second_sealing: "Second Sealing",
    capacity_grading: "Capacity Grading",
    battery_selection: "Battery Selection",
    testing: "Testing",
  };
  return map[stepName] || stepName;
}

function stepDescription(stepName: string): string {
  const map: Record<string, string> = {
    experiment_design: "Design molecular formulations and submit for procurement",
    drying: "Upload drying process data and complete this step",
    liquid_injection: "Upload liquid injection process data",
    formation: "Upload formation process data",
    second_sealing: "Upload second sealing process data",
    capacity_grading: "Upload capacity grading process data",
    battery_selection: "Pick battery cells for subsequent testing",
    testing: "Run battery tests. All sub-tests must complete.",
  };
  return map[stepName] || "";
}

function stepActionButton(
  step: StepAction,
  projectId: string,
  navigate: (path: string) => void,
  onTransition: () => void,
  transitioning: boolean,
) {
  switch (step.stepName) {
    case "experiment_design":
      return (
        <Button size="sm" onClick={() => navigate(`/projects/${projectId}/design`)}>
          <Beaker className="w-4 h-4" />
          Experiment Design
        </Button>
      );
    case "battery_selection":
      return (
        <Button size="sm" onClick={onTransition} loading={transitioning}>
          <CheckCircle2 className="w-4 h-4" />
          Mark Complete
        </Button>
      );
    case "drying":
    case "liquid_injection":
    case "formation":
    case "second_sealing":
    case "capacity_grading":
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/projects/${projectId}?tab=experiments`)}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </Button>
          <Button size="sm" onClick={onTransition} loading={transitioning}>
            <CheckCircle2 className="w-4 h-4" />
            Mark Complete
          </Button>
        </div>
      );
    default:
      return (
        <Button size="sm" onClick={onTransition} loading={transitioning}>
          <CheckCircle2 className="w-4 h-4" />
          Mark Complete
        </Button>
      );
  }
}
