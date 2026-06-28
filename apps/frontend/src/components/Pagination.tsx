import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
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

  // If onPageChange or totalItems is not provided, render a simplified static view
  if (!onPageChange || totalItems === 0) {
    return (
      <div className={cn("flex items-center justify-between px-6 py-4", className)}>
        <div className="flex flex-1 justify-between sm:hidden">
          <button className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t("previous")}
          </button>
          <button className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t("next")}
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              <Trans
                i18nKey="showing_results"
                values={{
                  from: 0,
                  to: 0,
                  total: 0,
                }}
                components={{
                  num1: <span className="font-medium text-gray-900" />,
                  num2: <span className="font-medium text-gray-900" />,
                  num3: <span className="font-medium text-gray-900" />,
                }}
              />
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex gap-1" aria-label="Pagination">
              <button className="relative inline-flex items-center rounded-md px-2 py-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                aria-current="page"
                className="relative z-10 inline-flex items-center rounded-md bg-[#1d74f5] px-3.5 py-1.5 text-sm font-medium text-white shadow-sm"
              >
                1
              </button>
              <button className="relative inline-flex items-center rounded-md px-2 py-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalItems / pageSize);
  const fromIndex = (currentPage - 1) * pageSize + 1;
  const toIndex = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: Array<number | "ellipsis"> = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, "ellipsis", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "ellipsis", totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className={cn("flex items-center justify-between px-6 py-4", className)}>
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("previous")}
        </button>
        <button
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("next")}
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500">
            <Trans
              i18nKey="showing_results"
              values={{
                from: fromIndex,
                to: toIndex,
                total: totalItems,
              }}
              components={{
                num1: <span className="font-medium text-gray-900" />,
                num2: <span className="font-medium text-gray-900" />,
                num3: <span className="font-medium text-gray-900" />,
              }}
            />
          </p>
          {onPageSizeChange && (
            <div className="flex items-center gap-1.5 ml-4 border-l border-gray-200 pl-4">
              <span className="text-xs text-gray-500">{t("show", "Show:")}</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1d74f5] focus:border-[#1d74f5] cursor-pointer"
              >
                {Array.from(new Set([pageSize, 5, 10, 20, 50])).sort((a, b) => a - b).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <nav className="isolate inline-flex gap-1" aria-label="Pagination">
            <button
              onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center rounded-md px-2 py-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">{t("previous")}</span>
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pages.map((page, index) => {
              if (page === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="relative inline-flex items-center px-2 py-1.5 text-sm font-medium text-gray-500"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                );
              }
              const isCurrent = page === currentPage;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "relative inline-flex items-center rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                    isCurrent
                      ? "z-10 bg-[#1d74f5] text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="relative inline-flex items-center rounded-md px-2 py-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">{t("next")}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
