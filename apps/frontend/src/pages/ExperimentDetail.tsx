import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLoaderData } from "react-router-dom";
import { format } from "date-fns";
import { Download, Edit3, Loader2, Trash2, Table2, FileDigit, ChevronDown, Layers, AlertCircle, Plus, Paperclip, MessageSquare, Send, History, MoreHorizontal, UploadCloud, X, CheckCircle2 } from "lucide-react";
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
import { Button } from "../components/Button";
import { ButtonGroup } from "../components/ButtonGroup";
import { Dropdown } from "../components/Dropdown";
import { Modal } from "../components/Modal";
import { Drawer } from "../components/Drawer";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { VersionDiffViewer } from "../components/VersionDiffViewer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import { cn } from "../lib/utils";

import type { Experiment } from "../types";
import { usePermissions } from "../hooks/usePermissions";
import { Popconfirm } from "../components/Popconfirm";

interface ExperimentDetail extends Experiment {
  attachments?: any[];
}

import { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY } from "../utils/recordTypes";

const ASSAY_TYPE_TO_PERMISSION = RECORD_TYPE_TO_API_TYPE;

const STEP_NAME_MAP: Record<string, string> = {
  experiment_design: "实验设计",
  battery_selection: "电芯选取",
  drying_injection: "干燥/注液",
  formation: "化成",
  second_sealing: "二封",
  capacity_grading: "定容",
  calendar_life: "日历寿命",
  storage_swelling: "存储胀力",
  energy_efficiency: "能量效率",
  dcr_test: "DCR测试",
  fast_charge: "快充测试",
  ht_cycle: "高温循环"
};

