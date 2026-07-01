import React from "react";
import { cn } from "../lib/utils";
import { Check, Circle } from "lucide-react";

export interface Step {
  key: string;
  label: string;
  description?: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;  // 0-based: which step we're on
  completed: number[];  // indices of completed steps
  className?: string;
}

export function StepProgress({ steps, currentStep, completed, className }: StepProgressProps) {
  return (
    <div className={cn("flex items-start gap-0", className)}>
      {steps.map((step, i) => {
        const isCompleted = completed.includes(i);
        const isCurrent = i === currentStep;
        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center min-w-0 flex-1">
              <div className="flex items-center w-full">
                {/* Connector line before */}
                {!isLast && (
                  <div className={cn(
                    "flex-1 h-px -mr-2 z-0",
                    isCompleted ? "bg-[#1d74f5]" : "bg-gray-200",
                  )} />
                )}

                {/* Step circle */}
                <div className={cn(
                  "relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0 transition-colors",
                  isCompleted
                    ? "bg-[#1d74f5] border-[#1d74f5] text-white"
                    : isCurrent
                      ? "border-[#1d74f5] text-[#1d74f5] bg-white"
                      : "border-gray-300 text-gray-400 bg-white",
                )}>
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-[11px] font-bold">{i + 1}</span>
                  )}
                </div>

                {/* Connector line after */}
                {!isLast && (
                  <div className={cn(
                    "flex-1 h-px -ml-2 z-0",
                    isCompleted ? "bg-[#1d74f5]" : "bg-gray-200",
                  )} />
                )}
              </div>

              {/* Label */}
              <p className={cn(
                "mt-2 text-xs text-center leading-tight max-w-[100px]",
                isCurrent ? "text-[#1d74f5] font-semibold" : "text-gray-500",
              )}>
                {step.label}
              </p>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
