import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "./Tabs";
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
      toast.success("导入成功，请刷新页面查看数据");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "导入失败");
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
      alert("导出失败，请稍后重试");
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-surface border border-border bg-surface">
      <div className="flex flex-col gap-4 border-b border-border bg-surface-subtle px-5 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
            <Database className="h-4 w-4 text-action" />
            项目全量数据汇总
          </h2>
          <p className="mt-1 text-xs text-gray-500">按数据类型浏览项目记录，并集中导入或导出 Excel 数据。</p>
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
            导入全量数据
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4" />
            导出全量数据
          </Button>
        </div>
      </div>
      <Tabs
        items={tabs.map((tab) => ({ ...tab, label: `${tab.label} ${dataCounts[tab.key] ?? 0}` }))}
        activeKey={activeTab}
        onChange={setActiveTab}
        className="bg-white px-3 sm:px-4"
      />
      <div className="min-h-72 bg-white">
        {activeTab === "process" && <ProcessDataTable staticData={props.processData} />}
        {activeTab === "calendar" && <CalendarLifeTable staticData={props.calendarLife} />}
        {activeTab === "swelling" && <StorageSwellingTable staticData={props.storageSwelling} />}
        {activeTab === "efficiency" && <EnergyEfficiencyTable staticData={props.energyEfficiency} />}
        {activeTab === "dcr" && <DcrTestTable staticData={props.dcrTest} />}
        {activeTab === "fastcharge" && <FastChargeTable staticData={props.fastCharge} />}
        {activeTab === "htcycle" && <HtCycleTable staticData={props.htCycle} />}
      </div>
    </section>
  );
}
