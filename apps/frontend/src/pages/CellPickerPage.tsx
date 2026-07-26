import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Check, Layers } from "lucide-react";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { PageHeader } from "../components/PageHeader";
import { toast } from "../components/Toast";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface ColDef {
  field: string;
  label: string;
  tooltip?: string;
}

const PD_COLS: ColDef[] = [
  { field: "cellId", label: "电池编号" },
  { field: "m0", label: "m0" }, { field: "m1", label: "m1" },
  { field: "mIn", label: "mIn (计算)", tooltip: "Injection Mass = m1 - m0" },
  { field: "m2", label: "m2" },
  { field: "mLoss", label: "mLoss (计算)", tooltip: "Loss Mass = m1 - m2" },
  { field: "v0", label: "v0" },
  { field: "fu0", label: "fu0" }, { field: "fr0", label: "fr0" },
  { field: "fq1", label: "fq1" }, { field: "fq2", label: "fq2" },
  { field: "fq", label: "fq (计算)", tooltip: "Formation Charge Capacity = fq1 + fq2" },
  { field: "v1", label: "v1" },
  { field: "fvg", label: "fvg (计算)", tooltip: "Gas Volume = (v1 - v0) / qdFirst" },
  { field: "fu1", label: "fu1" }, { field: "fr1", label: "fr1" },
  { field: "fu2", label: "fu2" }, { field: "fr2", label: "fr2" },
  { field: "ku", label: "ku (计算)", tooltip: "Aging Voltage Drop = fu1 - fu2" },
  { field: "m3", label: "m3" }, { field: "m4", label: "m4" },
  { field: "mHold", label: "mHold (计算)", tooltip: "Hold Mass = m4 - m0" },
  { field: "gu0", label: "gu0" }, { field: "gr0", label: "gr0" },
  { field: "gqc1", label: "gqc1" }, { field: "gqd1", label: "gqd1" },
  { field: "gqc2", label: "gqc2" },
  { field: "gu1", label: "gu1" }, { field: "gr1", label: "gr1" },
  { field: "qcFirst", label: "qcFirst (计算)", tooltip: "1st Charge = fq + gqc1" },
  { field: "qdFirst", label: "qdFirst (计算)", tooltip: "1st Discharge = gqd1" },
  { field: "ceFirst", label: "ceFirst (计算)", tooltip: "1st CE = qdFirst / qcFirst * 100" },
];

const PD_COLOR: Record<string, string> = {
  m0: "text-amber-600", m1: "text-amber-600", m2: "text-amber-600",
  m3: "text-amber-600", m4: "text-amber-600",
  v0: "text-amber-600", v1: "text-amber-600",
  fu0: "text-amber-600", fr0: "text-amber-600",
  fu1: "text-amber-600", fr1: "text-amber-600",
  fu2: "text-amber-600", fr2: "text-amber-600",
  gu0: "text-amber-600", gr0: "text-amber-600",
  fq1: "text-sky-600", fq2: "text-sky-600",
  gqc1: "text-sky-600", gqd1: "text-sky-600", gqc2: "text-sky-600",
  gu1: "text-sky-600", gr1: "text-sky-600",
  mIn: "text-emerald-600", mLoss: "text-emerald-600", mHold: "text-emerald-600",
  fq: "text-emerald-600", fvg: "text-emerald-600", ku: "text-emerald-600",
  qcFirst: "text-emerald-600", qdFirst: "text-emerald-600", ceFirst: "text-emerald-600",
};

/** Extract group prefix from cellId: "A001" → "A", "B002" → "B" */
function getGroupFromCellId(cellId: string): string {
  const m = cellId.match(/^([A-Za-z]+)/);
  return m ? m[1] : cellId;
}

const TEST_TYPES = [
  { value: "HtCycle", label: "高温循环", target: 5 },
  { value: "DcrTest", label: "4C DCR", target: 2 },
  { value: "EnergyEfficiency", label: "能效", target: 1 },
  { value: "CalendarLife", label: "日历寿命", target: 3 },
  { value: "StorageSwelling", label: "60℃存储胀气", target: 3 },
  { value: "FastCharge", label: "快充时间", target: 3 },
];

export function CellPickerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [cells, setCells] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [autoPicking, setAutoPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>("全部");

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
      const bsStep = wf?.steps?.find((s: any) => s.stepName === "battery_selection");
      setReadonly(bsStep?.status === "completed");

      setCells(deduped);
      setSelected(initSelected);
    } catch { toast("加载电池数据失败", "error"); }
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
      toast("已自动分配电池，表格已同步", "success");
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
      toast(`已挑选并分配 ${assignments.length} 个电池`, "success");
      navigate(`/projects/${projectId}`);
    } catch (err: any) { toast(err?.message ?? "操作失败", "error"); }
    finally { setSaving(false); }
  };

  // Group tabs
  const groupNames = [...new Set(cells.map((c) => getGroupFromCellId(String(c.cellId))).sort())];
  const groups = ["全部", ...groupNames];
  const displayCells = activeGroup === "全部"
    ? cells
    : cells.filter((c) => getGroupFromCellId(String(c.cellId)) === activeGroup);

  const displayAssignedCount = Object.keys(selected).filter((id) => displayCells.some((c) => c.cellId === id)).length;
  const targetMultiplier = activeGroup === "全部" ? groupNames.length : 1;
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
      <PageHeader title="挑选与分配电池" description="所有制程数据一览，手动或自动为后续测试挑选电池" onBack={() => navigate(`/projects/${projectId}`)} />
      <div className="rounded-surface border border-border bg-surface-subtle px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 text-[13px]">
            <span className="font-medium text-gray-700">分组 <span className="text-action-muted">{groupNames.length}</span></span>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-700">可用电池 <span className="text-action-muted">{displayCells.length}</span></span>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-700">已分配 <span className="text-action-muted">{displayAssignedCount}</span></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readonly && <Button variant="secondary" size="sm" onClick={handleAutoPick} loading={autoPicking} disabled={autoPicking || cells.length === 0}><Sparkles className="w-3.5 h-3.5 mr-1" />{autoPicking ? "自动分配中..." : "自动分配（每组17只）"}</Button>}
            {!readonly && <Button size="sm" onClick={handleSave} loading={saving} disabled={saving || displayAssignedCount === 0}><Check className="w-3.5 h-3.5 mr-1" />确认分配</Button>}
            {readonly && <span className="text-sm text-amber-600 font-medium">挑选流程已完成，当前仅供查看</span>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TEST_TYPES.map((t) => {
            const count = countsPerType[t.value] || 0;
            const target = t.target * targetMultiplier;
            const ok = count >= target;
            return <div key={t.value} className={cn("rounded-control border px-2.5 py-1 text-xs font-medium", ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : count > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-500")}>{t.label}: {count}/{target}</div>;
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
              <th className={cn(thClass, "sticky left-0 z-20 min-w-[130px]")}>电池编号</th>
              {dataCols.map((c) => <th key={c.field} className={cn(thClass, PD_COLOR[c.field] ?? "", "min-w-[90px]")}>{c.label}</th>)}
              <th className="sticky right-0 z-20 bg-gray-50 px-3 py-2 w-44 text-center text-[11px] font-semibold text-gray-500 whitespace-nowrap">分配测试类型</th>
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
                        <option value="">-- 未分配 --</option>
                        {TEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
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
