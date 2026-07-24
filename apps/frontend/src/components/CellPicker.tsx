import React, { useEffect, useState } from "react";
import { Loader2, Check, Layers, Zap, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "./Button";
import { Drawer } from "./Drawer";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "./Toast";

interface CellPickerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  processExperimentId: string;
  readonly?: boolean;
  onComplete?: (cellIds: string[]) => void;
}

const TEST_TYPES = [
  { value: 'CalendarLife', label: '日历寿命' },
  { value: 'StorageSwelling', label: '存储胀气' },
  { value: 'EnergyEfficiency', label: '能量效率' },
  { value: 'DcrTest', label: 'DCR测试' },
  { value: 'FastCharge', label: '快充时间' },
  { value: 'HtCycle', label: '高温循环' },
];

export function CellPicker({ open, onClose, projectId, processExperimentId, onComplete, readonly }: CellPickerProps) {
  const [cells, setCells] = useState<{ cellId: string; fqTotal: number }[]>([]);
  // Record<cellId, testType>
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [autoPicking, setAutoPicking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load cells once on open
  useEffect(() => {
    if (!open || !processExperimentId) return;
    setLoading(true);
    Promise.all([
      api.get<any[]>(`/api/v1/data/process/${processExperimentId}`),
      api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`).catch(() => []),
    ]).then(([processData, picked]) => {
      const initSelected: Record<string, string> = {};
      (picked || []).forEach((p: any) => {
        if (p.testType) {
          initSelected[p.cellId] = p.testType;
        }
      });
      
      const mapped = (processData || [])
        .filter((r: any) => r.cellId)
        .map((r: any) => ({
          cellId: r.cellId,
          fqTotal: (parseFloat(r.fq1) || 0) + (parseFloat(r.fq2) || 0),
        }))
        .sort((a: any, b: any) => b.fqTotal - a.fqTotal);
        
      setCells(mapped);
      setSelected(initSelected);
      setLoading(false);
    }).catch(() => { setLoading(false); toast("加载电芯数据失败", "error"); });
  }, [open, processExperimentId, projectId]);

  const handleAssign = (cellId: string, testType: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (!testType) {
        delete next[cellId];
      } else {
        next[cellId] = testType;
      }
      return next;
    });
  };

  const handleAutoPick = async () => {
    setAutoPicking(true);
    try {
      // Auto-pick via algorithm — writes to DB
      await api.post(`/api/v1/data/pick-cells/${projectId}`, { mode: "auto" });
      const data = await api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`);
      const newSelected: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        if (p.testType) {
          newSelected[p.cellId] = p.testType;
        }
      });
      setSelected(newSelected);
      toast(`系统已自动分配 ${Object.keys(newSelected).length} 个电芯，你可继续手动调整`, "success");
    } catch (err: any) {
      toast(err?.message ?? "自动挑选失败", "error");
    } finally {
      setAutoPicking(false);
    }
  };

  const doConfirm = async () => {
    setSyncing(true);
    const assignments = Object.entries(selected).map(([cellId, testType]) => ({ cellId, testType }));
    try {
      await api.post(`/api/v1/data/pick-cells/${projectId}`, {
        mode: "manual",
        assignments,
      });

      // 同步数据到业务表
      await api.post(`/api/v1/data/sync-cells/${projectId}`, {});

      // 尝试推进工作流，如果已经完成则忽略报错
      try {
        await api.put(`/api/v1/workflow/instances/${projectId}/transition`, {});
      } catch (e) {
        console.warn("Workflow transition skipped or failed", e);
      }

      onComplete?.(assignments.map(a => a.cellId));
      toast(`已挑选并分配 ${assignments.length} 个电芯`, "success");
      onClose();
    } catch (err: any) {
      toast(err?.message ?? "操作失败", "error");
    } finally {
      setSyncing(false);
    }
  };

  if (!open) return null;

  const assignedCount = Object.keys(selected).length;
  
  // Calculate counts per test type
  const countsPerType: Record<string, number> = {};
  Object.values(selected).forEach(t => {
    countsPerType[t] = (countsPerType[t] || 0) + 1;
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="挑选与分配电芯"
      description="选择后续测试使用的电芯并分配测试类型"
      icon={<Layers className="w-4 h-4 text-action" />}
      size="max-w-xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-900">{cells.length}</span> 个可用电芯，已分配 <span className="font-semibold text-action-muted">{assignedCount}</span>
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={syncing}>{readonly ? "关闭" : "取消"}</Button>
            <Button onClick={doConfirm} loading={syncing} disabled={syncing || assignedCount === 0 || readonly}>
              {syncing ? "同步中..." : "确认分配"}
              {!syncing && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      }
    >
      <div className="-mx-6 -mt-4 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          {!readonly && (
            <Button variant="secondary" size="sm" onClick={handleAutoPick} loading={autoPicking} disabled={autoPicking || cells.length === 0}>
              <Sparkles className="w-3.5 h-3.5" />
              {autoPicking ? "自动分配中..." : "自动分配（17只）"}
            </Button>
          )}
          {readonly && <p className="text-sm text-amber-600 font-medium">挑选流程已完成，当前仅供查看</p>}
        </div>
        
        <div className="mt-4 flex gap-2 flex-wrap">
          {TEST_TYPES.map(t => {
            const count = countsPerType[t.value] || 0;
            const hasCells = count > 0;
            return (
              <div key={t.value} className={cn(
                "text-xs px-2 py-1 rounded-md border",
                hasCells ? "bg-[#eef2ff] border-[#c7d2fe] text-[#4f46e5]" : "bg-gray-50 border-gray-200 text-gray-600"
              )}>
                {t.label}: {count}
              </div>
            );
          })}
        </div>
      </div>

      <div className="py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : cells.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">暂无可挑选的电芯</p>
            <p className="text-xs mt-1">请先上传制成工步数据</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cells.map((cell, i) => {
              const assignedType = selected[cell.cellId];
              const isSel = !!assignedType;
              return (
                <div
                  key={cell.cellId}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                    isSel ? "bg-[#f0f4ff] border border-[#d6e4ff]" : "hover:bg-gray-50 border border-gray-100",
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                    isSel ? "bg-action text-white" : "bg-gray-100 text-gray-400",
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", isSel ? "text-action-muted" : "text-gray-900")}>{cell.cellId}</p>
                    <p className="text-xs text-gray-500 mt-0.5">化成容量 {cell.fqTotal.toFixed(4)} Ah</p>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <select
                      value={assignedType || ""}
                      onChange={(e) => handleAssign(cell.cellId, e.target.value)}
                      disabled={readonly}
                      className={cn(
                        "text-sm rounded border-gray-300 py-1 pl-2 pr-8 focus:ring-focus/30 focus:border-focus",
                        isSel ? "bg-white text-action-muted font-medium border-action" : "bg-white text-gray-500",
                        readonly && "opacity-60 cursor-not-allowed bg-gray-50"
                      )}
                    >
                      <option value="">-- 未分配 --</option>
                      {TEST_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
