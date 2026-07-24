import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus, Trash2, Save, Edit3, Check, X, Loader2,
  CheckCircle2, Lock,
} from "lucide-react";
import { Button } from "../components/Button";
import { cn } from "../lib/utils";
import { Modal } from "../components/Modal";
import { Switch } from "../components/Switch";
import { Popconfirm } from "../components/Popconfirm";
import {
  TableWrapper, Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "../components/Table";
import { toast } from "../components/Toast";
import { PageLoader } from "../components/PageLoader";
import { api, ApiError } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { SegmentedControl } from "../components/SegmentedControl";

// ─── Types ──────────────────────────────────────────────────────

interface DesignRow {
  id?: string;
  rowIndex?: number;
  group: string;
  moleculeName: string;
  chineseName: string;
  molecularStructure: string;
  cas: string;
  designPrinciple: string;
  internalCode?: string;
  isRedundancy?: boolean;
  cellCount?: number | null;
  redundancyCount?: number;
}

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

// ─── Helpers ────────────────────────────────────────────────────

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function nextGroupName(existing: DesignRow[]): string {
  const used = new Set(existing.map((g) => g.group));
  for (const ch of GROUP_LETTERS) {
    if (!used.has(ch)) return ch;
  }
  // Fallback: G1, G2...
  let n = existing.length + 1;
  while (used.has(`G${n}`)) n++;
  return `G${n}`;
}

function EMPTY_GROUP(existing: DesignRow[] = []): DesignRow {
  return {
    group: nextGroupName(existing),
    moleculeName: "", chineseName: "",
    molecularStructure: "", cas: "", designPrinciple: "",
    cellCount: 17,
    redundancyCount: 3,
  };
}

// ─── Main Component ─────────────────────────────────────────────

export function ExperimentDesign() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const step = (searchParams.get("tab") as "design" | "procurement") || "design";

  const [loading, setLoading] = useState(true);

  // Design state
  const [groups, setGroups] = useState<DesignRow[]>([]);
  const [designSubmitted, setDesignSubmitted] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DesignRow | null>(null);
  const [batchEditing, setBatchEditing] = useState(false);
  const [batchDraft, setBatchDraft] = useState<DesignRow[]>([]);

  // Procurement state
  const [procRecords, setProcRecords] = useState<ProcurementRow[]>([]);
  const [procSubmitted, setProcSubmitted] = useState(false);
  const [savingProc, setSavingProc] = useState(false);
  const [procEditId, setProcEditId] = useState<string | null>(null);
  const [procSavingId, setProcSavingId] = useState<string | null>(null);

  // ── Fetch design data ──
  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const designData = await api.get<DesignRow[]>(`/api/v1/projects/${projectId}/design`);
      if (Array.isArray(designData) && designData.length > 0) {
        setGroups(designData.map((r) => ({
          ...r,
          redundancyCount: r.redundancyCount ?? 0,
        })));
        setDesignSubmitted(true);
      } else {
        setGroups([EMPTY_GROUP()]);
      }

      // Determine if procurement is submitted
      let procSubmittedFlag = false;
      try {
        const wf = await api.get<any>(`/api/v1/workflow/instances/${projectId}`);
        if (wf?.instance?.currentStepIndex >= 1 || wf?.instance?.status === 'Completed') {
          procSubmittedFlag = true;
        }
      } catch { /* no workflow yet */ }

      // Fetch procurement data if design exists
      if (Array.isArray(designData) && designData.length > 0) {
        const procData = await api.get<ProcurementRow[]>(`/api/v1/projects/${projectId}/procurement`);
        if (Array.isArray(procData)) {
          setProcRecords(procData);
          setProcSubmitted(procSubmittedFlag);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived totals ──
  const totalCells = groups.reduce((sum, g) => sum + 17 + (g.redundancyCount ?? 0), 0);

  // ── Design: submit ──
  const handleSubmitDesign = async () => {
    if (!projectId) return;

    if (groups.some((r) => !r.moleculeName?.trim())) {
      toast.error(t("molecule_name_required", "分子名称不可为空"));
      return;
    }
    if (groups.length === 0) {
      toast.error("请至少添加一个分组");
      return;
    }

    setSavingDesign(true);
    try {
      await api.post(`/api/v1/projects/${projectId}/design`, {
        groups: groups.map((r) => ({
          group: r.group,
          moleculeName: r.moleculeName,
          chineseName: r.chineseName,
          molecularStructure: r.molecularStructure || undefined,
          cas: r.cas,
          designPrinciple: r.designPrinciple || undefined,
          cellCount: 17,
          redundancyCount: r.redundancyCount ?? 0,
        })),
      });

      toast.success(t("design_submit_success"));
      setDesignSubmitted(true);
      setEditingIndex(null);
      setEditForm(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("create_failed"));
    } finally {
      setSavingDesign(false);
    }
  };

  // ── Design: inline edit ──
  const startEditing = (index: number) => {
    if (designSubmitted) return;
    setEditingIndex(index);
    setEditForm({ ...groups[index] });
  };
  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm(null);
  };
  const handleChange = (field: keyof DesignRow, value: string) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };
  const handleNumChange = (field: "redundancyCount", value: string) => {
    if (!editForm) return;
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setEditForm({ ...editForm, [field]: num });
    }
  };
  const handleSaveRow = () => {
    if (editingIndex === null || !editForm) return;
    if (!editForm.moleculeName?.trim()) {
      toast.error(t("molecule_name_required", "分子名称不可为空"));
      return;
    }
    const updated = [...groups];
    updated[editingIndex] = { ...editForm };
    setGroups(updated);
    setEditingIndex(null);
    setEditForm(null);
  };

  // ── Group management ──
  const handleAddGroup = () => {
    if (designSubmitted) return;
    setGroups((prev) => [...prev, EMPTY_GROUP(prev)]);
  };
  const handleDeleteGroup = (index: number) => {
    if (designSubmitted) return;
    if (groups.length <= 1) {
      toast.error("至少保留一个分组");
      return;
    }
    setGroups((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Batch edit ──
  const enterBatchEdit = () => {
    cancelEditing();
    setBatchDraft(groups.map((g) => ({ ...g })));
    setBatchEditing(true);
  };
  const cancelBatchEdit = () => {
    setBatchEditing(false);
    setBatchDraft([]);
  };
  const handleBatchFieldChange = (index: number, field: keyof DesignRow, value: string) => {
    setBatchDraft((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  const handleBatchNumChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setBatchDraft((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], redundancyCount: num };
        return updated;
      });
    }
  };
  const saveBatchEdit = () => {
    if (batchDraft.some((r) => !r.moleculeName?.trim())) {
      toast.error(t("molecule_name_required", "分子名称不可为空"));
      return;
    }
    setGroups(batchDraft);
    setBatchEditing(false);
    setBatchDraft([]);
    toast.success(t("design_saved", "批量修改已应用"));
  };

  // ── Procurement: submit ──
  const handleSubmitProcurement = async () => {
    setSavingProc(true);
    try {
      await api.put(`/api/v1/workflow/instances/${projectId}/transition`);
      toast.success(t("procurement_submit_success", "Procurement submitted, workflow advanced!"));
      setProcSubmitted(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("create_failed"));
    } finally {
      setSavingProc(false);
    }
  };

  // ── Procurement: update field ──
  const updateProcField = async (record: ProcurementRow, field: string, value: any) => {
    if (procSubmitted || !record.id) return;
    setProcSavingId(record.id);
    try {
      await api.put(`/api/v1/projects/${projectId}/procurement/${record.id}`, { [field]: value });
      setProcRecords((prev) =>
        prev.map((r) =>
          r.experimentDesignId === record.experimentDesignId ? { ...r, [field]: value } : r,
        ),
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("update_failed"));
    } finally {
      setProcSavingId(null);
    }
  };

  const toggleValid = async (record: ProcurementRow) => {
    if (procSubmitted) return;
    await updateProcField(record, "isValid", !record.isValid);
  };

  // ── Loading ──
  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("experiment_design")}
        description={t("experiment_design_desc")}
        onBack={() => navigate(`/projects/${projectId}`)}
        bordered
      />

      {/* Step Tabs */}
      <SegmentedControl
        items={[
          {
            value: "design",
            label: <span className="inline-flex items-center gap-1.5">1. {t("experiment_design")}{designSubmitted && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}</span>,
          },
          {
            value: "procurement",
            label: <span className="inline-flex items-center gap-1.5">2. {t("reagent_procurement")}{procSubmitted && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}</span>,
            disabled: !designSubmitted,
          },
        ]}
        value={step}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="sm:min-w-[360px]"
      />

      {/* ═══════ Step 1: Design ═══════ */}
      {step === "design" && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-col gap-4 rounded-md bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium text-gray-700">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                {t("design_group_count", "分组数")}: {groups.length}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                {t("design_cell_count", "电芯数")}: {totalCells}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {designSubmitted ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {t("design_submitted", "Design Submitted")}
                </span>
              ) : batchEditing ? (
                <>
                  <Button variant="secondary" size="sm" onClick={cancelBatchEdit}>
                    <X className="w-3.5 h-3.5" />
                    {t("cancel", "取消")}
                  </Button>
                  <Button size="sm" onClick={saveBatchEdit}>
                    <Check className="w-3.5 h-3.5" />
                    {t("design_save_all", "保存全部")}
                  </Button>
                  <Popconfirm title={t("design_submit_confirm", "确认提交实验设计？提交后不可修改。")} onConfirm={handleSubmitDesign} placement="top">
                    <Button size="sm" loading={savingDesign}>
                      <Save className="w-3.5 h-3.5" />
                      {t("design_submit")}
                    </Button>
                  </Popconfirm>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={enterBatchEdit}>
                    <Edit3 className="w-3.5 h-3.5" />
                    {t("design_batch_edit", "批量编辑")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleAddGroup}>
                    <Plus className="w-3.5 h-3.5" />
                    {t("design_add_group", "添加分组")}
                  </Button>
                  <Popconfirm title={t("design_submit_confirm", "确认提交实验设计？提交后不可修改。")} onConfirm={handleSubmitDesign} placement="top">
                    <Button size="sm" loading={savingDesign}>
                      <Save className="w-3.5 h-3.5" />
                      {t("design_submit")}
                    </Button>
                  </Popconfirm>
                </>
              )}
            </div>
          </div>

          {/* Design Table */}
          <TableWrapper className="max-h-[560px] overflow-auto rounded-lg !bg-white">
            <Table className="table-fixed w-full min-w-[960px] !divide-y-0">
              <TableHeader className="sticky top-0 z-20 !bg-gray-50">
                <TableRow>
                  <TableHead className="w-[3%]">#</TableHead>
                  <TableHead className="w-[7%]">{t("design_group")}</TableHead>
                  <TableHead className="w-[12%]">
                    <span className="text-red-500 mr-1">*</span>
                    {t("design_molecule_name")}
                  </TableHead>
                  <TableHead className="w-[12%]">{t("design_chinese_name")}</TableHead>
                  <TableHead className="w-[7%]">{t("design_cas")}</TableHead>
                  <TableHead className="w-[11%]">{t("design_principle")}</TableHead>

                  <TableHead className="w-[7%]">{t("design_redundancy", "冗余")}</TableHead>
                  <TableHead className="w-[9%]">{t("design_internal_code")}</TableHead>
                  <TableHead className="w-[7%] sticky right-0 z-20 !bg-gray-50">
                    {t("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="!divide-y divide-gray-100/70 !bg-transparent">
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-400 py-12">
                      {t("design_no_groups", '暂无分组，请点击上方「添加分组」')}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((row, i) => {
                    const editing = editingIndex === i || batchEditing;
                    return (
                      <TableRow key={i} className={cn("h-11", batchEditing && "bg-gray-50")}>
                        <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                        <TableCell>
                          {batchEditing ? (
                            <input className="h-7 w-full min-w-12 rounded-control border-0 bg-gray-100 px-2 text-xs font-mono outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
                              value={batchDraft[i]?.group ?? ""}
                              onChange={(e) => handleBatchFieldChange(i, "group", e.target.value)}
                              autoFocus={i === 0}
                            />
                          ) : (
                            <CellText
                              value={row.group}
                              editing={editingIndex === i}
                              editValue={editForm?.group ?? ""}
                              onEdit={(v) => handleChange("group", v)}
                              onClick={() => startEditing(i)}
                              locked={designSubmitted}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {batchEditing ? (
                            <input className="h-7 w-full min-w-12 rounded-control border-0 bg-gray-100 px-2 text-xs font-mono outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
                              value={batchDraft[i]?.moleculeName ?? ""}
                              onChange={(e) => handleBatchFieldChange(i, "moleculeName", e.target.value)}
                            />
                          ) : (
                            <CellText
                              value={row.moleculeName}
                              editing={editingIndex === i}
                              editValue={editForm?.moleculeName ?? ""}
                              onEdit={(v) => handleChange("moleculeName", v)}
                              onClick={() => startEditing(i)}
                              locked={designSubmitted}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {batchEditing ? (
                            <input className="h-7 w-full min-w-12 rounded-control border-0 bg-gray-100 px-2 text-xs font-mono outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
                              value={batchDraft[i]?.chineseName ?? ""}
                              onChange={(e) => handleBatchFieldChange(i, "chineseName", e.target.value)}
                            />
                          ) : (
                            <CellText
                              value={row.chineseName}
                              editing={editingIndex === i}
                              editValue={editForm?.chineseName ?? ""}
                              onEdit={(v) => handleChange("chineseName", v)}
                              onClick={() => startEditing(i)}
                              locked={designSubmitted}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {batchEditing ? (
                            <input className="h-7 w-full min-w-12 rounded-control border-0 bg-gray-100 px-2 text-xs font-mono outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
                              value={batchDraft[i]?.cas ?? ""}
                              onChange={(e) => handleBatchFieldChange(i, "cas", e.target.value)}
                            />
                          ) : (
                            <CellText
                              value={row.cas}
                              editing={editingIndex === i}
                              editValue={editForm?.cas ?? ""}
                              onEdit={(v) => handleChange("cas", v)}
                              onClick={() => startEditing(i)}
                              locked={designSubmitted}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {batchEditing ? (
                            <input className="h-7 w-full min-w-24 rounded-control border-0 bg-gray-100 px-2 text-xs font-mono outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
                              value={batchDraft[i]?.designPrinciple ?? ""}
                              onChange={(e) => handleBatchFieldChange(i, "designPrinciple", e.target.value)}
                            />
                          ) : (
                            <CellText
                              value={row.designPrinciple}
                              editing={editingIndex === i}
                              editValue={editForm?.designPrinciple ?? ""}
                              onEdit={(v) => handleChange("designPrinciple", v)}
                              onClick={() => startEditing(i)}
                              locked={designSubmitted}
                              className="line-clamp-1 max-w-[120px]"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {batchEditing ? (
                            <input className="h-7 w-14 rounded-control border-0 bg-gray-100 px-1.5 text-center text-xs outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
                              type="number" min={0} max={50}
                              value={batchDraft[i]?.redundancyCount ?? 0}
                              onChange={(e) => handleBatchNumChange(i, e.target.value)}
                            />
                          ) : editingIndex === i ? (
                            <input
                              className="h-7 w-14 rounded-control border-0 bg-gray-100 px-1.5 text-center text-xs outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
                              type="number" min={0} max={50}
                              value={editForm?.redundancyCount ?? 0}
                              onChange={(e) => handleNumChange("redundancyCount", e.target.value)}
                            />
                          ) : (
                            <span
                              className={cn("inline-flex h-7 items-center text-xs",
                                designSubmitted ? "text-gray-700" : "cursor-pointer text-gray-700 hover:text-gray-950",
                              )}
                              onClick={() => !designSubmitted && startEditing(i)}
                            >
                              {row.redundancyCount ?? 0}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                            {row.internalCode || "—"}
                          </code>
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 !bg-white">
                          {designSubmitted ? (
                            <Lock className="w-3.5 h-3.5 text-gray-300 mx-auto" />
                          ) : editingIndex === i && !batchEditing ? (
                            <div className="flex gap-0.5">
                              <Button variant="text" size="sm" onClick={handleSaveRow}
                                className="!p-1 hover:!text-emerald-600 hover:bg-emerald-50"><Check className="w-3.5 h-3.5" /></Button>
                              <Button variant="text" size="sm" onClick={cancelEditing}
                                className="!p-1 hover:bg-gray-100"><X className="w-3.5 h-3.5" /></Button>
                            </div>
                          ) : batchEditing ? (
                            <Trash2 className="w-3.5 h-3.5 text-gray-300 mx-auto opacity-0" />
                          ) : (
                            <div className="flex gap-0.5">
                              <Button variant="text" size="sm" onClick={() => startEditing(i)}
                                className="!p-1 hover:!text-gray-900 hover:bg-gray-100"><Edit3 className="w-3.5 h-3.5" /></Button>
                              <Popconfirm title={t("design_delete_group_confirm", "确定删除此分组？")}
                                onConfirm={() => handleDeleteGroup(i)} placement="top">
                                <Button variant="text" size="sm"
                                  className="!p-1 hover:!text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </Popconfirm>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableWrapper>
        </div>
      )}

      {/* ═══════ Step 2: Procurement ═══════ */}
      {step === "procurement" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 rounded-md bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-4 text-[13px] font-medium text-gray-700">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                {t("procurement_is_valid")}: {procRecords.filter((r) => r.isValid).length}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {t("procurement_invalid")}: {procRecords.filter((r) => !r.isValid).length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {procSubmitted ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {t("procurement_submitted", "Procurement Submitted")}
                </span>
              ) : (
                <Popconfirm
                  title={t("procurement_confirm", "确认提交试剂采购？提交后将推进工作流，不可撤回。")}
                  onConfirm={handleSubmitProcurement}
                  placement="top"
                >
                  <Button size="sm" loading={savingProc}>
                    <Save className="w-3.5 h-3.5" />
                    {t("design_submit")}
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>

          <TableWrapper className="max-h-[560px] overflow-auto rounded-lg !bg-white">
            <Table className="table-fixed w-full min-w-[1100px] !divide-y-0">
              <TableHeader className="sticky top-0 z-20 !bg-gray-50">
                <TableRow>
                  <TableHead className="w-[4%]">#</TableHead>
                  <TableHead className="w-[8%]">{t("design_group")}</TableHead>
                  <TableHead className="w-[12%]">{t("design_molecule_name")}</TableHead>
                  <TableHead className="w-[10%]">{t("design_internal_code")}</TableHead>
                  <TableHead className="w-[12%]">{t("procurement_supplier")}</TableHead>
                  <TableHead className="w-[10%]">{t("procurement_batch_no")}</TableHead>
                  <TableHead className="w-[8%]">{t("procurement_purity")}</TableHead>
                  <TableHead className="w-[8%]">{t("procurement_quantity")}</TableHead>
                  <TableHead className="w-[8%]">{t("procurement_is_valid")}</TableHead>
                  <TableHead className="w-[12%]">{t("procurement_remark")}</TableHead>
                  <TableHead className="w-[8%] sticky right-0 z-20 !bg-gray-50">
                    {t("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="!divide-y divide-gray-100/70 !bg-transparent">
                {procRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-gray-400 py-12">
                      {t("no_data_available", { type: t("reagent_procurement") })}
                    </TableCell>
                  </TableRow>
                ) : (
                  procRecords.map((record, i) => (
                    <TableRow
                      key={record.experimentDesignId || i}
                      className={cn(!record.isValid ? "opacity-60" : "")}
                    >
                      <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-xs">{record.group}</TableCell>
                      <TableCell className="text-xs">{record.moleculeName}</TableCell>
                      <TableCell>
                        <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                          {record.internalCode || "—"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <ProcCell
                          value={record.supplier || ""}
                          onSave={(v) => updateProcField(record, "supplier", v)}
                          saving={procSavingId === record.id}
                          locked={procSubmitted}
                          editing={procEditId === record.id}
                        />
                      </TableCell>
                      <TableCell>
                        <ProcCell
                          value={record.batchNo || ""}
                          onSave={(v) => updateProcField(record, "batchNo", v)}
                          saving={procSavingId === record.id}
                          locked={procSubmitted}
                          editing={procEditId === record.id}
                        />
                      </TableCell>
                      <TableCell>
                        <ProcCell
                          value={record.purity || ""}
                          onSave={(v) => updateProcField(record, "purity", v)}
                          saving={procSavingId === record.id}
                          locked={procSubmitted}
                          editing={procEditId === record.id}
                        />
                      </TableCell>
                      <TableCell>
                        <ProcCell
                          value={record.quantity || ""}
                          onSave={(v) => updateProcField(record, "quantity", v)}
                          saving={procSavingId === record.id}
                          locked={procSubmitted}
                          editing={procEditId === record.id}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={record.isValid}
                          onChange={() => toggleValid(record)}
                          size="sm"
                          disabled={procSubmitted}
                        />
                      </TableCell>
                      <TableCell>
                        <ProcCell
                          value={record.remark || ""}
                          onSave={(v) => updateProcField(record, "remark", v)}
                          saving={procSavingId === record.id}
                          locked={procSubmitted}
                          editing={procEditId === record.id}
                        />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "sticky right-0 z-10 !bg-white",
                        )}
                      >
                        <div className="flex items-center gap-1 justify-center">
                          {procSubmitted ? (
                            <Lock className="w-3.5 h-3.5 text-gray-300" />
                          ) : procEditId === record.id ? (
                            <>
                              <Button
                                variant="text"
                                size="sm"
                                onClick={() => {
                                  setProcEditId(null);
                                  toast.success(t("procurement_updated"));
                                }}
                                className="!p-1 hover:!text-emerald-600 hover:bg-emerald-50"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="text"
                                size="sm"
                                onClick={() => setProcEditId(null)}
                                className="!p-1 hover:bg-gray-100"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="text"
                              size="sm"
                              onClick={() => setProcEditId(record.id)}
                              className="!p-1 hover:!text-gray-900 hover:bg-gray-100"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
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
      )}
    </div>
  );
}

// ─── CellText ───────────────────────────────────────────────────

function CellText({
  value,
  editing,
  editValue,
  onEdit,
  onClick,
  locked,
  className,
}: {
  value: string;
  editing: boolean;
  editValue: string;
  onEdit: (v: string) => void;
  onClick: () => void;
  locked: boolean;
  className?: string;
}) {
  if (locked)
    return (
      <span className={cn("text-xs text-gray-500", className)}>
        {value || <span className="text-gray-300 italic">—</span>}
      </span>
    );
  if (editing)
    return (
      <input
        className="h-7 w-full min-w-12 rounded-control border-0 bg-gray-100 px-2 text-xs font-mono outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
        value={editValue}
        onChange={(e) => onEdit(e.target.value)}
        autoFocus
      />
    );
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center text-xs text-gray-700 cursor-pointer hover:text-gray-950",
        className,
      )}
      onClick={onClick}
    >
      {value || <span className="text-gray-300 italic">—</span>}
    </span>
  );
}

// ─── ProcCell ───────────────────────────────────────────────────

function ProcCell({
  value,
  onSave,
  saving,
  locked,
  editing,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  saving: boolean;
  locked: boolean;
  editing: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  if (locked)
    return (
      <span className="text-xs text-gray-500">
        {value || <span className="text-gray-300 italic">—</span>}
      </span>
    );
  if (editing)
    return (
      <input
        className="h-7 w-20 rounded-control border-0 bg-gray-100 px-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-focus/35"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft !== value) onSave(draft);
        }}
        autoFocus
      />
    );
  return (
    <span className={cn("inline-flex h-7 min-w-[50px] items-center text-xs", value ? "text-gray-700" : "text-gray-300 italic")}>
      {value || "—"}
      {saving && <Loader2 className="w-2.5 h-2.5 animate-spin inline ml-1" />}
    </span>
  );
}
