import React from "react";
import { cn } from "../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("bg-gray-200 animate-pulse rounded", className)}
    />
  );
}

export function SkeletonBlock({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-full", className)} />;
}

export function SkeletonCard({ rows = 4, className }: { rows?: number } & SkeletonProps) {
  return (
    <div className={cn("bg-white border border-gray-200 rounded shadow-sm overflow-hidden", className)}>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="p-8 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex items-center gap-4 px-6 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "w-32" : "w-20")} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-6 py-3 border-t border-gray-100">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3", c === 0 ? "w-40" : "w-16")} />
          ))}
        </div>
      ))}
    </div>
  );
}
