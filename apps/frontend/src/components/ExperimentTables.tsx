import React, { useEffect, useState } from "react";
import { Ban, Check, Edit3, Loader2, Lock, Pencil, RotateCcw, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, isCellInvalid } from "../lib/utils";
import { api } from "../lib/api";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { Tooltip, TooltipTh } from "./Tooltip";
import { Popconfirm } from "./Popconfirm";
import { toast } from "./Toast";

/** Shared hook: fetch /api/v1/data/:type/:expId and return { data, loading, error, refresh } */
function useTableData<T>(type: string, experimentId: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState(0);

  const refresh = () => setRef((n) => n + 1);

  useEffect(() => {
    if (!experimentId) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api.get<T[]>(`/api/v1/data/${type}/${experimentId}`)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err?.message ?? "加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type, experimentId, ref]);

  return { data, loading, error, refresh };
}

type SourceType = 'manual' | 'device' | 'computed';

interface ColDef {
  field: string;
  i18nKey: string;
  label?: string;
  tooltip?: string;
  sourceType?: SourceType;
  editable?: boolean;
  /** Render cell value using a custom function instead of `row[field]` */
  render?: (val: unknown, row: Record<string, unknown>) => React.ReactNode;
}

function getSourceColorClass(c: ColDef): { hdr: string; cell: string } {
  const type = c.sourceType || (c.tooltip && c.tooltip.includes('=') ? 'computed' : c.editable ? 'manual' : undefined);
  if (type === 'manual') return { hdr: 'text-amber-700 font-semibold', cell: 'text-amber-800 font-medium' };
  if (type === 'device') return { hdr: 'text-sky-700 font-semibold', cell: 'text-sky-800 font-medium' };
  if (type === 'computed') return { hdr: 'text-emerald-700 font-semibold', cell: 'text-emerald-800 font-medium' };
  return { hdr: 'text-gray-700 font-semibold', cell: 'text-gray-900' };
}

function TableShell({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
  if (loading) return <div className="flex items-center justify-center py-12" role="status"><Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" /><span className="sr-only">Loading</span></div>;
  if (error) return <div className="p-6 text-center text-sm text-red-500">{error}</div>;
  return <>{children}</>;
}

/** Render table headers from column definitions (plain <th> or <TooltipTh>). */
function renderHeaders(cols: ColDef[], t: (k: string) => string, cellClassName?: string): React.ReactNode[] {
  return cols.map((c) => {
    const colors = getSourceColorClass(c);
    const headerText = c.label || t(c.i18nKey);
    if (c.tooltip) {
      return <TooltipTh key={c.field} content={c.tooltip} label={headerText} className={cn(colors.hdr, cellClassName)} />;
    }
    return (
      <th key={c.field} className={cn("px-4 py-3 min-w-[140px] text-left text-xs font-semibold whitespace-nowrap bg-gray-50/90", colors.hdr, cellClassName)}>
        {headerText}
      </th>
    );
  });
}

/** Render data cells from column definitions, optionally with inline editing. */
function renderCells(
  cols: ColDef[], row: Record<string, unknown>, colorMap?: Record<string, string>,
  editing?: boolean, editForm?: Record<string, string>, onEdit?: (f: string, v: string) => void,
  batchChange?: (f: string, v: string) => void,
  cellClassName?: string,
): React.ReactNode[] {
  return cols.map((c) => {
    const colors = getSourceColorClass(c);
    const isEditing = (editing && c.editable && editForm) || (batchChange && c.editable);
    const cellValue = isEditing && editForm ? editForm[c.field] ?? '' : String(row[c.field] ?? '');
    return (
      <td key={c.field} className={cn("px-3 py-2 whitespace-nowrap text-[13px]", colors.cell, isEditing && 'cursor-text', cellClassName)}>
        {isEditing ? (
          <input
            type="text"
            value={cellValue}
            onChange={(e) => (batchChange || onEdit)!(c.field, e.target.value)}
            className="-my-1 w-full min-w-12 rounded border border-gray-300 bg-white px-1.5 py-1 text-[13px] font-mono outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-300"
            onClick={(e) => e.stopPropagation()}
          />
        ) : c.render ? (
          c.render(row[c.field], row)
        ) : (
          String(row[c.field] ?? '')
        )}
      </td>
    );
  });
}

/** Hook for inline editing state. */
function useInlineEdit(type: string) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startEditing = (row: any) => {
    const form: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === 'id' || k === 'experimentId' || k === 'createdAt') continue;
      form[k] = v == null ? '' : String(v);
    }
    setEditForm(form);
    setEditingId(row.id ?? '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (rowId: string, onRefreshed?: () => void) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editForm)) {
        body[k] = v === '' ? null : v;
      }
      await api.put(`/api/v1/data/${type}/${rowId}`, body);
      setEditingId(null);
      setEditForm({});
      onRefreshed?.();
    } catch (err: any) {
      alert(err?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return { editingId, editForm, saving, startEditing, cancelEditing, handleChange, handleSave };
}

/** Hook for batch editing state — mirrors all data rows and saves changed ones. */
function useBatchEdit(type: string, data: any[], refresh: () => void) {
  const [batchEditing, setBatchEditing] = useState(false);
  const [batchDraft, setBatchDraft] = useState<any[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);

  const enterBatchEdit = () => {
    setBatchDraft(data.map((d) => ({ ...d })));
    setBatchEditing(true);
  };

  const cancelBatchEdit = () => {
    setBatchEditing(false);
    setBatchDraft([]);
  };

  const handleBatchChange = (index: number, field: string, value: string) => {
    setBatchDraft((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const saveBatchEdit = async () => {
    setBatchSaving(true);
    try {
      const skipKeys = new Set(['id', 'experimentId', 'createdAt', 'updatedAt']);
      const changedRows: Record<string, unknown>[] = [];

      for (let i = 0; i < batchDraft.length; i++) {
        const original = data[i];
        const draft = batchDraft[i];
        if (!draft || !original) continue;
        // 已报废电池不可批量编辑
        if ((original as any).scrapped) continue;

        const row: Record<string, unknown> = { id: draft.id };
        let hasChanges = false;

        for (const key of Object.keys(draft)) {
          if (skipKeys.has(key)) continue;
          const originalVal = (original as any)[key];
          const draftVal = (draft as any)[key];
          if (String(originalVal ?? '') !== String(draftVal ?? '')) {
            row[key] = draftVal === '' ? null : draftVal;
            hasChanges = true;
          }
        }

        if (hasChanges) changedRows.push(row);
      }

      if (changedRows.length > 0) {
        await api.put(`/api/v1/data/${type}/batch`, { rows: changedRows });
      }

      setBatchEditing(false);
      setBatchDraft([]);
      refresh();
    } catch (err: any) {
      alert(err?.message ?? '批量保存失败');
    } finally {
      setBatchSaving(false);
    }
  };

  return { batchEditing, batchDraft, batchSaving, enterBatchEdit, cancelBatchEdit, handleBatchChange, saveBatchEdit };
}

/** Scrap/restore a single battery (project-scoped). Renders a scrap button
 *  for healthy cells and an undo button for scrapped ones. */
function ScrapCellButton({ projectId, cellId, scrapped, readOnly, onChanged }: {
  projectId?: string;
  cellId: string;
  scrapped?: boolean;
  readOnly?: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!projectId || !cellId) return null;

  const doScrap = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/v1/data/scrapped-cells/${projectId}`, { cellId, reason: reason.trim() || undefined });
      setOpen(false);
      setReason("");
      toast.success(t("scrap_cell_success", "电池已报废"));
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? t("scrap_cell_failed", "报废失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const doRestore = async () => {
    try {
      await api.post(`/api/v1/data/scrapped-cells/${projectId}/restore`, { cellId });
      toast.success(t("restore_cell_success", "已撤销报废"));
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? t("restore_cell_failed", "撤销报废失败"));
    }
  };

  if (scrapped) {
    return (
      <Tooltip content={t("restore_cell", "撤销报废")}>
        <Popconfirm
          title={t("restore_cell_confirm", "确认撤销该电池的报废状态？")}
          onConfirm={doRestore}
          placement="left"
        >
          <button className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </Popconfirm>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip content={t("scrap_cell", "报废电池")}>
        <button
          onClick={() => setOpen(true)}
          disabled={readOnly}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Ban className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Modal
        open={open}
        onClose={() => { if (!submitting) { setOpen(false); setReason(""); } }}
        title={t("scrap_cell_modal_title", "报废电池")}
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); setReason(""); }} disabled={submitting}>
              {t("cancel", "取消")}
            </Button>
            <Button variant="danger" onClick={doScrap} loading={submitting} disabled={submitting}>
              {t("confirm_scrap_cell", "确认报废")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {t("scrap_cell_warning_prefix", "电池")}
            <span className="font-semibold text-gray-900"> {cellId} </span>
            {t("scrap_cell_warning", "报废后将从图表、导出与电池挑选中排除，此操作可撤销。")}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("scrap_cell_reason_placeholder", "请填写报废原因（可选）")}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
          />
        </div>
      </Modal>
    </>
  );
}

/** Row actions: toggles between edit/delete buttons and save/cancel. */
function RowActions({ row, type, onRefresh, editing, onStartEdit, onSave, onCancel, saving: isSaving, readOnly, projectId }: {
  row: Record<string, unknown>; type: string; onRefresh: () => void;
  editing?: boolean; onStartEdit?: () => void; onSave?: () => void; onCancel?: () => void; saving?: boolean; readOnly?: boolean;
  projectId?: string;
}) {
  const { t } = useTranslation();
  const cellId = String(row.cellId ?? row.cellName ?? '');
  const scrapped = !!(row as any).scrapped;

  if (readOnly) {
    return (
      <div className="flex items-center justify-center">
        <Lock className="w-3.5 h-3.5 text-gray-300" />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1">
        <button onClick={onSave} disabled={isSaving}
          className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-40">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button onClick={onCancel} disabled={isSaving}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (scrapped) {
    // Scrapped batteries are frozen: only undo is available.
    return (
      <div className="flex items-center justify-center gap-1">
        <ScrapCellButton projectId={projectId} cellId={cellId} scrapped onChanged={onRefresh} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Tooltip content={t("edit_row")}>
        <button onClick={onStartEdit} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
      </Tooltip>
      <ScrapCellButton projectId={projectId} cellId={cellId} readOnly={readOnly} onChanged={onRefresh} />
    </div>
  );
}

// ─── ProcessData: column config + color grouping ────────────────────────────
// 黄色(手动输入) | 蓝色(设备获取) | 绿色(计算获取)
// border-r 加在每组最后一列上，形成竖向分隔线
const P_HDR: Record<string, string> = {};
const P_CELL: Record<string, string> = {};

const P_COLS: ColDef[] = [
  { field: 'cellId', i18nKey: 'col_cell_id' },
  // ── 注液 ──
  { field: 'm0', i18nKey: 'col_m0', editable: true, sourceType: 'manual', tooltip: '注液前电池重 (m0, g)' },
  { field: 'm1', i18nKey: 'col_m1', editable: true, sourceType: 'manual', tooltip: '预充后电池重 (m1, g)' },
  { field: 'mIn', i18nKey: 'col_comp_mIn', sourceType: 'computed', tooltip: '注液量 = m1 - m0 (g)' },
  { field: 'm2', i18nKey: 'col_m2', editable: true, sourceType: 'manual', tooltip: '二封后电池重 (m2, g)' },
  { field: 'mLoss', i18nKey: 'col_comp_mLoss', sourceType: 'computed', tooltip: '失液量 = m1 - m2 (g)' },
  // ── 化成 ──
  { field: 'v0', i18nKey: 'col_v0', editable: true, sourceType: 'manual', tooltip: '二封前 OCV (v0, V)' },
  { field: 'fu0', i18nKey: 'col_fu0', editable: true, sourceType: 'manual', tooltip: '化成前 OCV (fu0, V)' },
  { field: 'fr0', i18nKey: 'col_fr0', editable: true, sourceType: 'manual', tooltip: '化成前 ACIR (fr0, mΩ)' },
  { field: 'fq1', i18nKey: 'col_fq1', editable: true, sourceType: 'device', tooltip: '化成充电容量 (fq1, Ah)' },
  { field: 'fq2', i18nKey: 'col_fq2', editable: true, sourceType: 'device', tooltip: '化成放电容量 (fq2, Ah)' },
  { field: 'fq', i18nKey: 'col_comp_fq', sourceType: 'computed', tooltip: '化成充总容量 = fq1 + fq2 (Ah)' },
  { field: 'v1', i18nKey: 'col_v1', editable: true, sourceType: 'manual', tooltip: '二封后 OCV (v1, V)' },
  { field: 'fvg', i18nKey: 'col_comp_fvg', sourceType: 'computed', tooltip: '化成产气量 = (v1 - v0) / qdFirst (mL/Ah)' },
  { field: 'fu1', i18nKey: 'col_fu1', editable: true, sourceType: 'manual', tooltip: '老化前电压 (fu1, V)' },
  { field: 'fr1', i18nKey: 'col_fr1', editable: true, sourceType: 'manual', tooltip: '老化前电阻 (fr1, mΩ)' },
  { field: 'fu2', i18nKey: 'col_fu2', editable: true, sourceType: 'manual', tooltip: '老化后电压 (fu2, V)' },
  { field: 'fr2', i18nKey: 'col_fr2', editable: true, sourceType: 'manual', tooltip: '老化后电阻 (fr2, mΩ)' },
  { field: 'ku', i18nKey: 'col_comp_ku', sourceType: 'computed', tooltip: '老化电压降 = fu1 - fu2 (V)' },
  { field: 'm3', i18nKey: 'col_m3', editable: true, sourceType: 'manual', tooltip: '二封前电池质量 (m3, g)' },
  { field: 'm4', i18nKey: 'col_m4', editable: true, sourceType: 'manual', tooltip: '二封后电池质量 (m4, g)' },
  { field: 'mHold', i18nKey: 'col_comp_mHold', sourceType: 'computed', tooltip: '保液量 = m4 - m0 (g)' },
  { field: 'gu0', i18nKey: 'col_gu0', editable: true, sourceType: 'manual', tooltip: '定容前 OCV (gu0, V)' },
  { field: 'gr0', i18nKey: 'col_gr0', editable: true, sourceType: 'manual', tooltip: '定容前 ACIR (gr0, mΩ)' },
  { field: 'gqc1', i18nKey: 'col_gqc1', editable: true, sourceType: 'device', tooltip: '第一步分容充电容量 (gqc1, Ah)' },
  { field: 'gqd1', i18nKey: 'col_gqd1', editable: true, sourceType: 'device', tooltip: '第一步分容放电容量 (gqd1, Ah)' },
  { field: 'gqc2', i18nKey: 'col_gqc2', editable: true, sourceType: 'device', tooltip: '第二步分容充电容量 (gqc2, Ah)' },
  { field: 'gu1', i18nKey: 'col_gu1', editable: true, sourceType: 'device', tooltip: '定容后电压 (gu1, V)' },
  { field: 'gr1', i18nKey: 'col_gr1', editable: true, sourceType: 'device', tooltip: '定容后电阻 (gr1, mΩ)' },
  { field: 'qcFirst', i18nKey: 'col_comp_qcFirst', sourceType: 'computed', tooltip: '首次充电容量 = fq + gqc1 (Ah)' },
  { field: 'qdFirst', i18nKey: 'col_comp_qdFirst', sourceType: 'computed', tooltip: '首次放电容量 = gqd1 (Ah)' },
  { field: 'ceFirst', i18nKey: 'col_comp_ceFirst', sourceType: 'computed', tooltip: '首圈库比效率 = qdFirst / qcFirst * 100 (%)' },
];

// Step name → section index filter for ProcessData steps
const PD_STEP_SECTIONS: Record<string, number[]> = {
  drying_injection: [0], // 干燥注液 — m0, m1, mIn, m2, mLoss
  formation: [1, 2],       // 化成前电池体积 + 化成工序
  second_sealing: [3],     // 二封
  capacity_grading: [4],   // 定容
};

// Section definitions with column start/end indices (excluding cellId)
const P_SECTIONS: Array<{ labelKey: string; fallback: string; start: number; end: number }> = [
  { labelKey: 'lab_injection', fallback: '注液工序', start: 0, end: 5 },          // m0, m1, mIn, m2, mLoss = 5 cols
  { labelKey: 'lab_preFormVol', fallback: '化成前电池体积', start: 5, end: 6 },   // v0 = 1 col
  { labelKey: 'lab_formation', fallback: '化成工序', start: 6, end: 18 },         // fu0..ku = 12 cols
  { labelKey: 'lab_seal', fallback: '二封', start: 18, end: 21 },                 // m3, m4, mHold = 3 cols
  { labelKey: 'lab_grading', fallback: '定容工序', start: 21, end: 28 },          // gu0..gr1 = 7 cols
  { labelKey: 'lab_firstCycle', fallback: '首圈数据', start: 28, end: 31 },       // qcFirst, qdFirst, ceFirst = 3 cols
];

export function ProcessDataTable({ experimentId, stepName, staticData, readOnly, showBatchEdit, invalidInternalCodes, projectId }: { experimentId?: string; stepName?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; invalidInternalCodes?: string[]; projectId?: string }) {
  const { t } = useTranslation();
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>('process', experimentId || '');
  // Filter out rows from invalid procurement groups (matches group name and internalCode)
  const rawData = staticData || fetchData;
  const data = invalidInternalCodes && invalidInternalCodes.length > 0
    ? rawData.filter((row: any) => !isCellInvalid(row.cellId, invalidInternalCodes))
    : rawData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const { editingId, editForm, saving, startEditing, cancelEditing, handleChange, handleSave } = useInlineEdit('process');
  const { batchEditing, batchDraft, batchSaving, enterBatchEdit, cancelBatchEdit, handleBatchChange, saveBatchEdit } = useBatchEdit('process', data, refresh);

  // Determine which sections to show
  const sectionFilter = stepName ? PD_STEP_SECTIONS[stepName] : null;
  const sections = sectionFilter
    ? sectionFilter.map((i) => ({
      label: t(P_SECTIONS[i].labelKey, P_SECTIONS[i].fallback),
      count: P_SECTIONS[i].end - P_SECTIONS[i].start,
      start: P_SECTIONS[i].start,
      end: P_SECTIONS[i].end,
    }))
    : P_SECTIONS.map((s) => ({
      label: t(s.labelKey, s.fallback),
      count: s.end - s.start,
      start: s.start,
      end: s.end,
    }));

  // Build filtered column list
  const pRest = P_COLS.slice(1);
  const visiblePCols = sectionFilter
    ? sections.flatMap(sec => pRest.slice(sec.start, sec.end))
    : pRest;

  const hasBatchToolbar = showBatchEdit && !staticData && !readOnly && visiblePCols.some((c) => c.editable);

  return (
    <TableShell loading={loading} error={error}>
      {hasBatchToolbar && !batchEditing && (
        <div className="flex items-center justify-end border-b border-gray-200 bg-gray-50/70 px-4 py-2">
          <Button variant="secondary" size="sm" onClick={enterBatchEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" />批量编辑
          </Button>
        </div>
      )}
      {hasBatchToolbar && batchEditing && (
        <div className="flex items-center justify-between border-b border-gray-200 bg-amber-50/60 px-4 py-2">
          <span className="text-xs font-medium text-amber-800">批量编辑中 — 已修改高亮显示</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={cancelBatchEdit} disabled={batchSaving}>
              <X className="w-3.5 h-3.5 mr-1" />取消
            </Button>
            <Button size="sm" onClick={saveBatchEdit} loading={batchSaving} disabled={batchSaving}>
              <Save className="w-3.5 h-3.5 mr-1" />保存全部
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto overflow-y-auto max-h-150">
        <table className="min-w-full divide-y divide-gray-100 border-separate border-spacing-0">
          <thead className="bg-gray-50 sticky top-0 z-20">
            {/* Column header row */}
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50/90 px-4 py-3 min-w-[140px] text-left text-xs font-semibold text-gray-700 whitespace-nowrap border-r border-gray-100">{t('col_cell_id')}</th>
              {renderHeaders(visiblePCols, t, 'border-r border-gray-100')}
              {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50/90 px-2 py-3 w-[100px] min-w-[100px] max-w-[100px] text-center text-xs font-semibold text-gray-700 whitespace-nowrap">{t('actions')}</th>}
            </tr></thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((d: any, idx: number) => {
              const isEditing = editingId === d.id;
              const isBatchEditing = batchEditing;
              const draftRow = batchEditing ? batchDraft[idx] : null;
              const rowCls = d.scrapped
                ? 'bg-red-50/40 hover:bg-red-50/60'
                : (isEditing || isBatchEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70');
              return (
                <tr key={d.id} className={rowCls}>
                  <td className={cn("sticky left-0 z-10 px-3 py-2 whitespace-nowrap text-[13px] border-r border-gray-100", d.scrapped ? "bg-red-50/80" : "bg-white text-gray-900")}>
                    <span className={d.scrapped ? "text-gray-400 line-through" : ""}>{d.cellId}</span>
                    {d.scrapped && (
                      <span className="ml-1.5 inline-flex items-center rounded bg-red-100 border border-red-200 px-1.5 py-0.5 text-[10px] font-medium text-red-600 align-middle">{t("scrapped_badge", "已报废")}</span>
                    )}
                  </td>
                  {renderCells(visiblePCols, isBatchEditing && draftRow ? draftRow : d, P_CELL, (!isBatchEditing && isEditing), isBatchEditing ? undefined : editForm, isBatchEditing ? undefined : handleChange, isBatchEditing && !d.scrapped ? (f, v) => handleBatchChange(idx, f, v) : undefined, 'border-r border-gray-100')}
                  {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-2 whitespace-nowrap w-[100px] min-w-[100px] max-w-[100px]">
                    {isBatchEditing ? (
                      draftRow && data[idx] && Object.keys(draftRow).some((k) => {
                        const skip = new Set(['id', 'experimentId', 'createdAt', 'updatedAt']);
                        if (skip.has(k)) return false;
                        return String((data[idx] as any)[k] ?? '') !== String((draftRow as any)[k] ?? '');
                      }) ? <span className="inline-flex items-center justify-center w-full text-[10px] font-medium text-amber-600">✎</span> : null
                    ) : (
                      <RowActions row={d} type="process" onRefresh={refresh} projectId={projectId}
                        editing={isEditing}
                        onStartEdit={() => startEditing(d)}
                        onSave={() => handleSave(d.id, refresh)}
                        onCancel={cancelEditing}
                        saving={saving} readOnly={readOnly} />
                    )}
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TableShell>
  );
}

// ─── Computed-field color (shared by all tables) ─────────────────────────
/** Build header colorMap: editable → amber, computed (tooltip) → emerald */
function buildColorMap(cols: ColDef[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const c of cols) {
    if (c.tooltip) {
      m[c.field] = 'text-emerald-600';
    } else if (c.editable) {
      m[c.field] = 'text-amber-600';
    }
  }
  return m;
}

// ─── Shared render helper for simple row-cell pattern ────────────────────────
function SimpleTable({ cols, cellNameField, type, experimentId, t, keyFn, staticData, readOnly, showBatchEdit, projectId }: {
  cols: ColDef[]; cellNameField?: string; type: string; experimentId?: string;
  t: (k: string) => string; keyFn?: (d: any) => string; staticData?: any[]; readOnly?: boolean;
  showBatchEdit?: boolean; projectId?: string;
}) {
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>(type, experimentId || '');
  const data = staticData || fetchData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const { editingId, editForm, saving, startEditing, cancelEditing, handleChange, handleSave } = useInlineEdit(type);
  const { batchEditing, batchDraft, batchSaving, enterBatchEdit, cancelBatchEdit, handleBatchChange, saveBatchEdit } = useBatchEdit(type, data, refresh);
  const colorMap = buildColorMap(cols);
  const firstCol = cols[0];
  const restCols = cols.slice(1);
  // Cell colors: same as headers but without bg-
  const cellColorMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(colorMap)) {
    cellColorMap[k] = v.replace(/^bg-\S+ /, '');
  }

  const editableCols = restCols.filter((c) => c.editable);
  const hasBatchToolbar = showBatchEdit && !staticData && !readOnly && editableCols.length > 0;

  return (
    <TableShell loading={loading} error={error}>
      {hasBatchToolbar && !batchEditing && (
        <div className="flex items-center justify-end border-b border-gray-200 bg-gray-50/70 px-4 py-2">
          <Button variant="secondary" size="sm" onClick={enterBatchEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" />批量编辑
          </Button>
        </div>
      )}
      {hasBatchToolbar && batchEditing && (
        <div className="flex items-center justify-between border-b border-gray-200 bg-amber-50/60 px-4 py-2">
          <span className="text-xs font-medium text-amber-800">批量编辑中 — 已修改高亮显示</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={cancelBatchEdit} disabled={batchSaving}>
              <X className="w-3.5 h-3.5 mr-1" />取消
            </Button>
            <Button size="sm" onClick={saveBatchEdit} loading={batchSaving} disabled={batchSaving}>
              <Save className="w-3.5 h-3.5 mr-1" />保存全部
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto overflow-y-auto max-h-150"><table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50 sticky top-0 z-20"><tr>
          <th className="sticky left-0 z-20 bg-gray-50/90 px-4 py-3 min-w-[140px] text-left text-xs font-semibold text-gray-700 whitespace-nowrap">{t(firstCol.i18nKey)}</th>
          {renderHeaders(restCols, t)}
          {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50/90 px-2 py-3 w-[100px] min-w-[100px] max-w-[100px] text-center text-xs font-semibold text-gray-700 whitespace-nowrap">{t('actions')}</th>}
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((d: any, idx: number) => {
            const isEditing = editingId === (keyFn?.(d) ?? d.id);
            const isBatchEditing = batchEditing;
            const draftRow = batchEditing ? batchDraft[idx] : null;
            const rowCls = d.scrapped
              ? 'bg-red-50/40 hover:bg-red-50/60'
              : (isEditing || isBatchEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70');
            const firstVal = String(d[firstCol.field] ?? '');
            return (
              <tr key={keyFn?.(d) ?? d.id} className={rowCls}>
                <td className={cn("sticky left-0 z-10 px-3 py-2 whitespace-nowrap text-[13px]", d.scrapped ? "bg-red-50/80" : `bg-white ${cellColorMap[firstCol.field] || 'text-gray-900'}`)}>
                  <span className={d.scrapped ? "text-gray-400 line-through" : ""}>{firstVal}</span>
                  {d.scrapped && (
                    <span className="ml-1.5 inline-flex items-center rounded bg-red-100 border border-red-200 px-1.5 py-0.5 text-[10px] font-medium text-red-600 align-middle">{t("scrapped_badge")}</span>
                  )}
                </td>
                {renderCells(restCols, isBatchEditing && draftRow ? draftRow : d, cellColorMap, (!isBatchEditing && isEditing), isBatchEditing ? undefined : editForm, isBatchEditing ? undefined : handleChange, isBatchEditing && !d.scrapped ? (f, v) => handleBatchChange(idx, f, v) : undefined)}
                {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-2 whitespace-nowrap w-[100px] min-w-[100px] max-w-[100px]">
                  {isBatchEditing ? (
                    draftRow && data[idx] && Object.keys(draftRow).some((k) => {
                      const skip = new Set(['id', 'experimentId', 'createdAt', 'updatedAt']);
                      if (skip.has(k)) return false;
                      return String((data[idx] as any)[k] ?? '') !== String((draftRow as any)[k] ?? '');
                    }) ? <span className="inline-flex items-center justify-center w-full text-[10px] font-medium text-amber-600">✎</span> : null
                  ) : (
                    <RowActions row={d} type={type} onRefresh={refresh} projectId={projectId}
                      editing={isEditing}
                      onStartEdit={() => startEditing(d)}
                      onSave={() => handleSave(d.id, refresh)}
                      onCancel={cancelEditing}
                      saving={saving} readOnly={readOnly} />
                  )}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table></div></TableShell>
  );
}

// ─── CalendarLife ───────────────────────────────────────────────────────────
const CAL_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'dayCount', i18nKey: 'col_day', tooltip: '测试天数 (天)', editable: true },
  { field: 'dq', i18nKey: 'col_dq_loss', tooltip: '首次放电容量 (dq, Ah)', editable: true },
  { field: 'q', i18nKey: 'col_q_cap', tooltip: '定容容量 (q, Ah)', editable: true },
  { field: 'qRetention', i18nKey: 'col_comp_qRetention', tooltip: '容量保持率 = (dq / q_0d) * 100 (%)' },
  { field: 'qRecovery', i18nKey: 'col_comp_qRecovery', tooltip: '容量恢复率 = (q / q_0d) * 100 (%)' },
  { field: 'ddcr', i18nKey: 'col_ddcr', tooltip: '放电直流内阻 (ddcr, Ω)', editable: true },
  { field: 'ddcrGrowth', i18nKey: 'col_comp_ddcrGrowth', tooltip: '放电 DCR 增长率 = (ddcr / ddcr_0d - 1) * 100 (%)' },
  { field: 'cdcr', i18nKey: 'col_cdcr', tooltip: '充电直流内阻 (cdcr, Ω)', editable: true },
  { field: 'cdcrGrowth', i18nKey: 'col_comp_cdcrGrowth', tooltip: '充电 DCR 增长率 = (cdcr / cdcr_0d - 1) * 100 (%)' },
  { field: 'u', i18nKey: 'col_u_voltage', tooltip: '测试电压 (u, V)', editable: true },
  { field: 'uGrowth', i18nKey: 'col_comp_uGrowth', tooltip: '电压增长率 = (u / u_0d - 1) * 100 (%)' },
  { field: 'r', i18nKey: 'col_r_acir', tooltip: '交流内阻 (r, mΩ)', editable: true },
  { field: 'rGrowth', i18nKey: 'col_comp_rGrowth', tooltip: '内阻增长率 = (r / r_0d - 1) * 100 (%)' },
];
export function CalendarLifeTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; projectId?: string }) {
  const { t } = useTranslation();
  return <SimpleTable cols={CAL_COLS} type="calendar" experimentId={props.experimentId} staticData={props.staticData} t={t}
    keyFn={(d: any) => d.id || d.dayCount} readOnly={props.readOnly} showBatchEdit={props.showBatchEdit} projectId={props.projectId} />;
}

// ─── StorageSwelling ───────────────────────────────────────────────────────
const SWELL_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'dayCount', i18nKey: 'col_day', tooltip: '存储天数 (天)', editable: true },
  { field: 'qd1st', i18nKey: 'col_qd1st', tooltip: '首圈放电容量 (qd1st, Ah)', editable: true },
  { field: 'v', i18nKey: 'col_v_volume', tooltip: '存储后电池体积 (v, mL)', editable: true },
  { field: 'vg', i18nKey: 'col_comp_vg', tooltip: '存储产气量 = (v - v_0d) / qd1st (mL/Ah)' },
];
export function StorageSwellingTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; projectId?: string }) {
  const { t } = useTranslation();
  return <SimpleTable cols={SWELL_COLS} type="swelling" experimentId={props.experimentId} staticData={props.staticData} t={t} readOnly={props.readOnly} showBatchEdit={props.showBatchEdit} projectId={props.projectId} />;
}

// ─── EnergyEfficiency ──────────────────────────────────────────────────────
const EFF_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'de', i18nKey: 'col_de', tooltip: '放电能量 (de, Wh)', editable: true },
  { field: 'ce', i18nKey: 'col_ce', tooltip: '充电能量 (ce, Wh)', editable: true },
  { field: 'ee', i18nKey: 'col_comp_ee', tooltip: '能量效率比 = de / ce' },
];
export function EnergyEfficiencyTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; projectId?: string }) {
  const { t } = useTranslation();
  return <SimpleTable cols={EFF_COLS} type="efficiency" experimentId={props.experimentId} staticData={props.staticData} t={t} readOnly={props.readOnly} showBatchEdit={props.showBatchEdit} projectId={props.projectId} />;
}

// ─── DcrTest ───────────────────────────────────────────────────────────────
const DCR_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'q0', i18nKey: 'col_q0', tooltip: '测试前容量 (q0, Ah)', editable: true },
  { field: 'du0', i18nKey: 'col_du0', tooltip: '放电脉冲前电压 (du0, V)', editable: true },
  { field: 'du1', i18nKey: 'col_du1', tooltip: '放电脉冲后电压 (du1, V)', editable: true },
  { field: 'di', i18nKey: 'col_di', tooltip: '放电脉冲电流 (di, A)', editable: true },
  { field: 'ddcr', i18nKey: 'col_comp_ddcr', tooltip: '放电直流内阻 = |du1 - du0| / di (Ω)' },
  { field: 'cu0', i18nKey: 'col_cu0', tooltip: '充电脉冲前电压 (cu0, V)', editable: true },
  { field: 'cu1', i18nKey: 'col_cu1', tooltip: '充电脉冲后电压 (cu1, V)', editable: true },
  { field: 'ci', i18nKey: 'col_ci', tooltip: '充电脉冲电流 (ci, A)', editable: true },
  { field: 'cdcr', i18nKey: 'col_comp_cdcr', tooltip: '充电直流内阻 = |cu1 - cu0| / ci (Ω)' },
  { field: 'dRcProduct', i18nKey: 'col_comp_dRcProduct', tooltip: '放电 R-C 乘积 = q0 * ddcr (Ah·Ω)' },
  { field: 'cRcProduct', i18nKey: 'col_comp_cRcProduct', tooltip: '充电 R-C 乘积 = q0 * cdcr (Ah·Ω)' },
];
export function DcrTestTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; projectId?: string }) {
  const { t } = useTranslation();
  return <SimpleTable cols={DCR_COLS} type="dcr" experimentId={props.experimentId} staticData={props.staticData} t={t} readOnly={props.readOnly} showBatchEdit={props.showBatchEdit} projectId={props.projectId} />;
}

// ─── FastCharge (special: flatRows + computed time with custom cell render) ─
const FC_COLS: ColDef[] = [
  { field: 'stepNo', i18nKey: 'col_step_no', tooltip: '工步序号' },
  { field: 'cutOffVoltage', i18nKey: 'col_cutoff_voltage', tooltip: '全电截止电压 (V)', editable: true },
  { field: 'current', i18nKey: 'col_current', tooltip: '充电电流 (A)', editable: true },
  { field: 'rate', i18nKey: 'col_rate', tooltip: '充电倍率 (C)', editable: true },
  { field: 'stepCapacity', i18nKey: 'col_step_capacity', tooltip: '单步充电容量 (Ah)', editable: true },
  { field: 'stepSoc', i18nKey: 'col_step_soc', tooltip: '单步 SOC', render: (v) => v != null && v !== '-' ? (typeof v === 'number' ? v.toFixed(4) : String(v)) : '-' },
  { field: 'cumulativeSoc', i18nKey: 'col_cumulative_soc', tooltip: '累计 SOC', render: (v) => v != null && v !== '-' ? (typeof v === 'number' ? v.toFixed(4) : String(v)) : '-' },
  { field: 'stepTime', i18nKey: 'col_step_time', tooltip: '单步时间 (min)', editable: true },
];
const FC_COMP = 'text-sky-600';

export function FastChargeTable({ experimentId, staticData, readOnly, showBatchEdit, projectId }: { experimentId?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; projectId?: string }) {
  const { t } = useTranslation();
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>('fastcharge', experimentId || '');
  const data = staticData || fetchData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { batchEditing, batchDraft, batchSaving, enterBatchEdit, cancelBatchEdit, saveBatchEdit } = useBatchEdit('fastcharge', data, refresh);

  const flatRows = data.flatMap((d: any) => {
    const steps = d.steps || [];
    if (steps.length === 0) return [{ cellName: d.cellName, c0: d.c0, providedFastChargeTime: d.providedFastChargeTime, computedFastChargeTime: d.computedFastChargeTime, originalRow: d, scrapped: d.scrapped, isFirstStep: true, totalSteps: 1, stepNo: '-', cutOffVoltage: '-', current: '-', rate: '-', stepCapacity: '-', stepSoc: '-', cumulativeSoc: '-', stepTime: '-' }];
    return steps.map((step: any, i: number) => ({ cellName: d.cellName, c0: d.c0, providedFastChargeTime: d.providedFastChargeTime, computedFastChargeTime: d.computedFastChargeTime, originalRow: d, scrapped: d.scrapped, isFirstStep: i === 0, totalSteps: steps.length, ...step }));
  });

  const startEditing = (r: any) => {
    const form: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      if (['cellName', 'stepNo'].includes(k)) continue;
      form[k] = v == null ? '' : String(v);
    }
    setEditForm(form);
    setEditingKey(`${r.originalRow.id}-${flatRows.indexOf(r)}`);
  };

  const cancelEditing = () => { setEditingKey(null); setEditForm({}); };

  const handleChange = (field: string, value: string) => setEditForm((p) => ({ ...p, [field]: value }));

  const handleSave = async (r: any) => {
    setSaving(true);
    try {
      const parent = r.originalRow;
      const updatedSteps = (parent.steps || []).map((s: any) => {
        if (s.stepNo === Number(r.stepNo)) {
          return {
            ...s,
            cutOffVoltage: editForm.cutOffVoltage === '' ? null : Number(editForm.cutOffVoltage),
            current: editForm.current === '' ? null : Number(editForm.current),
            rate: editForm.rate === '' ? null : editForm.rate,
            stepCapacity: editForm.stepCapacity === '' ? null : Number(editForm.stepCapacity),
            stepTime: editForm.stepTime === '' ? null : editForm.stepTime,
          };
        }
        return s;
      });
      await api.put(`/api/v1/data/fastcharge/${parent.id}`, { cellName: parent.cellName, c0: parent.c0, steps: updatedSteps });
      setEditingKey(null);
      setEditForm({});
      refresh();
    } catch (err: any) {
      alert(err?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const isEditingRow = (r: any, idx: number) => editingKey === `${r.originalRow.id}-${idx}`;

  const fcEditableCols = FC_COLS.filter((c) => c.editable);
  const hasBatchToolbar = showBatchEdit && !staticData && !readOnly && fcEditableCols.length > 0;

  // batch draft for flat rows
  const [batchFlat, setBatchFlat] = useState<any[]>([]);
  const [batchSavingLocal, setBatchSavingLocal] = useState(false);
  const enterBatch = () => {
    enterBatchEdit();
    setBatchFlat(flatRows.map((r: any) => ({ ...r })));
  };
  const cancelBatch = () => {
    cancelBatchEdit();
    setBatchFlat([]);
  };
  const saveBatch = async () => {
    setBatchSavingLocal(true);
    try {
      // Group changed flat rows by parent
      const parentChanges = new Map<string, { parent: any; steps: any[] }>();
      for (let i = 0; i < batchFlat.length; i++) {
        const original = flatRows[i];
        const draft = batchFlat[i];
        if (!draft || !original) continue;
        // 已报废电池不可批量编辑
        if (original.scrapped) continue;
        const parentId = original.originalRow.id;
        let entry = parentChanges.get(parentId);
        if (!entry) {
          entry = { parent: original.originalRow, steps: (original.originalRow.steps || []).map((s: any) => ({ ...s })) };
          parentChanges.set(parentId, entry);
        }
        const stepIdx = entry.steps.findIndex((s: any) => s.stepNo === Number(original.stepNo));
        if (stepIdx >= 0) {
          const step = entry.steps[stepIdx];
          for (const key of fcEditableCols.map((c) => c.field)) {
            const draftVal = (draft as any)[key];
            const origVal = (original as any)[key];
            if (String(origVal ?? '') !== String(draftVal ?? '')) {
              step[key] = draftVal === '' ? null : Number(draftVal);
            }
          }
        }
      }
      for (const [id, { parent, steps }] of parentChanges) {
        await api.put(`/api/v1/data/fastcharge/${id}`, { cellName: parent.cellName, c0: parent.c0, steps });
      }
      setBatchFlat([]);
      cancelBatchEdit();
      refresh();
    } catch (err: any) {
      alert(err?.message ?? '批量保存失败');
    } finally {
      setBatchSavingLocal(false);
    }
  };

  return (
    <TableShell loading={loading} error={error}>
      {hasBatchToolbar && !batchEditing && (
        <div className="flex items-center justify-end border-b border-gray-200 bg-gray-50/70 px-4 py-2">
          <Button variant="secondary" size="sm" onClick={enterBatch}>
            <Pencil className="w-3.5 h-3.5 mr-1" />批量编辑
          </Button>
        </div>
      )}
      {hasBatchToolbar && batchEditing && (
        <div className="flex items-center justify-between border-b border-gray-200 bg-amber-50/60 px-4 py-2">
          <span className="text-xs font-medium text-amber-800">批量编辑中 — 已修改高亮显示</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={cancelBatch} disabled={batchSavingLocal}>
              <X className="w-3.5 h-3.5 mr-1" />取消
            </Button>
            <Button size="sm" onClick={saveBatch} loading={batchSavingLocal} disabled={batchSavingLocal}>
              <Save className="w-3.5 h-3.5 mr-1" />保存全部
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto overflow-y-auto max-h-150"><table className="min-w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-20"><tr>
          <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 min-w-[140px] text-left text-xs font-semibold text-gray-700 whitespace-nowrap">{t('col_cell_name')}</th>
          {renderHeaders(FC_COLS, t)}
          <TooltipTh content="10%-80% SOC 快充时间 (min)" label={t('col_comp_computedTime')} />
          {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50 px-2 py-3 w-[100px] min-w-[100px] max-w-[100px] text-center text-xs font-semibold text-gray-700 whitespace-nowrap">{t('actions')}</th>}
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {flatRows.map((r: any, idx: number) => {
            const isEditing = isEditingRow(r, idx);
            const isBatchEditing = batchEditing;
            const draftRow = batchEditing ? batchFlat[idx] : null;
            const rowCls = r.scrapped
              ? 'bg-red-50/40 hover:bg-red-50/60'
              : (isEditing || isBatchEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70');
            return (
              <tr key={`${r.originalRow.id}-${idx}`} className={rowCls}>
                {r.isFirstStep ? (
                  <td rowSpan={r.totalSteps} className={cn("sticky left-0 z-10 px-4 py-2 whitespace-nowrap text-sm border-r border-gray-100 font-medium align-middle", r.scrapped ? "bg-red-50/80" : "bg-white text-gray-900")}>
                    <span className={r.scrapped ? "text-gray-400 line-through" : ""}>{r.cellName}</span>
                    {r.scrapped && (
                      <span className="ml-1.5 inline-flex items-center rounded bg-red-100 border border-red-200 px-1.5 py-0.5 text-[10px] font-medium text-red-600 align-middle">{t("scrapped_badge", "已报废")}</span>
                    )}
                  </td>
                ) : null}
                {renderCells(FC_COLS, isBatchEditing && draftRow ? draftRow : r, undefined, (!isBatchEditing && isEditing), isBatchEditing ? undefined : editForm, isBatchEditing ? undefined : handleChange, isBatchEditing && !r.scrapped ? (f, v) => {
                  const updated = [...batchFlat];
                  updated[idx] = { ...updated[idx], [f]: v };
                  setBatchFlat(updated);
                } : undefined)}
                {r.isFirstStep ? (
                  <td rowSpan={r.totalSteps} className={`px-4 py-2 whitespace-nowrap text-sm ${FC_COMP} border-l border-gray-100 font-medium align-middle`}>
                    {r.computedFastChargeTime ? `${r.computedFastChargeTime} min` : 'N/A'}
                  </td>
                ) : null}
                {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-2 whitespace-nowrap w-[100px] min-w-[100px] max-w-[100px]">
                  {isBatchEditing ? (
                    draftRow && r && fcEditableCols.some((c) => String((r as any)[c.field] ?? '') !== String((draftRow as any)[c.field] ?? '')) ? <span className="inline-flex items-center justify-center w-full text-[10px] font-medium text-amber-600">✎</span> : null
                  ) : (
                    <RowActions row={r} type="fastcharge" onRefresh={refresh} projectId={projectId}
                      readOnly={readOnly}
                      editing={isEditing}
                      onStartEdit={() => startEditing(r)}
                      onSave={() => handleSave(r)}
                      onCancel={cancelEditing}
                      saving={saving} />
                  )}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table></div></TableShell>
  );
}

// ─── HtCycle ────────────────────────────────────────────────────────────────
const HT_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'cycle', i18nKey: 'col_cycle', tooltip: '循环圈数', editable: true, sourceType: 'manual' },
  { field: 'dischargeCapacity', i18nKey: 'col_capacity', tooltip: '放电容量 (Ah)', editable: true, sourceType: 'manual' },
  { field: 'capacityRetention', i18nKey: 'col_retention', sourceType: 'computed', tooltip: '容量保持率 (%)', render: (v) => v != null ? `${typeof v === 'number' ? v.toFixed(4) : v}%` : '-' },
  { field: 'ironDissolution', i18nKey: 'col_iron_ppm', sourceType: 'device', tooltip: '铁溶出量 (ppm)', render: (v) => v != null ? `${v} ppm` : '-' },
];
export function HtCycleTable({ experimentId, staticData, readOnly, showBatchEdit, projectId }: { experimentId?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; projectId?: string }) {
  const { t } = useTranslation();
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>('htcycle', experimentId || '');
  const data = staticData || fetchData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const { editingId, editForm, saving, startEditing, cancelEditing, handleChange, handleSave } = useInlineEdit('htcycle');
  const { batchEditing, batchDraft, batchSaving, enterBatchEdit, cancelBatchEdit, handleBatchChange, saveBatchEdit } = useBatchEdit('htcycle', data, refresh);
  const sorted = [...data].sort((a: any, b: any) => (a.cellName ?? '').localeCompare(b.cellName ?? '') || (a.cycle - b.cycle));
  const htColors = buildColorMap(HT_COLS);
  const htFirst = HT_COLS[0];
  const htRest = HT_COLS.slice(1);
  const hasBatchToolbar = showBatchEdit && !staticData && !readOnly && htRest.some((c) => c.editable);
  return (
    <TableShell loading={loading} error={error}>
      {hasBatchToolbar && !batchEditing && (
        <div className="flex items-center justify-end border-b border-gray-200 bg-gray-50/70 px-4 py-2">
          <Button variant="secondary" size="sm" onClick={enterBatchEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" />批量编辑
          </Button>
        </div>
      )}
      {hasBatchToolbar && batchEditing && (
        <div className="flex items-center justify-between border-b border-gray-200 bg-amber-50/60 px-4 py-2">
          <span className="text-xs font-medium text-amber-800">批量编辑中 — 已修改高亮显示</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={cancelBatchEdit} disabled={batchSaving}>
              <X className="w-3.5 h-3.5 mr-1" />取消
            </Button>
            <Button size="sm" onClick={saveBatchEdit} loading={batchSaving} disabled={batchSaving}>
              <Save className="w-3.5 h-3.5 mr-1" />保存全部
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto overflow-y-auto max-h-150"><table className="min-w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-20"><tr>
          <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 min-w-[140px] text-left text-xs font-semibold text-gray-700 whitespace-nowrap">{t(htFirst.i18nKey)}</th>
          {renderHeaders(htRest, t)}
          {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50 px-2 py-3 w-[100px] min-w-[100px] max-w-[100px] text-center text-xs font-semibold text-gray-700 whitespace-nowrap">{t('actions')}</th>}
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sorted.map((d: any, idx: number) => {
            const isEditing = editingId === d.id;
            const isBatchEditing = batchEditing;
            const draftRow = batchEditing ? batchDraft[idx] : null;
            const rowCls = d.scrapped
              ? 'bg-red-50/40 hover:bg-red-50/60'
              : (isEditing || isBatchEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70');
            const firstVal = String(d[htFirst.field] ?? '');
            return (
              <tr key={d.id} className={rowCls}>
                <td className={cn("sticky left-0 z-10 px-4 py-2 whitespace-nowrap text-sm font-medium", d.scrapped ? "bg-red-50/80 text-gray-400" : `bg-white ${htColors[htFirst.field] || 'text-gray-900'}`)}>
                  <span className={d.scrapped ? "line-through" : ""}>{firstVal}</span>
                  {d.scrapped && (
                    <span className="ml-1.5 inline-flex items-center rounded bg-red-100 border border-red-200 px-1.5 py-0.5 text-[10px] font-medium text-red-600 align-middle">{t("scrapped_badge", "已报废")}</span>
                  )}
                </td>
                {renderCells(htRest, isBatchEditing && draftRow ? draftRow : d, htColors, (!isBatchEditing && isEditing), isBatchEditing ? undefined : editForm, isBatchEditing ? undefined : handleChange, isBatchEditing && !d.scrapped ? (f, v) => handleBatchChange(idx, f, v) : undefined)}
                {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-1.5 whitespace-nowrap w-[100px] min-w-[100px] max-w-[100px]">
                  {isBatchEditing ? (
                    draftRow && data[idx] && Object.keys(draftRow).some((k) => {
                      const skip = new Set(['id', 'experimentId', 'createdAt', 'updatedAt']);
                      if (skip.has(k)) return false;
                      return String((data[idx] as any)[k] ?? '') !== String((draftRow as any)[k] ?? '');
                    }) ? <span className="inline-flex items-center justify-center w-full text-[10px] font-medium text-amber-600">✎</span> : null
                  ) : (
                    <RowActions row={d} type="htcycle" onRefresh={refresh} projectId={projectId}
                      editing={isEditing}
                      onStartEdit={() => startEditing(d)}
                      onSave={() => handleSave(d.id, refresh)}
                      onCancel={cancelEditing}
                      saving={saving} readOnly={readOnly} />
                  )}
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table></div></TableShell>
  );
}

// ─── SolutionPreparation (配液) ─────────────────────────────────────────────
const SLN_COLS: ColDef[] = [
  { field: 'groupName', i18nKey: 'col_formula' },
  { field: 'materialName', i18nKey: 'col_material_name', editable: true, sourceType: 'manual' },
  { field: 'specification', i18nKey: 'col_specification', editable: true, sourceType: 'manual' },
  { field: 'formulaAmount', i18nKey: 'col_formula_amount', editable: true, sourceType: 'manual' },
  { field: 'actualAmount', i18nKey: 'col_actual_amount', editable: true, sourceType: 'manual' },
];

export function SolutionPreparationTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean; showBatchEdit?: boolean; projectId?: string }) {
  const { t } = useTranslation();
  return <SimpleTable cols={SLN_COLS} type="solution" experimentId={props.experimentId} staticData={props.staticData} t={t} readOnly={props.readOnly} showBatchEdit={props.showBatchEdit} projectId={props.projectId} />;
}
