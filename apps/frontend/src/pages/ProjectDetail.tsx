import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useRouteLoaderData } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import {
  Loader2, UploadCloud, Plus, ArrowUpRight, AlertCircle, Settings2,
  Calendar, Layers, Trash2, Download, Lock, FileSpreadsheet, FileText,
  Battery, Zap, Activity, Flame,
} from "lucide-react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { CreateRecordWizard } from "../components/CreateRecordWizard";
import { cn } from "../lib/utils";
import { usePermissions } from "../hooks/usePermissions";
import { DataSummary } from "../components/DataSummary";
import { SkeletonCard } from "../components/Skeleton";
import { toast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import type { Project, Experiment, ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle, CellGroup } from "../types";
import { RECORD_TYPE_TO_API_TYPE, ALL_API_TYPES } from "../utils/recordTypes";

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetExpId, setUploadTargetExpId] = useState<string | null>(null);
  const [uploadTargetAssayType, setUploadTargetAssayType] = useState<string>("");
  const [uploadTargetTitle, setUploadTargetTitle] = useState<string>("");
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

  const [hasPickedCells, setHasPickedCells] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api.get<{ hasPickedCells: boolean }>(`/api/v1/projects/${projectId}/stats`)
      .then((res) => { if (!cancelled) setHasPickedCells(res.hasPickedCells); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleDeleteAttachment = async (experimentId: string, attachmentId: string) => {
    try {
      await api.delete(`/api/v1/experiments/${experimentId}/attachments/${attachmentId}`);
      toast("删除成功", "success");
      setRefetchTrigger((prev) => prev + 1);
    } catch (err: any) {
      toast(err?.message || "删除失败", "error");
    }
  };

  const handleInitAndUpload = async (assayType: string, label: string) => {
    try {
      const defaultTitle = `${label} - ${new Date().toISOString().split("T")[0]}`;
      const newExp = await api.post<{ id: string }>(
        `/api/v1/projects/${projectId}/experiments`,
        { title: defaultTitle, assayType }
      );
      setUploadTargetExpId(newExp.id);
      setUploadTargetAssayType(assayType);
      setUploadTargetTitle(label);
      setUploadModalOpen(true);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err: any) {
      toast(err?.message || "初始化实验记录失败", "error");
    }
  };

  // Load ALL experiments belonging to this project (no pagination)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`)
      .then((res) => {
        if (cancelled) return;
        setExperiments(res);
        setTotalItems(res.length);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "加载实验数据失败");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, refetchTrigger]);

  // Summary tab: fetch ALL experiments (no pagination), group by assayType, only request matching data
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

        // Group experiment IDs by their metadata.assayType
        const expIdsByType: Record<string, string[]> = {};
        for (const exp of allExps) {
          const assayType = exp.metadata?.assayType as string | undefined;
          if (assayType && RECORD_TYPE_TO_API_TYPE[assayType]) {
            if (!expIdsByType[assayType]) expIdsByType[assayType] = [];
            expIdsByType[assayType].push(exp.id);
          }
        }

        // Only request the matching data table for each experiment group
        const settleAssayType = (
          assayType: string,
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
          settleAssayType("ProcessData", "process", setProcessData, expIdsByType["ProcessData"] || []),
          settleAssayType("CalendarLife", "calendar", setCalendarLife, expIdsByType["CalendarLife"] || []),
          settleAssayType("StorageSwelling", "swelling", setStorageSwelling, expIdsByType["StorageSwelling"] || []),
          settleAssayType("EnergyEfficiency", "efficiency", setEnergyEfficiency, expIdsByType["EnergyEfficiency"] || []),
          settleAssayType("DcrTest", "dcr", setDcrTest, expIdsByType["DcrTest"] || []),
          settleAssayType("FastCharge", "fastcharge", setFastCharge, expIdsByType["FastCharge"] || []),
          settleAssayType("HtCycle", "htcycle", setHtCycle, expIdsByType["HtCycle"] || []),
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

  // Data fetch logic remains unchanged.

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recordOptions.map((opt) => {
            const exp = experiments.find((e) => e.metadata?.assayType === opt.value) as any;
            const isLocked = opt.value !== "ProcessData" && !hasPickedCells;
            const attachments: any[] = exp?.attachments || [];

            const iconMap: Record<string, React.ReactNode> = {
              ProcessData: <Layers className="w-4 h-4" />,
              CalendarLife: <Calendar className="w-4 h-4" />,
              StorageSwelling: <Battery className="w-4 h-4" />,
              EnergyEfficiency: <Zap className="w-4 h-4" />,
              DcrTest: <Activity className="w-4 h-4" />,
              FastCharge: <Zap className="w-4 h-4" />,
              HtCycle: <Flame className="w-4 h-4" />,
            };

            return (
              <AssayCard
                key={opt.value}
                opt={opt}
                exp={exp}
                attachments={attachments}
                isLocked={isLocked}
                icon={iconMap[opt.value] ?? <FileText className="w-4 h-4" />}
                projectId={projectId!}
                onDelete={handleDeleteAttachment}
                onUpload={() => {
                  setUploadTargetExpId(exp?.id ?? null);
                  setUploadTargetAssayType(opt.value);
                  setUploadTargetTitle(opt.label);
                  setUploadModalOpen(true);
                }}
                onInit={() => handleInitAndUpload(opt.value, opt.label)}
                t={t}
              />
            );
          })}
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

      <CreateRecordWizard
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        projectId={projectId!}
        hasPickedCells={hasPickedCells}
        onSuccess={() => setRefetchTrigger((n) => n + 1)}
        recordOptions={recordOptions}
      />

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        experimentId={uploadTargetExpId}
        assayType={uploadTargetAssayType}
        title={uploadTargetTitle}
        onSuccess={() => setRefetchTrigger((n) => n + 1)}
      />
    </div>
  );
}

