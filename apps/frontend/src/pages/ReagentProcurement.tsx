import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  CheckCircle2, XCircle, ChevronLeft, Loader2, ClipboardList, ArrowRight, Edit3, Check, X,
} from "lucide-react";
import { Button } from "../components/Button";
import { cn } from "../lib/utils";
import {
  TableWrapper, Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "../components/Table";
import { toast } from "../components/Toast";
import { SkeletonCard } from "../components/Skeleton";
import { api, ApiError } from "../lib/api";

interface ProcurementRow {
  id: string | null;
  projectId: string;
  experimentDesignId: string | null;
  moleculeName: string;
  group: string;
  chineseName: string | null;
  cas: string;
  internalCode: string;
  isRedundancy: boolean;
  supplier: string | null;
  batchNo: string | null;
  purity: string | null;
  quantity: string | null;
  isValid: boolean;
  remark: string | null;
  createdAt: string;
}

export function ReagentProcurement() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [records, setRecords] = useState<ProcurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchRecords = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    api.get<ProcurementRow[]>(`/api/v1/projects/${projectId}/procurement`)
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => toast.error(t("load_failed")))
      .finally(() => setLoading(false));
  }, [projectId, t]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const updateField = async (record: ProcurementRow, field: string, value: any) => {
    if (!record.id) { toast.error("Submit experiment design first"); return; }
    setSavingId(record.id);
    try {
      await api.put(`/api/v1/projects/${projectId}/procurement/${record.id}`, { [field]: value });
      setRecords((prev) => prev.map((r) => (r.experimentDesignId === record.experimentDesignId ? { ...r, [field]: value } : r)));
      toast.success(t("procurement_updated"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("update_failed"));
    } finally {
      setSavingId(null);
    }
  };

  const toggleValid = async (record: ProcurementRow) => { await updateField(record, "isValid", !record.isValid); };

  if (loading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/projects/${projectId}/design`)}><ChevronLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t("reagent_procurement")}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{t("procurement_desc")}</p>
          </div>
        </div>
        <Link to={`/projects/${projectId}`} className="text-xs text-gray-400 hover:text-[#1d74f5] flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" />{t("project_detail", "Project")}<ArrowRight className="w-3 h-3" /></Link>
      </div>

      <div className="flex gap-3 text-xs">
        <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-md">{t("procurement_is_valid")}: {records.filter((r) => r.isValid).length}</span>
        <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-md">{t("procurement_invalid")}: {records.filter((r) => !r.isValid).length}</span>
        <span className="px-2.5 py-1 bg-gray-50 text-gray-500 rounded-md">{t("total", "Total")}: {records.length}</span>
      </div>

      <TableWrapper className="max-h-[600px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("design_group")}</TableHead>
              <TableHead>{t("design_molecule_name")}</TableHead>
              <TableHead>{t("design_internal_code")}</TableHead>
              <TableHead>{t("procurement_supplier")}</TableHead>
              <TableHead>{t("procurement_batch_no")}</TableHead>
              <TableHead>{t("procurement_purity")}</TableHead>
              <TableHead>{t("procurement_quantity")}</TableHead>
              <TableHead>{t("procurement_is_valid")}</TableHead>
              <TableHead>{t("procurement_remark")}</TableHead>
              <TableHead className="w-[70px]">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-gray-400 py-12">{t("no_data_available", { type: t("reagent_procurement") })}</TableCell></TableRow>
            ) : (
              records.map((record, i) => (
                <TableRow key={record.experimentDesignId || i} className={cn(!record.isValid ? "opacity-60" : "", record.isRedundancy ? "bg-amber-50/40" : "")}>
                  <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium text-xs">{record.group}</TableCell>
                  <TableCell className="text-xs">{record.moleculeName}</TableCell>
                  <TableCell><code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{record.internalCode || "—"}</code></TableCell>
                  <TableCell><InlineCell value={record.supplier || ""} onSave={(v) => updateField(record, "supplier", v)} saving={savingId === record.id} editing={editingId === record.experimentDesignId} /></TableCell>
                  <TableCell><InlineCell value={record.batchNo || ""} onSave={(v) => updateField(record, "batchNo", v)} saving={savingId === record.id} editing={editingId === record.experimentDesignId} /></TableCell>
                  <TableCell><InlineCell value={record.purity || ""} onSave={(v) => updateField(record, "purity", v)} saving={savingId === record.id} editing={editingId === record.experimentDesignId} /></TableCell>
                  <TableCell><InlineCell value={record.quantity || ""} onSave={(v) => updateField(record, "quantity", v)} saving={savingId === record.id} editing={editingId === record.experimentDesignId} /></TableCell>
                  <TableCell>
                    <button onClick={() => toggleValid(record)} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors", record.isValid ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200")}>
                      {record.isValid ? <><CheckCircle2 className="w-2.5 h-2.5" /> Yes</> : <><XCircle className="w-2.5 h-2.5" /> No</>}
                    </button>
                  </TableCell>
                  <TableCell><InlineCell value={record.remark || ""} onSave={(v) => updateField(record, "remark", v)} saving={savingId === record.id} editing={editingId === record.experimentDesignId} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {editingId === record.experimentDesignId ? (
                        <>
                          <button onClick={() => { setEditingId(null); toast.success("Saved"); }} className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingId(record.experimentDesignId)} className="p-1.5 text-gray-400 hover:text-[#1d74f5] hover:bg-blue-50 rounded-md transition-colors" title={t("edit")}><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => toggleValid(record)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors" title={record.isValid ? t("procurement_invalid") : t("procurement_valid")}>{record.isValid ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}</button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}

function InlineCell({ value, onSave, saving, editing }: { value: string; onSave: (v: string) => Promise<void>; saving: boolean; editing: boolean }) {
  const [draft, setDraft] = useState(value);
  const { t } = useTranslation();
  useEffect(() => { setDraft(value); }, [value]);
  if (editing) return <input className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:border-gray-400 focus:outline-none" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== value) onSave(draft); }} onKeyDown={(e) => { if (e.key === "Enter" && draft !== value) onSave(draft); }} autoFocus />;
  return <span className={cn("text-xs min-w-[50px] inline-block", value ? "text-gray-700" : "text-gray-300 italic")} title={t("edit")}>{value || "—"}{saving && <Loader2 className="w-2.5 h-2.5 animate-spin inline ml-1" />}</span>;
}