export function ExperimentDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { experimentId } = useParams<{ experimentId: string }>();
  const loaderData = useLoaderData<ExperimentDetail | null>();
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(loaderData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    loaderData ? null : t("loading_failed")
  );

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEditModal = () => {
    if (!experiment) return;
    setEditTitle(experiment.title);
    setEditContent(experiment.content || "");
    setEditModalOpen(true);
  };

  // Attachments state
  const [attachmentsDrawerOpen, setAttachmentsDrawerOpen] = useState(false);
  const [attachments, setAttachments] = useState<any[]>(loaderData?.attachments || []);

  // Comments state
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false);
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<"attachments" | "comments" | "versions" | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [versions, setVersions] = useState<any[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Re-fetch experiment data after upload
  useEffect(() => {
    if (refreshCounter === 0 || !experiment?.id) return;
    api.get<ExperimentDetail>(`/api/v1/experiments/${experiment.id}`).then(setExperiment).catch(() => { });
  }, [refreshCounter]);

  useEffect(() => {
    if (attachmentsDrawerOpen && experiment) {
      api.get<any[]>(`/api/v1/experiments/${experiment.id}/attachments`)
        .then(setAttachments)
        .catch(console.error);
    }
  }, [attachmentsDrawerOpen, experiment]);

  useEffect(() => {
    if (commentsDrawerOpen && experiment) {
      api.get<any[]>(`/api/v1/experiments/${experiment.id}/comments`)
        .then(setComments)
        .catch(console.error);
    }
  }, [commentsDrawerOpen, experiment]);

  useEffect(() => {
    if (versionsDrawerOpen && experiment) {
      api.get<any[]>(`/api/v1/experiments/${experiment.id}/versions`)
        .then(setVersions)
        .catch(console.error);
    }
  }, [versionsDrawerOpen, experiment]);

  const handleExport = async (type: 'summary' | 'raw') => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/data/export/${type}/${experiment!.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        console.error(`Export failed (${res.status}):`, errBody);
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${experiment!.title}_${type}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/experiments/${experiment!.id}/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Download failed");
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!experiment) return;
    try {
      await api.delete(`/api/v1/experiments/${experiment.id}/attachments/${attId}`);
      setAttachments(prev => prev.filter(a => a.id !== attId));
      toast.success("Attachment deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experiment || !newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const added = await api.post(`/api/v1/experiments/${experiment.id}/comments`, { content: newComment });
      setComments(prev => [...prev, added]);
      setNewComment("");
    } catch (err) {
      toast.error("Failed to post comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSaveExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experiment) return;
    setSaving(true);
    try {
      const updated = await api.put<ExperimentDetail>(`/api/v1/experiments/${experiment.id}`, {
        title: editTitle,
        content: editContent || null,
        versionNo: experiment.versionNo,
      });
      setExperiment(updated);
      setEditModalOpen(false);
    } catch (err: any) {
      alert(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExperiment = async () => {
    if (!experiment) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/experiments/${experiment.id}`);
      setDeleteConfirmOpen(false);
      // Navigate back to the project experiments list
      navigate(experiment.projectId ? `/projects/${experiment.projectId}?tab=experiments` : "/projects");
    } catch (err: any) {
      alert(err?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const [completingStep, setCompletingStep] = useState(false);

  const handleCompleteStep = async () => {
    if (!experiment?.projectId) return;
    setCompletingStep(true);
    try {
      await api.put(`/api/v1/workflow/instances/${experiment.projectId}/transition`);
      toast.success(t("step_completed_success", "当前工步已提交，进入下一步！"));
      navigate(experiment.projectId ? `/projects/${experiment.projectId}?tab=experiments` : "/projects");
    } catch (err: any) {
      toast.error(err?.message ?? t("submit_failed", "提交失败"));
    } finally {
      setCompletingStep(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !experiment) {
    return <div className="p-10 text-sm text-red-500">{error ?? t("experiment_not_found")}</div>;
  }

  const assayType = experiment.metadata?.assayType;
  const permissionType = assayType ? ASSAY_TYPE_TO_PERMISSION[assayType] : null;
  const hasReadPermission =
    !permissionType ||
    hasPermission("experiments:read") ||
    hasPermission(`data_${permissionType}:read`);
  const canWrite = hasPermission("experiments:write");

  const hasRawData = true;

  // Data view mode: summary / raw
  const [dataView, setDataView] = useState<"summary" | "raw">("summary");

  // For ProcessData experiments, raw data has two sources: formation (化成) and grading (定容)
  const isProcessData = assayType === "ProcessData";
  const showProcessRawToggles = isProcessData && (!experiment.workflowStepName || ["formation", "capacity_grading"].includes(experiment.workflowStepName));
  const isProcessRawData = isProcessData && ["formation", "capacity_grading"].includes(experiment.workflowStepName || "");
  const [rawSource, setRawSource] = useState<"formation" | "grading">(experiment.workflowStepName === "capacity_grading" ? "grading" : "formation");
  const [rawSteps, setRawSteps] = useState<any[]>([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawLoaded, setRawLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (dataView !== "raw" || !experiment) return;
    const sourceParam = isProcessRawData ? rawSource : undefined;
    const cacheKey = sourceParam ?? "all";
    if (rawLoaded[cacheKey]) return;

    let cancelled = false;
    setRawLoading(true);
    const url = (isProcessData && showProcessRawToggles)
      ? `/api/v1/data/raw/${experiment.id}?source=${rawSource}`
      : `/api/v1/data/raw/${experiment.id}`;
    api.get<any[]>(url)
      .then((data) => {
        if (!cancelled) {
          setRawSteps(data ?? []);
          setRawLoaded((prev) => ({ ...prev, [cacheKey]: true }));
        }
      })
      .catch(() => { if (!cancelled) setRawSteps([]); })
      .finally(() => { if (!cancelled) setRawLoading(false); });
    return () => { cancelled = true; };
  }, [dataView, rawSource, rawLoaded, experiment, isProcessData]);

  // Upload Excel data entry
  const [uploadDataType, setUploadDataType] = useState<'summary' | 'raw'>('summary');
  const [uploadDataOpen, setUploadDataOpen] = useState(false);
  const [uploadDataFiles, setUploadDataFiles] = useState<File[]>([]);
  const [uploadDataSubmitting, setUploadDataSubmitting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleDataUpload = async () => {
    if (!experiment || uploadDataFiles.length === 0) return;
    setUploadDataSubmitting(true);
    try {
      if (uploadDataType === 'raw') {
        await Promise.all(
          uploadDataFiles.map(async (file) => {
            const form = new FormData();
            form.append("file", file);
            await api.upload(`/api/v1/experiments/${experiment.id}/attachments`, form);
          })
        );
        api.get<any[]>(`/api/v1/experiments/${experiment.id}/attachments`)
          .then(res => setAttachments(Array.isArray(res) ? res : []))
          .catch(() => {});
      } else {
        const form = new FormData();
        uploadDataFiles.forEach((file) => form.append("files", file));
        form.append("experimentId", experiment.id);
        form.append("mode", "merge");
        await api.upload("/api/v1/data/upload", form);
      }
      toast(t("upload_success", "上传成功"), "success");
      setUploadDataOpen(false);
      setUploadDataFiles([]);
      setRefreshCounter((n) => n + 1);
    } catch (err: any) {
      toast(err?.message ?? t("upload_failed", "上传失败"), "error");
    } finally {
      setUploadDataSubmitting(false);
    }
  };

  const renderTable = () => {
    switch (assayType) {
      case "ProcessData": return <ProcessDataTable experimentId={experiment.id} stepName={experiment.workflowStepName} />;
      case "CalendarLife": return <CalendarLifeTable experimentId={experiment.id} />;
      case "StorageSwelling": return <StorageSwellingTable experimentId={experiment.id} />;
      case "EnergyEfficiency": return <EnergyEfficiencyTable experimentId={experiment.id} />;
      case "DcrTest": return <DcrTestTable experimentId={experiment.id} />;
      case "FastCharge": return <FastChargeTable experimentId={experiment.id} />;
      case "HtCycle": return <HtCycleTable experimentId={experiment.id} />;
      default:
        return (
          <div className="p-8 text-center text-sm text-gray-500">
            {t("no_data_available", { type: assayType || "this type" })}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-30 pt-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{experiment.title}</h1>
            {assayType && (
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 shrink-0">
                {t(RECORD_TYPE_TO_I18N_KEY[assayType] || assayType)}
                {experiment.workflowStepName && ` - ${t(`step_${experiment.workflowStepName}`, STEP_NAME_MAP[experiment.workflowStepName] || experiment.workflowStepName)}`}
              </span>
            )}
            <span className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0 border",
              experiment.status === "Draft" && "bg-gray-50 text-gray-700 border-gray-200",
              experiment.status === "In Review" && "bg-amber-50 text-amber-700 border-amber-200",
              experiment.status === "Approved" && "bg-green-50 text-green-700 border-green-200",
              experiment.status === "Rejected" && "bg-rose-50 text-rose-700 border-rose-200",
              experiment.status === "Archived" && "bg-slate-50 text-slate-700 border-slate-200"
            )}>
              {t(`status_${experiment.status.toLowerCase().replace(" ", "_")}`, experiment.status)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{t("updated")} {format(new Date(experiment.updatedAt), "MMM d, yyyy")}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span>v{experiment.versionNo}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {experiment.projectId && canWrite && (
            <Button size="sm" variant="primary" onClick={handleCompleteStep} loading={completingStep} disabled={completingStep}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {t("complete_step", "提交")}
            </Button>
          )}
          {/* Quick drawer toggles */}
          <ButtonGroup
            items={[
              ...(canWrite ? [{
                id: "edit",
                label: "编辑",
                icon: <Edit3 className="w-4 h-4 text-gray-500" />,
                title: t("edit", "编辑信息"),
                onClick: openEditModal
              }] : []),
              {
                id: "history",
                label: "历史",
                icon: <History className="w-4 h-4" />,
                title: t("history", "历史版本"),
                onClick: () => { setActiveDrawer("versions"); setVersionsDrawerOpen(true); }
              },
              {
                id: "attachments",
                label: "附件",
                icon: <Paperclip className="w-4 h-4" />,
                title: t("attachments", "附件"),
                onClick: () => { setActiveDrawer("attachments"); setAttachmentsDrawerOpen(true); },
                badge: attachments.length > 0 ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute top-1 right-1" /> : undefined,
                className: "relative"
              },
              {
                id: "comments",
                label: "讨论",
                icon: <MessageSquare className="w-4 h-4" />,
                title: t("comments", "评论"),
                onClick: () => { setActiveDrawer("comments"); setCommentsDrawerOpen(true); },
                badge: comments.length > 0 ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-1 right-1" /> : undefined,
                className: "relative"
              }
            ]}
          />

          {/* Import / Export Group */}
          <ButtonGroup
            items={[
              ...(assayType !== "StorageSwelling" && canWrite ? [{
                id: "import",
                label: t("import_data", "导入"),
                icon: <UploadCloud className="w-3.5 h-3.5" />,
                badge: <ChevronDown className="w-3 h-3 opacity-50 ml-0.5" />,
                dropdownContent: (
                  <>
                    <button onClick={() => { setUploadDataType('summary'); setUploadDataOpen(true); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left">
                      <Table2 className="w-3.5 h-3.5 text-gray-400" />
                      {t("import_summary", "导入汇总数据")}
                    </button>
                    {hasRawData && (
                      <button onClick={() => { setUploadDataType('raw'); setUploadDataOpen(true); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left">
                        <FileDigit className="w-3.5 h-3.5 text-gray-400" />
                        {t("import_raw", "导入原始数据")}
                      </button>
                    )}
                  </>
                )
              }] : []),
              {
                id: "export",
                label: t("export", "导出"),
                icon: <Download className="w-3.5 h-3.5" />,
                onClick: () => { },
                badge: <ChevronDown className="w-3 h-3 opacity-50 ml-0.5" />,
                dropdownContent: (
                  <>
                    <button onClick={() => handleExport('summary')} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left">
                      <Table2 className="w-3.5 h-3.5 text-gray-400" />
                      {t("export_summary", "导出汇总 Excel")}
                    </button>
                    {hasRawData && (
                      <button onClick={() => handleExport('raw')} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left">
                        <FileDigit className="w-3.5 h-3.5 text-gray-400" />
                        {t("export_raw", "导出原始工步 Excel")}
                      </button>
                    )}
                  </>
                )
              }
            ]}
          />
        </div>
      </div>

      {experiment.content && (
        <div className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
          <div className="prose prose-sm prose-blue max-w-none text-gray-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {experiment.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {hasReadPermission ? (
        <div className="space-y-6">
          <ExperimentChart 
            assayType={assayType || "Unknown"} 
            experimentId={experiment.id} 
            projectId={experiment.projectId} 
            title={experiment.workflowStepName ? `${t(RECORD_TYPE_TO_I18N_KEY[assayType || "Unknown"] || assayType)} - ${t(`step_${experiment.workflowStepName}`, experiment.workflowStepName)}` : undefined} 
          />

          {/* Data Section */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-900">{t("data_table")}</h2>
                <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 border border-gray-200/60">
                  <button onClick={() => { setDataView("summary"); setRawLoaded({}); }}
                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                      dataView === "summary" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    <Table2 className="w-3.5 h-3.5" />{t("tab_summary", "汇总")}
                  </button>
                  <button onClick={() => setDataView("raw")}
                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                      dataView === "raw" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    <FileDigit className="w-3.5 h-3.5" />{t("tab_raw", "原始")}
                  </button>
                </div>
                {showProcessRawToggles && dataView === "raw" && (
                  <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 border border-gray-200/60 ml-2">
                    {(!experiment.workflowStepName || experiment.workflowStepName === "formation") && (
                      <button onClick={() => { setRawSource("formation"); setRawLoaded({}); }}
                        className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                          rawSource === "formation" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                        {t("raw_formation", "化成数据")}
                      </button>
                    )}
                    {(!experiment.workflowStepName || experiment.workflowStepName === "capacity_grading") && (
                      <button onClick={() => { setRawSource("grading"); setRawLoaded({}); }}
                        className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                          rawSource === "grading" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                        {t("raw_grading", "定容数据")}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {dataView === "raw" && rawSteps.length > 0 && (
                <span className="text-xs text-gray-400">{rawSteps.length} 行{isProcessData ? (rawSource === "formation" ? " (化成)" : " (定容)") : ""}</span>
              )}
            </div>

            {dataView === "summary" ? (
              <div key={refreshCounter}>{renderTable()}</div>
            ) : rawLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : rawSteps.length === 0 && !rawLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileDigit className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">
                  {isProcessData
                    ? (experiment.workflowStepName === "drying_injection" 
                        ? t("no_raw_data_drying", "暂无干燥/注液原始数据") 
                        : experiment.workflowStepName === "second_sealing"
                        ? t("no_raw_data_sealing", "暂无二封原始数据")
                        : (rawSource === "formation" ? t("no_raw_data_formation", "暂无化成原始工步数据") : t("no_raw_data_grading", "暂无定容原始工步数据")))
                    : t("no_raw_data", "暂无原始工步数据")}
                </p>
                {(isProcessData && (experiment.workflowStepName === "drying_injection" || experiment.workflowStepName === "second_sealing")) && (
                  <p className="text-xs text-gray-400 mt-2">{t("view_raw_data_attachments", "如果您上传了文件，请前往“附件”面板查看")}</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-[13px]">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      {[
                        { label: t("col_step_no", "工步号"), field: "stepNo" },
                        { label: "工步序号", field: "stepSeqNo" },
                        { label: t("col_raw_cycle", "循环号"), field: "cycleNo" },
                        { label: t("col_raw_cell", "电芯"), field: "cellName", sticky: true },
                        { label: t("col_raw_step_type", "工步类型"), field: "stepType" },
                        { label: t("col_raw_capacity", "容量"), field: "capacity", numeric: true },
                        { label: "起始电压", field: "startVoltage", numeric: true },
                        { label: "结束电压", field: "endVoltage", numeric: true },
                        { label: "起始电流", field: "startCurrent", numeric: true },
                        { label: "结束电流", field: "endCurrent", numeric: true },
                        { label: t("col_step_time", "工步时间"), field: "stepTime", numeric: true },
                      ].map((h) => (
                        <th
                          key={h.field}
                          className={cn(
                            "px-3 py-2.5 text-[11px] font-semibold uppercase whitespace-nowrap bg-gray-50",
                            h.numeric ? "text-right text-gray-500" : "text-left text-gray-500",
                            h.sticky && "sticky left-0 z-10 after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-gray-200",
                          )}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rawSteps.map((s: any) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs">{s.stepNo}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-400">{s.stepSeqNo}</td>
                        <td className="px-3 py-2 text-xs">{s.cycleNo}</td>
                        <td className="sticky left-0 bg-white px-3 py-2 text-xs font-medium text-gray-700 after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-gray-100">
                          {s.cellName}
                        </td>
                        <td className="px-3 py-2 text-xs">{s.stepType}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{s.capacity ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.startVoltage ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.endVoltage ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.startCurrent ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.endCurrent ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.stepTime ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-red-500 bg-red-50/50 rounded-lg border border-red-100">
          {t("no_permission_data")}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={t("edit_experiment")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModalOpen(false)} disabled={saving}>{t("cancel")}</Button>
            <Button type="submit" form="modal-experiment-form" loading={saving} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </>
        }>
        <form id="modal-experiment-form" onSubmit={handleSaveExperiment} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("title")}</label>
            <input type="text" required value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm" disabled={saving} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("notes")}</label>
            <MarkdownEditor value={editContent} onChange={setEditContent} disabled={saving} />
          </div>
        </form>
      </Modal>


      {/* Upload Data Modal */}
      <Modal open={uploadDataOpen} onClose={() => { setUploadDataOpen(false); setUploadDataFiles([]); }} title={t("import_data", "导入数据")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setUploadDataOpen(false); setUploadDataFiles([]); }} disabled={uploadDataSubmitting}>{t("cancel")}</Button>
            <Button variant="primary" size="sm" onClick={handleDataUpload} loading={uploadDataSubmitting} disabled={uploadDataSubmitting || uploadDataFiles.length === 0}>
              {uploadDataSubmitting ? t("uploading", "上传中...") : t("import_data", "导入数据")}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#1d74f5] hover:bg-blue-50/20 transition-all"
            onClick={() => uploadInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.className = e.currentTarget.className.replace('border-gray-200', 'border-[#1d74f5]').replace('hover:bg-blue-50/20', 'bg-blue-50/40'); }}
            onDragLeave={(e) => { e.currentTarget.className = e.currentTarget.className.replace('border-[#1d74f5]', 'border-gray-200').replace('bg-blue-50/40', 'hover:bg-blue-50/20'); }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) {
                const files = Array.from(e.dataTransfer.files).filter(f => uploadDataType === 'raw' || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
                if (files.length > 0) setUploadDataFiles((prev) => [...prev, ...files]);
              }
            }}
          >
            <UploadCloud className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">{t("upload_drag_hint", "拖拽或点击选择文件")}</p>
            <p className="text-xs text-gray-400">{uploadDataType === 'raw' ? t("upload_any", "支持任意格式的文件") : t("upload_supported_formats", "支持 .xlsx / .xls 格式，可同时选择多个文件")}</p>
            <input type="file" accept={uploadDataType === 'raw' ? undefined : ".xlsx,.xls"} multiple className="hidden" ref={uploadInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const files = Array.from(e.target.files);
                  setUploadDataFiles((prev) => [...prev, ...files]);
                }
                if (uploadInputRef.current) uploadInputRef.current.value = "";
              }} />
          </div>
          {uploadDataFiles.length > 0 && (
            <div className="space-y-1.5 border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {uploadDataFiles.map((f, i) => (
                <div key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <FileDigit className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs text-gray-700 truncate">{f.name}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadDataFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-[11px] text-red-500 hover:text-red-700 font-medium shrink-0"
                  >{t("remove", "移除")}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Attachments Drawer */}
      <Drawer
        open={attachmentsDrawerOpen || activeDrawer === "attachments"}
        onClose={() => { setAttachmentsDrawerOpen(false); setActiveDrawer(null); }}
        title={t("attachments", "Attachments")}
      >
        <div className="space-y-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">{t("files", "Files")}</h4>
          {attachments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{t("no_attachments", "暂无附件")}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {attachments.map(att => (
                <li key={att.id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                      <FileDigit className="w-4 h-4 text-[#1d74f5]" />
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => downloadAttachment(att.id, att.fileName)}
                        className="text-sm font-medium text-blue-600 hover:underline truncate block text-left"
                      >
                        {att.fileName}
                      </button>
                      <p className="text-xs text-gray-500">{(att.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <Popconfirm
                    title={t("delete_attachment_confirm", "附件删除后关联的汇总数据也会一并删除，确定继续？")}
                    onConfirm={() => handleDeleteAttachment(att.id)}
                    placement="left"
                  >
                    <Button variant="text" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Popconfirm>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Drawer>

      {/* Comments Drawer */}
      <Drawer
        open={commentsDrawerOpen || activeDrawer === "comments"}
        onClose={() => { setCommentsDrawerOpen(false); setActiveDrawer(null); }}
        title={t("comments", "Comments")}
      >
        <div className="h-full flex flex-col -m-6">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">{t("no_comments", "暂无评论，开始对话吧！")}</p>
            ) : (
              comments.map(c => {
                const isMe = c.userId === JSON.parse(atob(localStorage.getItem('token')?.split('.')[1] || 'e30=')).sub;
                return (
                  <div key={c.id} className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                    <span className="text-[11px] text-gray-500 mb-1 px-1">
                      {isMe ? t("you", "我") : t("collaborator", "协作者")} • {format(new Date(c.createdAt), "MMM d, HH:mm")}
                    </span>
                    <div className={cn("px-4 py-2.5 rounded-2xl text-sm shadow-sm", isMe ? "bg-[#1d74f5] text-white rounded-br-none" : "bg-white border border-gray-100 text-gray-900 rounded-bl-none")}>
                      {c.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-4 bg-white border-t border-gray-100 shrink-0">
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder={t("comment_placeholder", "输入评论...")}
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5]"
                disabled={commentSubmitting}
              />
              <Button type="submit" variant="primary" className="!rounded-full !p-2 shrink-0" loading={commentSubmitting} disabled={commentSubmitting || !newComment.trim()}>
                {!commentSubmitting && <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>
      </Drawer>

      <Drawer open={versionsDrawerOpen || activeDrawer === "versions"} onClose={() => { setVersionsDrawerOpen(false); setActiveDrawer(null); }} title={t("history", "Version History")}>
        <VersionDiffViewer versions={versions} />
      </Drawer>
    </div>
  );
}
