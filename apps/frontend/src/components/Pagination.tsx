import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../lib/utils";

interface PaginationProps {
  currentPage?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;
  const fromIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const toIndex = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: Array<number | "ellipsis"> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className={cn("flex items-center justify-between gap-4 px-6 py-4", className)}>
      {/* Left: info + page size */}
      <div className="hidden sm:flex sm:items-center sm:gap-4">
        {totalItems > 0 ? (
          <>
            <p className="text-sm text-gray-500 whitespace-nowrap">
              <span className="font-medium text-gray-900">{fromIndex}</span>
              {" — "}
              <span className="font-medium text-gray-900">{toIndex}</span>
              {" / "}
              <span className="font-medium text-gray-900">{totalItems}</span>
              {" 条"}
            </p>
            {onPageSizeChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#1d74f5] focus:border-[#1d74f5] cursor-pointer hover:border-gray-300 transition-colors"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} 条/页
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">共 0 条</p>
        )}
      </div>

      {/* Right: pagination buttons */}
      {totalPages > 0 && (
        <nav className="flex items-center gap-0.5" aria-label="Pagination">
          {/* First */}
          <span
            onClick={() => currentPage > 1 && onPageChange?.(1)}
            className={cn("cursor-pointer select-none px-1 text-sm leading-8 transition-colors", currentPage <= 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-900")}
          >
            <ChevronsLeft className="inline h-4 w-4" />
          </span>
          {/* Prev */}
          <span
            onClick={() => currentPage > 1 && onPageChange?.(currentPage - 1)}
            className={cn("cursor-pointer select-none px-1 text-sm leading-8 transition-colors", currentPage <= 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-900")}
          >
            <ChevronLeft className="inline h-4 w-4" />
          </span>

          {/* Page numbers */}
          <span className="mx-1">
            {getPageNumbers().map((page, idx) => {
              if (page === "ellipsis") {
                return (
                  <span key={`e-${idx}`} className="px-2 text-sm text-gray-400 select-none">
                    ...
                  </span>
                );
              }
              const isCurrent = page === currentPage;
              return (
                <span
                  key={page}
                  onClick={() => onPageChange?.(page)}
                  className={cn(
                    "cursor-pointer select-none px-2 text-sm leading-8 transition-colors",
                    isCurrent
                      ? "text-[#1d74f5] font-bold"
                      : "text-gray-500 hover:text-gray-900",
                  )}
                >
                  {page}
                </span>
              );
            })}
          </span>

          {/* Next */}
          <span
            onClick={() => currentPage < totalPages && onPageChange?.(currentPage + 1)}
            className={cn("cursor-pointer select-none px-1 text-sm leading-8 transition-colors", currentPage >= totalPages ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-900")}
          >
            <ChevronRight className="inline h-4 w-4" />
          </span>
          {/* Last */}
          <span
            onClick={() => currentPage < totalPages && onPageChange?.(totalPages)}
            className={cn("cursor-pointer select-none px-1 text-sm leading-8 transition-colors", currentPage >= totalPages ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-900")}
          >
            <ChevronsRight className="inline h-4 w-4" />
          </span>
        </nav>
      )}
    </div>
  );
}
