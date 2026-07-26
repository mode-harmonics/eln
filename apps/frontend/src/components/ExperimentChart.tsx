import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Scatter,
  ErrorBar,
  ComposedChart,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY } from "../utils/recordTypes";

interface ExperimentChartProps {
  assayType: string;
  experimentId?: string;
  projectId?: string;
  title?: string;
  staticData?: any[];
}

const TYPE_MAP = RECORD_TYPE_TO_API_TYPE;

/* ── Palette & Helpers ────────────────────────────────────────── */

const PALETTE = [
  '#1d74f5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
];

function n(v: any): number {
  if (v == null || v === '') return 0;
  const parsed = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(parsed) ? 0 : parsed;
}

/** Group name extraction logic: prefers groupName if present, else fallback to letter prefix of cellName/cellId */
function getGroupName(item: any): string {
  if (item.groupName) return String(item.groupName);
  const name = item.cellId || item.cellName || '';
  const m = String(name).match(/^([A-Za-z]+)/);
  return m ? m[1] : (String(name) || 'Default');
}

/** Build group -> color dictionary */
function useGroupColorMap(data: any[]): { groupMap: Map<string, string>; groups: string[] } {
  return useMemo(() => {
    const set = new Set<string>();
    for (const item of data) {
      set.add(getGroupName(item));
    }
    const groups = Array.from(set).sort();
    const groupMap = new Map<string, string>();
    groups.forEach((g, idx) => {
      groupMap.set(g, PALETTE[idx % PALETTE.length]);
    });
    return { groupMap, groups };
  }, [data]);
}

/** Quartile and mean calculation for Box Plot */
function calculateBoxStats(values: number[]) {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0, mean: 0, count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  const quant = (q: number) => {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = quant(0.25);
  const median = quant(0.5);
  const q3 = quant(0.75);

  return { min, q1, median, q3, max, mean, count: sorted.length };
}

/* ── Chart Styles ───────────────────────────────────────────── */

const AXIS_STYLE = { fontSize: 12, fill: '#6b7280' };
const GRID_STYLE = { strokeDasharray: '3 3', vertical: false, stroke: '#e5e7eb' };
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: '8px',
  border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  backgroundColor: '#ffffff',
  fontSize: '12px',
};

function EmptyChart() {
  const { t } = useTranslation();
  return <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">{t("no_data")}</div>;
}

/* ── 1. 制程数据：首次放电容量 (qdFirst) 箱形图 ──────────────── */

function ProcessBoxPlotChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);

  const chartData = useMemo(() => {
    const groupedValues = new Map<string, number[]>();
    for (const d of data) {
      const g = getGroupName(d);
      const val = n(d.qdFirst || d.gqd1);
      if (val > 0) {
        if (!groupedValues.has(g)) groupedValues.set(g, []);
        groupedValues.get(g)!.push(val);
      }
    }

    return groups.map((g) => {
      const vals = groupedValues.get(g) || [];
      const stats = calculateBoxStats(vals);
      // Recharts bar range: [Q1, Q3]. Whisker error bars: min to max
      return {
        group: g,
        color: groupMap.get(g) || PALETTE[0],
        boxRange: [stats.q1, stats.q3],
        q1: stats.q1,
        q3: stats.q3,
        median: stats.median,
        mean: stats.mean,
        min: stats.min,
        max: stats.max,
        // Error range relative to box boundaries
        whiskerLow: stats.q1 - stats.min,
        whiskerHigh: stats.max - stats.q3,
        count: stats.count,
      };
    }).filter(d => d.count > 0);
  }, [data, groups, groupMap]);

  if (chartData.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="group" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(_val: any, _name: any, item: any) => {
            const p = item.payload;
            return [
              `均值: ${p.mean.toFixed(3)} | 中位数: ${p.median.toFixed(3)} | 范围: [${p.min.toFixed(3)}, ${p.max.toFixed(3)}] (N=${p.count})`,
              '首次放电容量 (qdFirst)'
            ];
          }}
        />
        {/* IQR Box with Whiskers */}
        <Bar dataKey="boxRange" maxBarSize={32} radius={[2, 2, 2, 2]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} fillOpacity={0.6} stroke={entry.color} strokeWidth={1.5} />
          ))}
          <ErrorBar
            dataKey="whiskerLow"
            direction="y"
            width={10}
            strokeWidth={1.5}
            stroke="#374151"
          />
        </Bar>
        {/* Mean points */}
        <Scatter dataKey="mean" fill="#111827" shape="cross" name="Mean" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ── 2. 日历寿命：容量保持/恢复 (柱形图) & DCR增长 (折线图) ───── */

