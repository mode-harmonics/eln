import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useRouteLoaderData, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, UploadCloud, Settings2,
  Layers, Lock, CheckCircle2,
} from "lucide-react";
import { Button } from "../components/Button";
import { cn } from "../lib/utils";
import { usePermissions } from "../hooks/usePermissions";
import { DataSummary } from "../components/DataSummary";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/Card";
import { SkeletonCard } from "../components/Skeleton";
import { CellPicker } from "../components/CellPicker";
import { api, ApiError } from "../lib/api";
import type { Project, Experiment, ProcessData, CalendarLife, StorageSwelling, EnergyEfficiency, DcrTest, FastCharge, HtCycle, CellGroup } from "../types";
import { RECORD_TYPE_TO_API_TYPE, ALL_API_TYPES } from "../utils/recordTypes";

export function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "summary" | "experiments") || "experiments";

  const loaderProject = useRouteLoaderData("project") as Project | null;
  const [project, setProject] = useState<Project | null>(loaderProject);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalItems, setTotalItems] = useState(0);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Business data for DataSummary tab
  const [processData, setProcessData] = useState<ProcessData[]>([]);
  const [calendarLife, setCalendarLife] = useState<CalendarLife[]>([]);
  const [storageSwelling, setStorageSwelling] = useState<StorageSwelling[]>([]);
  const [energyEfficiency, setEnergyEfficiency] = useState<EnergyEfficiency[]>([]);
  const [dcrTest, setDcrTest] = useState<DcrTest[]>([]);
  const [fastCharge, setFastCharge] = useState<FastCharge[]>([]);
  const [htCycle, setHtCycle] = useState<HtCycle[]>([]);
  const [loadedTypes, setLoadedTypes] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Group data for DataSummary
  const [groups, setGroups] = useState<CellGroup[]>([]);

  // Project-level cell picks
  const [pickedCells, setPickedCells] = useState<string[]>([]);
  const [cellPickerOpen, setCellPickerOpen] = useState(false);
  const hasPickedCells = pickedCells.length > 0;

  const recordOptions = React.useMemo(() => [
    { value: "ProcessData", label: t("process_data"), permission: "data_process:write", sheetType: "step" },
    { value: "CalendarLife", label: t("calendar_life"), permission: "data_calendar:write", sheetType: "step" },
    { value: "StorageSwelling", label: t("storage_swelling"), permission: "data_swelling:write", sheetType: "step" },
    { value: "EnergyEfficiency", label: t("energy_efficiency"), permission: "data_efficiency:write", sheetType: "step" },
    { value: "DcrTest", label: t("dcr_test"), permission: "data_dcr:write", sheetType: "step" },
    { value: "FastCharge", label: t("fast_charge"), permission: "data_fastcharge:write", sheetType: "step" },
    { value: "HtCycle", label: t("ht_cycle"), permission: "data_htcycle:write", sheetType: "cycle" },
  ].filter((opt) => hasPermission("experiments:write") || hasPermission("data:write") || hasPermission(opt.permission)), [t, hasPermission]);

  // Load groups for DataSummary cell → group name mapping
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api.get<CellGroup[]>(`/api/v1/projects/${projectId}/groups`)
      .then((data) => { if (!cancelled) setGroups(data); })
      .catch(() => { /* groups are optional */ });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api.get<any[]>(`/api/v1/data/picked-cells/${projectId}`)
      .then((data) => { if (!cancelled) setPickedCells((data || []).map((p: any) => p.cellId)); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [projectId, refetchTrigger]);

  const handleInitProcessData = async () => {
    try {
      const defaultTitle = `ProcessData - ${new Date().toISOString().split("T")[0]}`;
      const newExp = await api.post<{ id: string }>(
        `/api/v1/projects/${projectId}/experiments`,
        { title: defaultTitle, assayType: "ProcessData" }
      );
      setRefetchTrigger((n) => n + 1);
      navigate(`/projects/${projectId}/experiments/${newExp.id}`);
    } catch (err: any) {
      console.error("Failed to initialize ProcessData:", err);
    }
  };

  // Load ALL experiments belonging to this project (no pagination)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`)
      .then((res) => {
        if (cancelled) return;
        setExperiments(res);
        setTotalItems(res.length);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "加载实验数据失败");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, refetchTrigger]);

  // Summary tab: fetch ALL experiments (no pagination), group by assayType, only request matching data
  useEffect(() => {
    if (!projectId || activeTab !== "summary") return;
    let cancelled = false;

    setProcessData([]);
    setCalendarLife([]);
    setStorageSwelling([]);
    setEnergyEfficiency([]);
    setDcrTest([]);
    setFastCharge([]);
    setHtCycle([]);
    setLoadedTypes([]);
    setDataLoading(true);

    // Fetch ALL experiments without pagination to guarantee completeness
    api.get<Experiment[]>(`/api/v1/projects/${projectId}/experiments`)
      .then((allExps) => {
        if (cancelled) return;

        if (!Array.isArray(allExps) || allExps.length === 0) {
          setLoadedTypes(ALL_API_TYPES);
          setDataLoading(false);
          return;
        }

        // Group experiment IDs by their metadata.assayType
        const expIdsByType: Record<string, string[]> = {};
        for (const exp of allExps) {
          const assayType = exp.metadata?.assayType as string | undefined;
          if (assayType && RECORD_TYPE_TO_API_TYPE[assayType]) {
            if (!expIdsByType[assayType]) expIdsByType[assayType] = [];
            expIdsByType[assayType].push(exp.id);
          }
        }

        // Only request the matching data table for each experiment group
        const settleAssayType = (
          assayType: string,
          apiType: string,
          setter: (data: any[]) => void,
          expIds: string[],
        ) => {
          if (expIds.length === 0) {
            setter([]);
            setLoadedTypes((prev) => [...prev, apiType]);
            return;
          }
          return Promise.all(
            expIds.map((expId) =>
              api.get<any[]>(`/api/v1/data/${apiType}/${expId}`).catch(() => [] as any[])
            )
          ).then((results) => {
            if (cancelled) return;
            setter(results.flat());
            setLoadedTypes((prev) => [...prev, apiType]);
          });
        };

        const tasks = [
          settleAssayType("ProcessData", "process", setProcessData, expIdsByType["ProcessData"] || []),
          settleAssayType("CalendarLife", "calendar", setCalendarLife, expIdsByType["CalendarLife"] || []),
          settleAssayType("StorageSwelling", "swelling", setStorageSwelling, expIdsByType["StorageSwelling"] || []),
          settleAssayType("EnergyEfficiency", "efficiency", setEnergyEfficiency, expIdsByType["EnergyEfficiency"] || []),
          settleAssayType("DcrTest", "dcr", setDcrTest, expIdsByType["DcrTest"] || []),
          settleAssayType("FastCharge", "fastcharge", setFastCharge, expIdsByType["FastCharge"] || []),
          settleAssayType("HtCycle", "htcycle", setHtCycle, expIdsByType["HtCycle"] || []),
        ];

        Promise.all(tasks.filter(Boolean)).finally(() => {
          if (!cancelled) setDataLoading(false);
        });
      })
      .catch((err) => {
        if (!cancelled) console.error("Summary data fetch failed:", err);
      });

    return () => { cancelled = true; };
  }, [projectId, activeTab, refetchTrigger]);

  // Data fetch logic remains unchanged.

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !project) {
    return <div className="p-10">{error ?? t("project_not_found")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1 truncate">{project.description}</p>
        </div>
        <Link
          to={`/projects/${projectId}/groups`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1d74f5] transition-colors shrink-0 mt-1"
        >
          <Settings2 className="w-4 h-4" />
          {t("group_management")}
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          <Button variant="text" onClick={() => { setSearchParams({ tab: "experiments" }) }} className={cn(
            "!pb-3 border-b-2 font-medium text-sm relative",
            activeTab === "experiments"
              ? "border-[#1d74f5] text-[#1d74f5]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}>
            {t("experiments_records")}
            {totalItems > 0 && (
              <span className="ml-1.5 text-[11px] text-gray-400 font-normal">({totalItems})</span>
            )}
          </Button>
          <Button variant="text" onClick={() => setSearchParams({ tab: "summary" })} className={cn(
            "!pb-3 border-b-2 font-medium text-sm",
            activeTab === "summary"
              ? "border-[#1d74f5] text-[#1d74f5]"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}>
            {t("data_summary")}
          </Button>
        </nav>
      </div>

      {activeTab === "experiments" ? (
        <div className="space-y-6">
          {/* ── 电芯挑选面板 ── */}
          {(() => {
            const processExp = experiments.find((e) => (e as any).metadata?.assayType === "ProcessData") as any;
            const hasProcessData = !!processExp;
            const canWrite = hasPermission("experiments:write") || hasPermission("data:write") || hasPermission("data_process:write");
            return (
              <div className={`rounded-xl border px-5 py-4 flex items-center gap-5 ${!hasProcessData ? "bg-gray-50 border-gray-200 opacity-70" :
                  hasPickedCells ? "bg-blue-50/40 border-blue-100" :
                    "bg-amber-50/40 border-amber-200"
                }`}>
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${!hasProcessData ? "bg-gray-100 text-gray-300" :
                    hasPickedCells ? "bg-[#1d74f5]/10 text-[#1d74f5]" :
                      "bg-amber-100 text-amber-600"
                  }`}>
                  <Layers className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">电芯挑选</p>
                  {!hasProcessData ? (
                    <p className="text-xs text-gray-400 mt-0.5">请先导入制程数据（ProcessData），完成后可在此挑选电芯</p>
                  ) : hasPickedCells ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {pickedCells.slice(0, 12).map((cid) => (
                        <span key={cid} className="inline-flex items-center px-2 py-0.5 rounded bg-white text-[11px] font-mono text-blue-700 border border-blue-200/60 shadow-sm">{cid}</span>
                      ))}
                      {pickedCells.length > 12 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white text-[11px] text-gray-400 border border-gray-200 shadow-sm">+{pickedCells.length - 12} 个</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 mt-0.5">发现制程数据，请挑选用于后续测试的电芯，挑选后将自动初始化全部 6 类实验表</p>
                  )}
                </div>
                {hasProcessData && canWrite && (
                  <div className="shrink-0">
                    {hasPickedCells ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          已挑选 {pickedCells.length} 个
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setCellPickerOpen(true)}>
                          重新挑选
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => setCellPickerOpen(true)}>
                        <Layers className="w-4 h-4 mr-1.5" />
                        挑选电芯
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── 7 类实验卡片 ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recordOptions.map((opt) => {
              const exp = experiments.find((e) => (e as any).metadata?.assayType === opt.value) as any;
              const isLocked = opt.value !== "ProcessData" && !hasPickedCells;

              return (
                <AssayCard
                  key={opt.value}
                  opt={opt}
                  exp={exp}
                  isLocked={isLocked}
                  projectId={projectId!}
                  onInit={opt.value === "ProcessData" ? handleInitProcessData : undefined}
                />
              );
            })}
          </div>
        </div>
      ) : (
        dataLoading ? (
          <SkeletonCard rows={5} />
        ) : (
          <DataSummary
            loadedTypes={loadedTypes}
            processData={processData}
            calendarLife={calendarLife}
            storageSwelling={storageSwelling}
            energyEfficiency={energyEfficiency}
            dcrTest={dcrTest}
            fastCharge={fastCharge}
            htCycle={htCycle}
            groups={groups}
          />
        )
      )}

      {/* CellPicker drawer — project-scoped */}
      {(() => {
        const processExp = experiments.find((e) => (e as any).metadata?.assayType === "ProcessData") as any;
        return processExp ? (
          <CellPicker
            open={cellPickerOpen}
            onClose={() => setCellPickerOpen(false)}
            projectId={projectId!}
            processExperimentId={processExp.id}
            onComplete={(cells) => {
              setPickedCells(cells);
              setRefetchTrigger((n) => n + 1);
            }}
          />
        ) : null;
      })()}
    </div>
  );
}

interface AssayCardProps {
  opt: { value: string; label: string };
  exp: any;
  isLocked: boolean;
  projectId: string;
  onInit?: () => void;
}

function AssayCard({ opt, exp, isLocked, projectId, onInit }: AssayCardProps) {
  const hasData = !!exp;
  const { t } = useTranslation();

  if (isLocked) {
    return (
      <Card className="opacity-70 h-full flex flex-col min-h-[200px]">
        <CardHeader>
          <div>
            <CardTitle>{opt.label}</CardTitle>
            <CardDescription>{opt.value}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <Lock className="w-6 h-6 text-gray-300" />
            <p className="text-[12px] font-medium text-gray-400">未解锁</p>
            <p className="text-[11px] text-gray-400 leading-relaxed max-w-[180px]">
              需先完成制程数据导入并挑选电芯
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasData) {
    return (
      <Link to={`/projects/${projectId}/experiments/${exp.id}`} className="block h-full">
        <Card className="group h-full flex flex-col min-h-[200px]">
          <CardHeader>
            <div>
              <CardTitle className="group-hover:text-[#1d74f5]">{opt.label}</CardTitle>
              <CardDescription>{opt.value}</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn(
                "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
                exp.status === "Approved" ? "bg-[#f0f9f4] text-[#1e8b4e]"
                  : exp.status === "Archived" ? "bg-slate-50 text-slate-600"
                    : "bg-gray-100 text-gray-600"
              )}>
                {exp.status === "Approved" ? t("status_approved")
                  : exp.status === "Archived" ? t("status_archived")
                    : t("status_draft")}
              </span>
              <span className="text-[11px] text-gray-400 font-mono">v{exp.versionNo}</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-500 leading-relaxed">
              数据已就绪
            </p>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // No data state
  return (
    <Card className="border-dashed h-full flex flex-col min-h-[200px]">
      <CardHeader>
        <div>
          <CardTitle>{opt.label}</CardTitle>
          <CardDescription>{opt.value}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        {onInit ? (
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <UploadCloud className="w-7 h-7 text-gray-300" />
            <p className="text-[12px] font-medium text-gray-400">尚未导入数据</p>
            <Button variant="primary" size="sm" onClick={onInit}>
              <UploadCloud className="w-3.5 h-3.5" />
              初始化并导入
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <UploadCloud className="w-7 h-7 text-gray-300" />
            <p className="text-[12px] font-medium text-gray-400">尚未创建</p>
            <p className="text-[11px] text-gray-400 leading-relaxed max-w-[160px]">
              挑选电芯后将自动创建
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
