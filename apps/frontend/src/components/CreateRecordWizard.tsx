import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Calendar,
  Activity,
  Zap,
  Battery,
  Flame,
  ArrowLeft,
  UploadCloud,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { api } from "../lib/api";
import { toast } from "./Toast";
import { cn } from "../lib/utils";

interface CreateRecordWizardProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  hasPickedCells: boolean;
  onSuccess: () => void;
  recordOptions: { value: string; label: string; permission: string; sheetType: string }[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ProcessData: <Layers className="w-8 h-8" />,
  CalendarLife: <Calendar className="w-8 h-8" />,
  StorageSwelling: <Battery className="w-8 h-8" />,
  EnergyEfficiency: <Zap className="w-8 h-8" />,
  DcrTest: <Activity className="w-8 h-8" />,
  FastCharge: <Zap className="w-8 h-8" />,
  HtCycle: <Flame className="w-8 h-8" />,
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  ProcessData: "上传电池生产全生命周期数据，并开启挑选流程。",
  CalendarLife: "长期日历寿命测试数据，记录容量保持率与恢复率。",
  StorageSwelling: "高温/常温存储膨胀测试，监测厚度与体积变化。",
  EnergyEfficiency: "能量效率与电压曲线分析，评估电芯能量损耗。",
  DcrTest: "直流内阻(DCR)测试，评估不同SOC下的内阻特性。",
  FastCharge: "快充能力评估，包含恒流比、充电温升及极化数据。",
  HtCycle: "高温循环寿命测试，追踪长周期性能衰减。",
};

