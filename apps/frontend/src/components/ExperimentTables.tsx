import React, { useEffect, useState } from "react";
import { Check, Edit3, Loader2, Lock, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Tooltip, TooltipTh } from "./Tooltip";
import { Popconfirm } from "./Popconfirm";

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

function TableShell({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
  if (loading) return <div className="flex items-center justify-center py-12" role="status"><Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" /><span className="sr-only">Loading</span></div>;
  if (error) return <div className="p-6 text-center text-sm text-red-500">{error}</div>;
  return <>{children}</>;
}

// ─── Shared Row Edit / Delete Components ──────────────────────────────────────



// ─── Data-driven column config ────────────────────────────────────────────────
interface ColDef {
  field: string;
  i18nKey: string;
  tooltip?: string;
  editable?: boolean;
  /** Render cell value using a custom function instead of `row[field]` */
  render?: (val: unknown, row: Record<string, unknown>) => React.ReactNode;
}

/** Render table headers from column definitions (plain <th> or <TooltipTh>). */
function renderHeaders(cols: ColDef[], t: (k: string) => string, colorMap?: Record<string, string>): React.ReactNode[] {
  return cols.map((c) => {
    const colorCls = colorMap?.[c.field];
    const headerText = (c.field !== 'cellId' && c.field !== 'cellName') ? `${t(c.i18nKey)} (${c.field})` : t(c.i18nKey);
    if (c.tooltip) {
      return <TooltipTh key={c.field} content={c.tooltip} label={headerText} className={colorCls} />;
    }
    return <th key={c.field} className={`px-3 py-2.5 w-[150px] min-w-[150px] max-w-[150px] text-left text-[11px] font-semibold whitespace-nowrap ${colorCls || 'text-gray-500'}`}>{headerText}</th>;
  });
}

/** Render data cells from column definitions, optionally with inline editing. */
function renderCells(
  cols: ColDef[], row: Record<string, unknown>, colorMap?: Record<string, string>,
  editing?: boolean, editForm?: Record<string, string>, onEdit?: (f: string, v: string) => void,
): React.ReactNode[] {
  return cols.map((c) => {
    const colorCls = colorMap?.[c.field];
    const isEditing = editing && c.editable && editForm;
    return (
      <td key={c.field} className={`px-3 py-2 whitespace-nowrap text-[13px] ${colorCls || 'text-gray-600'} ${isEditing ? 'cursor-text' : ''}`}>
        {isEditing ? (
          <input
            type="text"
            value={editForm![c.field] ?? ''}
            onChange={(e) => onEdit!(c.field, e.target.value)}
            className="-my-1 w-full min-w-12 rounded border border-gray-300 bg-white px-1.5 py-1 text-[13px] font-mono outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-300"
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

/** Row actions: toggles between edit/delete buttons and save/cancel. */
function RowActions({ row, type, onRefresh, editing, onStartEdit, onSave, onCancel, saving: isSaving, readOnly }: {
  row: Record<string, unknown>; type: string; onRefresh: () => void;
  editing?: boolean; onStartEdit?: () => void; onSave?: () => void; onCancel?: () => void; saving?: boolean; readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const rowId = (type === 'fastcharge' ? (row.originalRow as any)?.id : row.id) as string;

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

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <Tooltip content="Edit">
          <button onClick={onStartEdit} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
        </Tooltip>
        <Tooltip content="Delete">
          <Popconfirm
            title={t("delete_row_confirm")}
            onConfirm={async () => {
              try {
                await api.delete(`/api/v1/data/${type}/${rowId}`);
                onRefresh();
              } catch (err: any) {
                alert(err?.message ?? "Delete failed");
              }
            }}
            placement="left"
          >
            <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </Popconfirm>
        </Tooltip>
      </div>
    </>
  );
}

// ─── ProcessData: column config + color grouping ────────────────────────────
// 黄色(手动输入) | 蓝色(设备获取) | 绿色(计算获取)
// border-r 加在每组最后一列上，形成竖向分隔线
const P_HDR: Record<string, string> = {
  m0: 'text-amber-600', m1: 'text-amber-600', m2: 'text-amber-600',
  m3: 'text-amber-600', m4: 'text-amber-600',
  v0: 'text-amber-600', v1: 'text-amber-600',
  fu0: 'text-amber-600', fr0: 'text-amber-600',
  fu1: 'text-amber-600', fr1: 'text-amber-600',
  fu2: 'text-amber-600', fr2: 'text-amber-600',
  gu0: 'text-amber-600', gr0: 'text-amber-600',
  fq1: 'text-sky-600', fq2: 'text-sky-600',
  gqc1: 'text-sky-600', gqd1: 'text-sky-600', gqc2: 'text-sky-600',
  gu1: 'text-sky-600', gr1: 'text-sky-600',
  mIn: 'text-emerald-600', mLoss: 'text-emerald-600', mHold: 'text-emerald-600',
  fq: 'text-emerald-600', fvg: 'text-emerald-600', ku: 'text-emerald-600',
  qcFirst: 'text-emerald-600', qdFirst: 'text-emerald-600', ceFirst: 'text-emerald-600',
};
// Section boundary fields — add a right border for visual separation
const P_BOUNDARY = new Set(['mHold', 'ku', 'v0', 'mLoss', 'gr1']);
for (const k of P_BOUNDARY) {
  if (P_HDR[k]) P_HDR[k] += ' border-r border-gray-300!';
}
const P_CELL: Record<string, string> = {};
for (const [k, v] of Object.entries(P_HDR)) {
  P_CELL[k] = v.replace(/^bg-\S+ /, ''); // keep only text color
}

const P_COLS: ColDef[] = [
  { field: 'cellId', i18nKey: 'col_cell_id' },
  // ── 注液 ──
  { field: 'm0', i18nKey: 'col_m0', editable: true },
  { field: 'm1', i18nKey: 'col_m1', editable: true },
  { field: 'mIn', i18nKey: 'col_comp_mIn', tooltip: 'Injection Mass = m1 - m0' },
  { field: 'm2', i18nKey: 'col_m2', editable: true },
  { field: 'mLoss', i18nKey: 'col_comp_mLoss', tooltip: 'Loss Mass = m1 - m2' },
  // ── 化成 ──
  { field: 'v0', i18nKey: 'col_v0', editable: true },
  { field: 'fu0', i18nKey: 'col_fu0', editable: true },
  { field: 'fr0', i18nKey: 'col_fr0', editable: true },
  { field: 'fq1', i18nKey: 'col_fq1', editable: true },
  { field: 'fq2', i18nKey: 'col_fq2', editable: true },
  { field: 'fq', i18nKey: 'col_comp_fq', tooltip: 'Formation Charge Capacity = fq1 + fq2' },
  { field: 'v1', i18nKey: 'col_v1', editable: true },
  { field: 'fvg', i18nKey: 'col_comp_fvg', tooltip: 'Formation Gas Volume = (v1 - v0) / qdFirst' },
  { field: 'fu1', i18nKey: 'col_fu1', editable: true },
  { field: 'fr1', i18nKey: 'col_fr1', editable: true },
  { field: 'fu2', i18nKey: 'col_fu2', editable: true },
  { field: 'fr2', i18nKey: 'col_fr2', editable: true },
  { field: 'ku', i18nKey: 'col_comp_ku', tooltip: 'Aging Voltage Drop = fu1 - fu2' },
  { field: 'm3', i18nKey: 'col_m3', editable: true },
  { field: 'm4', i18nKey: 'col_m4', editable: true },
  { field: 'mHold', i18nKey: 'col_comp_mHold', tooltip: 'Hold Mass = m4 - m0' },
  { field: 'gu0', i18nKey: 'col_gu0', editable: true },
  { field: 'gr0', i18nKey: 'col_gr0', editable: true },
  { field: 'gqc1', i18nKey: 'col_gqc1', editable: true },
  { field: 'gqd1', i18nKey: 'col_gqd1', editable: true },
  { field: 'gqc2', i18nKey: 'col_gqc2', editable: true },
  { field: 'gu1', i18nKey: 'col_gu1', editable: true },
  { field: 'gr1', i18nKey: 'col_gr1', editable: true },
  { field: 'qcFirst', i18nKey: 'col_comp_qcFirst', tooltip: '1st Charge Capacity = fq + gqc1' },
  { field: 'qdFirst', i18nKey: 'col_comp_qdFirst', tooltip: '1st Discharge Capacity = gqd1' },
  { field: 'ceFirst', i18nKey: 'col_comp_ceFirst', tooltip: '1st Coulombic Efficiency = qdFirst / qcFirst * 100' },
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

export function ProcessDataTable({ experimentId, stepName, staticData, readOnly }: { experimentId?: string; stepName?: string; staticData?: any[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>('process', experimentId || '');
  const data = staticData || fetchData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const { editingId, editForm, saving, startEditing, cancelEditing, handleChange, handleSave } = useInlineEdit('process');

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

  return (
    <TableShell loading={loading} error={error}>
      <div className="overflow-x-auto overflow-y-auto max-h-150">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50 sticky top-0 z-20">
            {/* Section header row */}
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold text-gray-400 whitespace-nowrap border-b border-gray-100" colSpan={1}></th>
              {sections.map((sec, i) => (
                <th
                  key={sec.label}
                  colSpan={sec.count}
                  className={"px-3 py-1.5 text-[10px] font-semibold whitespace-nowrap border-b border-gray-100 text-center " + (i % 2 === 0 ? "text-gray-400 bg-gray-50" : "text-gray-400 bg-gray-100/60")}
                >
                  {sec.label}
                </th>
              ))}
              <th className="sticky right-0 z-20 bg-gray-50 px-3 py-1.5 border-b border-gray-100" colSpan={1}></th>
            </tr>
            {/* Column header row */}
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2.5 min-w-[120px] text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap">{t('col_cell_id')}</th>
              {renderHeaders(visiblePCols, t, P_HDR)}
              {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50 px-2 py-2.5 w-[70px] min-w-[70px] max-w-[70px] text-center text-[11px] font-semibold text-gray-500 whitespace-nowrap">{t('actions')}</th>}
            </tr></thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((d: any) => {
              const isEditing = editingId === d.id;
              return (
                <tr key={d.id} className={isEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70'}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 whitespace-nowrap text-[13px] text-gray-900">{d.cellId}</td>
                  {renderCells(visiblePCols, d, P_CELL, isEditing, editForm, handleChange)}
                  {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-2 whitespace-nowrap w-[70px] min-w-[70px] max-w-[70px]">
                    <RowActions row={d} type="process" onRefresh={refresh}
                      editing={isEditing}
                      onStartEdit={() => startEditing(d)}
                      onSave={() => handleSave(d.id, refresh)}
                      onCancel={cancelEditing}
                      saving={saving} readOnly={readOnly} />
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
function SimpleTable({ cols, cellNameField, type, experimentId, t, keyFn, staticData, readOnly }: {
  cols: ColDef[]; cellNameField?: string; type: string; experimentId?: string;
  t: (k: string) => string; keyFn?: (d: any) => string; staticData?: any[]; readOnly?: boolean;
}) {
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>(type, experimentId || '');
  const data = staticData || fetchData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const { editingId, editForm, saving, startEditing, cancelEditing, handleChange, handleSave } = useInlineEdit(type);
  const colorMap = buildColorMap(cols);
  const firstCol = cols[0];
  const restCols = cols.slice(1);
  // Cell colors: same as headers but without bg-
  const cellColorMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(colorMap)) {
    cellColorMap[k] = v.replace(/^bg-\S+ /, '');
  }
  return (
    <TableShell loading={loading} error={error}>
      <div className="overflow-x-auto overflow-y-auto max-h-150"><table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50 sticky top-0 z-20"><tr>
          <th className={`sticky left-0 z-20 bg-gray-50 px-3 py-2.5 min-w-[120px] text-left text-[11px] font-semibold whitespace-nowrap ${cellColorMap[firstCol.field] || 'text-gray-500'}`}>{t(firstCol.i18nKey)}</th>
          {renderHeaders(restCols, t, colorMap)}
          {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50 px-2 py-2.5 w-[70px] min-w-[70px] max-w-[70px] text-center text-[11px] font-semibold text-gray-500 whitespace-nowrap">{t('actions')}</th>}
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((d: any) => {
            const isEditing = editingId === (keyFn?.(d) ?? d.id);
            return (
              <tr key={keyFn?.(d) ?? d.id} className={isEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70'}>
                <td className={`sticky left-0 z-10 bg-white px-3 py-2 whitespace-nowrap text-[13px] ${cellColorMap[firstCol.field] || 'text-gray-900'}`}>{String(d[firstCol.field] ?? '')}</td>
                {renderCells(restCols, d, cellColorMap, isEditing, editForm, handleChange)}
                {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-2 whitespace-nowrap w-[70px] min-w-[70px] max-w-[70px]">
                  <RowActions row={d} type={type} onRefresh={refresh}
                    editing={isEditing}
                    onStartEdit={() => startEditing(d)}
                    onSave={() => handleSave(d.id, refresh)}
                    onCancel={cancelEditing}
                    saving={saving} readOnly={readOnly} />
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
  { field: 'dayCount', i18nKey: 'col_day', editable: true },
  { field: 'dq', i18nKey: 'col_dq_loss', editable: true },
  { field: 'q', i18nKey: 'col_q_cap', editable: true },
  { field: 'qRetention', i18nKey: 'col_comp_qRetention', tooltip: 'Capacity Retention = (dq / q_0d) * 100' },
  { field: 'qRecovery', i18nKey: 'col_comp_qRecovery', tooltip: 'Capacity Recovery = (q / q_0d) * 100' },
  { field: 'ddcr', i18nKey: 'col_ddcr', editable: true },
  { field: 'ddcrGrowth', i18nKey: 'col_comp_ddcrGrowth', tooltip: 'D-DCR Increase = (ddcr / ddcr_0d - 1) * 100' },
  { field: 'cdcr', i18nKey: 'col_cdcr', editable: true },
  { field: 'cdcrGrowth', i18nKey: 'col_comp_cdcrGrowth', tooltip: 'C-DCR Increase = (cdcr / cdcr_0d - 1) * 100' },
  { field: 'u', i18nKey: 'col_u_voltage', editable: true },
  { field: 'uGrowth', i18nKey: 'col_comp_uGrowth', tooltip: 'Voltage Increase = (u / u_0d - 1) * 100' },
  { field: 'r', i18nKey: 'col_r_acir', editable: true },
  { field: 'rGrowth', i18nKey: 'col_comp_rGrowth', tooltip: 'Internal Resistance Increase = (r / r_0d - 1) * 100' },
];
export function CalendarLifeTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  return <SimpleTable cols={CAL_COLS} type="calendar" experimentId={props.experimentId} staticData={props.staticData} t={t}
    keyFn={(d: any) => d.id || d.dayCount} readOnly={props.readOnly} />;
}

// ─── StorageSwelling ───────────────────────────────────────────────────────
const SWELL_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'dayCount', i18nKey: 'col_day', editable: true },
  { field: 'qd1st', i18nKey: 'col_qd1st', editable: true },
  { field: 'v', i18nKey: 'col_v_volume', editable: true },
  { field: 'vg', i18nKey: 'col_comp_vg', tooltip: 'Gas Volume = (v - v_0d) / qd1st (mL/Ah)' },
];
export function StorageSwellingTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  return <SimpleTable cols={SWELL_COLS} type="swelling" experimentId={props.experimentId} staticData={props.staticData} t={t} readOnly={props.readOnly} />;
}

// ─── EnergyEfficiency ──────────────────────────────────────────────────────
const EFF_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'de', i18nKey: 'col_de', editable: true },
  { field: 'ce', i18nKey: 'col_ce', editable: true },
  { field: 'ee', i18nKey: 'col_comp_ee', tooltip: 'Energy Efficiency Ratio = de / ce' },
];
export function EnergyEfficiencyTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  return <SimpleTable cols={EFF_COLS} type="efficiency" experimentId={props.experimentId} staticData={props.staticData} t={t} readOnly={props.readOnly} />;
}

// ─── DcrTest ───────────────────────────────────────────────────────────────
const DCR_COLS: ColDef[] = [
  { field: 'cellName', i18nKey: 'col_cell_name' },
  { field: 'q0', i18nKey: 'col_q0', editable: true },
  { field: 'du0', i18nKey: 'col_du0', editable: true },
  { field: 'du1', i18nKey: 'col_du1', editable: true },
  { field: 'di', i18nKey: 'col_di', editable: true },
  { field: 'ddcr', i18nKey: 'col_comp_ddcr', tooltip: 'Discharge DCR = |du1 - du0| / di (Ω)' },
  { field: 'cu0', i18nKey: 'col_cu0', editable: true },
  { field: 'cu1', i18nKey: 'col_cu1', editable: true },
  { field: 'ci', i18nKey: 'col_ci', editable: true },
  { field: 'cdcr', i18nKey: 'col_comp_cdcr', tooltip: 'Charge DCR = |cu1 - cu0| / ci (Ω)' },
  { field: 'dRcProduct', i18nKey: 'col_comp_dRcProduct', tooltip: 'Discharge R-C Product = q0 * ddcr (Ah·Ω)' },
  { field: 'cRcProduct', i18nKey: 'col_comp_cRcProduct', tooltip: 'Charge R-C Product = q0 * cdcr (Ah·Ω)' },
];
export function DcrTestTable(props: { experimentId?: string; staticData?: any[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  return <SimpleTable cols={DCR_COLS} type="dcr" experimentId={props.experimentId} staticData={props.staticData} t={t} readOnly={props.readOnly} />;
}

// ─── FastCharge (special: flatRows + computed time with custom cell render) ─
const FC_COLS: ColDef[] = [
  { field: 'stepNo', i18nKey: 'col_step_no' },
  { field: 'cutOffVoltage', i18nKey: 'col_cutoff_voltage', editable: true },
  { field: 'current', i18nKey: 'col_current', editable: true },
  { field: 'rate', i18nKey: 'col_rate', editable: true },
  { field: 'stepCapacity', i18nKey: 'col_step_capacity', editable: true },
  { field: 'stepSoc', i18nKey: 'col_step_soc', render: (v) => v != null && v !== '-' ? (typeof v === 'number' ? v.toFixed(4) : String(v)) : '-' },
  { field: 'cumulativeSoc', i18nKey: 'col_cumulative_soc', render: (v) => v != null && v !== '-' ? (typeof v === 'number' ? v.toFixed(4) : String(v)) : '-' },
  { field: 'stepTime', i18nKey: 'col_step_time', editable: true },
];
const FC_COMP = 'text-sky-600';

export function FastChargeTable({ experimentId, staticData, readOnly }: { experimentId?: string; staticData?: any[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>('fastcharge', experimentId || '');
  const data = staticData || fetchData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const flatRows = data.flatMap((d: any) => {
    const steps = d.steps || [];
    if (steps.length === 0) return [{ cellName: d.cellName, c0: d.c0, providedFastChargeTime: d.providedFastChargeTime, computedFastChargeTime: d.computedFastChargeTime, originalRow: d, isFirstStep: true, totalSteps: 1, stepNo: '-', cutOffVoltage: '-', current: '-', rate: '-', stepCapacity: '-', stepSoc: '-', cumulativeSoc: '-', stepTime: '-' }];
    return steps.map((step: any, i: number) => ({ cellName: d.cellName, c0: d.c0, providedFastChargeTime: d.providedFastChargeTime, computedFastChargeTime: d.computedFastChargeTime, originalRow: d, isFirstStep: i === 0, totalSteps: steps.length, ...step }));
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

  return (
    <TableShell loading={loading} error={error}>
      <div className="overflow-x-auto overflow-y-auto max-h-150"><table className="min-w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-20"><tr>
          <th className="sticky left-0 z-20 bg-gray-50 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('col_cell_name')}</th>
          {renderHeaders(FC_COLS, t)}
          <TooltipTh content="10%-80% SOC Fast Charge Time (min)" label={t('col_comp_computedTime')} />
          {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50 px-2 py-1.5 w-[70px] min-w-[70px] max-w-[70px] text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap shadow-[-4px_0_12px_rgba(0,0,0,0.05)]">{t('actions')}</th>}
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {flatRows.map((r: any, idx: number) => {
            const isEditing = isEditingRow(r, idx);
            return (
              <tr key={`${r.originalRow.id}-${idx}`} className={isEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70'}>
                {r.isFirstStep ? (
                  <td rowSpan={r.totalSteps} className="sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap text-sm text-gray-900 border-r border-gray-100 font-medium align-middle">
                    {r.cellName}
                  </td>
                ) : null}
                {renderCells(FC_COLS, r, undefined, isEditing, editForm, handleChange)}
                {r.isFirstStep ? (
                  <td rowSpan={r.totalSteps} className={`px-4 py-2 whitespace-nowrap text-sm ${FC_COMP} border-l border-gray-100 font-medium align-middle`}>
                    {r.computedFastChargeTime ? `${r.computedFastChargeTime} min` : 'N/A'}
                  </td>
                ) : null}
                {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-2 whitespace-nowrap border-l border-gray-100 w-[70px] min-w-[70px] max-w-[70px]">
                  <RowActions row={r} type="fastcharge" onRefresh={refresh}
                    readOnly={readOnly}
                    editing={isEditing}
                    onStartEdit={() => startEditing(r)}
                    onSave={() => handleSave(r)}
                    onCancel={cancelEditing}
                    saving={saving} />
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
  { field: 'ironDissolution', i18nKey: 'col_iron_ppm', render: (v) => v != null ? `${v} ppm` : '-' },
  { field: 'cycle', i18nKey: 'col_cycle', editable: true },
  { field: 'dischargeCapacity', i18nKey: 'col_capacity', editable: true },
  { field: 'capacityRetention', i18nKey: 'col_retention', render: (v) => v != null ? `${typeof v === 'number' ? v.toFixed(4) : v}%` : '-' },
];
export function HtCycleTable({ experimentId, staticData, readOnly }: { experimentId?: string; staticData?: any[]; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { data: fetchData, loading: fetchLoading, error: fetchErr, refresh } = useTableData<any>('htcycle', experimentId || '');
  const data = staticData || fetchData;
  const loading = staticData ? false : fetchLoading;
  const error = staticData ? null : fetchErr;
  const { editingId, editForm, saving, startEditing, cancelEditing, handleChange, handleSave } = useInlineEdit('htcycle');
  const sorted = [...data].sort((a: any, b: any) => (a.cellName ?? '').localeCompare(b.cellName ?? '') || (a.cycle - b.cycle));
  const htColors = buildColorMap(HT_COLS);
  const htFirst = HT_COLS[0];
  const htRest = HT_COLS.slice(1);
  return (
    <TableShell loading={loading} error={error}>
      <div className="overflow-x-auto overflow-y-auto max-h-150"><table className="min-w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-20"><tr>
          <th className={`sticky left-0 z-20 bg-gray-50 px-4 py-2 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap ${htColors[htFirst.field] || 'text-gray-500'}`}>{t(htFirst.i18nKey)}</th>
          {renderHeaders(htRest, t, htColors)}
          {staticData ? null : <th className="sticky right-0 z-20 bg-gray-50 px-2 py-1.5 w-[70px] min-w-[70px] max-w-[70px] text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap shadow-[-4px_0_12px_rgba(0,0,0,0.05)]">{t('actions')}</th>}
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sorted.map((d: any) => {
            const isEditing = editingId === d.id;
            return (
              <tr key={d.id} className={isEditing ? 'bg-gray-50' : 'hover:bg-gray-50/70'}>
                <td className={`sticky left-0 z-10 bg-white px-4 py-2 whitespace-nowrap text-sm ${htColors[htFirst.field] || 'text-gray-900'} font-medium`}>{String(d[htFirst.field] ?? '')}</td>
                {renderCells(htRest, d, htColors, isEditing, editForm, handleChange)}
                {staticData ? null : <td className="sticky right-0 z-10 bg-white px-2 py-1.5 whitespace-nowrap shadow-[-4px_0_12px_rgba(0,0,0,0.05)] w-[70px] min-w-[70px] max-w-[70px]">
                  <RowActions row={d} type="htcycle" onRefresh={refresh}
                    editing={isEditing}
                    onStartEdit={() => startEditing(d)}
                    onSave={() => handleSave(d.id, refresh)}
                    onCancel={cancelEditing}
                    saving={saving} readOnly={readOnly} />
                </td>}
              </tr>
            );
          })}
        </tbody>
      </table></div></TableShell>
  );
}
