import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLoaderData } from "react-router-dom";
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
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { api, ApiError } from "../lib/api";
import type { Experiment } from "../types";
import { usePermissions } from "../hooks/usePermissions";

interface ExperimentDetail extends Experiment {
  attachments?: unknown[];
  collaborators?: unknown[];
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
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
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
          <div className="flex items-center gap-3 shrink-0">
            {canWrite && (
              <>
                <Button variant="secondary" onClick={openEditModal}>
                  <Edit3 className="w-4 h-4" />
                  {t("edit")}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
                  <Trash2 className="w-4 h-4" />
                  {t("delete")}
                </Button>
              </>
            )}
            <Button variant="secondary">
              <Download className="w-4 h-4" />
              {t("export")}
            </Button>
          </div>
        </div>
        <div className="h-px bg-gray-200 w-full mt-6"></div>
      </div>

      {hasReadPermission ? (
        <div className="space-y-8">
          <ExperimentChart assayType={assayType || "Unknown"} experimentId={experiment.id} projectId={experiment.projectId} />

          {/* Data Table Section */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{t("data_table")}</h2>
            </div>
            {renderTable()}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-red-500 bg-red-50/50 rounded-lg border border-red-100">
          {t("no_permission_data")}
        </div>
      )}

      {/* Edit Experiment Modal */}
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
        </form>
      </Modal>

      {/* Delete Experiment Confirmation Modal */}
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
    </div>
  );
}
