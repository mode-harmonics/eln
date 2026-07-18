import React, { useState } from "react";
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
import { Database, Download } from "lucide-react";
import { Button } from "./Button";

export function ProjectRawData(props: SummaryDataProps & { loadedTypes: string[]; projectId: string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("process");

  const tabs = [
    { key: "process", label: t("tab_process", "制程数据") },
    { key: "calendar", label: t("tab_calendar", "日历寿命") },
    { key: "swelling", label: t("tab_swelling", "存储胀气") },
    { key: "efficiency", label: t("tab_efficiency", "能量效率") },
    { key: "dcr", label: t("tab_dcr", "DCR测试") },
    { key: "fastcharge", label: t("tab_fastcharge", "快充测试") },
    { key: "htcycle", label: t("tab_htcycle", "高温循环") },
  ];

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
    <div className="bg-white border border-gray-200 rounded shadow-sm mb-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-gray-50">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            项目全量数据汇总
          </h2>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4" />
          导出全部明细
        </Button>
      </div>
      <Tabs
        items={tabs}
        activeKey={activeTab}
        onChange={setActiveTab}
        className="px-2 bg-white"
      />
      <div className="bg-white">
        {activeTab === "process" && <ProcessDataTable staticData={props.processData} />}
        {activeTab === "calendar" && <CalendarLifeTable staticData={props.calendarLife} />}
        {activeTab === "swelling" && <StorageSwellingTable staticData={props.storageSwelling} />}
        {activeTab === "efficiency" && <EnergyEfficiencyTable staticData={props.energyEfficiency} />}
        {activeTab === "dcr" && <DcrTestTable staticData={props.dcrTest} />}
        {activeTab === "fastcharge" && <FastChargeTable staticData={props.fastCharge} />}
        {activeTab === "htcycle" && <HtCycleTable staticData={props.htCycle} />}
      </div>
    </div>
  );
}
