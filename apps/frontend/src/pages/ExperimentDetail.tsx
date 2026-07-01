import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLoaderData } from "react-router-dom";
import { format } from "date-fns";
import { Download, Edit3, Loader2, Trash2, Table2, FileDigit, ChevronDown, Layers, CheckCircle2, AlertCircle } from "lucide-react";
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
import { CellPicker } from "../components/CellPicker";
import { ConflictModal } from "../components/ConflictModal";
import { StepProgress } from "../components/StepProgress";
import { toast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import { cn } from "../lib/utils";
import type { Experiment } from "../types";
import { usePermissions } from "../hooks/usePermissions";

interface ExperimentDetail extends Experiment {
  attachments?: unknown[];
  collaborators?: unknown[];
  cellPicked?: boolean;
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

  const assayType = experiment.metadata?.assayType || experiment.metadata?.recordType;
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
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("experimentId", experiment.id);
        if (mode) form.append("mode", mode);
        await api.upload("/api/v1/data/upload", form);
      }
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
            {experiment.content && (
              <>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>{experiment.content}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
              <Table2 className="w-4 h-4 text-gray-400" />
              导出汇总数据
            </button>
            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
              <FileDigit className="w-4 h-4 text-gray-400" />
              导出原始数据
            </button>
          </Dropdown>
        </div>
      </div>

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
            <textarea rows={4} value={editContent} onChange={(e) => setEditContent(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm" disabled={saving} />
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
    </div>
  );
}
