import React, { useEffect, useState } from "react";
import { Loader2, Check, Layers, Zap, MousePointerClick, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { Drawer } from "./Drawer";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "./Toast";

interface CellPickerProps {
  open: boolean;
  onClose: () => void;
  experimentId: string;
  projectId: string;
  onComplete?: (cellIds: string[]) => void;
}

export function CellPicker({ open, onClose, experimentId, projectId, onComplete }: CellPickerProps) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [cells, setCells] = useState<{ cellId: string; fqTotal: number }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [topN, setTopN] = useState(0);

  useEffect(() => {
    if (!open || !experimentId) return;
    setLoading(true);
    api.get<any[]>(`/api/v1/data/process/${experimentId}`)
      .then((data) => {
        const mapped = (data || [])
          .filter((r: any) => r.cellId && r.fq1 && r.fq2)
          .map((r: any) => ({
            cellId: r.cellId,
            fqTotal: (parseFloat(r.fq1) || 0) + (parseFloat(r.fq2) || 0),
          }))
          .sort((a, b) => b.fqTotal - a.fqTotal);
        setCells(mapped);
        setTopN(mapped.length);
        setSelected(new Set(mapped.map((c) => c.cellId)));
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast("加载电芯数据失败", "error"); });
  }, [open, experimentId]);

  const handleAutoPick = () => {
    const top = cells.slice(0, topN);
    setSelected(new Set(top.map((c) => c.cellId)));
    setMode("auto");
  };

  const toggleCell = (cellId: string) => {
    setMode("manual");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });
  };

  const handleConfirm = async () => {
    setSyncing(true);
    const picked = Array.from(selected);
    try {
      // Step 1: pick cells
      await api.post(`/api/v1/data/pick-cells/${experimentId}?projectId=${projectId}`, {
        cellIds: picked,
        mode,
      });
      // Step 2: sync to target tables
      await api.post(`/api/v1/data/sync-cells/${experimentId}`, {});
      toast(`已挑选 ${picked.length} 个电池并同步到数据表`, "success");
      onComplete?.(picked);
      onClose();
    } catch (err: any) {
      toast(err?.message ?? "操作失败", "error");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!open) { /* reset handled by caller */ }
  }, [open]);

  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="挑选电池"
      description="选择后续测试使用的电池"
      icon={<Layers className="w-4 h-4 text-[#1d74f5]" />}
      size="max-w-lg"
      footer={
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            已选 <span className="font-semibold text-gray-900">{selected.size}</span> / {cells.length} 个电池
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={syncing}>取消</Button>
            <Button onClick={handleConfirm} loading={syncing} disabled={syncing || selected.size === 0}>
              {syncing ? "同步中..." : "确认挑选 & 同步"}
              {!syncing && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      }
    >
      {/* Mode toggle */}
      <div className="-mx-6 -mt-4 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { handleAutoPick(); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                mode === "auto" ? "bg-white shadow-sm border border-gray-200 text-[#1d74f5]" : "text-gray-500 hover:text-gray-700",
              )}
            >
              <Zap className="w-4 h-4" />
              自动挑选
            </button>
            <button
              onClick={() => setMode("manual")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                mode === "manual" ? "bg-white shadow-sm border border-gray-200 text-[#1d74f5]" : "text-gray-500 hover:text-gray-700",
              )}
            >
              <MousePointerClick className="w-4 h-4" />
              手动选择
            </button>
            {mode === "auto" && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-400">前</span>
                <input
                  type="number"
                  min={1}
                  max={cells.length}
                  value={topN}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(cells.length, Number(e.target.value) || 1));
                    setTopN(n);
                    setSelected(new Set(cells.slice(0, n).map((c) => c.cellId)));
                  }}
                  className="w-16 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 text-center focus:outline-none focus:border-[#1d74f5]"
                />
                <span className="text-xs text-gray-400">个</span>
              </div>
            )}
          </div>
        </div>

        {/* Cell list */}
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
                    {/* Rank */}
                    <span className={cn(
                      "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                      isSel ? "bg-[#1d74f5] text-white" : "bg-gray-100 text-gray-400",
                    )}>
                      {i + 1}
                    </span>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", isSel ? "text-[#1d74f5]" : "text-gray-900")}>{cell.cellId}</p>
                      <p className="text-xs text-gray-500 mt-0.5">化成容量 {cell.fqTotal.toFixed(4)} Ah</p>
                    </div>
                    {/* Check */}
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
