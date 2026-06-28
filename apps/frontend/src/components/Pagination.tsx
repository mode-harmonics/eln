import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { cn } from "../lib/utils";

export function Pagination({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn("flex items-center justify-between px-6 py-4", className)}
    >
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
            <button className="relative inline-flex items-center rounded-md px-2 py-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:z-20 focus:outline-offset-0 transition-colors">
              <span className="sr-only">{t("previous")}</span>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-current="page"
              className="relative z-10 inline-flex items-center rounded-md bg-[#1d74f5] px-3.5 py-1.5 text-sm font-medium text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d74f5] shadow-sm"
            >
              1
            </button>
            <button className="relative inline-flex items-center rounded-md px-3.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:z-20 focus:outline-offset-0 transition-colors">
              2
            </button>
            <button className="relative inline-flex items-center rounded-md px-3.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:z-20 focus:outline-offset-0 transition-colors">
              3
            </button>
            <span className="relative inline-flex items-center px-2 py-1.5 text-sm font-medium text-gray-500">
              <MoreHorizontal className="h-4 w-4" />
            </span>
            <button className="relative inline-flex items-center rounded-md px-3.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:z-20 focus:outline-offset-0 transition-colors">
              8
            </button>
            <button className="relative inline-flex items-center rounded-md px-2 py-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:z-20 focus:outline-offset-0 transition-colors">
              <span className="sr-only">{t("next")}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
