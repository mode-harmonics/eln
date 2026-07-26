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
import { Database, Download, UploadCloud } from "lucide-react";
import { Button } from "./Button";
import { toast } from "./Toast";
import { api, ApiError } from "../lib/api";
import { ExperimentChart } from "./ExperimentChart";

export function ProjectRawData(props: SummaryDataProps & { loadedTypes: string[]; projectId: string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("process");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (let i = 0; i < files.length; i++) form.append("files", files[i]);
      form.append("mode", "merge");
      await api.upload(`/api/v1/data/upload-project/${props.projectId}`, form);
      toast.success(t("import_success_refresh"));
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
            <Button variant="secondary" size="sm" onClick={() => uploadInputRef.current?.click()} loading={uploading}>
              <UploadCloud className="w-4 h-4" />
              {t("import_summary")}
            </Button>
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
