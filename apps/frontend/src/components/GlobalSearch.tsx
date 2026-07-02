import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

export function GlobalSearch() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      api.get<any[]>(`/api/v1/search?q=${encodeURIComponent(query)}`)
        .then(res => {
          setResults(res || []);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="relative z-50" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full sm:w-64 pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#1d74f5] focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors"
          placeholder={t("search", "Search projects, experiments...")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setOpen(true); }}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Loader2 className="h-4 w-4 text-[#1d74f5] animate-spin" />
          </div>
        )}
      </div>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden">
          <div className="max-h-96 overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500 text-center">
                {t("no_results", "No results found")}
              </div>
            ) : (
              results.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={item.url}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 uppercase">
                      {item.type}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {item.title}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
