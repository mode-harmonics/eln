import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles, Check, Layers } from "lucide-react";
import { Button } from "../components/Button";
import { completeWorkflowStep } from "../lib/workflow";
import { SegmentedControl } from "../components/SegmentedControl";
import { PageHeader } from "../components/PageHeader";
import { toast } from "../components/Toast";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { BuiltInStep } from "@eln/shared";

import { TooltipTh } from "../components/Tooltip";

interface ColDef {
  field: string;
  label: string;
  tooltip?: string;
}

const PD_COLS: ColDef[] = [
  { field: "cellId", label: "电池编号（cellId）" },
  { field: "gqd1", label: "第一步分容放电容量（gqd1）" },
  { field: "gr1", label: "定容后电阻（gr1）" },
  { field: "fvg", label: "化成产气量（fvg）" },
  { field: "ku", label: "老化电压降（ku）" },
  { field: "fq1", label: "化成充电容量（fq1）" },
  { field: "fq2", label: "化成放电容量（fq2）" },
];
const PD_COLOR: Record<string, string> = {
  gqd1: "text-sky-700", gr1: "text-sky-700", fq1: "text-sky-700", fq2: "text-sky-700",
  fvg: "text-emerald-700", ku: "text-emerald-700",
};
/** Extract group prefix from cellId: "A001" → "A", "B002" → "B" */
function getGroupFromCellId(cellId: string): string {
  const m = cellId.match(/^([A-Za-z]+)/);
  return m ? m[1] : cellId;
}

const TEST_TYPES = [
  { value: "HtCycle", labelKey: "ht_cycle", target: 5 },
  { value: "DcrTest", labelKey: "dcr_test", target: 2 },
  { value: "EnergyEfficiency", labelKey: "energy_efficiency", target: 1 },
  { value: "CalendarLife", labelKey: "calendar_life", target: 3 },
  { value: "StorageSwelling", labelKey: "storage_swelling", target: 3 },
  { value: "FastCharge", labelKey: "fast_charge", target: 3 },
];

