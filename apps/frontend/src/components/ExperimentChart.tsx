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
  Scatter,
  ErrorBar,
  ComposedChart,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY } from "../utils/recordTypes";

interface ExperimentChartProps {
  assayType: string;
  workflowStepName?: string;
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

function validNumber(v: any): number | null {
  if (v == null || v === '') return null;
  const parsed = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(parsed) ? parsed : null;
}

function useLegendToggle(keys: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setHidden((current) => new Set([...current].filter((key) => keys.includes(key))));
  }, [keys.join('|')]);
  const toggle = (key: string) => setHidden((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return { hidden, toggle };
}

function GroupLegend({ groups, groupMap, hidden, onToggle }: {
  groups: string[];
  groupMap: Map<string, string>;
  hidden: Set<string>;
  onToggle: (group: string) => void;
}) {
  return (
    <div className="mt-1 flex min-h-5 flex-wrap justify-center gap-x-3 gap-y-1">
      {groups.map((group) => (
        <button
          key={group}
          type="button"
          onClick={() => onToggle(group)}
          aria-pressed={!hidden.has(group)}
          className={`flex items-center gap-1 text-[11px] transition-opacity ${hidden.has(group) ? 'opacity-35' : 'opacity-100'}`}
        >
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: groupMap.get(group) }} />
          组 {group}
        </button>
      ))}
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <h4 className="mb-1 text-xs font-semibold text-gray-700">{title}</h4>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
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
  const capacityLegend = useLegendToggle(groups);
  const dcrLegend = useLegendToggle(groups);

  // Group by dayCount and groupName
  const { barData, lineData } = useMemo(() => {
    const daysSet = new Set<number>();
    const byDayGroup = new Map<string, { qRetentionSum: number; qRetentionCount: number; ddcrSum: number; ddcrCount: number }>();

    for (const r of data) {
      const day = r.dayCount;
      if (day == null) continue;
      daysSet.add(day);

      const g = getGroupName(r);
      const key = `${day}_${g}`;
      const curr = byDayGroup.get(key) || { qRetentionSum: 0, qRetentionCount: 0, ddcrSum: 0, ddcrCount: 0 };
      const retention = validNumber(r.qRetention);
      const ddcr = validNumber(r.ddcrGrowth);
      if (retention !== null) { curr.qRetentionSum += retention; curr.qRetentionCount += 1; }
      if (ddcr !== null) { curr.ddcrSum += ddcr; curr.ddcrCount += 1; }
      byDayGroup.set(key, curr);
    }

    const sortedDays = Array.from(daysSet).sort((a, b) => a - b);

    const barData = sortedDays.map((day) => {
      const point: any = { dayCount: `${day}天` };
      for (const g of groups) {
        const item = byDayGroup.get(`${day}_${g}`);
        point[`${g}_retention`] = item?.qRetentionCount ? item.qRetentionSum / item.qRetentionCount : null;
      }
      return point;
    });

    const lineData = sortedDays.map((day) => {
      const point: any = { dayCount: `${day}天` };
      for (const g of groups) {
        const item = byDayGroup.get(`${day}_${g}`);
        point[g] = item?.ddcrCount ? item.ddcrSum / item.ddcrCount : null;
      }
      return point;
    });

    return { barData, lineData };
  }, [data, groups]);

  if (barData.length === 0) return <EmptyChart />;

  return (
    <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
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
              {groups.map((g) => (
                <Bar key={g} hide={capacityLegend.hidden.has(g)} dataKey={`${g}_retention`} name={`组 ${g}`} fill={groupMap.get(g)} radius={[3, 3, 0, 0]} maxBarSize={30} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <GroupLegend groups={groups} groupMap={groupMap} hidden={capacityLegend.hidden} onToggle={capacityLegend.toggle} />
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
              {groups.map((g) => (
                <Line
                  key={g}
                  hide={dcrLegend.hidden.has(g)}
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
        <GroupLegend groups={groups} groupMap={groupMap} hidden={dcrLegend.hidden} onToggle={dcrLegend.toggle} />
      </div>
    </div>
  );
}

/* ── 3. 存储胀气：产气变化图 (折线图) ────────────────────────── */

function StorageSwellingChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);
  const vgLegend = useLegendToggle(groups);
  const volumeLegend = useLegendToggle(groups);

  const lineData = useMemo(() => {
    const daysSet = new Set<number>();
    const byDayGroup = new Map<string, { vgSum: number; vgCount: number; volumeSum: number; volumeCount: number }>();

    for (const r of data) {
      const day = r.dayCount;
      if (day == null) continue;
      daysSet.add(day);

      const g = getGroupName(r);
      const key = `${day}_${g}`;
      const curr = byDayGroup.get(key) || { vgSum: 0, vgCount: 0, volumeSum: 0, volumeCount: 0 };
      const vg = validNumber(r.vg);
      const volume = validNumber(r.v);
      if (vg !== null) { curr.vgSum += vg; curr.vgCount += 1; }
      if (volume !== null) { curr.volumeSum += volume; curr.volumeCount += 1; }
      byDayGroup.set(key, curr);
    }

    const sortedDays = Array.from(daysSet).sort((a, b) => a - b);
    return sortedDays.map((day) => {
      const point: any = { dayCount: `${day}天` };
      for (const g of groups) {
        const item = byDayGroup.get(`${day}_${g}`);
        point[`${g}_vg`] = item?.vgCount ? item.vgSum / item.vgCount : null;
        point[`${g}_volume`] = item?.volumeCount ? item.volumeSum / item.volumeCount : null;
      }
      return point;
    });
  }, [data, groups]);

  if (lineData.length === 0) return <EmptyChart />;

  const renderLines = (suffix: 'vg' | 'volume', legend: ReturnType<typeof useLegendToggle>) => (
    <>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any) => [`${n(value).toFixed(3)}${suffix === 'vg' ? ' mL/Ah' : ' mL'}`, '']} />
          {groups.map((g) => <Line key={g} hide={legend.hidden.has(g)} type="monotone" dataKey={`${g}_${suffix}`} name={`组 ${g}`} stroke={groupMap.get(g)} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
        </LineChart>
      </ResponsiveContainer>
      <GroupLegend groups={groups} groupMap={groupMap} hidden={legend.hidden} onToggle={legend.toggle} />
    </>
  );

  return <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
    <ChartPanel title="归一化产气量趋势">{renderLines('vg', vgLegend)}</ChartPanel>
    <ChartPanel title="电池体积趋势">{renderLines('volume', volumeLegend)}</ChartPanel>
  </div>;
}

const PROCESS_STEP_CHARTS: Record<string, Array<{ title: string; unit: string; metrics: Array<{ field: string; label: string }> }>> = {
  drying_injection: [
    { title: '注液与失液量对比', unit: 'g', metrics: [{ field: 'mIn', label: '注液量' }, { field: 'mLoss', label: '失液量' }] },
    { title: '注液阶段质量对比', unit: 'g', metrics: [{ field: 'm0', label: '注液前' }, { field: 'm1', label: '预充后' }, { field: 'm2', label: '二封后' }] },
  ],
  formation: [
    { title: '化成容量对比', unit: 'Ah', metrics: [{ field: 'fq1', label: '充电容量' }, { field: 'fq2', label: '放电容量' }, { field: 'fq', label: '总容量' }] },
    { title: '化成与老化电压对比', unit: 'V', metrics: [{ field: 'fu0', label: '化成前' }, { field: 'fu1', label: '老化前' }, { field: 'fu2', label: '老化后' }] },
  ],
  second_sealing: [
    { title: '二封前后质量对比', unit: 'g', metrics: [{ field: 'm3', label: '二封前' }, { field: 'm4', label: '二封后' }] },
    { title: '保液量对比', unit: 'g', metrics: [{ field: 'mHold', label: '保液量' }] },
  ],
  capacity_grading: [
    { title: '定容充放电容量对比', unit: 'Ah', metrics: [{ field: 'gqc1', label: '首次充电' }, { field: 'gqd1', label: '首次放电' }, { field: 'gqc2', label: '二次充电' }] },
    { title: '首圈库仑效率', unit: '%', metrics: [{ field: 'ceFirst', label: '首圈效率' }] },
  ],
};

function ProcessStepCharts({ data, stepName }: { data: any[]; stepName: string }) {
  const specs = PROCESS_STEP_CHARTS[stepName];
  const { groupMap, groups } = useGroupColorMap(data);
  const firstLegend = useLegendToggle(groups);
  const secondLegend = useLegendToggle(groups);
  const charts = useMemo(() => specs.map((spec) => spec.metrics.map((metric) => {
    const point: any = { metric: metric.label };
    groups.forEach((group) => {
      const values = data.filter((row) => getGroupName(row) === group).map((row) => validNumber(row[metric.field])).filter((value): value is number => value !== null);
      point[group] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });
    return point;
  })), [data, groups, specs]);
  const legends = [firstLegend, secondLegend];
  return <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
    {specs.map((spec, index) => {
      const legend = legends[index];
      return <ChartPanel key={spec.title} title={spec.title}>
        <ResponsiveContainer width="100%" height="90%"><BarChart data={charts[index]} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid {...GRID_STYLE} /><XAxis dataKey="metric" axisLine={false} tickLine={false} tick={AXIS_STYLE} /><YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} domain={[0, 'auto']} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any) => [`${n(value).toFixed(3)} ${spec.unit}`, '']} />
          {groups.map((group) => <Bar key={group} hide={legend.hidden.has(group)} dataKey={group} name={`组 ${group}`} fill={groupMap.get(group)} radius={[3, 3, 0, 0]} maxBarSize={34} />)}
        </BarChart></ResponsiveContainer>
        <GroupLegend groups={groups} groupMap={groupMap} hidden={legend.hidden} onToggle={legend.toggle} />
      </ChartPanel>;
    })}
  </div>;
}

/* ── 4. 4CDCR：DCR图 (柱形图) ──────────────────────────────── */

function DcrGroupChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);
  const dcrLegend = useLegendToggle(groups);
  const rcLegend = useLegendToggle(groups);

  const chartData = useMemo(() => {
    type Metric = 'ddcr' | 'cdcr' | 'dRc' | 'cRc';
    const sums = new Map<string, Record<Metric, { sum: number; count: number }>>();
    for (const d of data) {
      const g = getGroupName(d);
      const curr = sums.get(g) || { ddcr: { sum: 0, count: 0 }, cdcr: { sum: 0, count: 0 }, dRc: { sum: 0, count: 0 }, cRc: { sum: 0, count: 0 } };
      const values: Record<Metric, number | null> = { ddcr: validNumber(d.ddcr), cdcr: validNumber(d.cdcr), dRc: validNumber(d.dRcProduct), cRc: validNumber(d.cRcProduct) };
      (Object.keys(values) as Metric[]).forEach((field) => { const value = values[field]; if (value !== null) { curr[field].sum += value; curr[field].count += 1; } });
      sums.set(g, curr);
    }
    const build = (labels: Array<[string, 'ddcr' | 'cdcr' | 'dRc' | 'cRc']>) => labels.map(([metric, field]) => {
      const point: any = { metric };
      groups.forEach((g) => { const metric = sums.get(g)?.[field]; point[g] = metric?.count ? metric.sum / metric.count : null; });
      return point;
    });
    return { dcr: build([['放电 DCR', 'ddcr'], ['充电 DCR', 'cdcr']]), rc: build([['放电 R-C', 'dRc'], ['充电 R-C', 'cRc']]) };
  }, [data, groups]);

  if (!groups.length) return <EmptyChart />;

  const renderBars = (rows: any[], unit: string, legend: ReturnType<typeof useLegendToggle>) => <>
    <ResponsiveContainer width="100%" height="90%"><BarChart data={rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid {...GRID_STYLE} /><XAxis dataKey="metric" axisLine={false} tickLine={false} tick={AXIS_STYLE} /><YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(4)} ${unit}`, '']} />
      {groups.map((g) => <Bar key={g} hide={legend.hidden.has(g)} dataKey={g} name={`组 ${g}`} fill={groupMap.get(g)} radius={[3, 3, 0, 0]} maxBarSize={32} />)}
    </BarChart></ResponsiveContainer>
    <GroupLegend groups={groups} groupMap={groupMap} hidden={legend.hidden} onToggle={legend.toggle} />
  </>;
  return <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
    <ChartPanel title="充放电 DCR 对比">{renderBars(chartData.dcr, 'Ω', dcrLegend)}</ChartPanel>
    <ChartPanel title="充放电 R-C 乘积对比">{renderBars(chartData.rc, 'Ah·Ω', rcLegend)}</ChartPanel>
  </div>;
}

/* ── 5. 能效：能效图 (柱形图) ──────────────────────────────── */

function EfficiencyGroupChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);
  const efficiencyLegend = useLegendToggle(groups);
  const energyLegend = useLegendToggle(groups);

  const chartData = useMemo(() => {
    type Metric = 'ee' | 'de' | 'ce';
    const sums = new Map<string, Record<Metric, { sum: number; count: number }>>();
    for (const d of data) {
      const g = getGroupName(d);
      const curr = sums.get(g) || { ee: { sum: 0, count: 0 }, de: { sum: 0, count: 0 }, ce: { sum: 0, count: 0 } };
      const de = validNumber(d.de); const ce = validNumber(d.ce); const storedEe = validNumber(d.ee);
      const values: Record<Metric, number | null> = { ee: storedEe ?? (de !== null && ce ? de / ce : null), de, ce };
      (Object.keys(values) as Metric[]).forEach((field) => { const value = values[field]; if (value !== null) { curr[field].sum += value; curr[field].count += 1; } });
      sums.set(g, curr);
    }
    const efficiency: any = { metric: '能量效率' };
    const energy = [{ metric: '放电能量' } as any, { metric: '充电能量' } as any];
    groups.forEach((g) => { const item = sums.get(g); efficiency[g] = item?.ee.count ? item.ee.sum / item.ee.count * 100 : null; energy[0][g] = item?.de.count ? item.de.sum / item.de.count : null; energy[1][g] = item?.ce.count ? item.ce.sum / item.ce.count : null; });
    return { efficiency: [efficiency], energy };
  }, [data, groups]);

  if (!groups.length) return <EmptyChart />;

  const renderBars = (rows: any[], unit: string, legend: ReturnType<typeof useLegendToggle>) => <>
    <ResponsiveContainer width="100%" height="90%"><BarChart data={rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid {...GRID_STYLE} /><XAxis dataKey="metric" axisLine={false} tickLine={false} tick={AXIS_STYLE} /><YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} domain={[0, 'auto']} />
      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(2)}${unit}`, '']} />
      {groups.map((g) => <Bar key={g} hide={legend.hidden.has(g)} dataKey={g} name={`组 ${g}`} fill={groupMap.get(g)} radius={[3, 3, 0, 0]} maxBarSize={34} />)}
    </BarChart></ResponsiveContainer>
    <GroupLegend groups={groups} groupMap={groupMap} hidden={legend.hidden} onToggle={legend.toggle} />
  </>;
  return <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
    <ChartPanel title="平均能量效率">{renderBars(chartData.efficiency, '%', efficiencyLegend)}</ChartPanel>
    <ChartPanel title="充放电能量对比">{renderBars(chartData.energy, ' Wh', energyLegend)}</ChartPanel>
  </div>;
}

