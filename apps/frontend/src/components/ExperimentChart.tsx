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
  LegendProps,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { getGroupColor, UNGROUPED_COLOR } from '../utils/chartColors';

interface GroupAssignment {
  groupId: string;
  groupName: string;
  color: string;
}

interface ExperimentChartProps {
  assayType: string;
  experimentId?: string;
  projectId?: string;
  title?: string;
  groupMap?: Record<string, GroupAssignment>;
}

import { RECORD_TYPE_TO_API_TYPE, RECORD_TYPE_TO_I18N_KEY } from "../utils/recordTypes";

const TYPE_MAP = RECORD_TYPE_TO_API_TYPE;

/* ── helpers ───────────────────────────────────────────── */

function cellKey(row: any, assayType: string): string {
  return assayType === 'ProcessData' ? row.cellId : row.cellName;
}

function cellColor(cellId: string, groupMap?: Record<string, GroupAssignment>): string {
  if (!groupMap) return '#1d74f5';
  return groupMap[cellId]?.color ?? UNGROUPED_COLOR;
}

function cellGroupName(cellId: string, groupMap?: Record<string, GroupAssignment>): string {
  if (!groupMap) return '';
  return groupMap[cellId]?.groupName ?? '';
}

/** Format decimal strings / nulls to number */
function n(v: any): number {
  if (v == null || v === '') return 0;
  const parsed = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(parsed) ? 0 : parsed;
}

/** Pivot CalendarLife rows → { dayCount, cellA: qRetention, cellB: qRetention, ... } */
function pivotCalendarLife(data: any[], metric: string): any[] {
  const cells = [...new Set(data.map((r) => r.cellName))];
  const days = [...new Set(data.map((r) => r.dayCount))].sort((a, b) => a - b);
  const map = new Map<string, any>();
  for (const r of data) {
    map.set(`${r.dayCount}_${r.cellName}`, r);
  }
  return days.map((day) => {
    const point: any = { dayCount: day };
    for (const cell of cells) {
      const row = map.get(`${day}_${cell}`);
      point[cell] = row ? n(row[metric]) : null;
    }
    return point;
  });
}

/** Pivot StorageSwelling rows → { dayCount, cellA: vg, cellB: vg, ... } */
function pivotSwelling(data: any[], metric: string): any[] {
  return pivotCalendarLife(data, metric);
}

/** Pivot HtCycle rows → { cycle, cellA: capacityRetention, cellB: capacityRetention, ... } */
function pivotHtCycle(data: any[], metric: string): any[] {
  const cells = [...new Set(data.map((r) => r.cellName))];
  const cycles = [...new Set(data.map((r) => r.cycle))].sort((a, b) => a - b);
  const map = new Map<string, any>();
  for (const r of data) {
    map.set(`${r.cycle}_${r.cellName}`, r);
  }
  return cycles.map((cycle) => {
    const point: any = { cycle };
    for (const cell of cells) {
      const row = map.get(`${cycle}_${cell}`);
      point[cell] = row ? n(row[metric]) : null;
    }
    return point;
  });
}

/* ── shared chart config ──────────────────────────────── */

const AXIS_STYLE = { fontSize: 12, fill: '#6b7280' };
const GRID_STYLE = { strokeDasharray: '3 3', vertical: false, stroke: '#e5e7eb' };
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: '8px',
  border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

/* ── custom legend ────────────────────────────────────── */

function GroupLegend({ groupMap }: { groupMap?: Record<string, GroupAssignment> }) {
  if (!groupMap || Object.keys(groupMap).length === 0) return null;
  const seen = new Set<string>();
  const groups: { name: string; color: string }[] = [];
  for (const g of Object.values(groupMap)) {
    if (!seen.has(g.groupName)) {
      seen.add(g.groupName);
      groups.push({ name: g.groupName, color: g.color });
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', fontSize: '12px', marginTop: '8px' }}>
      {groups.map((g) => (
        <span key={g.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: g.color, display: 'inline-block' }} />
          {g.name}
        </span>
      ))}
    </div>
  );
}