export function CellPickerPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [cells, setCells] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoPicking, setAutoPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const operationLock = useRef(false);
  const [pendingAutoSync, setPendingAutoSync] = useState(false);
  const [stepStatus, setStepStatus] = useState<string | null>(null);
  const readonly = stepStatus !== "in_progress";
  const [activeGroup, setActiveGroup] = useState<string>(t("all"));
  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [candidates, picked, wf] = await Promise.all([
        api.get<any[]>(`/api/v1/data/selection-candidates/${projectId}`),
        api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`),
        api.get<any>(`/api/v1/workflow/instances/${projectId}`),
      ]);
      const deduped = candidates.filter((row) => row.cellId && !row.scrapped);
      // ── Picked / readonly ──
      const initSelected: Record<string, string> = {};
      (picked || []).forEach((p: any) => { if (p.testType) initSelected[p.cellId] = p.testType; });
      const bsStep = wf?.steps?.find((s: any) => (s.builtInStep ?? s.stepName) === BuiltInStep.BatterySelection);
      setStepStatus(bsStep?.status ?? "missing");

      setCells(deduped);
      setSelected(initSelected);
    } catch (error) { setLoadError(error instanceof Error ? error.message : t("load_cell_data_failed")); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAssign = (cellId: string, testType: string) => {
    setSelected((prev) => { const n = { ...prev }; if (!testType) delete n[cellId]; else n[cellId] = testType; return n; });
  };

  const handleAutoPick = async () => {
    if (operationLock.current) return;
    operationLock.current = true;
    setAutoPicking(true);
    try {
      if (!pendingAutoSync) await api.post(`/api/v1/data/pick-cells/${projectId}`, { mode: "auto" });
      setPendingAutoSync(true);
      await api.post(`/api/v1/data/sync-cells/${projectId}`, {});
      setPendingAutoSync(false);
      await loadData();
      toast(t("auto_assign_synced"), "success");
    } catch (err: any) { toast(err?.message ?? "自动挑选失败", "error"); }
    finally { operationLock.current = false; setAutoPicking(false); }
  };

  const handleSave = async () => {
    if (operationLock.current || pendingAutoSync) return;
    operationLock.current = true;
    setSaving(true);
    const assignments = Object.entries(selected).map(([cellId, testType]) => ({ cellId, testType }));
    try {
      await api.post(`/api/v1/data/pick-cells/${projectId}`, { mode: "manual", assignments });
      await api.post(`/api/v1/data/sync-cells/${projectId}`, {});
      await completeWorkflowStep(projectId!, BuiltInStep.BatterySelection);
      toast(t("pick_assign_success", { count: assignments.length }), "success");
      navigate(`/projects/${projectId}`);
    } catch (err: any) { toast(err?.message ?? "操作失败", "error"); }
    finally { operationLock.current = false; setSaving(false); }
  };

  // Group tabs
  const groupNames = [...new Set(cells.map((c) => getGroupFromCellId(String(c.cellId))).sort())];
  const groups = [t("all"), ...groupNames];
  const displayCells = activeGroup === t("all")
    ? cells
    : cells.filter((c) => getGroupFromCellId(String(c.cellId)) === activeGroup);

  const displayAssignedCount = Object.keys(selected).filter((id) => displayCells.some((c) => c.cellId === id)).length;
  const targetMultiplier = activeGroup === t("all") ? groupNames.length : 1;
  const countsPerType: Record<string, number> = {};
  displayCells.forEach((c) => {
    const t = selected[c.cellId];
    if (t) countsPerType[t] = (countsPerType[t] || 0) + 1;
  });

  const formatVal = (v: any) => {
    if (v == null || v === "") return "—";
    const n = parseFloat(v);
    if (isNaN(n)) return String(v);
    if (n === 0) return "0";
    const absN = Math.abs(n);
    if (absN < 0.0001 && absN > 0) return n.toExponential(4);
    return n.toFixed(4);
  };

  const thClass = "sticky top-0 z-20 bg-gray-50 px-3 py-2 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap border-r border-gray-100";
  const dataCols = PD_COLS.slice(1);

  return (
    <div className="space-y-4">
      <PageHeader title={t("pick_assign_title")} description={t("pick_assign_desc")} onBack={() => navigate(`/projects/${projectId}`)} />
      {loadError && <div role="alert" className="space-y-2 rounded-md border border-red-200 p-4 text-sm text-red-600"><p>{loadError}</p><Button onClick={loadData}>{t("retry")}</Button></div>}
      <div className="rounded-surface border border-border bg-surface-subtle px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 text-[13px]">
            <span className="font-medium text-gray-700">{t("group")} <span className="text-action-muted">{groupNames.length}</span></span>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-700">{t("available_cells")} <span className="text-action-muted">{displayCells.length}</span></span>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-700">{t("assigned")} <span className="text-action-muted">{displayAssignedCount}</span></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readonly && <Button variant="secondary" size="sm" onClick={handleAutoPick} loading={autoPicking} disabled={loading || !!loadError || autoPicking || saving || cells.length === 0}><Sparkles className="w-3.5 h-3.5 mr-1" />{autoPicking ? t("auto_assigning") : (pendingAutoSync ? t("retry_cell_sync") : t("auto_assign_default"))}</Button>}
            {!readonly && <Button size="sm" onClick={handleSave} loading={saving} disabled={loading || !!loadError || saving || autoPicking || pendingAutoSync || displayAssignedCount === 0}><Check className="w-3.5 h-3.5 mr-1" />{t("confirm_assign")}</Button>}
            {stepStatus === "completed" && <span className="text-sm text-amber-600 font-medium">{t("pick_completed_readonly")}</span>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TEST_TYPES.map((tt) => {
            const count = countsPerType[tt.value] || 0;
            const target = tt.target * targetMultiplier;
            const ok = count >= target;
            return <div key={tt.value} className={cn("rounded-control border px-2.5 py-1 text-xs font-medium", ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : count > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-500")}>{t(tt.labelKey)}: {count}/{target}</div>;
          })}
        </div>
      </div>
      {/* Group tabs */}
      {groups.length > 1 && (
        <SegmentedControl
          items={groups.map((g) => ({ value: g, label: g }))}
          value={activeGroup}
          onValueChange={setActiveGroup}
          size="sm"
        />
      )}
      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : cells.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400"><Layers className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无可挑选的电池</p></div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-380px)] rounded-surface border border-border bg-white">
          <table className="min-w-max border-separate border-spacing-0">
            <thead className="bg-gray-50 sticky top-0 z-20"><tr>
              <th className={cn(thClass, "sticky left-0 z-40 min-w-[130px] bg-gray-50 shadow-[2px_0_6px_rgba(0,0,0,0.06)]")}>{t("cell_id")}</th>
              {dataCols.map((c) => (
                c.tooltip ? (
                  <TooltipTh key={c.field} content={c.tooltip} label={c.label} className={cn(thClass, PD_COLOR[c.field] ?? "", "min-w-[90px]")} />
                ) : (
                  <th key={c.field} className={cn(thClass, PD_COLOR[c.field] ?? "", "min-w-[90px]")}>{c.label}</th>
                )
              ))}
              <th className="sticky right-0 z-20 bg-gray-50 px-3 py-2 w-44 text-center text-[11px] font-semibold text-gray-500 whitespace-nowrap">{t("assign_test_type")}</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {displayCells.map((cell) => {
                const assignedType = selected[cell.cellId];
                const isSel = !!assignedType;
                return (
                  <tr key={cell.cellId || cell.id} className={cn(isSel && "bg-blue-50/40")}>
                    <td className={cn("sticky left-0 z-30 bg-white px-3 py-2 whitespace-nowrap text-[13px] font-semibold border-r border-gray-100 shadow-[2px_0_6px_rgba(0,0,0,0.06)]",
                      isSel ? "text-action-muted" : "text-gray-900"
                    )}>
                      {cell.cellId}
                    </td>
                    {dataCols.map((c) => <td key={c.field} className={cn("px-3 py-2 whitespace-nowrap text-[13px] border-r border-gray-100 font-mono text-right z-[1]", PD_COLOR[c.field] ?? "text-gray-400")}>{formatVal(cell[c.field])}</td>)}
                    <td className="sticky right-0 z-20 bg-white px-2 py-1">
                      <select
                        value={assignedType || ""}
                        onChange={(e) => handleAssign(cell.cellId, e.target.value)}
                        disabled={readonly || loading || !!loadError || saving || autoPicking || pendingAutoSync}
                        className={cn(
                          "w-36 rounded-control border py-1 pl-2 pr-7 text-xs outline-none focus:ring-1 focus:ring-focus/35",
                          isSel ? "border-action bg-action-subtle text-action-muted font-semibold" : "border-gray-200 text-gray-500",
                          readonly && "opacity-60 cursor-not-allowed bg-gray-50",
                        )}
                      >
                        <option value="">{t("not_assigned")}</option>
                        {TEST_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{t(tt.labelKey)}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
