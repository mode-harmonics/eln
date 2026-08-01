import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles, Check, Layers } from "lucide-react";
import { Button } from "../components/Button";
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
  { field: "cellId", label: "电池编号" },
  { field: "m0", label: "m0", tooltip: "注液前电池重 (m0, g)" },
  { field: "m1", label: "m1", tooltip: "预充后电池重 (m1, g)" },
  { field: "mIn", label: "mIn (计算)", tooltip: "注液量 = m1 - m0 (g)" },
  { field: "m2", label: "m2", tooltip: "二封后电池重 (m2, g)" },
  { field: "mLoss", label: "mLoss (计算)", tooltip: "失液量 = m1 - m2 (g)" },
  { field: "v0", label: "v0", tooltip: "二封前 OCV (v0, V)" },
  { field: "fu0", label: "fu0", tooltip: "化成前 OCV (fu0, V)" },
  { field: "fr0", label: "fr0", tooltip: "化成前 ACIR (fr0, mΩ)" },
  { field: "fq1", label: "fq1", tooltip: "化成充电容量 (fq1, Ah)" },
  { field: "fq2", label: "fq2", tooltip: "化成放电容量 (fq2, Ah)" },
  { field: "fq", label: "fq (计算)", tooltip: "化成充总容量 = fq1 + fq2 (Ah)" },
  { field: "v1", label: "v1", tooltip: "二封后 OCV (v1, V)" },
  { field: "fvg", label: "fvg (计算)", tooltip: "化成产气量 = (v1 - v0) / qdFirst (mL/Ah)" },
  { field: "fu1", label: "fu1", tooltip: "老化前电压 (fu1, V)" },
  { field: "fr1", label: "fr1", tooltip: "老化前电阻 (fr1, mΩ)" },
  { field: "fu2", label: "fu2", tooltip: "老化后电压 (fu2, V)" },
  { field: "fr2", label: "fr2", tooltip: "老化后电阻 (fr2, mΩ)" },
  { field: "ku", label: "ku (计算)", tooltip: "老化电压降 = fu1 - fu2 (V)" },
  { field: "m3", label: "m3", tooltip: "二封前电池质量 (m3, g)" },
  { field: "m4", label: "m4", tooltip: "二封后电池质量 (m4, g)" },
  { field: "mHold", label: "mHold (计算)", tooltip: "保液量 = m4 - m0 (g)" },
  { field: "gu0", label: "gu0", tooltip: "定容前 OCV (gu0, V)" },
  { field: "gr0", label: "gr0", tooltip: "定容前 ACIR (gr0, mΩ)" },
  { field: "gqc1", label: "gqc1", tooltip: "第一步分容充电容量 (gqc1, Ah)" },
  { field: "gqd1", label: "gqd1", tooltip: "第一步分容放电容量 (gqd1, Ah)" },
  { field: "gqc2", label: "gqc2", tooltip: "第二步分容充电容量 (gqc2, Ah)" },
  { field: "gu1", label: "gu1", tooltip: "定容后电压 (gu1, V)" },
  { field: "gr1", label: "gr1", tooltip: "定容后电阻 (gr1, mΩ)" },
  { field: "qcFirst", label: "qcFirst (计算)", tooltip: "首次充电容量 = fq + gqc1 (Ah)" },
  { field: "qdFirst", label: "qdFirst (计算)", tooltip: "首次放电容量 = gqd1 (Ah)" },
  { field: "ceFirst", label: "ceFirst (计算)", tooltip: "首圈库比效率 = qdFirst / qcFirst * 100 (%)" },
];