function CalendarLifeCharts({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);

  // Group by dayCount and groupName
  const { barData, lineData } = useMemo(() => {
    const daysSet = new Set<number>();
    const byDayGroup = new Map<string, { qRetentionSum: number; qRecoverySum: number; ddcrSum: number; count: number }>();

    for (const r of data) {
      const day = r.dayCount;
      if (day == null) continue;
      daysSet.add(day);

      const g = getGroupName(r);
      const key = `${day}_${g}`;
      const curr = byDayGroup.get(key) || { qRetentionSum: 0, qRecoverySum: 0, ddcrSum: 0, count: 0 };

      curr.qRetentionSum += n(r.qRetention);
      curr.qRecoverySum += n(r.qRecovery);
      curr.ddcrSum += n(r.ddcrGrowth);
      curr.count += 1;
      byDayGroup.set(key, curr);
    }

    const sortedDays = Array.from(daysSet).sort((a, b) => a - b);

    const barData = sortedDays.map((day) => {
      const point: any = { dayCount: `${day}天` };
      for (const g of groups) {
        const item = byDayGroup.get(`${day}_${g}`);
        point[`${g}_retention`] = item && item.count ? item.qRetentionSum / item.count : 0;
      }
      return point;
    });

    const lineData = sortedDays.map((day) => {
      const point: any = { dayCount: `${day}天` };
      for (const g of groups) {
        const item = byDayGroup.get(`${day}_${g}`);
        point[g] = item && item.count ? item.ddcrSum / item.count : null;
      }
      return point;
    });

    return { barData, lineData };
  }, [data, groups]);

  if (barData.length === 0) return <EmptyChart />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      {/* 容量保持率柱形图 */}
      <div className="h-full flex flex-col">
        <h4 className="text-xs font-semibold text-gray-700 mb-1">容量保持率对比 (柱形图)</h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={5} />
              <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} domain={[0, 'auto']} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(2)}%`, '容量保持率']} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {groups.map((g) => (
                <Bar key={g} dataKey={`${g}_retention`} name={`组 ${g}`} fill={groupMap.get(g)} radius={[3, 3, 0, 0]} maxBarSize={30} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DCR 增长率折线图 */}
      <div className="h-full flex flex-col">
        <h4 className="text-xs font-semibold text-gray-700 mb-1">DCR 增长趋势 (折线图)</h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={5} />
              <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} domain={['auto', 'auto']} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(2)}%`, 'DCR增长率']} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {groups.map((g) => (
                <Line
                  key={g}
                  type="monotone"
                  dataKey={g}
                  name={`组 ${g}`}
                  stroke={groupMap.get(g)}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ── 3. 存储胀气：产气变化图 (折线图) ────────────────────────── */

function StorageSwellingChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);

  const lineData = useMemo(() => {
    const daysSet = new Set<number>();
    const byDayGroup = new Map<string, { vgSum: number; count: number }>();

    for (const r of data) {
      const day = r.dayCount;
      if (day == null) continue;
      daysSet.add(day);

      const g = getGroupName(r);
      const key = `${day}_${g}`;
      const curr = byDayGroup.get(key) || { vgSum: 0, count: 0 };
      curr.vgSum += n(r.vg);
      curr.count += 1;
      byDayGroup.set(key, curr);
    }

    const sortedDays = Array.from(daysSet).sort((a, b) => a - b);
    return sortedDays.map((day) => {
      const point: any = { dayCount: `${day}天` };
      for (const g of groups) {
        const item = byDayGroup.get(`${day}_${g}`);
        point[g] = item && item.count ? item.vgSum / item.count : null;
      }
      return point;
    });
  }, [data, groups]);

  if (lineData.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={lineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: any) => [`${n(value).toFixed(3)} mL/Ah`, `组 ${name}`]} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {groups.map((g) => (
          <Line
            key={g}
            type="monotone"
            dataKey={g}
            name={`组 ${g}`}
            stroke={groupMap.get(g)}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── 4. 4CDCR：DCR图 (柱形图) ──────────────────────────────── */

function DcrGroupChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);

  const chartData = useMemo(() => {
    const groupSums = new Map<string, { ddcrSum: number; cdcrSum: number; count: number }>();
    for (const d of data) {
      const g = getGroupName(d);
      const curr = groupSums.get(g) || { ddcrSum: 0, cdcrSum: 0, count: 0 };
      curr.ddcrSum += n(d.ddcr);
      curr.cdcrSum += n(d.cdcr);
      curr.count += 1;
      groupSums.set(g, curr);
    }

    return groups.map((g) => {
      const item = groupSums.get(g) || { ddcrSum: 0, cdcrSum: 0, count: 0 };
      return {
        group: g,
        ddcrAvg: item.count ? item.ddcrSum / item.count : 0,
        cdcrAvg: item.count ? item.cdcrSum / item.count : 0,
        color: groupMap.get(g) || PALETTE[0],
      };
    });
  }, [data, groups, groupMap]);

  if (chartData.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="group" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(4)} Ω`, '']} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="ddcrAvg" name="放电 DCR (平均)" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Bar>
        <Bar dataKey="cdcrAvg" name="充电 DCR (平均)" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} fillOpacity={0.6} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 5. 能效：能效图 (柱形图) ──────────────────────────────── */

function EfficiencyGroupChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);

  const chartData = useMemo(() => {
    const groupSums = new Map<string, { eeSum: number; count: number }>();
    for (const d of data) {
      const g = getGroupName(d);
      const curr = groupSums.get(g) || { eeSum: 0, count: 0 };
      curr.eeSum += n(d.ee || (n(d.de) && n(d.ce) ? n(d.de) / n(d.ce) : 0));
      curr.count += 1;
      groupSums.set(g, curr);
    }

    return groups.map((g) => {
      const item = groupSums.get(g) || { eeSum: 0, count: 0 };
      return {
        group: g,
        eeAvg: item.count ? item.eeSum / item.count : 0,
        color: groupMap.get(g) || PALETTE[0],
      };
    });
  }, [data, groups, groupMap]);

  if (chartData.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="group" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} domain={[0, 'auto']} />
        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${(n(v) * 100).toFixed(2)}%`, '平均能效比 (ee)']} />
        <Bar dataKey="eeAvg" name="能量效率比" radius={[4, 4, 0, 0]} maxBarSize={45}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 6. 高温循环：循环图 (带平滑线的散点/折线图) ────────────────── */

function HtCycleGroupChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);

  // Group by cycle and groupName
  const chartData = useMemo(() => {
    const cycleSet = new Set<number>();
    const byCycleGroup = new Map<string, { retSum: number; count: number }>();

    for (const r of data) {
      const cycle = r.cycle;
      if (cycle == null) continue;
      cycleSet.add(cycle);

      const g = getGroupName(r);
      const key = `${cycle}_${g}`;
      const curr = byCycleGroup.get(key) || { retSum: 0, count: 0 };
      curr.retSum += n(r.capacityRetention);
      curr.count += 1;
      byCycleGroup.set(key, curr);
    }

    const sortedCycles = Array.from(cycleSet).sort((a, b) => a - b);
    return sortedCycles.map((cycle) => {
      const point: any = { cycle };
      for (const g of groups) {
        const item = byCycleGroup.get(`${cycle}_${g}`);
        point[g] = item && item.count ? item.retSum / item.count : null;
      }
      return point;
    });
  }, [data, groups]);

  if (chartData.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} name="循环圈数" />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} domain={['auto', 'auto']} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: any) => [`${n(v).toFixed(2)}%`, `组 ${name}`]} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {groups.map((g) => (
          <Line
            key={g}
            type="monotone"
            dataKey={g}
            name={`组 ${g}`}
            stroke={groupMap.get(g)}
            strokeWidth={2}
            dot={{ r: 3.5, strokeWidth: 1 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── 快充时间默认图表 ────────────────────────────────────────── */

function FastChargeChart({ data }: { data: any[] }) {
  const { groupMap } = useGroupColorMap(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="cellName" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="computedFastChargeTime" radius={[4, 4, 0, 0]} maxBarSize={40} name="10%-80% SOC (min)">
          {data.map((entry, idx) => (
            <Cell key={idx} fill={groupMap.get(getGroupName(entry)) || PALETTE[idx % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

export function ExperimentChart({ assayType, experimentId, projectId, title, staticData }: ExperimentChartProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (staticData) {
      setData(staticData);
      return;
    }
    const type = TYPE_MAP[assayType];
    setData([]);
    if (!type || (!experimentId && !projectId)) return;
    let active = true;
    const url = experimentId
      ? `/api/v1/data/${type}/${experimentId}`
      : `/api/v1/data/project/${type}/${projectId}`;

    api.get<any>(url)
      .then((res) => {
        if (!active) return;
        if (res && res.rows) { setData(res.rows); }
        else { setData(Array.isArray(res) ? res : []); }
      })
      .catch(() => { if (active) setData([]); });
    return () => { active = false; };
  }, [assayType, experimentId, projectId, staticData]);

  const renderChart = () => {
    if (!data.length) return <EmptyChart />;
    switch (assayType) {
      case 'ProcessData': return <ProcessBoxPlotChart data={data} />;
      case 'CalendarLife': return <CalendarLifeCharts data={data} />;
      case 'StorageSwelling': return <StorageSwellingChart data={data} />;
      case 'EnergyEfficiency': return <EfficiencyGroupChart data={data} />;
      case 'DcrTest': return <DcrGroupChart data={data} />;
      case 'FastCharge': return <FastChargeChart data={data} />;
      case 'HtCycle': return <HtCycleGroupChart data={data} />;
      default: return <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">暂无合适图表</div>;
    }
  };

  const { t } = useTranslation();
  const displayName = title || t(RECORD_TYPE_TO_I18N_KEY[assayType] || assayType);

  return (
    <div className="bg-white rounded-xl p-5 h-80 w-full border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-action rounded-full"></span>
          {displayName} - 数据对比图
        </h3>
      </div>
      <div className="h-60 w-full">{renderChart()}</div>
    </div>
  );
}


