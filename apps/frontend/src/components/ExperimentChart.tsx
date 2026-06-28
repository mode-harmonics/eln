import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { api } from '../lib/api';

interface ExperimentChartProps {
  assayType: string;
  experimentId?: string;
}

const TYPE_MAP: Record<string, string> = {
  ProcessData: 'process',
  CalendarLife: 'calendar',
  StorageSwelling: 'swelling',
  EnergyEfficiency: 'efficiency',
  DcrTest: 'dcr',
  FastCharge: 'fastcharge',
  HtCycle: 'htcycle',
};

export function ExperimentChart({ assayType, experimentId }: ExperimentChartProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const type = TYPE_MAP[assayType];
    if (!type || !experimentId) return;
    api.get<any[]>(`/api/v1/data/${type}/${experimentId}`)
      .then(setData)
      .catch(() => setData([]));
  }, [assayType, experimentId]);

  const renderChart = () => {
    switch (assayType) {
      case 'ProcessData':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="cellId" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="fq" fill="#1d74f5" radius={[4, 4, 0, 0]} name="fq (Capacity)" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'CalendarLife':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="q" stroke="#1d74f5" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="Capacity (q)" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'StorageSwelling':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="dayCount" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="v" fill="#1d74f5" radius={[4, 4, 0, 0]} name="Volume (v)" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'EnergyEfficiency':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="cellName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="de" fill="#1d74f5" radius={[4, 4, 0, 0]} name="Discharge Eff (de)" maxBarSize={40} />
              <Bar dataKey="ce" fill="#10b981" radius={[4, 4, 0, 0]} name="Charge Eff (ce)" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'DcrTest':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="cellName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="ddcr" fill="#1d74f5" radius={[4, 4, 0, 0]} name="D-DCR" maxBarSize={40} />
              <Bar dataKey="cdcr" fill="#10b981" radius={[4, 4, 0, 0]} name="C-DCR" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'FastCharge':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="cellName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="computedFastChargeTime" fill="#1d74f5" radius={[4, 4, 0, 0]} name="10%-80% SOC (min)" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'HtCycle':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="cycle" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey={(d) => d.caps ? d.caps[0] : 0} stroke="#1d74f5" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="Cap 1" />
            </LineChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            No chart available for {assayType}
          </div>
        );
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm p-5 h-72 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {assayType} Overview
        </h3>
      </div>
      <div className="h-52 w-full">
        {renderChart()}
      </div>
    </div>
  );
}