const PD_COLOR: Record<string, string> = {
  m0: "text-amber-700", m1: "text-amber-700", m2: "text-amber-700",
  m3: "text-amber-700", m4: "text-amber-700",
  v0: "text-amber-700", v1: "text-amber-700",
  fu0: "text-amber-700", fr0: "text-amber-700",
  fu1: "text-amber-700", fr1: "text-amber-700",
  fu2: "text-amber-700", fr2: "text-amber-700",
  gu0: "text-amber-700", gr0: "text-amber-700",
  fq1: "text-sky-700", fq2: "text-sky-700",
  gqc1: "text-sky-700", gqd1: "text-sky-700", gqc2: "text-sky-700",
  gu1: "text-sky-700", gr1: "text-sky-700",
  mIn: "text-emerald-700", mLoss: "text-emerald-700", mHold: "text-emerald-700",
  fq: "text-emerald-700", fvg: "text-emerald-700", ku: "text-emerald-700",
  qcFirst: "text-emerald-700", qdFirst: "text-emerald-700", ceFirst: "text-emerald-700",
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
  const [autoPicking, setAutoPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(t("all"));
  const [bsMap, setBsMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/v1/workflow/default-steps", { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })
      .then((r) => r.json().catch(() => ({})))
      .then((json) => {
        const steps: Array<{ name: string; builtInStep: string | null; children?: any[]; parallelChildren?: string[] }> = json?.data?.steps ?? json?.steps ?? [];
        const m: Record<string, string> = {};
        for (const s of steps) {
          m[s.name] = s.builtInStep ?? s.name;
          if (s.children) for (const c of s.children) m[c.name] = c.builtInStep ?? c.name;
          if (s.parallelChildren) for (const c of s.parallelChildren) m[c] = c;
        }
        setBsMap(m);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // ── Same fetch pattern as ProjectDetail data loading ──
      const allExps = await api.get<any[]>(`/api/v1/projects/${projectId}/experiments`);
      if (!Array.isArray(allExps)) { setCells([]); setLoading(false); return; }

      // Find ALL ProcessData experiment IDs (may be more than one)
      const processExpIds = allExps
        .filter((e: any) => e.metadata?.assayType === "ProcessData")
        .map((e: any) => e.id);

      const [rowsByExp, picked, wf] = await Promise.all([
        processExpIds.length > 0
          ? Promise.all(processExpIds.map((eid: string) => api.get<any[]>(`/api/v1/data/process/${eid}`).catch(() => [])))
          : Promise.resolve([]),
        api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`).catch(() => []),
        api.get<any>(`/api/v1/workflow/instances/${projectId}`).catch(() => null),
      ]);

      // ── Deduplicate by cellId (same logic as ProjectDetail) ──
      const rawRows = (rowsByExp as any[][]).flat();
      const seen = new Map<string, any>();
      for (const row of rawRows) {
        const key = row.cellId || row.id;
        if (!seen.has(key)) seen.set(key, row);
        else {
          const existing = seen.get(key);
          for (const [k, v] of Object.entries(row)) {
            if (v != null && v !== "" && (existing[k] == null || existing[k] === "")) existing[k] = v;
          }
        }
      }
      const deduped = Array.from(seen.values()).filter((r: any) => r.cellId);

      // ── Picked / readonly ──
      const initSelected: Record<string, string> = {};
      (picked || []).forEach((p: any) => { if (p.testType) initSelected[p.cellId] = p.testType; });
      const bsStep = wf?.steps?.find((s: any) => (bsMap[s.stepName] ?? s.stepName) === BuiltInStep.BatterySelection);
      setReadonly(bsStep?.status === "completed");

      setCells(deduped);
      setSelected(initSelected);
    } catch { toast(t("load_cell_data_failed", "加载电池数据失败"), "error"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAssign = (cellId: string, testType: string) => {
    setSelected((prev) => { const n = { ...prev }; if (!testType) delete n[cellId]; else n[cellId] = testType; return n; });
  };

  const handleAutoPick = async () => {
    setAutoPicking(true);
    try {
      await api.post(`/api/v1/data/pick-cells/${projectId}`, { mode: "auto" });
      try { await api.post(`/api/v1/data/sync-cells/${projectId}`, {}); } catch { }
      await loadData();
      toast(t("auto_assign_synced"), "success");
    } catch (err: any) { toast(err?.message ?? "自动挑选失败", "error"); }
    finally { setAutoPicking(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    const assignments = Object.entries(selected).map(([cellId, testType]) => ({ cellId, testType }));
    try {
      await api.post(`/api/v1/data/pick-cells/${projectId}`, { mode: "manual", assignments });
      await api.post(`/api/v1/data/sync-cells/${projectId}`, {});
      try { await api.put(`/api/v1/workflow/instances/${projectId}/transition`, {}); } catch { }
      toast(t("pick_assign_success", { count: assignments.length }), "success");
      navigate(`/projects/${projectId}`);
    } catch (err: any) { toast(err?.message ?? "操作失败", "error"); }
    finally { setSaving(false); }
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
            {!readonly && <Button variant="secondary" size="sm" onClick={handleAutoPick} loading={autoPicking} disabled={autoPicking || cells.length === 0}><Sparkles className="w-3.5 h-3.5 mr-1" />{autoPicking ? t("auto_assigning") : t("auto_assign_default")}</Button>}
            {!readonly && <Button size="sm" onClick={handleSave} loading={saving} disabled={saving || displayAssignedCount === 0}><Check className="w-3.5 h-3.5 mr-1" />{t("confirm_assign")}</Button>}
            {readonly && <span className="text-sm text-amber-600 font-medium">{t("pick_completed_readonly")}</span>}
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
          <table className="min-w-max border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-20"><tr>
              <th className={cn(thClass, "sticky left-0 z-20 min-w-[130px]")}>{t("cell_id")}</th>
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
                    <td className={cn("sticky left-0 z-20 bg-white px-3 py-2 whitespace-nowrap text-[13px] font-semibold border-r border-gray-100 shadow-[2px_0_6px_rgba(0,0,0,0.06)]",
                      isSel ? "text-action-muted" : "text-gray-900"
                    )}>
                      {cell.cellId}
                    </td>
                    {dataCols.map((c) => <td key={c.field} className={cn("px-3 py-2 whitespace-nowrap text-[13px] border-r border-gray-100 font-mono text-right z-[1]", PD_COLOR[c.field] ?? "text-gray-400")}>{formatVal(cell[c.field])}</td>)}
                    <td className="sticky right-0 z-20 bg-white px-2 py-1">
                      <select
                        value={assignedType || ""}
                        onChange={(e) => handleAssign(cell.cellId, e.target.value)}
                        disabled={readonly}
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
