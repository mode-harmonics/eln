import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  calculateCFR21,
  calculateRelativeDeviation,
  getGroupName,
  SummaryDataProps,
  MetricStat,
  RawDataPoint,
} from "../utils/dataSummary";
import {
  ChevronDown,
  ChevronRight,
  Settings2,
  X,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";

interface HeatmapCellProps {
  value: number;
  isPositiveGood: boolean;
}

// Maps metric keys to the data type string used in loadedTypes tracking
const METRIC_TO_TYPE: Record<string, string> = {
  qc_1st: "process",
  qd_1st: "process",
  ce_1st: "process",
  cal_retention: "calendar",
  cal_recovery: "calendar",
  cal_ddcr_pct: "calendar",
  cal_cdcr_pct: "calendar",
  gas_volume: "swelling",
  energy_eff: "efficiency",
  dcr_discharge: "dcr",
  dcr_charge: "dcr",
  fc_time: "fastcharge",
  cycle_retention: "htcycle",
  iron_ppm: "htcycle",
};

const HeatmapCell: React.FC<HeatmapCellProps> = ({ value, isPositiveGood }) => {
  const isPositive = value > 0;
  const isGood = isPositiveGood ? isPositive : !isPositive;
  const absVal = Math.abs(value);

  let bgColor = "bg-gray-50";
  let textColor = "text-gray-900";

  if (absVal > 0.1) {
    if (isGood) {
      if (absVal > 5) {
        bgColor = "bg-green-100";
        textColor = "text-green-800";
      } else {
        bgColor = "bg-green-50";
        textColor = "text-green-700";
      }
    } else {
      if (absVal > 5) {
        bgColor = "bg-red-100";
        textColor = "text-red-800";
      } else {
        bgColor = "bg-red-50";
        textColor = "text-red-700";
      }
    }
  }

  return (
    <td
      className={`px-4 py-3 whitespace-nowrap text-[13px] text-center font-medium ${bgColor} ${textColor} border-r border-gray-100 transition-colors`}
    >
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </td>
  );
};

const MiniErrorBar: React.FC<{
  mean: number;
  sd: number;
  minVal: number;
  maxVal: number;
}> = ({ mean, sd, minVal, maxVal }) => {
  const range = Math.max(maxVal - minVal, sd * 2, 0.001);
  const buffer = range * 0.1;
  const displayMin = Math.min(minVal, mean - sd) - buffer;
  const displayMax = Math.max(maxVal, mean + sd) + buffer;
  const displayRange = displayMax - displayMin;

  const toPct = (val: number) => {
    const pct = ((val - displayMin) / displayRange) * 100;
    return `${Math.max(0, Math.min(100, pct))}%`;
  };

  return (
    <div
      className="relative h-4 w-full flex items-center my-3"
      title={`Range: ${minVal.toFixed(2)} - ${maxVal.toFixed(2)}\nMean: ${mean.toFixed(2)}\nSD: ±${sd.toFixed(2)}`}
    >
      <div className="absolute left-0 right-0 h-px bg-gray-200"></div>

      {/* SD range */}
      <div
        className="absolute h-1.5 bg-[#1d74f5]/20 rounded-full -translate-y-1/2 top-1/2"
        style={{
          left: toPct(mean - sd),
          right: `${100 - parseFloat(toPct(mean + sd))}%`,
        }}
      />

      {/* SD whiskers */}
      <div
        className="absolute w-px h-2 bg-[#1d74f5] top-1/2 -translate-y-1/2"
        style={{ left: toPct(mean - sd) }}
      />
      <div
        className="absolute w-px h-2 bg-[#1d74f5] top-1/2 -translate-y-1/2"
        style={{ left: toPct(mean + sd) }}
      />

      {/* Mean tick */}
      <div
        className="absolute w-1 h-3 bg-[#1d74f5] rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2"
        style={{ left: toPct(mean) }}
      />
    </div>
  );
};

const ExpandedRowDetails: React.FC<{
  groups: string[];
  computedMetrics: Record<string, MetricStat>;
}> = ({ groups, computedMetrics }) => {
  const { t } = useTranslation();
  return (
    <div className="p-5 bg-[#f8fafc] border-b border-gray-200 shadow-inner">
      <h4 className="text-[13px] font-semibold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
        {t("inter_group_replicates")}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {groups.map((g) => {
          const st = computedMetrics[g];
          if (!st) return null;

          return (
            <div
              key={g}
              className="bg-white border border-gray-200 rounded p-4 shadow-sm flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                <span className="font-semibold text-gray-900">{g}</span>
                <span className="text-[11px] font-mono font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                  n={st.count}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[13px] text-gray-500">Mean ± SD:</span>
                <span className="font-mono font-medium text-[#1d74f5]">
                  {st.finalMean.toFixed(3)}{" "}
                  <span className="text-gray-400 font-normal">
                    ±{st.sd.toFixed(3)}
                  </span>
                </span>
              </div>

              <MiniErrorBar
                mean={st.finalMean}
                sd={st.sd}
                minVal={st.min}
                maxVal={st.max}
              />

              <div className="space-y-1 mt-2 flex-grow">
                {st.rawData.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
                  >
                    <span
                      className={`font-mono ${d.isOutlier ? "text-red-400 line-through" : "text-gray-600"}`}
                    >
                      {d.cellName}
                    </span>
                    <div className="flex items-center gap-2">
                      {d.isOutlier ? (
                        <div className="group/tooltip relative flex items-center">
                          <span className="font-mono text-red-400 line-through cursor-help decoration-red-400/50">
                            {d.value.toFixed(3)}
                          </span>
                          <div className="absolute bottom-full right-0 mb-1 hidden group-hover/tooltip:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10 whitespace-normal text-left font-sans font-normal">
                            This data point exceeds the control limit (CFR-21)
                            and has been excluded from the calculation.
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-gray-900 font-medium">
                          {d.value.toFixed(3)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DataSummary: React.FC<SummaryDataProps> = (props) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [baseGroup, setBaseGroup] = useState<string>("");
  const [groupingStrategy, setGroupingStrategy] = useState<"prefix" | "custom">(
    "prefix",
  );
  const [customGrouping, setCustomGrouping] = useState<Record<string, string>>(
    {},
  );
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const allCellNames = useMemo(() => {
    const names = new Set<string>();
    props.processData.forEach((d) => names.add(d.cellId));
    props.calendarLife.forEach((d) => names.add(d.cellName));
    props.storageSwelling.forEach((d) => names.add(d.cellName));
    props.energyEfficiency.forEach((d) => names.add(d.cellName));
    props.dcrTest.forEach((d) => names.add(d.cellName));
    props.fastCharge.forEach((d) => names.add(d.cellName));
    props.htCycle.forEach((d) => {
      if (d.cellName) {
        names.add(d.cellName);
      }
    });
    return Array.from(names).sort();
  }, [props]);

  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "prefix" | "custom";
    setGroupingStrategy(val);
    if (val === "custom" && Object.keys(customGrouping).length === 0) {
      const initial: Record<string, string> = {};
      allCellNames.forEach((c) => (initial[c] = getGroupName(c, "prefix")));
      setCustomGrouping(initial);
      setIsGroupModalOpen(true);
    }
  };

  const toggleRow = (key: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedRows(newSet);
  };

  const metrics = useMemo(() => {
    const rawMetrics: Record<
      string,
      Record<string, { cellName: string; value: number }[]>
    > = {};

    const addMetric = (
      group: string,
      metricKey: string,
      cellName: string,
      value: number | null | undefined,
    ) => {
      if (value === null || value === undefined || isNaN(value)) return;
      if (!rawMetrics[metricKey]) rawMetrics[metricKey] = {};
      if (!rawMetrics[metricKey][group]) rawMetrics[metricKey][group] = [];
      rawMetrics[metricKey][group].push({ cellName, value });
    };

    // 1. Process Data
    props.processData.forEach((d) => {
      const g = getGroupName(d.cellId, groupingStrategy, customGrouping);
      const fq = parseFloat(d.fq || "0");
      const gqc1 = parseFloat(d.gqc1 || "0");
      const gqd1 = parseFloat(d.gqd1 || "0");

      addMetric(g, "qc_1st", d.cellId, fq + gqc1);
      addMetric(g, "qd_1st", d.cellId, gqd1);
      if (fq + gqc1 > 0) {
        addMetric(g, "ce_1st", d.cellId, (gqd1 / (fq + gqc1)) * 100);
      }
    });

    // 2. Calendar Life
    const clByCell: Record<string, any[]> = {};
    props.calendarLife.forEach((d) => {
      if (!clByCell[d.cellName]) clByCell[d.cellName] = [];
      clByCell[d.cellName].push(d);
    });

    Object.keys(clByCell).forEach((cellName) => {
      const g = getGroupName(cellName, groupingStrategy, customGrouping);
      const items = clByCell[cellName].sort((a, b) => a.dayCount - b.dayCount);
      const latest = items[items.length - 1];

      if (latest && latest.dayCount > 0) {
        addMetric(
          g,
          "cal_retention",
          cellName,
          parseFloat(latest.qRetention || "0"),
        );
        addMetric(
          g,
          "cal_recovery",
          cellName,
          parseFloat(latest.qRecovery || "0"),
        );
        addMetric(
          g,
          "cal_ddcr_pct",
          cellName,
          parseFloat(latest.ddcrGrowth || "0"),
        );
        addMetric(
          g,
          "cal_cdcr_pct",
          cellName,
          parseFloat(latest.cdcrGrowth || "0"),
        );
      }
    });

    // 3. Storage Swelling
    const ssByCell: Record<string, any[]> = {};
    props.storageSwelling.forEach((d) => {
      if (!ssByCell[d.cellName]) ssByCell[d.cellName] = [];
      ssByCell[d.cellName].push(d);
    });

    Object.keys(ssByCell).forEach((cellName) => {
      const g = getGroupName(cellName, groupingStrategy, customGrouping);
      const items = ssByCell[cellName].sort((a, b) => a.dayCount - b.dayCount);
      const latest = items[items.length - 1];
      if (latest && latest.dayCount > 0) {
        addMetric(g, "gas_volume", cellName, parseFloat(latest.gasVolume || "0"));
      }
    });

    props.energyEfficiency.forEach((d: any) => {
      const g = getGroupName(d.cellName, groupingStrategy, customGrouping);
      addMetric(g, "energy_eff", d.cellName, parseFloat(d.eePct || d.ee || "0"));
    });

    props.dcrTest.forEach((d: any) => {
      const g = getGroupName(d.cellName, groupingStrategy, customGrouping);
      if (d.ddcr) addMetric(g, "dcr_discharge", d.cellName, parseFloat(d.ddcr));
      if (d.cdcr) addMetric(g, "dcr_charge", d.cellName, parseFloat(d.cdcr));
    });

    props.fastCharge.forEach((d: any) => {
      const g = getGroupName(d.cellName, groupingStrategy, customGrouping);
      addMetric(g, "fc_time", d.cellName, parseFloat(d.computedFastChargeTime || d.fcTime || "0"));
    });

    // HtCycle
    const htByCell: Record<string, any[]> = {};
    props.htCycle.forEach((d: any) => {
      if (d.cellName) {
        if (!htByCell[d.cellName]) htByCell[d.cellName] = [];
        htByCell[d.cellName].push(d);
      }
    });
    Object.keys(htByCell).forEach((cellName) => {
      const g = getGroupName(cellName, groupingStrategy, customGrouping);
      const sorted = htByCell[cellName].sort((a: any, b: any) => a.cycle - b.cycle);
      const latest = sorted[sorted.length - 1];
      if (latest && latest.cycle > 0) {
        const retention = latest.capacityRetention != null ? parseFloat(latest.capacityRetention) : null;
        if (retention != null) {
          addMetric(g, "cycle_retention", cellName, retention);
        }
      }
      sorted.forEach((d) => {
        const fe = d.ironDissolution != null ? parseFloat(d.ironDissolution) : null;
        if (fe != null) {
          addMetric(g, "iron_ppm", cellName, fe);
        }
      });
    });

    const computedMetrics: Record<string, Record<string, MetricStat>> = {};
    const groupsSet = new Set<string>();
    Object.keys(rawMetrics).forEach((metricKey) => {
      computedMetrics[metricKey] = {};
      Object.keys(rawMetrics[metricKey]).forEach((group) => {
        groupsSet.add(group);
        const stat = calculateCFR21(rawMetrics[metricKey][group]);
        if (stat) computedMetrics[metricKey][group] = stat;
      });
    });
    return { computedMetrics, groups: Array.from(groupsSet).sort() };
  }, [props, groupingStrategy, customGrouping]);

  const groupsToUse = useMemo(() => {
    if (metrics.groups.length > 0) return metrics.groups;
    const groupsSet = new Set<string>();
    allCellNames.forEach((name) => groupsSet.add(getGroupName(name, groupingStrategy, customGrouping)));
    return Array.from(groupsSet).sort();
  }, [metrics.groups, allCellNames, groupingStrategy, customGrouping]);

  const activeBaseGroup = baseGroup || (groupsToUse.length > 0 ? groupsToUse[0] : "");

  const metricDefs = [
    { key: "qc_1st", label: t("metric_qc_1st"), isPositiveGood: true },
    { key: "qd_1st", label: t("metric_qd_1st"), isPositiveGood: true },
    { key: "ce_1st", label: t("metric_ce_1st"), isPositiveGood: true },
    { key: "cal_retention", label: t("metric_cal_retention"), isPositiveGood: true },
    { key: "cal_recovery", label: t("metric_cal_recovery"), isPositiveGood: true },
    { key: "cal_ddcr_pct", label: t("metric_cal_ddcr_pct"), isPositiveGood: false },
    { key: "cal_cdcr_pct", label: t("metric_cal_cdcr_pct"), isPositiveGood: false },
    { key: "gas_volume", label: t("metric_gas_volume"), isPositiveGood: false },
    { key: "energy_eff", label: t("metric_energy_eff"), isPositiveGood: true },
    { key: "dcr_discharge", label: t("metric_dcr_discharge"), isPositiveGood: false },
    { key: "dcr_charge", label: t("metric_dcr_charge"), isPositiveGood: false },
    { key: "fc_time", label: t("metric_fc_time"), isPositiveGood: false },
    { key: "cycle_retention", label: t("metric_cycle_retention"), isPositiveGood: true },
    { key: "iron_ppm", label: t("metric_iron_ppm"), isPositiveGood: false },
  ].filter((def) => {
    const type = METRIC_TO_TYPE[def.key];
    return hasPermission("experiments:read") || hasPermission("data:read") || hasPermission(`data_${type}:read`);
  });

  if (groupsToUse.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm mb-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-gray-50">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-gray-500" />
            {t("data_aggregation_heatmap")}
          </h2>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-200 rounded-md shadow-sm w-full sm:w-auto">
            <label className="text-[10px] font-medium text-gray-500 whitespace-nowrap uppercase">
              {t("grouping")}:
            </label>
            <select
              className="text-xs border-none bg-transparent font-medium text-gray-900 focus:ring-0 cursor-pointer p-0 pr-4"
              value={groupingStrategy}
              onChange={(e) => {
                setGroupingStrategy(e.target.value as "prefix" | "custom");
                if (e.target.value === "custom") setIsGroupModalOpen(true);
              }}
            >
              <option value="prefix">By Prefix</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-200 rounded-md shadow-sm w-full sm:w-auto">
            <label className="text-[10px] font-medium text-gray-500 whitespace-nowrap uppercase">
              {t("base_group")}:
            </label>
            <select
              className="text-xs border-none bg-transparent font-medium text-[#1d74f5] focus:ring-0 cursor-pointer p-0 pr-4"
              value={activeBaseGroup}
              onChange={(e) => setBaseGroup(e.target.value)}
            >
              {groupsToUse.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="w-8"></th>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">
                {t("metric_name")}
              </th>
              <th className="px-6 py-3 text-center text-[10px] font-bold text-[#1d74f5] uppercase tracking-wider border-r border-gray-100 bg-[#f0f7ff]/50">
                {activeBaseGroup} ({t("baseline")})
              </th>
              {groupsToUse
                .filter((g) => g !== activeBaseGroup)
                .map((g) => (
                  <th
                    key={g}
                    className="px-6 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100"
                  >
                    {g} ({t("deviation")})
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {metricDefs.map((def) => {
              const baseStat = metrics.computedMetrics[def.key]?.[activeBaseGroup];
              const dataType = METRIC_TO_TYPE[def.key];
              const isRowLoading = props.loadedTypes ? !props.loadedTypes.includes(dataType) : false;
              const hasAnyData = Object.keys(metrics.computedMetrics[def.key] || {}).length > 0;

              if (!hasAnyData && !isRowLoading) return null;
              const isExpanded = expandedRows.has(def.key);

              return (
                <React.Fragment key={def.key}>
                  <tr
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => setExpandedRows((prev) => {
                      const next = new Set(prev);
                      if (next.has(def.key)) next.delete(def.key); else next.add(def.key);
                      return next;
                    })}
                  >
                    <td className="px-2 py-3 border-r border-gray-100 text-gray-400 text-center">
                      {isExpanded ? <ChevronDown className="w-4 h-4 mx-auto" /> : <ChevronRight className="w-4 h-4 mx-auto" />}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs font-medium text-gray-900 border-r border-gray-100">
                      {def.label}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-center text-[#1d74f5] font-mono font-semibold border-r border-gray-100 bg-[#f8fafc]">
                      {isRowLoading ? (
                        <div className="w-12 h-4 bg-gray-200 animate-pulse rounded mx-auto"></div>
                      ) : baseStat ? (
                        baseStat.finalMean.toFixed(2)
                      ) : (
                        "-"
                      )}
                    </td>
                    {groupsToUse
                      .filter((g) => g !== activeBaseGroup)
                      .map((g) => {
                        if (isRowLoading) {
                          return (
                            <td key={g} className="px-6 py-3 whitespace-nowrap text-xs text-center border-r border-gray-100 bg-gray-50">
                              <div className="w-12 h-4 bg-gray-100 animate-pulse rounded mx-auto"></div>
                            </td>
                          );
                        }
                        const targetStat = metrics.computedMetrics[def.key]?.[g];
                        if (!targetStat || !baseStat) {
                          return <td key={g} className="px-6 py-3 text-center text-gray-400 border-r border-gray-100">-</td>;
                        }
                        return <HeatmapCell key={g} value={calculateRelativeDeviation(targetStat.finalMean, baseStat.finalMean)} isPositiveGood={def.isPositiveGood} />;
                      })}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={groupsToUse.length + 2} className="p-0 border-b border-gray-200">
                        <ExpandedRowDetails
                          groups={groupsToUse}
                          computedMetrics={metrics.computedMetrics[def.key] || {}}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {t("custom_grouping")}
              </h3>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow bg-gray-50/50">
              <div className="space-y-3">
                {allCellNames.map((cellName) => (
                  <div
                    key={cellName}
                    className="flex items-center justify-between bg-white px-4 py-2 border border-gray-200 rounded"
                  >
                    <span className="text-[13px] font-mono font-medium text-gray-700">
                      {cellName}
                    </span>
                    <input
                      type="text"
                      className="text-[13px] border border-gray-300 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-[#1d74f5] focus:border-[#1d74f5]"
                      value={customGrouping[cellName] || ""}
                      onChange={(e) =>
                        setCustomGrouping((prev) => ({
                          ...prev,
                          [cellName]: e.target.value,
                        }))
                      }
                      placeholder="Group name"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white rounded-b-lg">
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1d74f5] rounded hover:bg-blue-600 transition-colors"
              >
                {t("apply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
