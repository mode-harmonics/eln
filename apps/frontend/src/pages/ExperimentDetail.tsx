import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Download, Edit3, Loader2, Trash2 } from "lucide-react";
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
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { api, ApiError } from "../lib/api";
import type { Experiment } from "../types";
import { usePermissions } from "../hooks/usePermissions";

interface ExperimentDetail extends Experiment {
  attachments?: unknown[];
  collaborators?: unknown[];
}

const ASSAY_TYPE_TO_PERMISSION: Record<string, string> = {
  ProcessData: "process",
  CalendarLife: "calendar",
  StorageSwelling: "swelling",
  EnergyEfficiency: "efficiency",
  DcrTest: "dcr",
  FastCharge: "fastcharge",
  HtCycle: "htcycle",
};

export function ExperimentDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { experimentId } = useParams<{ experimentId: string }>();
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchExperiment = () => {
    if (!experimentId) return;
    api.get<ExperimentDetail>(`/api/v1/experiments/${experimentId}`)
      .then((data) => setExperiment(data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!experimentId) return;
    let cancelled = false;
    api.get<ExperimentDetail>(`/api/v1/experiments/${experimentId}`)
      .then((data) => { if (!cancelled) setExperiment(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "加载失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [experimentId]);

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
    return <div className="p-10 text-sm text-red-500">{error ?? "Experiment not found"}</div>;
  }

  const assayType = experiment.metadata?.assayType || experiment.metadata?.recordType;
  const permissionType = assayType ? ASSAY_TYPE_TO_PERMISSION[assayType] : null;
  const hasReadPermission =
    !permissionType ||
    hasPermission("experiments:read") ||
    hasPermission(`data_${permissionType}:read`);
  const canWrite = hasPermission("experiments:write");

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
            {canWrite && (
              <>
                <Button variant="secondary" onClick={openEditModal}>
                  <Edit3 className="w-4 h-4" />
                  {t("edit")}
                </Button>
                <Button variant="secondary" onClick={() => setDeleteModalOpen(true)} className="[&>svg]:text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                  {t("delete")}
                </Button>
              </>
            )}
            <Button variant="secondary">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
        <div className="h-px bg-gray-200 w-full mt-6"></div>
      </div>

      {hasReadPermission ? (
        <div className="space-y-8">
          <ExperimentChart assayType={assayType || "Unknown"} experimentId={experiment.id} projectId={experiment.projectId} />

          {/* Data Table Section */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-[15px] font-semibold text-gray-900">Data Table</h2>
              <Button variant="text">
                <Download className="w-4 h-4" />
              </Button>
            </div>
            {renderTable()}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-red-500 bg-red-50/50 rounded-lg border border-red-100">
          You do not have permission to view this battery-science business data.
        </div>
      )}

      {/* Edit Experiment Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={t("edit_experiment")}>
        <form onSubmit={handleSaveExperiment} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("title")}</label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("notes")}</label>
            <textarea
              rows={4}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
              disabled={saving}
            />
          </div>
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={saving} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Experiment Confirmation Modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t("delete_confirm_title")}>
        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600">{t("delete_experiment_confirm")}</p>
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="danger" onClick={handleDeleteExperiment} loading={deleting} disabled={deleting}>
              {deleting ? t("deleting") : t("delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
