import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Upload, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { cn } from "../lib/utils";

interface ConflictModalProps {
  open: boolean;
  onClose: () => void;
  onOverwrite: () => void;
  onMerge: () => void;
  existingCount: number;
}

export function ConflictModal({ open, onClose, onOverwrite, onMerge, existingCount }: ConflictModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-up panel */}
      <div
        className={cn(
          "relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl p-6 pb-8",
          "animate-in slide-in-from-bottom duration-300 ease-out",
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-1">
          {t("conflict_title")}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 text-center mb-2">
          {t("conflict_description")}
        </p>

        {/* Existing data count */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-sm text-gray-500">
            已有 <strong className="text-gray-900">{existingCount}</strong> 条数据记录
          </span>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            variant="primary"
            className="w-full !py-3 !text-sm flex items-center justify-center gap-2"
            onClick={onOverwrite}
          >
            <Upload className="w-4 h-4" />
            {t("overwrite")} — 删除旧数据后重新上传
          </Button>
          <Button
            variant="secondary"
            className="w-full !py-3 !text-sm flex items-center justify-center gap-2"
            onClick={onMerge}
          >
            <Layers className="w-4 h-4" />
            {t("merge")} — 保留旧数据，追加新数据
          </Button>
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
