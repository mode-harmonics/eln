import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLoaderData } from "react-router-dom";
import { format } from "date-fns";
import { Download, Edit3, Loader2, Trash2, Table2, FileDigit, ChevronDown, Layers, CheckCircle2, AlertCircle, Plus, Paperclip, MessageSquare, Send, History } from "lucide-react";
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
import { Dropdown } from "../components/Dropdown";
import { Modal } from "../components/Modal";
import { Drawer } from "../components/Drawer";
import { CellPicker } from "../components/CellPicker";
import { ConflictModal } from "../components/ConflictModal";
import { StepProgress } from "../components/StepProgress";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { VersionDiffViewer } from "../components/VersionDiffViewer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import { cn } from "../lib/utils";
import type { Experiment } from "../types";
import { usePermissions } from "../hooks/usePermissions";

interface ExperimentDetail extends Experiment {
  attachments?: any[];
  collaborators?: any[];
}

import { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY } from "../utils/recordTypes";

const ASSAY_TYPE_TO_PERMISSION = RECORD_TYPE_TO_API_TYPE;

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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEditModal = () => {
    if (!experiment) return;
    setEditTitle(experiment.title);
    setEditContent(experiment.content || "");
    setEditModalOpen(true);
  };

  // Review workflow state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);

  // Collaborators workflow state
  const [collaboratorDrawerOpen, setCollaboratorDrawerOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [newCollabUserId, setNewCollabUserId] = useState("");
  const [newCollabRole, setNewCollabRole] = useState("Viewer");
  const [collabSubmitting, setCollabSubmitting] = useState(false);

  // Attachments state
  const [attachmentsDrawerOpen, setAttachmentsDrawerOpen] = useState(false);
  const [attachments, setAttachments] = useState<any[]>(loaderData?.attachments || []);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Comments state
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false);
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    if ((submitModalOpen || collaboratorDrawerOpen) && users.length === 0) {
      api.get<{ items: any[] }>("/api/v1/users?limit=100")
        .then((res) => setUsers(res.items || []))
        .catch(console.error);
    }
  }, [submitModalOpen, collaboratorDrawerOpen]);

  useEffect(() => {
    if (collaboratorDrawerOpen && experiment) {
      api.get<any[]>(`/api/v1/experiments/${experiment.id}/collaborators`)
        .then(setCollaborators)
        .catch(console.error);
    }
  }, [collaboratorDrawerOpen, experiment]);

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
      if (!res.ok) throw new Error("Export failed");
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
      toast.error(`Export failed`);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!experiment || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const newAtt = await api.post(`/api/v1/experiments/${experiment.id}/attachments`, formData);
      setAttachments(prev => [...prev, newAtt]);
      toast.success("Attachment uploaded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploadingAttachment(false);
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

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experiment || !newCollabUserId) return;
    setCollabSubmitting(true);
    try {
      await api.post(`/api/v1/experiments/${experiment.id}/collaborators`, { userId: newCollabUserId, role: newCollabRole });
      const updated = await api.get<any[]>(`/api/v1/experiments/${experiment.id}/collaborators`);
      setCollaborators(updated);
      setNewCollabUserId("");
      toast(t("collaborator_added", "Collaborator added"), "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to add collaborator", "error");
    } finally {
      setCollabSubmitting(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!experiment) return;
    try {
      await api.delete(`/api/v1/experiments/${experiment.id}/collaborators/${userId}`);
      setCollaborators(prev => prev.filter(c => c.userId !== userId));
      toast(t("collaborator_removed", "Collaborator removed"), "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to remove collaborator", "error");
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experiment) return;
    setWorkflowSubmitting(true);
    try {
      const updated = await api.post<ExperimentDetail>(`/api/v1/experiments/${experiment.id}/submit`, {
        reviewerId: reviewerId || undefined,
      });
      setExperiment(updated);
      setSubmitModalOpen(false);
      toast(t("submitted_for_review") || "Submitted for review", "success");
    } catch (err: any) {
      toast(err?.message ?? "Submit failed", "error");
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!experiment) return;
    setWorkflowSubmitting(true);
    try {
      const updated = await api.post<ExperimentDetail>(`/api/v1/experiments/${experiment.id}/approve`, {});
      setExperiment(updated);
      toast(t("approved") || "Approved", "success");
    } catch (err: any) {
      toast(err?.message ?? "Approve failed", "error");
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experiment || !rejectReason.trim()) return;
    setWorkflowSubmitting(true);
    try {
      const updated = await api.post<ExperimentDetail>(`/api/v1/experiments/${experiment.id}/reject`, {
        reason: rejectReason,
      });
      setExperiment(updated);
      setRejectModalOpen(false);
      toast(t("rejected") || "Rejected", "success");
    } catch (err: any) {
      toast(err?.message ?? "Reject failed", "error");
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!experiment) return;
    setWorkflowSubmitting(true);
    try {
      const updated = await api.post<ExperimentDetail>(`/api/v1/experiments/${experiment.id}/archive`, {});
      setExperiment(updated);
      toast(t("archived") || "Archived", "success");
    } catch (err: any) {
      toast(err?.message ?? "Archive failed", "error");
    } finally {
      setWorkflowSubmitting(false);
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
      setDeleteModalOpen(false);
      // Navigate back to the project experiments list
      navigate(experiment.projectId ? `/projects/${experiment.projectId}?tab=experiments` : "/projects");
    } catch (err: any) {
      alert(err?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
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

  // Data view mode: summary / raw
  const [dataView, setDataView] = useState<"summary" | "raw">("summary");
  const [rawSteps, setRawSteps] = useState<any[]>([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawLoaded, setRawLoaded] = useState(false);

  useEffect(() => {
    if (dataView !== "raw" || rawLoaded || !experiment) return;
    let cancelled = false;
    setRawLoading(true);
    api.get<any[]>(`/api/v1/data/raw/${experiment.id}`)
      .then((data) => { if (!cancelled) { setRawSteps(data ?? []); setRawLoaded(true); } })
      .catch(() => { if (!cancelled) setRawSteps([]); })
      .finally(() => { if (!cancelled) setRawLoading(false); });
    return () => { cancelled = true; };
  }, [dataView, rawLoaded, experiment]);

  // Cell picker drawer
  const [cellPickerOpen, setCellPickerOpen] = useState(false);
  const [pickedCells, setPickedCells] = useState<string[]>([]);

  useEffect(() => {
    if (!experimentId) return;
    api.get<any[]>(`/api/v1/data/picked-cells/${experimentId}`)
      .then((data) => setPickedCells((data || []).map((p: any) => p.cellId)))
      .catch(() => { /* no picks yet */ });
  }, [experimentId, cellPickerOpen]);

  // Conflict modal for upload
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingConflictCount, setPendingConflictCount] = useState(0);
  const [uploadMode, setUploadMode] = useState<"overwrite" | "merge" | undefined>(undefined);

  const handleUpload = async (files: File[], mode?: "overwrite" | "merge") => {
    if (!experiment || files.length === 0) return;
    try {
      const form = new FormData();
      files.forEach((file) => {
        form.append("files", file);
      });
      form.append("experimentId", experiment.id);
      if (mode) form.append("mode", mode);
      await api.upload("/api/v1/data/upload", form);
      toast("上传成功", "success");
      // Refresh page data
      window.location.reload();
    } catch (err: any) {
      if (err?.status === 409) {
        const count = err?.body?.existingCount ?? 0;
        setPendingFiles(files);
        setPendingConflictCount(count);
        setConflictModalOpen(true);
        return;
      }
      toast(err?.message ?? "上传失败", "error");
    }
  };

  const renderTable = () => {
    switch (assayType) {
      case "ProcessData": return <ProcessDataTable experimentId={experiment.id} />;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{experiment.title}</h1>
            {assayType && (
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 shrink-0">
                {t(RECORD_TYPE_TO_I18N_KEY[assayType] || assayType)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{t("updated")} {format(new Date(experiment.updatedAt), "MMM d, yyyy")}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span>v{experiment.versionNo}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canWrite && experiment.status === "Draft" && (
            <Button variant="primary" size="sm" onClick={() => setSubmitModalOpen(true)}>
              {t("submit_review", "Submit for Review")}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setVersionsDrawerOpen(true)}>
            <History className="w-4 h-4" />
            {t("history", "History")}
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setAttachmentsDrawerOpen(true)}>
            <Paperclip className="w-4 h-4" />
            {t("attachments", "Attachments")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCommentsDrawerOpen(true)}>
            <MessageSquare className="w-4 h-4" />
            {t("comments", "Comments")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCollaboratorDrawerOpen(true)}>
            <Layers className="w-4 h-4" />
            {t("collaborators", "Collaborators")}
          </Button>
          {hasPermission("experiments:approve") && experiment.status === "In Review" && (
            <>
              <Button variant="danger" size="sm" onClick={() => { setRejectReason(""); setRejectModalOpen(true); }}>
                {t("reject", "Reject")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleApprove} loading={workflowSubmitting}>
                <CheckCircle2 className="w-4 h-4" />
                {t("approve", "Approve")}
              </Button>
            </>
          )}
          {hasPermission("experiments:archive") && experiment.status === "Approved" && (
            <Button variant="secondary" size="sm" onClick={handleArchive} loading={workflowSubmitting}>
              {t("archive", "Archive")}
            </Button>
          )}
          {canWrite && (
            <>
              <Button variant="secondary" size="sm" onClick={openEditModal}>
                <Edit3 className="w-4 h-4" />
                {t("edit")}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
                <Trash2 className="w-4 h-4" />
                {t("delete")}
              </Button>
            </>
          )}
          <Dropdown
            trigger={
              <Button variant="secondary" size="sm">
                <Download className="w-4 h-4" />
                {t("export")}
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
              </Button>
            }
          >
            <button onClick={() => handleExport('summary')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
              <Table2 className="w-4 h-4 text-gray-400" />
              导出汇总数据
            </button>
            <button onClick={() => handleExport('raw')} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
              <FileDigit className="w-4 h-4 text-gray-400" />
              导出原始数据
            </button>
          </Dropdown>
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

      {/* Workflow Card — Cell Picking */}
      {assayType === "ProcessData" && (
        <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border border-blue-100/70 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-800">{t("workflow")}</span>
              </div>
              <StepProgress
                steps={[
                  { key: "upload", label: t("step_upload_process_data") },
                  { key: "pick", label: t("step_pick_cells") },
                  { key: "other", label: t("step_upload_other_data") },
                ]}
                currentStep={pickedCells.length > 0 ? 2 : ((experiment.cellPicked ?? false) ? 1 : 0)}
                completed={(() => {
                  const c: number[] = [0];
                  if (experiment.cellPicked || pickedCells.length > 0) c.push(1);
                  if (pickedCells.length > 0) c.push(2);
                  return c;
                })()}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                {pickedCells.length > 0 ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{t("picked_cells_count", { count: pickedCells.length })}</>
                ) : (
                  <><AlertCircle className="w-3.5 h-3.5 text-amber-500" />{t("not_picked")}</>
                )}
              </span>
              <Button variant="primary" size="sm" onClick={() => setCellPickerOpen(true)}>
                {t("pick_cells")}
              </Button>
            </div>
          </div>
          {/* Picked cells chips */}
          {pickedCells.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-blue-100/50">
              {pickedCells.map((cid) => (
                <span key={cid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/70 text-xs font-mono text-blue-700 border border-blue-200/60 shadow-sm">
                  {cid}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {hasReadPermission ? (
        <div className="space-y-6">
          <ExperimentChart assayType={assayType || "Unknown"} experimentId={experiment.id} projectId={experiment.projectId} />

          {/* Data Section */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-900">{t("data_table")}</h2>
                <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 border border-gray-200/60">
                  <button onClick={() => { setDataView("summary"); setRawLoaded(false); }}
                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                      dataView === "summary" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    <Table2 className="w-3.5 h-3.5" />汇总
                  </button>
                  <button onClick={() => setDataView("raw")}
                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                      dataView === "raw" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                    <FileDigit className="w-3.5 h-3.5" />原始
                  </button>
                </div>
              </div>
              {dataView === "raw" && rawSteps.length > 0 && (
                <span className="text-xs text-gray-400">{rawSteps.length} 行</span>
              )}
            </div>

            {dataView === "summary" ? (
              renderTable()
            ) : rawLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : rawSteps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileDigit className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">暂无原始工步数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-[13px]">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{["工步号","工步序号","循环号","电芯","工步类型","容量","起始电压","结束电压","起始电流","结束电流","工步时间"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rawSteps.map((s: any) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs">{s.stepNo}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-400">{s.stepSeqNo}</td>
                        <td className="px-3 py-2 text-xs">{s.cycleNo}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{s.cellName}</td>
                        <td className="px-3 py-2 text-xs">{s.stepType}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{s.capacity ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.startVoltage ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.endVoltage ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.startCurrent ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">{s.endCurrent ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-400">{s.stepTime ?? "—"}</td>
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

      {/* Delete Modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t("delete_confirm_title")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>{t("cancel")}</Button>
            <Button variant="danger" onClick={handleDeleteExperiment} loading={deleting} disabled={deleting}>
              {deleting ? t("deleting") : t("delete")}
            </Button>
          </>
        }>
        <p className="text-sm text-gray-600">{t("delete_experiment_confirm")}</p>
      </Modal>

      {/* Cell Picker Drawer */}
      <CellPicker
        open={cellPickerOpen}
        onClose={() => setCellPickerOpen(false)}
        experimentId={experiment.id}
        projectId={experiment.projectId}
        onComplete={(cells) => {
          setPickedCells(cells);
          setExperiment((prev) => prev ? { ...prev, cellPicked: true } : prev);
        }}
      />

      {/* Conflict Modal — slide-up overlay for overwrite/merge choice */}
      <ConflictModal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        existingCount={pendingConflictCount}
        onOverwrite={() => {
          setConflictModalOpen(false);
          setUploadMode("overwrite");
          handleUpload(pendingFiles, "overwrite");
        }}
        onMerge={() => {
          setConflictModalOpen(false);
          setUploadMode("merge");
          handleUpload(pendingFiles, "merge");
        }}
      />

      {/* Submit for Review Modal */}
      <Modal open={submitModalOpen} onClose={() => setSubmitModalOpen(false)} title={t("submit_review", "Submit for Review")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubmitModalOpen(false)} disabled={workflowSubmitting}>{t("cancel")}</Button>
            <Button type="submit" form="modal-submit-form" loading={workflowSubmitting} disabled={workflowSubmitting}>
              {workflowSubmitting ? t("submitting", "Submitting...") : t("submit", "Submit")}
            </Button>
          </>
        }>
        <form id="modal-submit-form" onSubmit={handleSubmitReview} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("reviewer", "Reviewer")} (Optional)</label>
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
              disabled={workflowSubmitting}
            >
              <option value="">-- {t("select_reviewer", "Select a reviewer")} --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username || u.email}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title={t("reject_experiment", "Reject Experiment")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModalOpen(false)} disabled={workflowSubmitting}>{t("cancel")}</Button>
            <Button type="submit" form="modal-reject-form" variant="danger" loading={workflowSubmitting} disabled={workflowSubmitting || !rejectReason.trim()}>
              {workflowSubmitting ? t("rejecting", "Rejecting...") : t("reject", "Reject")}
            </Button>
          </>
        }>
        <form id="modal-reject-form" onSubmit={handleReject} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("reason", "Reason")} <span className="text-red-500">*</span></label>
            <textarea rows={4} required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("reject_reason_placeholder", "Please provide a reason for rejection")}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 sm:text-sm" disabled={workflowSubmitting} />
          </div>
        </form>
      </Modal>

      {/* Collaborators Drawer */}
      <Drawer
        open={collaboratorDrawerOpen}
        onClose={() => setCollaboratorDrawerOpen(false)}
        title={t("collaborators", "Collaborators")}
      >
        <div className="space-y-6">
          <form onSubmit={handleAddCollaborator} className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h4 className="text-sm font-medium text-gray-900">{t("add_collaborator", "Add Collaborator")}</h4>
            <div className="space-y-2">
              <select
                required
                value={newCollabUserId}
                onChange={(e) => setNewCollabUserId(e.target.value)}
                className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none sm:text-sm"
                disabled={collabSubmitting}
              >
                <option value="">-- {t("select_user", "Select a user")} --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username || u.email}</option>
                ))}
              </select>
              <select
                required
                value={newCollabRole}
                onChange={(e) => setNewCollabRole(e.target.value)}
                className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none sm:text-sm"
                disabled={collabSubmitting}
              >
                <option value="Editor">Editor</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
            <Button type="submit" variant="primary" className="w-full" loading={collabSubmitting} disabled={collabSubmitting || !newCollabUserId}>
              <Plus className="w-4 h-4" />
              {t("add", "Add")}
            </Button>
          </form>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">{t("current_collaborators", "Current Collaborators")}</h4>
            {collaborators.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">{t("no_collaborators", "No collaborators yet")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {collaborators.map(c => {
                  const user = users.find(u => u.id === c.userId);
                  return (
                    <li key={c.id} className="py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.username || user?.email || c.userId}</p>
                        <p className="text-xs text-gray-500">{c.role}</p>
                      </div>
                      <Button variant="text" size="sm" onClick={() => handleRemoveCollaborator(c.userId)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        {t("remove", "Remove")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Drawer>

      {/* Attachments Drawer */}
      <Drawer
        open={attachmentsDrawerOpen}
        onClose={() => setAttachmentsDrawerOpen(false)}
        title={t("attachments", "Attachments")}
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex flex-col items-center justify-center text-center">
            <Paperclip className="w-6 h-6 text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-900 mb-1">Upload Attachment</p>
            <p className="text-xs text-gray-500 mb-3">Any file type (PDF, Images, etc.)</p>
            <label className={cn("cursor-pointer inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#1d74f5] hover:bg-blue-700 transition-colors", uploadingAttachment && "opacity-50 pointer-events-none")}>
              {uploadingAttachment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {uploadingAttachment ? "Uploading..." : "Select File"}
              <input type="file" className="hidden" onChange={handleUploadAttachment} disabled={uploadingAttachment} />
            </label>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">{t("files", "Files")}</h4>
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No attachments</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {attachments.map(att => (
                  <li key={att.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                        <FileDigit className="w-4 h-4 text-[#1d74f5]" />
                      </div>
                      <div className="min-w-0">
                        <a href={`/api/v1/experiments/${experiment?.id}/attachments/${att.id}/download`} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">
                          {att.fileName}
                        </a>
                        <p className="text-xs text-gray-500">{(att.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button variant="text" size="sm" onClick={() => handleDeleteAttachment(att.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Drawer>

      {/* Comments Drawer */}
      <Drawer
        open={commentsDrawerOpen}
        onClose={() => setCommentsDrawerOpen(false)}
        title={t("comments", "Comments")}
      >
        <div className="h-full flex flex-col -m-6">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No comments yet. Start the conversation!</p>
            ) : (
              comments.map(c => {
                const isMe = c.userId === JSON.parse(atob(localStorage.getItem('token')?.split('.')[1] || 'e30=')).sub;
                return (
                  <div key={c.id} className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                    <span className="text-[11px] text-gray-500 mb-1 px-1">
                      {isMe ? "You" : "Collaborator"} • {format(new Date(c.createdAt), "MMM d, HH:mm")}
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
                placeholder="Type a comment..."
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

      <Drawer open={versionsDrawerOpen} onClose={() => setVersionsDrawerOpen(false)} title={t("history", "Version History")}>
        <VersionDiffViewer versions={versions} />
      </Drawer>
    </div>
  );
}
