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

export function ProjectRawData(props: SummaryDataProps & { loadedTypes: string[] }) {
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
      const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
      const wb = new ExcelJS.Workbook();

      const addSheet = (name: string, data: any[]) => {
        if (!data || data.length === 0) return;
        const sheet = wb.addWorksheet(name);

        let flatRows = data;
        if (name === "快充测试") {
          flatRows = data.flatMap((d: any) => {
            const steps = d.steps || [];
            if (steps.length === 0) return [{ cellName: d.cellName, c0: d.c0, providedFastChargeTime: d.providedFastChargeTime, computedFastChargeTime: d.computedFastChargeTime }];
            return steps.map((step: any) => ({ cellName: d.cellName, c0: d.c0, providedFastChargeTime: d.providedFastChargeTime, computedFastChargeTime: d.computedFastChargeTime, ...step }));
          });
        }

        const keys = Array.from(
          new Set(flatRows.flatMap(row => Object.keys(row)))
        ).filter(k => k !== 'id' && k !== 'experimentId' && k !== 'createdAt' && k !== 'updatedAt' && k !== 'originalRow' && k !== 'steps');

        sheet.columns = keys.map(k => ({ header: k, key: k, width: 15 }));

        flatRows.forEach(row => {
          const rowData: Record<string, any> = {};
          keys.forEach(k => { rowData[k] = row[k]; });
          sheet.addRow(rowData);
        });
      };

      addSheet("制程数据", props.processData);
      addSheet("日历寿命", props.calendarLife);
      addSheet("存储胀气", props.storageSwelling);
      addSheet("能量效率", props.energyEfficiency);
      addSheet("DCR测试", props.dcrTest);
      addSheet("快充测试", props.fastCharge);
      addSheet("高温循环", props.htCycle);

      if (wb.worksheets.length === 0) {
        alert("当前项目没有任何明细数据可导出");
        return;
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `项目数据汇总.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
