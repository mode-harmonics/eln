import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "./SegmentedControl";
import {
  ProcessDataTable,
  CalendarLifeTable,
  StorageSwellingTable,
  EnergyEfficiencyTable,
  DcrTestTable,
  FastChargeTable,
  HtCycleTable,
} from "./ExperimentTables";
import { SummaryDataProps } from "../utils/dataSummary";
import { Check, ChevronDown, Database, Download, UploadCloud } from "lucide-react";
import { Button } from "./Button";
import { Dropdown } from "./Dropdown";
import { toast } from "./Toast";
import { api, ApiError } from "../lib/api";
import { ExperimentChart } from "./ExperimentChart";

export function ProjectRawData(props: SummaryDataProps & { loadedTypes: string[]; projectId: string; onImported?: () => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("process");

  // Upload state — import mode: merge keeps existing rows, overwrite replaces them
  const [uploading, setUploading] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const importModeRef = useRef<"merge" | "overwrite">("merge");
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const pickMode = (mode: "merge" | "overwrite") => {
    importModeRef.current = mode;
    setImportMode(mode);
    uploadInputRef.current?.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const mode = importModeRef.current;

    if (mode === "overwrite") {
      const ok = window.confirm(
        t("import_overwrite_confirm", "覆盖模式将删除该类型已有的全部数据后重新导入，此操作不可恢复，确定继续？"),
      );
      if (!ok) {
        if (uploadInputRef.current) uploadInputRef.current.value = "";
        return;
      }
    }

    setUploading(true);
    try {
      const form = new FormData();
      for (let i = 0; i < files.length; i++) form.append("files", files[i]);
      form.append("mode", mode);
      const result = await api.upload<any>(`/api/v1/data/upload-project/${props.projectId}`, form);

      // Build per-type row summary
      const byType: { sheetName: string; assayType: string; rows: number }[] =
        result?.sheetsByType ?? [];
      const summary = byType
        .map((r) => `${r.sheetName}: ${r.rows} 行`)
        .join("，");

      if (result?.workflowCompleted) {
        toast.success(t("import_success_workflow", "导入成功，工作流已完成"));
      } else if (summary) {
        toast.success(t("import_success_detail", "导入成功：{{summary}}", { summary }));
      } else {
        toast.success(t("import_success", "导入成功，数据已刷新"));
      }
      props.onImported?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("import_failed"));
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const tabs = [
    { key: "process", label: t("tab_process", "制程数据") },
    { key: "calendar", label: t("tab_calendar", "日历寿命") },
    { key: "swelling", label: t("tab_swelling", "存储胀气") },
    { key: "efficiency", label: t("tab_efficiency", "能量效率") },
    { key: "dcr", label: t("tab_dcr", "DCR测试") },
    { key: "fastcharge", label: t("tab_fastcharge", "快充测试") },
    { key: "htcycle", label: t("tab_htcycle", "高温循环") },
  ];

  const dataCounts: Record<string, number> = {
    process: props.processData.length,
    calendar: props.calendarLife.length,
    swelling: props.storageSwelling.length,
    efficiency: props.energyEfficiency.length,
    dcr: props.dcrTest.length,
    fastcharge: props.fastCharge.length,
    htcycle: props.htCycle.length,
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/data/export/project/${props.projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        throw new Error(`Export failed (${res.status}): ${errBody}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `项目数据汇总.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
      alert(t("export_failed"));
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Card (matching Workflow progress header) */}
      <section className="rounded-lg bg-gray-50 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-600" />
              <h2 className="text-[15px] font-semibold text-gray-900">{t("project_data_overview")}</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">{t("project_data_overview_desc")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={handleImport}
            />
            <Dropdown
              trigger={
                <Button variant="secondary" size="sm" loading={uploading} disabled={uploading}>
                  <UploadCloud className="w-4 h-4" />
                  {t("import_summary")}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              }
            >
              <div className="py-1.5">
                <p className="px-3 pb-1 pt-0.5 text-[11px] font-medium text-gray-400">{t("import_mode_label", "导入模式")}</p>
                <button
                  onClick={() => pickMode("merge")}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-950 transition-colors"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {importMode === "merge" && <Check className="h-3.5 w-3.5 text-action" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{t("merge", "合并")}</span>
                    <span className="block text-[11px] text-gray-400">{t("import_mode_merge_desc", "保留已有数据，按电池编号合并新增/更新")}</span>
                  </span>
                </button>
                <button
                  onClick={() => pickMode("overwrite")}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-950 transition-colors"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {importMode === "overwrite" && <Check className="h-3.5 w-3.5 text-red-500" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{t("overwrite", "覆盖")}</span>
                    <span className="block text-[11px] text-gray-400">{t("import_mode_overwrite_desc", "删除该类型已有数据后重新导入（不可恢复）")}</span>
                  </span>
                </button>
              </div>
            </Dropdown>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4" />
              {t("export_summary")}
            </Button>
          </div>
        </div>
      </section>

      {/* Sub-tabs pill bar */}
      <div className="overflow-x-auto pb-1">
        <SegmentedControl
          items={tabs.map((tab) => ({ value: tab.key, label: `${tab.label} (${dataCounts[tab.key] ?? 0})` }))}
          value={activeTab}
          onValueChange={setActiveTab}
          size="md"
        />
      </div>

      {/* Active content */}
      <div className="space-y-5">
        {activeTab === "process" && (
          <>
            <ExperimentChart assayType="ProcessData" staticData={props.processData} />
            <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-100">
              <ProcessDataTable staticData={props.processData} />
            </div>
          </>
        )}
        {activeTab === "calendar" && (
          <>
            <ExperimentChart assayType="CalendarLife" staticData={props.calendarLife} />
            <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-100">
              <CalendarLifeTable staticData={props.calendarLife} />
            </div>
          </>
        )}
        {activeTab === "swelling" && (
          <>
            <ExperimentChart assayType="StorageSwelling" staticData={props.storageSwelling} />
            <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-100">
              <StorageSwellingTable staticData={props.storageSwelling} />
            </div>
          </>
        )}
        {activeTab === "efficiency" && (
          <>
            <ExperimentChart assayType="EnergyEfficiency" staticData={props.energyEfficiency} />
            <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-100">
              <EnergyEfficiencyTable staticData={props.energyEfficiency} />
            </div>
          </>
        )}
        {activeTab === "dcr" && (
          <>
            <ExperimentChart assayType="DcrTest" staticData={props.dcrTest} />
            <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-100">
              <DcrTestTable staticData={props.dcrTest} />
            </div>
          </>
        )}
        {activeTab === "fastcharge" && (
          <>
            <ExperimentChart assayType="FastCharge" staticData={props.fastCharge} />
            <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-100">
              <FastChargeTable staticData={props.fastCharge} />
            </div>
          </>
        )}
        {activeTab === "htcycle" && (
          <>
            <ExperimentChart assayType="HtCycle" staticData={props.htCycle} />
            <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-100">
              <HtCycleTable staticData={props.htCycle} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
