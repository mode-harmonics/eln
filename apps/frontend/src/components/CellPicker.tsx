import React, { useEffect, useState } from "react";
import { Loader2, Check, Layers, Zap, MousePointerClick, ChevronRight, AlertTriangle } from "lucide-react";
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
  alreadyPicked: boolean;
  onComplete?: (cellIds: string[]) => void;
}

export function CellPicker({ open, onClose, projectId, processExperimentId, alreadyPicked, onComplete }: CellPickerProps) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [cells, setCells] = useState<{ cellId: string; fqTotal: number }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showResyncWarning, setShowResyncWarning] = useState(false);

  useEffect(() => {
    if (!open || !processExperimentId || mode !== "manual") return;
    setLoading(true);
    setShowResyncWarning(false);
    api.get<any[]>(`/api/v1/data/process/${processExperimentId}`)
      .then((data) => {
        const mapped = (data || [])
          .filter((r: any) => r.cellId && r.fq1 && r.fq2)
          .map((r: any) => ({
            cellId: r.cellId,
            fqTotal: (parseFloat(r.fq1) || 0) + (parseFloat(r.fq2) || 0),
          }))
          .sort((a: any, b: any) => b.fqTotal - a.fqTotal);
        setCells(mapped);
        setSelected(new Set(mapped.map((c: any) => c.cellId)));
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast("加载电芯数据失败", "error"); });
  }, [open, processExperimentId, mode]);

  useEffect(() => {
    if (mode === "auto") {
      setSelected(new Set());
    }
  }, [mode]);

  const toggleCell = (cellId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });
  };

  const doConfirm = async () => {
    setSyncing(true);
    const picked = mode === "auto" ? [] : Array.from(selected);
    try {
      await api.post(`/api/v1/data/pick-cells/${projectId}`, {
        mode,
        ...(picked.length > 0 ? { cellIds: picked } : {}),
      });
      await api.post(`/api/v1/data/sync-cells/${projectId}`, {});
      toast(`已挑选电芯并同步到全部数据表`, "success");
      onComplete?.(picked);
      onClose();
    } catch (err: any) {
      toast(err?.message ?? "操作失败", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmClick = () => {
    if (alreadyPicked) {
      setShowResyncWarning(true);
    } else {
      doConfirm();
    }
  };

  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="挑选电芯"
      description="选择后续测试使用的电芯，确认后将同步到全部实验表"
      icon={<Layers className="w-4 h-4 text-[#1d74f5]" />}
      size="max-w-lg"
      footer={
        showResyncWarning ? (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>重新挑选将<strong>清空并重建</strong>全部 6 类实验表中的电芯占位行（已手动录入或导入的数据也会被清空），请确认继续。</span>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowResyncWarning(false)} disabled={syncing}>取消</Button>
              <Button variant="danger" onClick={doConfirm} loading={syncing} disabled={syncing}>
                {syncing ? "同步中..." : "确认清空并重新同步"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            {mode === "manual" ? (
              <p className="text-sm text-gray-500">
                已选 <span className="font-semibold text-gray-900">{selected.size}</span> / {cells.length} 个电芯
              </p>
            ) : (
              <p className="text-sm text-gray-500">系统将自动挑选</p>
            )}
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onClose} disabled={syncing}>取消</Button>
              <Button onClick={handleConfirmClick} loading={syncing} disabled={syncing || (mode === "manual" && selected.size === 0)}>
                {syncing ? "同步中..." : "确认挑选 & 同步"}
                {!syncing && <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="-mx-6 -mt-4 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 w-fit border border-gray-200/60">
          <button
            onClick={() => setMode("auto")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all",
              mode === "auto" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            自动挑选
          </button>
          <button
            onClick={() => setMode("manual")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all",
              mode === "manual" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
            )}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            手动选择
          </button>
        </div>
      </div>

      <div className="py-4">
        {mode === "auto" ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">系统将根据后端策略自动挑选电芯</p>
            <p className="text-xs text-gray-400 mt-1">确认后由后端服务完成电芯选择与同步</p>
          </div>
        ) : loading ? (
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
