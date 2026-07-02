import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function VersionDiffViewer({ versions }: { versions: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!versions || versions.length === 0) {
    return <div className="text-gray-500 text-sm p-4">No version history available.</div>;
  }

  const renderDiff = (current: any, previous: any) => {
    if (!previous) return <div className="text-sm text-gray-500 italic mt-2">Initial version.</div>;
    
    const changes = [];
    if (current.title !== previous.title) changes.push({ field: 'Title', old: previous.title, new: current.title });
    if (current.content !== previous.content) changes.push({ field: 'Notes', old: previous.content, new: current.content });
    if (current.status !== previous.status) changes.push({ field: 'Status', old: previous.status, new: current.status });

    if (changes.length === 0) return <div className="text-sm text-gray-500 italic mt-2">No visible changes in tracked fields.</div>;

    return (
      <div className="mt-3 space-y-3">
        {changes.map(c => (
          <div key={c.field} className="text-sm border border-gray-100 rounded overflow-hidden">
            <div className="bg-gray-50 px-3 py-1.5 font-medium text-gray-700 border-b border-gray-100">{c.field}</div>
            <div className="p-2.5 bg-red-50 text-red-700 whitespace-pre-wrap">{c.old || '(empty)'}</div>
            <div className="p-2.5 bg-green-50 text-green-700 whitespace-pre-wrap">{c.new || '(empty)'}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      {versions.map((v, i) => {
        const previous = i < versions.length - 1 ? versions[i + 1].snapshot : null;
        const current = v.snapshot;
        const isExpanded = expanded === v.id;
        
        return (
          <div key={v.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button 
              onClick={() => setExpanded(isExpanded ? null : v.id)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left focus:outline-none"
            >
              <div>
                <div className="font-medium text-gray-900">Version {v.versionNumber}</div>
                <div className="text-xs text-gray-500 mt-0.5">{format(new Date(v.updatedAt || v.createdAt), 'MMM d, yyyy HH:mm')}</div>
              </div>
              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
            </button>
            {isExpanded && (
              <div className="p-3 bg-white border-t border-gray-100">
                {renderDiff(current, previous)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
