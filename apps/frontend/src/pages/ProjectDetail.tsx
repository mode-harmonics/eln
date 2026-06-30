import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useRouteLoaderData } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Loader2, UploadCloud, CheckCircle2, Settings2, Plus, ChartColumn, Info, Search } from "lucide-react";
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
import { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY, ALL_API_TYPES } from "../utils/recordTypes";

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalRecordType, setModalRecordType] = useState("ProcessData");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useViewMode("project_detail_view_mode", "list");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "summary" | "experiments") || "experiments";

  const loaderProject = useRouteLoaderData("project") as Project | null;
  const [project, setProject] = useState<Project | null>(loaderProject);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

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
    { value: "ProcessData", label: t("process_data"), permission: "data_process:write", sheetType: "step" },
    { value: "CalendarLife", label: t("calendar_life"), permission: "data_calendar:write", sheetType: "step" },
    { value: "StorageSwelling", label: t("storage_swelling"), permission: "data_swelling:write", sheetType: "step" },
    { value: "EnergyEfficiency", label: t("energy_efficiency"), permission: "data_efficiency:write", sheetType: "step" },
    { value: "DcrTest", label: t("dcr_test"), permission: "data_dcr:write", sheetType: "step" },
    { value: "FastCharge", label: t("fast_charge"), permission: "data_fastcharge:write", sheetType: "step" },
    { value: "HtCycle", label: t("ht_cycle"), permission: "data_htcycle:write", sheetType: "cycle" },
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

  // Paginated experiments for the list/grid tab
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    const queryParams = new URLSearchParams();
    queryParams.append("page", String(currentPage));
    queryParams.append("limit", String(pageSize));
    if (searchQuery.trim()) {
      queryParams.append("search", searchQuery.trim());
    }

    api.get<{ items: Experiment[]; total: number }>(`/api/v1/projects/${projectId}/experiments?${queryParams.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setExperiments(res.items);
        setTotalItems(res.total);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "加载实验数据失败");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, currentPage, pageSize, searchQuery, refetchTrigger]);

  // Summary tab: fetch ALL experiments (no pagination), group by recordType, only request matching data
  useEffect(() => {
    if (!projectId || activeTab !== "summary") return;
    let cancelled = false;

    setProcessData([]);
    setCalendarLife([]);
    setStorageSwelling([]);
    setEnergyEfficiency([]);
    setDcrTest([]);
    setFastCharge([]);
    setHtCycle([]);
    setLoadedTypes([]);
    setDataLoading(true);

    // Fetch ALL experiments without pagination to guarantee completeness
    api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`)
      .then((allExps) => {
        if (cancelled) return;

        if (!Array.isArray(allExps) || allExps.length === 0) {
          setLoadedTypes(ALL_API_TYPES);
          setDataLoading(false);
          return;
        }

        // Group experiment IDs by their metadata.recordType
        const expIdsByType: Record<string, string[]> = {};
        for (const exp of allExps) {
          const recordType = exp.metadata?.recordType as string | undefined;
          if (recordType && RECORD_TYPE_TO_API_TYPE[recordType]) {
            if (!expIdsByType[recordType]) expIdsByType[recordType] = [];
            expIdsByType[recordType].push(exp.id);
          }
        }

        // Only request the matching data table for each experiment group
        const settleRecordType = (
          recordType: string,
          apiType: string,
          setter: (data: any[]) => void,
          expIds: string[],
        ) => {
          if (expIds.length === 0) {
            setter([]);
            setLoadedTypes((prev) => [...prev, apiType]);
            return;
          }
          return Promise.all(
            expIds.map((expId) =>
              api.get<any[]>(`/api/v1/data/${apiType}/${expId}`).catch(() => [] as any[])
            )
          ).then((results) => {
            if (cancelled) return;
            setter(results.flat());
            setLoadedTypes((prev) => [...prev, apiType]);
          });
        };

        const tasks = [
          settleRecordType("ProcessData", "process", setProcessData, expIdsByType["ProcessData"] || []),
          settleRecordType("CalendarLife", "calendar", setCalendarLife, expIdsByType["CalendarLife"] || []),
          settleRecordType("StorageSwelling", "swelling", setStorageSwelling, expIdsByType["StorageSwelling"] || []),
          settleRecordType("EnergyEfficiency", "efficiency", setEnergyEfficiency, expIdsByType["EnergyEfficiency"] || []),
          settleRecordType("DcrTest", "dcr", setDcrTest, expIdsByType["DcrTest"] || []),
          settleRecordType("FastCharge", "fastcharge", setFastCharge, expIdsByType["FastCharge"] || []),
          settleRecordType("HtCycle", "htcycle", setHtCycle, expIdsByType["HtCycle"] || []),
        ];

        Promise.all(tasks.filter(Boolean)).finally(() => {
          if (!cancelled) setDataLoading(false);
        });
      })
      .catch((err) => {
        if (!cancelled) console.error("Summary data fetch failed:", err);
      });

    return () => { cancelled = true; };
  }, [projectId, activeTab, refetchTrigger]);

  const closeModal = () => {
    setIsModalOpen(false);
    setModalTitle("");
    setModalRecordType("ProcessData");
    setSelectedFiles([]);
    setUploadError(null);
    setSubmitting(false);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
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
      // Step 2 – upload each file
      for (const file of selectedFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("experimentId", experiment.id);
        await api.upload(`/api/v1/data/upload`, form);
      }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1 truncate">{project.description}</p>
        </div>
        <Link
          to={`/projects/${projectId}/groups`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1d74f5] transition-colors shrink-0 mt-1"
        >
          <Settings2 className="w-4 h-4" />
          {t("group_management")}
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          <Button variant="text" onClick={() => { setSearchParams({ tab: "experiments" }); setSearchQuery(""); setSearchInput(""); }} className={cn(
            "!pb-3 border-b-2 font-medium text-sm relative",
            activeTab === "experiments"
              ? "border-[#1d74f5] text-[#1d74f5]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}>
            {t("experiments_records")}
            {totalItems > 0 && (
              <span className="ml-1.5 text-[11px] text-gray-400 font-normal">({totalItems})</span>
            )}
          </Button>
          <Button variant="text" onClick={() => setSearchParams({ tab: "summary" })} className={cn(
            "!pb-3 border-b-2 font-medium text-sm",
            activeTab === "summary"
              ? "border-[#1d74f5] text-[#1d74f5]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}>
            {t("data_summary")}
          </Button>
        </nav>
      </div>

      {activeTab === "experiments" ? (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setSearchQuery(searchInput); setCurrentPage(1); } }}
                placeholder={t("search_projects")}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-1.5 text-sm placeholder-gray-400 focus:bg-white focus:border-gray-300 focus:outline-none focus:ring-0 transition-colors"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <ViewToggle
                viewMode={viewMode}
                setViewMode={setViewMode}
                className="hidden sm:flex"
              />
              {hasPermission("projects:write") && recordOptions.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setIsModalOpen(true);
                    if (recordOptions.length > 0) {
                      setModalRecordType(recordOptions[0].value);
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {t("new_record")}
                </Button>
              )}
            </div>
          </div>

          {viewMode === "list" ? (
            <div className="border border-gray-200 rounded bg-white">
              <div className="divide-y divide-gray-100">
                {experiments.map((exp) => {
                  const recordType = (exp.metadata?.recordType || exp.metadata?.assayType) as string | undefined;
                  return (
                  <Link
                    key={exp.id}
                    to={`/projects/${projectId}/experiments/${exp.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="text-gray-300 group-hover:text-gray-500 shrink-0">
                        <ChartColumn className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[13px] font-medium text-gray-900 group-hover:text-[#1d74f5] truncate">
                            {exp.title}
                          </h3>
                          {recordType && RECORD_TYPE_TO_I18N_KEY[recordType] && (
                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 shrink-0">
                              {t(RECORD_TYPE_TO_I18N_KEY[recordType])}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-[13px] text-gray-500">
                          <span>{t("updated")}{" "}{format(new Date(exp.updatedAt), "MMM d, yyyy")}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>v{exp.versionNo}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                          exp.status === "Approved"
                            ? "bg-[#f0f9f4] text-[#1e8b4e]"
                            : exp.status === "In Review"
                              ? "bg-[#fff8e6] text-[#b28200]"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {exp.status === "Approved" ? t("status_approved") : exp.status === "In Review" ? t("status_in_review") : t("status_draft")}
                      </span>
                    </div>
                  </Link>
                );})}
                {experiments.length === 0 && (
                  <div className="p-8 text-center text-sm text-gray-500">
                    {searchQuery ? "未找到匹配的实验" : t("no_experiments_found")}
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
            <>
              {experiments.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded">
                  <ChartColumn className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  {searchQuery ? "未找到匹配的实验" : t("no_experiments_found")}
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {experiments.map((exp) => {
                    const recordType = (exp.metadata?.recordType || exp.metadata?.assayType) as string | undefined;
                    return (
                    <Link
                      key={exp.id}
                      to={`/projects/${projectId}/experiments/${exp.id}`}
                      className="group flex flex-col border border-gray-200 rounded p-6 bg-white hover:border-gray-300 transition-colors relative"
                    >
                      <div className="absolute top-5 right-5 text-gray-300 group-hover:text-gray-500">
                        <ChartColumn className="w-5 h-5" />
                      </div>
                      <div className="pr-8 mb-3">
                        <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-[#1d74f5] leading-tight">
                          {exp.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        {recordType && RECORD_TYPE_TO_I18N_KEY[recordType] && (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            {t(RECORD_TYPE_TO_I18N_KEY[recordType])}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                            exp.status === "Approved"
                              ? "bg-[#f0f9f4] text-[#1e8b4e]"
                              : exp.status === "In Review"
                                ? "bg-[#fff8e6] text-[#b28200]"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {exp.status === "Approved" ? t("status_approved") : exp.status === "In Review" ? t("status_in_review") : t("status_draft")}
                        </span>
                      </div>
                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-[13px] text-gray-500">
                        <span>v{exp.versionNo}</span>
                        <span>{format(new Date(exp.updatedAt), "MMM d")}</span>
                      </div>
                    </Link>
                  );})}
                </div>
              )}
              {experiments.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </>
          )}
        </div>
      ) : (
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
      )}

      <Modal open={isModalOpen} onClose={closeModal} title={t("create_new_record")}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={submitting}>{t("cancel")}</Button>
            <Button type="submit" form="modal-record-form" loading={submitting} disabled={submitting}>
              {submitting ? t("uploading") : t("create_record")}
            </Button>
          </>
        }>
        <form id="modal-record-form" onSubmit={handleCreateRecord} className="space-y-5">
          {/* Info hint */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">{t("upload_raw_data_hint")}</p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("title")}</label>
            <input
              type="text"
              required
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
              placeholder={t("title_placeholder")}
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
            {/* Sheet format hint */}
            <p className="mt-1.5 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Info className="w-3 h-3" />
                {recordOptions.find((o) => o.value === modalRecordType)?.sheetType === "cycle"
                  ? t("upload_cycle_hint")
                  : t("upload_step_hint")}
              </span>
            </p>
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
                const files = Array.from(e.dataTransfer.files ?? []);
                if (files.length > 0) { setSelectedFiles(files); setUploadError(null); }
              }}
              className={`flex flex-col items-center justify-center w-full rounded border-2 border-dashed px-4 py-7 cursor-pointer transition-colors ${
                dragOver
                  ? "border-[#1d74f5] bg-blue-50"
                  : selectedFiles.length > 0
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
              }`}
            >
              {selectedFiles.length > 0 ? (
                <>
                  <CheckCircle2 className="w-7 h-7 text-green-500 mb-2" />
                  {selectedFiles.length === 1 ? (
                    <span className="text-sm font-medium text-green-700 text-center break-all">{selectedFiles[0].name}</span>
                  ) : (
                    <div className="text-center">
                      <span className="text-sm font-medium text-green-700">{selectedFiles.length} files selected</span>
                      <div className="text-xs text-green-600 mt-1 max-h-20 overflow-y-auto">
                        {selectedFiles.map((f, i) => (
                          <span key={i} className="block truncate max-w-[260px]">{f.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <span className="text-xs text-green-600 mt-1">{t("file_selected")}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-7 h-7 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500 text-center">{t("select_file")}</span>
                  <span className="text-xs text-gray-400 mt-1">{t("drag_hint")}</span>
                </>
              )}
              <input
                id="excel-upload"
                type="file"
                multiple
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={submitting}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) { setSelectedFiles(files); setUploadError(null); }
                }}
              />
            </label>
          </div>

          {/* Error */}
          {uploadError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{uploadError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