/* ── 6. 高温循环：循环图 (带平滑线的散点/折线图) ────────────────── */

function HtCycleGroupChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);
  const retentionLegend = useLegendToggle(groups);
  const capacityLegend = useLegendToggle(groups);

  // Group by cycle and groupName
  const chartData = useMemo(() => {
    const cycleSet = new Set<number>();
    const byCycleGroup = new Map<string, { retSum: number; retCount: number; capacitySum: number; capacityCount: number }>();

    for (const r of data) {
      const cycle = r.cycle;
      if (cycle == null) continue;
      cycleSet.add(cycle);

      const g = getGroupName(r);
      const key = `${cycle}_${g}`;
      const curr = byCycleGroup.get(key) || { retSum: 0, retCount: 0, capacitySum: 0, capacityCount: 0 };
      const retention = validNumber(r.capacityRetention);
      const capacity = validNumber(r.dischargeCapacity);
      if (retention !== null) { curr.retSum += retention; curr.retCount += 1; }
      if (capacity !== null) { curr.capacitySum += capacity; curr.capacityCount += 1; }
      byCycleGroup.set(key, curr);
    }

    const sortedCycles = Array.from(cycleSet).sort((a, b) => a - b);
    return sortedCycles.map((cycle) => {
      const point: any = { cycle };
      for (const g of groups) {
        const item = byCycleGroup.get(`${cycle}_${g}`);
        point[`${g}_retention`] = item?.retCount ? item.retSum / item.retCount : null;
        point[`${g}_capacity`] = item?.capacityCount ? item.capacitySum / item.capacityCount : null;
      }
      return point;
    });
  }, [data, groups]);

  if (chartData.length === 0) return <EmptyChart />;

  const renderLines = (suffix: 'retention' | 'capacity', unit: string, legend: ReturnType<typeof useLegendToggle>) => <>
    <ResponsiveContainer width="100%" height="90%"><LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid {...GRID_STYLE} /><XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={8} /><YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} domain={['auto', 'auto']} />
      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(3)}${unit}`, '']} />
      {groups.map((g) => <Line key={g} hide={legend.hidden.has(g)} type="monotone" dataKey={`${g}_${suffix}`} name={`组 ${g}`} stroke={groupMap.get(g)} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
    </LineChart></ResponsiveContainer>
    <GroupLegend groups={groups} groupMap={groupMap} hidden={legend.hidden} onToggle={legend.toggle} />
  </>;
  return <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
    <ChartPanel title="容量保持率趋势">{renderLines('retention', '%', retentionLegend)}</ChartPanel>
    <ChartPanel title="放电容量趋势">{renderLines('capacity', ' Ah', capacityLegend)}</ChartPanel>
  </div>;
}

/* ── 快充时间默认图表 ────────────────────────────────────────── */

function FastChargeChart({ data }: { data: any[] }) {
  const { groupMap, groups } = useGroupColorMap(data);
  const timeLegend = useLegendToggle(groups);
  const socLegend = useLegendToggle(groups);
  const { timeData, socData } = useMemo(() => {
    const time: any = { metric: '10%–80% SOC' };
    const timeSums = new Map<string, { sum: number; count: number }>();
    const stepSums = new Map<string, { sum: number; count: number }>();
    const stepSet = new Set<number>();
    data.forEach((row) => {
      const g = getGroupName(row);
      const t = validNumber(row.computedFastChargeTime ?? row.providedFastChargeTime);
      const ts = timeSums.get(g) || { sum: 0, count: 0 }; if (t !== null && t > 0) { ts.sum += t; ts.count += 1; } timeSums.set(g, ts);
      (row.steps || []).forEach((step: any) => { const no = Number(step.stepNo); const soc = validNumber(step.cumulativeSoc); if (!Number.isFinite(no) || soc === null) return; stepSet.add(no); const key = `${no}_${g}`; const s = stepSums.get(key) || { sum: 0, count: 0 }; s.sum += soc * 100; s.count += 1; stepSums.set(key, s); });
    });
    groups.forEach((g) => { const item = timeSums.get(g); time[g] = item?.count ? item.sum / item.count : null; });
    const soc = [...stepSet].sort((a, b) => a - b).map((stepNo) => { const point: any = { stepNo }; groups.forEach((g) => { const item = stepSums.get(`${stepNo}_${g}`); point[g] = item?.count ? item.sum / item.count : null; }); return point; });
    return { timeData: [time], socData: soc };
  }, [data, groups]);
  return <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
    <ChartPanel title="平均快充时间"><ResponsiveContainer width="100%" height="90%"><BarChart data={timeData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}><CartesianGrid {...GRID_STYLE} /><XAxis dataKey="metric" axisLine={false} tickLine={false} tick={AXIS_STYLE} /><YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(2)} min`, '']} />{groups.map((g) => <Bar key={g} hide={timeLegend.hidden.has(g)} dataKey={g} fill={groupMap.get(g)} name={`组 ${g}`} radius={[3, 3, 0, 0]} maxBarSize={34} />)}</BarChart></ResponsiveContainer><GroupLegend groups={groups} groupMap={groupMap} hidden={timeLegend.hidden} onToggle={timeLegend.toggle} /></ChartPanel>
    <ChartPanel title="累计 SOC 工步曲线"><ResponsiveContainer width="100%" height="90%"><LineChart data={socData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}><CartesianGrid {...GRID_STYLE} /><XAxis dataKey="stepNo" axisLine={false} tickLine={false} tick={AXIS_STYLE} /><YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${n(v).toFixed(2)}%`, '']} />{groups.map((g) => <Line key={g} hide={socLegend.hidden.has(g)} type="monotone" dataKey={g} name={`组 ${g}`} stroke={groupMap.get(g)} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}</LineChart></ResponsiveContainer><GroupLegend groups={groups} groupMap={groupMap} hidden={socLegend.hidden} onToggle={socLegend.toggle} /></ChartPanel>
  </div>;
}

/* ── Main Component ──────────────────────────────────────────── */

export function ExperimentChart({ assayType, workflowStepName, experimentId, projectId, title, staticData }: ExperimentChartProps) {
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
    // Exclude scrapped batteries (电池报废) from charts
    const visible = data.filter((r: any) => !r.scrapped);
    if (!visible.length) return <EmptyChart />;
    switch (assayType) {
      case 'ProcessData': return workflowStepName && PROCESS_STEP_CHARTS[workflowStepName]
        ? <ProcessStepCharts data={visible} stepName={workflowStepName} />
        : <ProcessBoxPlotChart data={visible} />;
      case 'CalendarLife': return <CalendarLifeCharts data={visible} />;
      case 'StorageSwelling': return <StorageSwellingChart data={visible} />;
      case 'EnergyEfficiency': return <EfficiencyGroupChart data={visible} />;
      case 'DcrTest': return <DcrGroupChart data={visible} />;
      case 'FastCharge': return <FastChargeChart data={visible} />;
      case 'HtCycle': return <HtCycleGroupChart data={visible} />;
      default: return <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">暂无合适图表</div>;
    }
  };

  const { t } = useTranslation();
  const displayName = title || t(RECORD_TYPE_TO_I18N_KEY[assayType] || assayType);
  const hasTwoCharts = ['CalendarLife', 'StorageSwelling', 'EnergyEfficiency', 'DcrTest', 'FastCharge', 'HtCycle'].includes(assayType)
    || (assayType === 'ProcessData' && !!workflowStepName && !!PROCESS_STEP_CHARTS[workflowStepName]);

  return (
    <div className={`bg-white rounded-xl p-5 w-full border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] mb-5 ${hasTwoCharts ? 'h-[36rem] md:h-80' : 'h-80'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-action rounded-full"></span>
          {displayName} - 数据对比图
        </h3>
      </div>
      <div className={`w-full ${hasTwoCharts ? 'h-[31rem] md:h-60' : 'h-60'}`}>{renderChart()}</div>
    </div>
  );
}