export function CreateRecordWizard({
  open,
  onClose,
  projectId,
  hasPickedCells,
  onSuccess,
  recordOptions,
}: CreateRecordWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<string>("");
  
  // Form State
  const [title, setTitle] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep(1);
    setSelectedType("");
    setTitle("");
    setSelectedFiles([]);
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTypeSelect = (typeValue: string) => {
    const isTest = typeValue !== "ProcessData";
    if (isTest && !hasPickedCells) return; // locked

    const opt = recordOptions.find((o) => o.value === typeValue);
    setSelectedType(typeValue);
    setTitle(`${opt?.label || typeValue} - ${new Date().toISOString().split('T')[0]}`);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError(t("select_file", "Please select a file"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const experiment = await api.post<{ id: string }>(
        `/api/v1/projects/${projectId}/experiments`,
        { title: title, recordType: selectedType },
      );
      for (const file of selectedFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("experimentId", experiment.id);
        await api.upload(`/api/v1/data/upload`, form);
      }
      toast("上传成功", "success");
      onSuccess();
      handleClose();
    } catch (err: any) {
      if (err?.status === 409) {
        toast("检测到已有数据，请选择覆盖或合并模式", "error");
      } else {
        setError(err?.message ?? t("upload_error", "Upload failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => {
    const processOption = recordOptions.find((o) => o.value === "ProcessData");
    const testOptions = recordOptions.filter((o) => o.value !== "ProcessData");

    return (
      <div className="space-y-8 py-2">
        {/* Process Data Section */}
        {processOption && (
          <section>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
              基础流程 (Foundation)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleTypeSelect(processOption.value)}
                className="group relative flex flex-col items-start p-5 rounded-xl border border-[#1d74f5]/30 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 hover:from-blue-100/60 hover:to-indigo-100/60 transition-all shadow-sm hover:shadow-md hover:border-[#1d74f5] text-left"
              >
                <div className="absolute top-4 right-4 text-[#1d74f5]/20 group-hover:text-[#1d74f5]/40 transition-colors">
                  {TYPE_ICONS[processOption.value] || <Layers className="w-8 h-8" />}
                </div>
                <h4 className="text-lg font-bold text-[#1d74f5] mb-2">{processOption.label}</h4>
                <p className="text-xs text-gray-600 leading-relaxed pr-8">
                  {TYPE_DESCRIPTIONS[processOption.value] || "上传基础数据。"}
                </p>
              </button>
            </div>
          </section>
        )}

        {/* Test Data Section */}
        {testOptions.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                测试记录 (Performance Tests)
              </h3>
              {!hasPickedCells && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  <Lock className="w-3 h-3 mr-1" />
                  前置条件未满足
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {testOptions.map((opt) => {
                const isLocked = !hasPickedCells;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeSelect(opt.value)}
                    disabled={isLocked}
                    className={cn(
                      "group relative flex flex-col items-start p-5 rounded-xl border text-left transition-all",
                      isLocked 
                        ? "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed" 
                        : "bg-white border-gray-200 hover:border-[#1d74f5] hover:shadow-md hover:bg-blue-50/10"
                    )}
                    title={isLocked ? "必须先上传制成数据并完成「电池挑选」" : ""}
                  >
                    <div className={cn(
                      "absolute top-4 right-4 transition-colors",
                      isLocked ? "text-gray-300" : "text-gray-200 group-hover:text-[#1d74f5]/30"
                    )}>
                      {TYPE_ICONS[opt.value] || <Activity className="w-8 h-8" />}
                    </div>
                    
                    <h4 className={cn(
                      "text-[15px] font-bold mb-1.5",
                      isLocked ? "text-gray-500" : "text-gray-900 group-hover:text-[#1d74f5]"
                    )}>
                      {opt.label}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed pr-8 line-clamp-2">
                      {TYPE_DESCRIPTIONS[opt.value] || "上传测试数据。"}
                    </p>

                    {isLocked && (
                      <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-gray-900/80 text-white text-xs px-3 py-1.5 rounded-md shadow-lg flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-300" />
                          需先完成电池挑选
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  };

  const renderStep2 = () => {
    const selectedOpt = recordOptions.find((o) => o.value === selectedType);
    
    return (
      <form id="wizard-upload-form" onSubmit={handleSubmit} className="space-y-6 py-2">
        <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
          <div className="bg-blue-100 text-blue-600 p-2 rounded-md">
            {TYPE_ICONS[selectedType] || <Activity className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">{selectedOpt?.label}</h4>
            <p className="text-xs text-gray-500">
              {selectedOpt?.sheetType === "cycle" ? t("upload_cycle_hint", "请上传循环层级(Cycle)的数据表格") : t("upload_step_hint", "请上传工步层级(Step)的数据表格")}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("title", "Title")}</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-shadow"
            placeholder={t("title_placeholder", "Enter title")}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("upload_excel", "Upload Excel File")}</label>
          <label
            htmlFor="wizard-excel-upload"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const files = Array.from(e.dataTransfer.files ?? []);
              if (files.length > 0) { setSelectedFiles(files); setError(null); }
            }}
            className={cn(
              "flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-all duration-200",
              dragOver
                ? "border-[#1d74f5] bg-blue-50 scale-[1.02]"
                : selectedFiles.length > 0
                  ? "border-green-400 bg-green-50"
                  : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            )}
          >
            {selectedFiles.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                {selectedFiles.length === 1 ? (
                  <span className="text-sm font-medium text-green-800 text-center break-all">{selectedFiles[0].name}</span>
                ) : (
                  <span className="text-sm font-medium text-green-800">{selectedFiles.length} 个文件已选择</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center text-gray-500">
                <div className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center mb-3 shadow-sm">
                  <UploadCloud className="w-6 h-6 text-gray-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 mb-1">{t("select_file", "Click or drag file to this area")}</span>
                <span className="text-xs text-gray-400">支持 .xlsx 格式文件</span>
              </div>
            )}
            <input
              id="wizard-excel-upload"
              type="file"
              multiple
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={submitting}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) { setSelectedFiles(files); setError(null); }
              }}
            />
          </label>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}
      </form>
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 1 ? "选择记录类型" : "上传实验数据"}
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回上一步
            </Button>
          ) : (
            <div /> // placeholder for flex-between
          )}
          
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              {t("cancel", "Cancel")}
            </Button>
            {step === 2 && (
              <Button type="submit" form="wizard-upload-form" loading={submitting} disabled={submitting}>
                {submitting ? "正在上传..." : "创建并上传"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="min-h-[400px]">
        {step === 1 ? renderStep1() : renderStep2()}
      </div>
    </Modal>
  );
}
