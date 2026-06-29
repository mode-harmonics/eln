import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useRouteLoaderData } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { FileText, Loader2, UploadCloud, CheckCircle2, Settings2 } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { usePermissions } from "../hooks/usePermissions";
import { DataSummary } from "../components/DataSummary";
import { SkeletonCard } from "../components/Skeleton";
import { api, ApiError } from "../lib/api";
import type { Project, Experiment, ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle, CellGroup } from "../types";

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalRecordType, setModalRecordType] = useState("ProcessData");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useViewMode("project_detail_view_mode", "list");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "summary" | "experiments") || "summary";

  const loaderProject = useRouteLoaderData("project") as Project | null;
  const [project, setProject] = useState<Project | null>(loaderProject);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Business data for DataSummary tab
  const [processData, setProcessData] = useState<ProcessData[]>([]);
  const [calendarLife, setCalendarLife] = useState<CalendarLife[]>([]);
  const [storageSwelling, setStorageSwelling] = useState<StorageSwelling[]>([]);
  const [energyEfficiency, setEnergyEfficiency] = useState<EnergyEfficiency[]>([]);
  const [dcrTest, setDcrTest] = useState<DcrTest[]>([]);
  const [fastCharge, setFastCharge] = useState<FastCharge[]>([]);
  const [htCycle, setHtCycle] = useState<HtCycle[]>([]);
  const [loadedTypes, setLoadedTypes] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Group data for DataSummary
  const [groups, setGroups] = useState<CellGroup[]>([]);

  const recordOptions = React.useMemo(() => [
    { value: "ProcessData", label: t("process_data"), permission: "data_process:write" },
    { value: "CalendarLife", label: t("calendar_life"), permission: "data_calendar:write" },
    { value: "StorageSwelling", label: t("storage_swelling"), permission: "data_swelling:write" },
    { value: "EnergyEfficiency", label: t("energy_efficiency"), permission: "data_efficiency:write" },
    { value: "DcrTest", label: t("dcr_test"), permission: "data_dcr:write" },
    { value: "FastCharge", label: t("fast_charge"), permission: "data_fastcharge:write" },
    { value: "HtCycle", label: t("ht_cycle"), permission: "data_htcycle:write" },
  ].filter((opt) => hasPermission("experiments:write") || hasPermission("data:write") || hasPermission(opt.permission)), [t, hasPermission]);

  // Load groups for DataSummary cell → group name mapping
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api.get<CellGroup[]>(`/api/v1/projects/${projectId}/groups`)
      .then((data) => { if (!cancelled) setGroups(data); })
      .catch(() => { /* groups are optional */ });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setProcessData([]);
    setCalendarLife([]);
    setStorageSwelling([]);
    setEnergyEfficiency([]);
    setDcrTest([]);
    setFastCharge([]);
    setHtCycle([]);
    setLoadedTypes([]);
    setDataLoading(true);

    const queryParams = new URLSearchParams();
    queryParams.append("page", String(currentPage));
    queryParams.append("limit", String(pageSize));

    api.get<{ items: Experiment[]; total: number }>(`/api/v1/projects/${projectId}/experiments?${queryParams.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const exps = res.items;
        setExperiments(exps);
        setTotalItems(res.total);

        const expIds = exps.map((e) => e.id);
        if (expIds.length === 0) {
          setLoadedTypes(["process", "calendar", "swelling", "efficiency", "dcr", "fastcharge", "htcycle"]);
          setDataLoading(false);
          return;
        }

        const dataTypes = [
          { type: "process", setter: setProcessData as any },
          { type: "calendar", setter: setCalendarLife as any },
          { type: "swelling", setter: setStorageSwelling as any },
          { type: "efficiency", setter: setEnergyEfficiency as any },
          { type: "dcr", setter: setDcrTest as any },
          { type: "fastcharge", setter: setFastCharge as any },
          { type: "htcycle", setter: setHtCycle as any },
        ];

        let completed = 0;
        dataTypes.forEach(({ type, setter }) => {
          Promise.all(
            expIds.map((expId) =>
              api.get<any[]>(`/api/v1/data/${type}/${expId}`).catch(() => [] as any[])
            )
          ).then((results) => {
            if (cancelled) return;
            const allRows = results.flat();
            setter(allRows);
            setLoadedTypes((prev) => [...prev, type]);
            completed++;
            if (completed === dataTypes.length) {
              setDataLoading(false);
            }
          });
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "加载实验数据失败");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, currentPage, pageSize, refetchTrigger]);

  const closeModal = () => {
    setIsModalOpen(false);
    setModalTitle("");
    setModalRecordType("ProcessData");
    setSelectedFile(null);
    setUploadError(null);
    setSubmitting(false);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError(t("select_file"));
      return;
    }
    setUploadError(null);
    setSubmitting(true);
    try {
      // Step 1 – create the experiment (record)
      const experiment = await api.post<{ id: string }>(
        `/api/v1/projects/${projectId}/experiments`,
        { title: modalTitle, recordType: modalRecordType },
      );
      // Step 2 – upload the Excel file and associate it with the new experiment
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("experimentId", experiment.id);
      await api.upload(`/api/v1/data/upload`, form);
      closeModal();
      setRefetchTrigger((n) => n + 1);
    } catch (err: any) {
      setUploadError(err?.message ?? t("upload_error"));
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="mt-2 text-gray-600">{project.description}</p>
        <div className="flex items-center gap-3 mt-4">
          <Link
            to={`/projects/${projectId}/groups`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1d74f5] transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            分组管理
          </Link>
        </div>
        <div className="h-px bg-gray-200 w-full mt-6"></div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <Button variant="text" onClick={() => setSearchParams({ tab: "summary" })} className={cn(
            "!pb-4 border-b-2 font-medium text-sm",
            activeTab === "summary"
              ? "border-[#1d74f5] text-[#1d74f5]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}>
            {t("data_summary")}
          </Button>
          <Button variant="text" onClick={() => setSearchParams({ tab: "experiments" })} className={cn(
            "!pb-4 border-b-2 font-medium text-sm",
            activeTab === "experiments"
              ? "border-[#1d74f5] text-[#1d74f5]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}>
            {t("experiments_records")}
          </Button>
        </nav>
      </div>

      {activeTab === "summary" ? (
        dataLoading ? (
          <SkeletonCard rows={5} />
        ) : (
          <DataSummary
            loadedTypes={loadedTypes}
            processData={processData}
            calendarLife={calendarLife}
            storageSwelling={storageSwelling}
            energyEfficiency={energyEfficiency}
            dcrTest={dcrTest}
            fastCharge={fastCharge}
            htCycle={htCycle}
            groups={groups}
          />
        )
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
              {hasPermission("projects:write") && recordOptions.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    setIsModalOpen(true);
                    if (recordOptions.length > 0) {
                      setModalRecordType(recordOptions[0].value);
                    }
                  }}
                >
                  {t("new_record")}
                </Button>
              )}
            </div>
          </div>

          {viewMode === "list" ? (
            <div className="border border-gray-200 rounded bg-white">
              <div className="divide-y divide-gray-100">
                {experiments.map((exp) => (
                  <Link
                    key={exp.id}
                    to={`/projects/${projectId}/experiments/${exp.id}`}
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
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  className="border-t border-gray-200"
                />
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {experiments.map((exp) => (
                <Link
                  key={exp.id}
                  to={`/projects/${projectId}/experiments/${exp.id}`}
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
          {viewMode === "grid" && experiments.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      <Modal open={isModalOpen} onClose={closeModal} title={t("create_new_record")}>
        <form onSubmit={handleCreateRecord} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("title")}</label>
            <input
              type="text"
              required
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
              placeholder="e.g. Initial Formulation Test"
              disabled={submitting}
            />
          </div>

          {/* Record Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("record_type")}</label>
            <select
              value={modalRecordType}
              onChange={(e) => setModalRecordType(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
              disabled={submitting}
            >
              {recordOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Excel Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("upload_excel")}</label>
            <label
              htmlFor="excel-upload"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) { setSelectedFile(file); setUploadError(null); }
              }}
              className={`flex flex-col items-center justify-center w-full rounded border-2 border-dashed px-4 py-7 cursor-pointer transition-colors ${
                dragOver
                  ? "border-[#1d74f5] bg-blue-50"
                  : selectedFile
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
              }`}
            >
              {selectedFile ? (
                <>
                  <CheckCircle2 className="w-7 h-7 text-green-500 mb-2" />
                  <span className="text-sm font-medium text-green-700 text-center break-all">{selectedFile.name}</span>
                  <span className="text-xs text-green-600 mt-1">{t("file_selected")}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-7 h-7 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500 text-center">{t("select_file")}</span>
                  <span className="text-xs text-gray-400 mt-1">拖拽或点击上传</span>
                </>
              )}
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={submitting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setSelectedFile(file); setUploadError(null); }
                }}
              />
            </label>
          </div>

          {/* Error */}
          {uploadError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{uploadError}</p>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              {submitting ? t("uploading") : t("create_record")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
