import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText, X, Loader2 } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { DataSummary } from "../components/DataSummary";
import { api, ApiError } from "../lib/api";
import type { Project, Experiment, ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle } from "../types";

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode("project_detail_view_mode", "list");
  const [activeTab, setActiveTab] = useState<"summary" | "experiments">("summary");

  const [project, setProject] = useState<Project | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Business data for DataSummary tab
  const [processData, setProcessData] = useState<ProcessData[]>([]);
  const [calendarLife, setCalendarLife] = useState<CalendarLife[]>([]);
  const [storageSwelling, setStorageSwelling] = useState<StorageSwelling[]>([]);
  const [energyEfficiency, setEnergyEfficiency] = useState<EnergyEfficiency[]>([]);
  const [dcrTest, setDcrTest] = useState<DcrTest[]>([]);
  const [fastCharge, setFastCharge] = useState<FastCharge[]>([]);
  const [htCycle, setHtCycle] = useState<HtCycle[]>([]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.get<Project>(`/api/v1/projects/${projectId}`),
      api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`),
    ])
      .then(([proj, exps]) => {
        setProject(proj);
        setExperiments(exps);

        // Load business data for all experiments in this project
        const expIds = exps.map((e) => e.id);
        if (expIds.length === 0) return;

        const dataTypes: Array<{ type: string; setter: (d: any) => void }> = [
          { type: "process", setter: setProcessData as any },
          { type: "calendar", setter: setCalendarLife as any },
          { type: "swelling", setter: setStorageSwelling as any },
          { type: "efficiency", setter: setEnergyEfficiency as any },
          { type: "dcr", setter: setDcrTest as any },
          { type: "fastcharge", setter: setFastCharge as any },
          { type: "htcycle", setter: setHtCycle as any },
        ];

        // Fetch data for each experiment × data-type pair in parallel, then flatten
        expIds.forEach((expId) => {
          dataTypes.forEach(({ type, setter }) => {
            api.get<any[]>(`/api/v1/data/${type}/${expId}`)
              .then((rows) => setter((prev: any[]) => [...prev, ...rows]))
              .catch(() => {}); // silence 404s for experiment/type combos with no data
          });
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !project) {
    return <div className="p-10">{error ?? t("project_not_found")}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/projects" className="hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            {t("projects")}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="mt-2 text-gray-600">{project.description}</p>
        <div className="h-px bg-gray-200 w-full mt-6"></div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("summary")}
            className={cn(
              "whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "summary"
                ? "border-[#1d74f5] text-[#1d74f5]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            )}
          >
            {t("data_summary")}
          </button>
          <button
            onClick={() => setActiveTab("experiments")}
            className={cn(
              "whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "experiments"
                ? "border-[#1d74f5] text-[#1d74f5]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            )}
          >
            {t("experiments_records")}
          </button>
        </nav>
      </div>

      {activeTab === "summary" ? (
        <DataSummary
          processData={processData}
          calendarLife={calendarLife}
          storageSwelling={storageSwelling}
          energyEfficiency={energyEfficiency}
          dcrTest={dcrTest}
          fastCharge={fastCharge}
          htCycle={htCycle}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-800">
              {t("experiments_records")}
            </h2>
            <div className="flex items-center gap-4">
              <ViewToggle
                viewMode={viewMode}
                setViewMode={setViewMode}
                className="hidden sm:flex"
              />
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-1.5 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors"
              >
                {t("new_record")}
              </button>
            </div>
          </div>

          {viewMode === "list" ? (
            <div className="border border-gray-200 rounded bg-white">
              <div className="divide-y divide-gray-100">
                {experiments.map((exp) => (
                  <Link
                    key={exp.id}
                    to={`/experiments/${exp.id}`}
                    className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-gray-400 group-hover:text-gray-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-[13px] font-medium text-gray-900 group-hover:text-[#1d74f5]">
                          {exp.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-3 text-[13px] text-gray-500">
                          <span>{t("updated")}{" "}{format(new Date(exp.updatedAt), "MMM d, yyyy")}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>v{exp.versionNo}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                          exp.status === "Approved"
                            ? "bg-[#f0f9f4] text-[#1e8b4e]"
                            : exp.status === "In Review"
                              ? "bg-[#fff8e6] text-[#b28200]"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {exp.status}
                      </span>
                    </div>
                  </Link>
                ))}
                {experiments.length === 0 && (
                  <div className="p-8 text-center text-sm text-gray-500">
                    {t("no_experiments_found")}
                  </div>
                )}
              </div>
              {experiments.length > 0 && (
                <Pagination className="border-t border-gray-200" />
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {experiments.map((exp) => (
                <Link
                  key={exp.id}
                  to={`/experiments/${exp.id}`}
                  className="group flex flex-col border border-gray-200 rounded p-6 bg-white hover:border-gray-300 transition-colors relative"
                >
                  <div className="absolute top-6 right-6 text-gray-400 group-hover:text-gray-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="pr-8 mb-4">
                    <h3 className="text-[17px] font-semibold text-gray-900 group-hover:text-[#1d74f5] leading-tight">
                      {exp.title}
                    </h3>
                  </div>
                  <div className="mt-auto pt-6 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                          exp.status === "Approved"
                            ? "bg-[#f0f9f4] text-[#1e8b4e]"
                            : exp.status === "In Review"
                              ? "bg-[#fff8e6] text-[#b28200]"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {exp.status}
                      </span>
                      <span className="text-[13px] text-gray-500">v{exp.versionNo}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[13px] text-gray-500">
                      <span>{format(new Date(exp.updatedAt), "MMM d")}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {viewMode === "grid" && experiments.length > 0 && <Pagination />}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[17px] font-bold text-gray-900">
                {t("create_new_record")}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRecord} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("title")}</label>
                <input
                  type="text"
                  required
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  placeholder="e.g. Initial Formulation Test"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("record_type")}</label>
                <select className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm">
                  <option value="ProcessData">{t("process_data")}</option>
                  <option value="CalendarLife">{t("calendar_life")}</option>
                  <option value="StorageSwelling">{t("storage_swelling")}</option>
                  <option value="EnergyEfficiency">{t("energy_efficiency")}</option>
                  <option value="DcrTest">{t("dcr_test")}</option>
                  <option value="FastCharge">{t("fast_charge")}</option>
                  <option value="HtCycle">{t("ht_cycle")}</option>
                </select>
              </div>
              <div className="pt-4 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors"
                >
                  {t("create_record")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
