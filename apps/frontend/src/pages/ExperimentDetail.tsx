import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ProcessDataTable,
  CalendarLifeTable,
  StorageSwellingTable,
  EnergyEfficiencyTable,
  DcrTestTable,
  FastChargeTable,
  HtCycleTable
} from "../components/ExperimentTables";
import { ExperimentChart } from "../components/ExperimentChart";
import { Breadcrumb } from "../components/Breadcrumb";
import { api, ApiError } from "../lib/api";
import type { Experiment } from "../types";

interface ExperimentDetail extends Experiment {
  attachments?: unknown[];
  collaborators?: unknown[];
}

export function ExperimentDetail() {
  const { t } = useTranslation();
  const { experimentId } = useParams<{ experimentId: string }>();
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!experimentId) return;
    api.get<ExperimentDetail>(`/api/v1/experiments/${experimentId}`)
      .then(setExperiment)
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [experimentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !experiment) {
    return <div className="p-10 text-sm text-red-500">{error ?? "Experiment not found"}</div>;
  }

  const assayType = experiment.metadata?.assayType || experiment.metadata?.recordType;

  const renderTable = () => {
    switch (assayType) {
      case "ProcessData":    return <ProcessDataTable experimentId={experiment.id} />;
      case "CalendarLife":   return <CalendarLifeTable experimentId={experiment.id} />;
      case "StorageSwelling": return <StorageSwellingTable experimentId={experiment.id} />;
      case "EnergyEfficiency": return <EnergyEfficiencyTable experimentId={experiment.id} />;
      case "DcrTest":        return <DcrTestTable experimentId={experiment.id} />;
      case "FastCharge":     return <FastChargeTable experimentId={experiment.id} />;
      case "HtCycle":        return <HtCycleTable experimentId={experiment.id} />;
      default:
        return (
          <div className="p-8 text-center text-sm text-gray-500">
            No data table available for {assayType || "this type"}.
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb
          backTo={experiment.projectId ? `/projects/${experiment.projectId}?tab=experiments` : "/projects"}
          items={[
            { label: t("projects"), to: "/projects" },
            ...(experiment.projectId
              ? [{ label: t("project"), to: `/projects/${experiment.projectId}?tab=experiments` }]
              : []),
            { label: experiment.title },
          ]}
        />

        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{experiment.title}</h1>
            <div className="mt-2 flex items-center gap-4 text-[13px] text-gray-500">
              <span>Updated {format(new Date(experiment.updatedAt), "PPp")}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              <span>v{experiment.versionNo}</span>
              {assayType && (
                <>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{assayType}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors">
              Export
            </button>
          </div>
        </div>
        <div className="h-px bg-gray-200 w-full mt-6"></div>
      </div>

      <div className="space-y-8">
        <ExperimentChart assayType={assayType || "Unknown"} experimentId={experiment.id} />

        {/* Data Table Section */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-[15px] font-semibold text-gray-900">Data Table</h2>
            <button className="text-gray-400 hover:text-gray-600">
              <Download className="w-4 h-4" />
            </button>
          </div>
          {renderTable()}
        </div>
      </div>
    </div>
  );
}
