import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { Eye, Edit2, Columns } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function MarkdownEditor({ value, onChange, disabled }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split');

  return (
    <div className={cn("border border-gray-300 rounded-md overflow-hidden bg-white flex flex-col", disabled && "opacity-75 pointer-events-none")}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={cn("px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors", mode === 'edit' ? "bg-white shadow-sm text-gray-900 border border-gray-200" : "text-gray-500 hover:text-gray-700")}
        >
          <Edit2 className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={cn("px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors", mode === 'preview' ? "bg-white shadow-sm text-gray-900 border border-gray-200" : "text-gray-500 hover:text-gray-700")}
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button
          type="button"
          onClick={() => setMode('split')}
          className={cn("px-2 py-1 text-xs font-medium rounded hidden sm:flex items-center gap-1 transition-colors", mode === 'split' ? "bg-white shadow-sm text-gray-900 border border-gray-200" : "text-gray-500 hover:text-gray-700")}
        >
          <Columns className="w-3.5 h-3.5" /> Split
        </button>
      </div>

      <div className={cn("flex flex-col sm:flex-row min-h-[200px] max-h-[500px]")}>
        {(mode === 'edit' || mode === 'split') && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              "flex-1 p-3 text-sm text-gray-900 focus:outline-none resize-none font-mono bg-white",
              mode === 'split' ? "border-b sm:border-b-0 sm:border-r border-gray-200" : ""
            )}
            placeholder="Write markdown here..."
          />
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className="flex-1 p-3 overflow-y-auto bg-gray-50/50 prose prose-sm prose-blue max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value || '*Nothing to preview*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
