import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    <div className={cn("flex flex-wrap items-center justify-center gap-4 px-4 py-4 sm:justify-between sm:px-6", className)}>
      {/* Left: info + page size */}
      <div className="hidden sm:flex sm:items-center sm:gap-4">
        {totalItems > 0 ? (
          <>
            <p className="text-[13px] text-gray-500 whitespace-nowrap">
              {fromIndex} — {toIndex} / {totalItems} {t("pagination_item_unit", "items")}
            </p>
            {onPageSizeChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">{t("pagination_per_page")}</span>
                <select
                  aria-label={t("pagination_per_page")}
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="bg-transparent border-0 px-2 py-1 text-[13px] font-medium text-gray-600 focus:outline-none focus:ring-0 cursor-pointer transition-colors hover:text-gray-900"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {t("pagination_items_per_page", { size })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">{t("pagination_total_zero")}</p>
        )}
      </div>

      {/* Right: pagination buttons */}
      {totalPages > 0 && (
        <nav className="flex items-center gap-0.5" aria-label="Pagination">
          {/* First */}
          <button
            type="button"
            aria-label="First page"
            disabled={currentPage <= 1}
            onClick={() => onPageChange?.(1)}
            className="flex h-8 items-center justify-center rounded-control px-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <ChevronsLeft className="inline h-4 w-4" aria-hidden="true" />
          </button>
          {/* Prev */}
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => onPageChange?.(currentPage - 1)}
            className="flex h-8 items-center justify-center rounded-control px-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="inline h-4 w-4" aria-hidden="true" />
          </button>

          {/* Page numbers */}
          <span className="mx-1 flex items-center gap-0.5">
            {getPageNumbers().map((page, idx) => {
              if (page === "ellipsis") {
                return (
                  <span key={`e-${idx}`} className="px-2 h-8 flex items-center justify-center text-sm text-gray-400 select-none">
                    ...
                  </span>
                );
              }
              const isCurrent = page === currentPage;
              return (
                <button
                  type="button"
                  key={page}
                  onClick={() => onPageChange?.(page)}
                  aria-label={`Page ${page}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-control px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35",
                    isCurrent
                      ? "bg-action-subtle text-action-muted font-semibold"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  {page}
                </button>
              );
            })}
          </span>

          {/* Next */}
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange?.(currentPage + 1)}
            className="flex h-8 items-center justify-center rounded-control px-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <ChevronRight className="inline h-4 w-4" aria-hidden="true" />
          </button>
          {/* Last */}
          <button
            type="button"
            aria-label="Last page"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange?.(totalPages)}
            className="flex h-8 items-center justify-center rounded-control px-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <ChevronsRight className="inline h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