/* ── chart sub-components ─────────────────────────────── */

function ProcessChart({ data, groupMap }: { data: any[]; groupMap?: Record<string, GroupAssignment> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="cellId" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip
          cursor={{ fill: '#f3f4f6' }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: any, _name: any, props: any) => {
            const cid = props?.payload?.cellId;
            const gn = cellGroupName(cid, groupMap);
            return [n(value).toFixed(3), `fq (Capacity) ${gn ? `· ${gn}` : ''}`];
          }}
        />
        <Bar dataKey="fq" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={cellColor(entry.cellId, groupMap)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CalendarLineChart({ data, groupMap }: { data: any[]; groupMap?: Record<string, GroupAssignment> }) {
  const cells = useMemo(() => [...new Set(data.map((r) => r.cellName))], [data]);
  const lineData = useMemo(() => pivotCalendarLife(data, 'qRetention'), [data]);

  if (cells.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: any, name: any) => [
            n(value).toFixed(2),
            `${name} ${cellGroupName(name, groupMap) ? `· ${cellGroupName(name, groupMap)}` : ''}`,
          ]}
        />
        <Legend content={<GroupLegend groupMap={groupMap} />} />
        {cells.map((cell) => (
          <Line
            key={cell}
            type="monotone"
            dataKey={cell}
            stroke={cellColor(cell, groupMap)}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            name={cell}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function SwellingChart({ data, groupMap }: { data: any[]; groupMap?: Record<string, GroupAssignment> }) {
  const cells = useMemo(() => [...new Set(data.map((r) => r.cellName))], [data]);
  const lineData = useMemo(() => pivotSwelling(data, 'vg'), [data]);

  if (cells.length > 1) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: any, name: any) => [
              n(value).toFixed(3),
              `${name} ${cellGroupName(name, groupMap) ? `· ${cellGroupName(name, groupMap)}` : ''}`,
            ]}
          />
          <Legend content={<GroupLegend groupMap={groupMap} />} />
          {cells.map((cell) => (
            <Line key={cell} type="monotone" dataKey={cell} stroke={cellColor(cell, groupMap)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={cell} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="vg" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={cellColor(entry.cellName, groupMap)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EfficiencyChart({ data, groupMap }: { data: any[]; groupMap?: Record<string, GroupAssignment> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="cellName" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="de" radius={[4, 4, 0, 0]} maxBarSize={40} name="Discharge Eff (de)">
          {data.map((entry, idx) => (
            <Cell key={idx} fill={cellColor(entry.cellName, groupMap)} />
          ))}
        </Bar>
        <Bar dataKey="ce" radius={[4, 4, 0, 0]} maxBarSize={40} name="Charge Eff (ce)">
          {data.map((entry, idx) => (
            <Cell key={idx} fill={cellColor(entry.cellName, groupMap)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DcrChart({ data, groupMap }: { data: any[]; groupMap?: Record<string, GroupAssignment> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="cellName" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="ddcr" radius={[4, 4, 0, 0]} maxBarSize={40} name="D-DCR">
          {data.map((entry, idx) => (
            <Cell key={idx} fill={cellColor(entry.cellName, groupMap)} />
          ))}
        </Bar>
        <Bar dataKey="cdcr" radius={[4, 4, 0, 0]} maxBarSize={40} name="C-DCR">
          {data.map((entry, idx) => (
            <Cell key={idx} fill={cellColor(entry.cellName, groupMap)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function FastChargeChart({ data, groupMap }: { data: any[]; groupMap?: Record<string, GroupAssignment> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="cellName" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="computedFastChargeTime" radius={[4, 4, 0, 0]} maxBarSize={40} name="10%-80% SOC (min)">
          {data.map((entry, idx) => (
            <Cell key={idx} fill={cellColor(entry.cellName, groupMap)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HtCycleChart({ data, groupMap }: { data: any[]; groupMap?: Record<string, GroupAssignment> }) {
  const cells = useMemo(() => [...new Set(data.map((r) => r.cellName))], [data]);
  const [metric, setMetric] = useState<'capacityRetention' | 'ironDissolution'>('capacityRetention');
  const lineData = useMemo(() => pivotHtCycle(data, metric), [data, metric]);

  if (cells.length === 0) return <EmptyChart />;

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Metric toggle */}
      <div className="flex items-center gap-2 text-xs shrink-0">
        <button
          className={`px-3 py-1 rounded-full font-medium transition-colors ${metric === 'capacityRetention' ? 'bg-[#1d74f5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          onClick={() => setMetric('capacityRetention')}
        >
          Capacity Retention
        </button>
        <button
          className={`px-3 py-1 rounded-full font-medium transition-colors ${metric === 'ironDissolution' ? 'bg-[#1d74f5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          onClick={() => setMetric('ironDissolution')}
        >
          Iron Dissolution (ppm)
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={AXIS_STYLE} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: any) => [
                n(value).toFixed(2),
                `${name} ${cellGroupName(name, groupMap) ? `· ${cellGroupName(name, groupMap)}` : ''}`,
              ]}
            />
            <Legend content={<GroupLegend groupMap={groupMap} />} />
            {cells.map((cell) => (
              <Line
                key={cell}
                type="monotone"
                dataKey={cell}
                stroke={cellColor(cell, groupMap)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={cell}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
      暂无数据
    </div>
  );
}

/* ── main component ───────────────────────────────────── */

export function ExperimentChart({ assayType, experimentId, projectId, title, groupMap: groupMapProp }: ExperimentChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [groupMap, setGroupMap] = useState<Record<string, GroupAssignment> | undefined>(groupMapProp);

  useEffect(() => {
    const type = TYPE_MAP[assayType];
    if (!type || !experimentId) return;

    let url = `/api/v1/data/${type}/${experimentId}`;
    if (projectId) {
      url += `?withGroups=true&projectId=${projectId}`;
    }

    api.get<any>(url)
      .then((res) => {
        // If server returned { rows, groupMap } format
        if (res && res.rows && res.groupMap) {
          setData(res.rows);
          setGroupMap(res.groupMap);
        } else {
          // Plain array response
          setData(Array.isArray(res) ? res : []);
          if (groupMapProp) setGroupMap(groupMapProp);
        }
      })
      .catch(() => setData([]));
  }, [assayType, experimentId, projectId]);

  const renderChart = () => {
    if (!data.length) return <EmptyChart />;

    switch (assayType) {
      case 'ProcessData':
        return <ProcessChart data={data} groupMap={groupMap} />;
      case 'CalendarLife':
        return <CalendarLineChart data={data} groupMap={groupMap} />;
      case 'StorageSwelling':
        return <SwellingChart data={data} groupMap={groupMap} />;
      case 'EnergyEfficiency':
        return <EfficiencyChart data={data} groupMap={groupMap} />;
      case 'DcrTest':
        return <DcrChart data={data} groupMap={groupMap} />;
      case 'FastCharge':
        return <FastChargeChart data={data} groupMap={groupMap} />;
      case 'HtCycle':
        return <HtCycleChart data={data} groupMap={groupMap} />;
      default:
        return (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            No chart available for {displayName}
          </div>
        );
    }
  };

  const { t } = useTranslation();

  const displayName = title || t(RECORD_TYPE_TO_I18N_KEY[assayType] || assayType);

  return (
    <div className="bg-white border border-gray-200 rounded p-5 h-72 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {displayName}
        </h3>
      </div>
      <div className="h-52 w-full">
        {renderChart()}
      </div>
    </div>
  );
}
