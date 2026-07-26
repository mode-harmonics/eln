import React from "react";
import { cn } from "../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-gray-200/80 motion-safe:animate-pulse rounded-md", className)}
    />
  );
}

export function SkeletonBlock({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-full", className)} />;
}

export function SkeletonChart({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-xl bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-5 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-44 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-full" />
      </div>
      <div className="h-48 flex items-end justify-between gap-3 px-2 pt-6 pb-2">
        <Skeleton className="h-[40%] flex-1 rounded-t-sm" />
        <Skeleton className="h-[75%] flex-1 rounded-t-sm" />
        <Skeleton className="h-[55%] flex-1 rounded-t-sm" />
        <Skeleton className="h-[90%] flex-1 rounded-t-sm" />
        <Skeleton className="h-[60%] flex-1 rounded-t-sm" />
        <Skeleton className="h-[80%] flex-1 rounded-t-sm" />
        <Skeleton className="h-[45%] flex-1 rounded-t-sm" />
      </div>
    </div>
  );
}

export function SkeletonCard({ rows = 5, className }: { rows?: number } & SkeletonProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {/* Top Banner Card Placeholder */}
      <div className="rounded-lg bg-gray-50 px-5 py-4 sm:px-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Segmented Pills Placeholder */}
      <div className="inline-flex gap-1.5 rounded-xl bg-gray-100/70 p-1">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>

      {/* Chart Placeholder */}
      <SkeletonChart />

      {/* Table Placeholder */}
      <div className="rounded-lg bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 bg-gray-50/80 px-6 py-3 border-b border-gray-100">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg bg-white border border-gray-100 shadow-sm overflow-hidden space-y-0">
      {/* header */}
      <div className="flex items-center gap-4 bg-gray-50/80 px-6 py-3 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3.5", i === 0 ? "w-32" : "w-20")} />
        ))}
      </div>
      {/* rows */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-6 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-36" : "w-16")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
