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
  onComplete?: (cellIds: string[]) => void;
}

export function CellPicker({ open, onClose, projectId, processExperimentId, onComplete }: CellPickerProps) {
  const [cells, setCells] = useState<{ cellId: string; fqTotal: number }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      const pickedIds = new Set((picked || []).map((p: any) => p.cellId));
      const mapped = (processData || [])
        .filter((r: any) => r.cellId && r.fq1 && r.fq2)
        .map((r: any) => ({
          cellId: r.cellId,
          fqTotal: (parseFloat(r.fq1) || 0) + (parseFloat(r.fq2) || 0),
        }))
        .sort((a: any, b: any) => b.fqTotal - a.fqTotal);
      setCells(mapped);
      setSelected(new Set(mapped.filter((c: any) => pickedIds.has(c.cellId)).map((c: any) => c.cellId)));
      setLoading(false);
    }).catch(() => { setLoading(false); toast("加载电芯数据失败", "error"); });
  }, [open, processExperimentId, projectId]);

  const toggleCell = (cellId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });
  };

  const handleAutoPick = async () => {
    setAutoPicking(true);
    try {
      // Auto-pick via algorithm — writes to DB
      await api.post(`/api/v1/data/pick-cells/${projectId}`, { mode: "auto" });
      const data = await api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`);
      const pickedIds = (data || []).map((p: any) => p.cellId);
      setSelected(new Set(pickedIds));
      toast(`系统已自动选择 ${pickedIds.length} 个电芯，你可继续手动调整`, "success");
    } catch (err: any) {
      toast(err?.message ?? "自动挑选失败", "error");
    } finally {
      setAutoPicking(false);
    }
  };

  const doConfirm = async () => {
    setSyncing(true);
    const picked = Array.from(selected);
    try {
      // Persist the final selection (overwrites existing picks)
      await api.post(`/api/v1/data/pick-cells/${projectId}`, {
        mode: "manual",
        cellIds: picked,
      });

      onComplete?.(picked);
      toast(`已挑选 ${picked.length} 个电芯`, "success");
      onClose();
    } catch (err: any) {
      toast(err?.message ?? "操作失败", "error");
    } finally {
      setSyncing(false);
    }
  };

  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="挑选电芯"
      description="选择后续测试使用的电芯"
      icon={<Layers className="w-4 h-4 text-[#1d74f5]" />}
      size="max-w-lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-900">{cells.length}</span> 个电芯，已选 <span className="font-semibold text-[#1d74f5]">{selected.size}</span>
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={syncing}>取消</Button>
            <Button onClick={doConfirm} loading={syncing} disabled={syncing || selected.size === 0}>
              {syncing ? "同步中..." : "确认挑选"}
              {!syncing && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      }
    >
      <div className="-mx-6 -mt-4 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <Button variant="secondary" size="sm" onClick={handleAutoPick} loading={autoPicking} disabled={autoPicking || cells.length === 0}>
          <Sparkles className="w-3.5 h-3.5" />
          {autoPicking ? "自动选择中..." : "自动选择"}
        </Button>
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
          <div className="space-y-1">
            {cells.map((cell, i) => {
              const isSel = selected.has(cell.cellId);
              return (
                <button
                  key={cell.cellId}
                  onClick={() => toggleCell(cell.cellId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                    isSel ? "bg-[#f0f4ff] border border-[#d6e4ff]" : "hover:bg-gray-50 border border-transparent",
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                    isSel ? "bg-[#1d74f5] text-white" : "bg-gray-100 text-gray-400",
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", isSel ? "text-[#1d74f5]" : "text-gray-900")}>{cell.cellId}</p>
                    <p className="text-xs text-gray-500 mt-0.5">化成容量 {cell.fqTotal.toFixed(4)} Ah</p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                    isSel ? "bg-[#1d74f5] border-[#1d74f5]" : "border-gray-300",
                  )}>
                    {isSel && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