interface AssayCardProps {
  opt: { value: string; label: string };
  exp: any;
  attachments: any[];
  isLocked: boolean;
  icon: React.ReactNode;
  projectId: string;
  onDelete: (experimentId: string, attachmentId: string) => void;
  onUpload: () => void;
  onInit: () => void;
  t: (key: string) => string;
}

function AssayCard({ opt, exp, attachments, isLocked, icon, projectId, onDelete, onUpload, onInit, t }: AssayCardProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmedDelete = async () => {
    if (!confirmDeleteId || !exp?.id) return;
    setDeleting(true);
    try {
      await onDelete(exp.id, confirmDeleteId);
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const hasData = !!exp;
  const fileCount = attachments.length;

  return (
    <div
      className={cn(
        "flex flex-col bg-white border rounded-xl overflow-hidden transition-shadow",
        isLocked
          ? "border-gray-200 opacity-70"
          : hasData
            ? "border-gray-200 hover:shadow-sm"
            : "border-dashed border-gray-300 hover:border-[#1d74f5]/50"
      )}
      style={{ minHeight: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-sm",
          isLocked ? "bg-gray-100 text-gray-400"
            : hasData ? "bg-[#1d74f5]/10 text-[#1d74f5]"
              : "bg-gray-50 text-gray-400"
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">{opt.label}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{opt.value}</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
              exp.status === "Approved" ? "bg-green-50 text-green-700"
                : exp.status === "In Review" ? "bg-amber-50 text-amber-700"
                  : "bg-gray-100 text-gray-500"
            )}>
              {exp.status === "Approved" ? t("status_approved")
                : exp.status === "In Review" ? t("status_in_review")
                  : t("status_draft")}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">v{exp.versionNo}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-5 py-4 min-h-0">
        {isLocked ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <Lock className="w-6 h-6 text-gray-300" />
            <p className="text-[12px] font-medium text-gray-400">未解锁</p>
            <p className="text-[11px] text-gray-400 leading-relaxed max-w-[180px]">
              需先完成制程数据导入并挑选电芯
            </p>
          </div>
        ) : hasData ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* File count summary */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500 font-medium">
                {fileCount > 0 ? `已导入 ${fileCount} 个文件` : "暂无数据文件"}
              </span>
            </div>

            {/* File list */}
            {fileCount > 0 ? (
              <div className="flex-1 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 divide-y divide-gray-100" style={{ maxHeight: 140 }}>
                {attachments.map((att) => (
                  <div key={att.id} className="group relative">
                    {confirmDeleteId === att.id ? (
                      /* Inline confirm row */
                      <div className="flex items-center justify-between px-3 py-2.5 bg-red-50 border-l-2 border-red-400">
                        <span className="text-[11px] text-red-700 font-medium flex-1 mr-2 leading-snug">
                          删除后数据不可恢复，确认删除？
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={handleConfirmedDelete}
                            className="px-2 py-1 text-[11px] font-medium text-white bg-red-500 rounded hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                            确认删除
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center px-3 py-2.5 hover:bg-white transition-colors">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0 mr-2" />
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-[11px] font-medium text-gray-700 truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {(att.fileSize / 1024).toFixed(1)} KB · {format(new Date(att.createdAt), "MM-dd HH:mm")}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={`/api/v1/experiments/${exp.id}/attachments/${att.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            title="下载"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(att.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[11px] text-gray-400 border border-dashed border-gray-200 rounded-lg" style={{ minHeight: 80 }}>
                未上传数据文件
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <UploadCloud className="w-7 h-7 text-gray-300" />
            <p className="text-[12px] font-medium text-gray-400">尚未导入数据</p>
            <p className="text-[11px] text-gray-400 leading-relaxed max-w-[160px]">
              点击下方按钮初始化并上传
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
        {isLocked ? (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 w-full">
            <Lock className="w-3.5 h-3.5" />
            <span>需完成电芯挑选后解锁</span>
          </div>
        ) : hasData ? (
          <>
            <Link to={`/projects/${projectId}/experiments/${exp.id}`} className="mr-auto">
              <button
                type="button"
                className="text-[12px] font-medium text-gray-600 hover:text-[#1d74f5] transition-colors flex items-center gap-1"
              >
                查看数据表
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </Link>
            <Button size="sm" variant="primary" onClick={onUpload}>
              导入数据
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" className="w-full" onClick={onInit}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            初始化并导入
          </Button>
        )}
      </div>
    </div>
  );
}

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  experimentId: string | null;
  assayType: string;
  title: string;
  onSuccess: () => void;
}

function UploadModal({ open, onClose, experimentId, assayType, title, onSuccess }: UploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"merge" | "overwrite">("merge");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setSelectedFiles([]);
    setMode("merge");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experimentId) return;
    if (selectedFiles.length === 0) {
      setError("请选择要上传的 Excel 文件");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const form = new FormData();
      selectedFiles.forEach((file) => {
        form.append("files", file);
      });
      form.append("experimentId", experimentId);
      form.append("mode", mode);

      await api.upload(`/api/v1/data/upload`, form);
      toast("上传成功", "success");
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err?.message ?? "上传失败，请检查文件格式或数据内容");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={`导入数据 - ${title}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-650 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Mode selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            导入模式 (Ingestion Mode)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMode("merge")}
              className={cn(
                "p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer",
                mode === "merge"
                  ? "border-[#1d74f5] bg-blue-50/20 ring-1 ring-[#1d74f5]"
                  : "border-gray-250 hover:border-gray-300"
              )}
            >
              <div>
                <span className={cn("text-[14px] font-bold block mb-1", mode === "merge" ? "text-[#1d74f5]" : "text-gray-900")}>
                  合并或追加 (Merge)
                </span>
                <span className="text-[11px] text-gray-500 leading-normal block">
                  将新文件的数据合并到当前实验，保留其他已导入文件的内容。
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("overwrite")}
              className={cn(
                "p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer",
                mode === "overwrite"
                  ? "border-red-500 bg-red-50/10 ring-1 ring-red-500"
                  : "border-gray-250 hover:border-gray-300"
              )}
            >
              <div>
                <span className={cn("text-[14px] font-bold block mb-1", mode === "overwrite" ? "text-red-600" : "text-gray-905")}>
                  清空并覆盖 (Overwrite)
                </span>
                <span className="text-[11px] text-gray-500 leading-normal block">
                  清空此实验已有的所有文件和表格行，完全以本次上传的数据为准。
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) {
              const files = Array.from(e.dataTransfer.files).filter(
                (f) =>
                  f.name.endsWith(".xlsx") ||
                  f.name.endsWith(".xls") ||
                  f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              );
              setSelectedFiles((prev) => [...prev, ...files]);
            }
          }}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
            dragOver
              ? "border-[#1d74f5] bg-blue-50/30"
              : "border-gray-200 hover:border-gray-300"
          )}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".xlsx,.xls";
            input.multiple = true;
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              if (target.files) {
                setSelectedFiles((prev) => [...prev, ...Array.from(target.files!)]);
              }
            };
            input.click();
          }}
        >
          <UploadCloud className="w-10 h-10 mx-auto text-gray-400 mb-3 animate-pulse" />
          <span className="text-sm font-semibold text-gray-900 block mb-1">
            点击或拖拽文件至此处上传
          </span>
          <span className="text-xs text-gray-400">
            支持多个 .xlsx 或 .xls 电池数据表格
          </span>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-450">
              待导入文件 ({selectedFiles.length})
            </label>
            <div className="border border-gray-100 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-100 bg-gray-50/30">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0 mr-3">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-gray-700 truncate block" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[10px] text-gray-450 block mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" disabled={submitting || selectedFiles.length === 0} className="relative">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />}
            {submitting ? "正在解析并导入..." : "开始导入"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
