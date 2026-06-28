import React, { useEffect, useState } from "react";
import { Edit3, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Button } from "./Button";
import { Modal } from "./Modal";

/** Shared hook: fetch /api/v1/data/:type/:expId and return { data, loading, error, refresh } */
function useTableData<T>(type: string, experimentId: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState(0);

  const refresh = () => setRef((n) => n + 1);

  useEffect(() => {
    if (!experimentId) return;
    setLoading(true);
    api.get<T[]>(`/api/v1/data/${type}/${experimentId}`)
      .then(setData)
      .catch((err) => setError(err?.message ?? "加载失败"))
      .finally(() => setLoading(false));
  }, [type, experimentId, ref]);

  return { data, loading, error, refresh };
}

function TableShell({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  if (error) return <div className="p-6 text-center text-sm text-red-500">{error}</div>;
  return <>{children}</>;
}

// ─── Shared Row Edit / Delete Components ──────────────────────────────────────

const SYSTEM_FIELDS = new Set(["id", "experimentId", "createdAt"]);

interface EditRowModalProps {
  open: boolean;
  onClose: () => void;
  row: Record<string, unknown>;
  type: string;
  onSaved: () => void;
}

function EditRowModal({ open, onClose, row, type, onSaved }: EditRowModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize form from row data, skipping system fields
    const init: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      if (!SYSTEM_FIELDS.has(key)) {
        init[key] = val == null ? "" : String(val);
      }
    }
    setForm(init);
  }, [row]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Convert numeric strings back to appropriate types
      const body: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(form)) {
        if (key === "picked" || key === "isHorizontal") {
          body[key] = val === "true" || val === "Yes";
        } else {
          body[key] = val === "" ? null : val;
        }
      }
      await api.put(`/api/v1/data/${type}/${row.id}`, body);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const editableFields = Object.keys(form).filter((key) => !SYSTEM_FIELDS.has(key));

  return (
    <Modal open={open} onClose={onClose} title={`${t("edit_row")} - ${row.cellId || row.cellName || row.id}`} maxWidth="2xl">
      <form onSubmit={handleSave} className="flex flex-col" style={{ maxHeight: "calc(90vh - 80px)" }}>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {editableFields.map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">{key}</label>
                {key === "picked" || key === "isHorizontal" ? (
                  <select
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                    disabled={saving}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form[key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm font-mono text-xs"
                    disabled={saving}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100 rounded-b-lg">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={saving} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface DeleteRowConfirmProps {
  open: boolean;
  onClose: () => void;
  rowId: string;
  type: string;
  onDeleted: () => void;
}

function DeleteRowConfirm({ open, onClose, rowId, type, onDeleted }: DeleteRowConfirmProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/data/${type}/${rowId}`);
      onDeleted();
      onClose();
    } catch (err: any) {
      alert(err?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("delete_confirm_title")}>
      <div className="p-6 space-y-5">
        <p className="text-sm text-gray-600">{t("delete_row_confirm")}</p>
        <div className="pt-2 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting} disabled={deleting}>
            {deleting ? t("deleting") : t("delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface RowActionsProps {
  row: Record<string, unknown>;
  type: string;
  onRefresh: () => void;
}

function RowActions({ row, type, onRefresh }: RowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditOpen(true)}
          className="p-1 text-gray-400 hover:text-[#1d74f5] transition-colors"
          title="Edit"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setDeleteOpen(true)}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <EditRowModal open={editOpen} onClose={() => setEditOpen(false)} row={row} type={type} onSaved={onRefresh} />
      <DeleteRowConfirm open={deleteOpen} onClose={() => setDeleteOpen(false)} rowId={row.id as string} type={type} onDeleted={onRefresh} />
    </>
  );
}

export function ProcessDataTable({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useTableData<any>('process', experimentId);
  return (
    <TableShell loading={loading} error={error}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_cell_id")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_m0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_m1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_m2")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_v0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_v1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fu0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fr0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fq1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fq2")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fu1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fr1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fu2")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_fr2")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_m3")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_m4")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_gu0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_gr0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_gqc1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_gqd1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_gqc2")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_gu1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_gr1")}
            </th>
            {/* Computed fields */}
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Injection Mass = m1 - m0"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_mIn")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Loss Mass = m1 - m2"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_mLoss")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Hold Mass = m4 - m0"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_mHold")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Formation Charge Capacity = fq1 + fq2"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_fq")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="1st Discharge Capacity = gqd1"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_qdFirst")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Formation Gas Volume = (v1 - v0) / qdFirst"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_fvg")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Aging Voltage Drop = fu1 - fu2"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_ku")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="1st Charge Capacity = fq + gqc1"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_qcFirst")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="1st Coulombic Efficiency = qdFirst / qcFirst * 100"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_ceFirst")}
              </span>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("col_picked")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {d.cellId}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.m0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.m1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.m2}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.v0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.v1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fu0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fr0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fq1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fq2}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fu1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fr1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fu2}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.fr2}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.m3}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.m4}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.gu0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.gr0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.gqc1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.gqd1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.gqc2}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.gu1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.gr1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.mIn}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.mLoss}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.mHold}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.fq}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.qdFirst}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.fvg}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.ku}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.qcFirst}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.ceFirst}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.picked ? (
                  <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-[#f0f9f4] text-[#1e8b4e]">
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                    No
                  </span>
                )}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <RowActions row={d} type="process" onRefresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TableShell>
  );
}

export function CalendarLifeTable({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useTableData<any>('calendar', experimentId);
  return (
    <TableShell loading={loading} error={error}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cell_name")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_is_horizontal")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_day")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_q_cap")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_dq_loss")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_ddcr")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cdcr")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_u_voltage")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_r_acir")}
            </th>
            {/* Computed fields */}
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Capacity Retention = (dq / q_0d) * 100"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_qRetention")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Capacity Recovery = (q / q_0d) * 100"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_qRecovery")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="D-DCR Increase = (ddcr / ddcr_0d - 1) * 100"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_ddcrGrowth")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="C-DCR Increase = (cdcr / cdcr_0d - 1) * 100"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_cdcrGrowth")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Voltage Increase = (u / u_0d - 1) * 100"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_uGrowth")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Internal Resistance Increase = (r / r_0d - 1) * 100"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_rGrowth")}
              </span>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((d: any) => (
            <tr key={d.id || d.dayCount}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {d.cellName}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.isHorizontal ? "Yes" : "No"}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.dayCount}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.q}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.dq}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.ddcr}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.cdcr}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.u}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.r}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.qRetention}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.qRecovery}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.ddcrGrowth}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.cdcrGrowth}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.uGrowth}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.rGrowth}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <RowActions row={d} type="calendar" onRefresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TableShell>
  );
}

export function StorageSwellingTable({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useTableData<any>('swelling', experimentId);
  return (
    <TableShell loading={loading} error={error}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cell_name")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_qd1st")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_day")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_v_volume")}
            </th>
            {/* Computed fields */}
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Gas Volume = (v - v_0d) / qd1st (mL/Ah)"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_vg")}
              </span>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {d.cellName}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.qd1st}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.dayCount}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.v}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.vg}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <RowActions row={d} type="swelling" onRefresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TableShell>
  );
}

export function EnergyEfficiencyTable({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useTableData<any>('efficiency', experimentId);
  return (
    <TableShell loading={loading} error={error}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cell_name")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_de")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_ce")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_notes")}
            </th>
            {/* Computed fields */}
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Energy Efficiency Ratio = de / ce"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_ee")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Energy Efficiency = (de / ce) * 100 (%)"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_eePct")}
              </span>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {d.cellName}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.de}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.ce}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.notes}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.ee}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.eePct}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <RowActions row={d} type="efficiency" onRefresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TableShell>
  );
}

export function DcrTestTable({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useTableData<any>('dcr', experimentId);
  return (
    <TableShell loading={loading} error={error}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cell_name")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_q0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_du0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_du1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_di")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cu0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cu1")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_ci")}
            </th>
            {/* Computed fields */}
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Discharge DCR = |du1 - du0| / di (Ω)"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_ddcr")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Charge DCR = |cu1 - cu0| / ci (Ω)"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_cdcr")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Discharge R-C Product = q0 * ddcr (Ah·Ω)"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_dRcProduct")}
              </span>
            </th>
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="Charge R-C Product = q0 * cdcr (Ah·Ω)"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_cRcProduct")}
              </span>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {d.cellName}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.q0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.du0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.du1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.di}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.cu0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.cu1}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.ci}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.ddcr}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.cdcr}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.dRcProduct}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.cRcProduct}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <RowActions row={d} type="dcr" onRefresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TableShell>
  );
}

export function FastChargeTable({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useTableData<any>('fastcharge', experimentId);
  return (
    <TableShell loading={loading} error={error}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cell_name")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_c0")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_time_provided")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_steps")}
            </th>
            {/* Computed fields */}
            <th
              className="px-4 py-2 text-left text-xs font-medium text-[#1d74f5] uppercase tracking-wider whitespace-nowrap cursor-help"
              title="10%-80% SOC Fast Charge Time (min)"
            >
              <span className="underline decoration-dotted underline-offset-2">
                {t("col_comp_computedTime")}
              </span>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {d.cellName}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.c0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.providedFastChargeTime
                  ? `${d.providedFastChargeTime} min`
                  : "N/A"}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {d.steps?.length || 0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 bg-[#f8fafc]">
                {d.computedFastChargeTime
                  ? `${d.computedFastChargeTime} min`
                  : "N/A"}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <RowActions row={d} type="fastcharge" onRefresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TableShell>
  );
}

export function HtCycleTable({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useTableData<any>('htcycle', experimentId);
  return (
    <TableShell loading={loading} error={error}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_cycle")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("col_caps")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {d.cycle}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {JSON.stringify(d.caps)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <RowActions row={d} type="htcycle" onRefresh={refresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </TableShell>
  );
}
