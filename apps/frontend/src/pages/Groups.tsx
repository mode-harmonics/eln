import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLoaderData } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Save, X, ChevronLeft, Settings2, Loader2 } from "lucide-react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonCard } from "../components/Skeleton";
import { api, ApiError } from "../lib/api";
import type { CellGroup } from "../types";
import { GROUP_PALETTE } from "../utils/chartColors";
import { Popconfirm } from "../components/Popconfirm";

export function Groups() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const loaderData = useLoaderData<{ projectName: string } | null>();
  const [projectName, setProjectName] = useState(loaderData?.projectName ?? "");

  const [groups, setGroups] = useState<CellGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New / edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CellGroup | null>(null);
  const [formName, setFormName] = useState("");
  const [formMode, setFormMode] = useState<"prefix" | "manual">("prefix");
  const [formMatchValue, setFormMatchValue] = useState("");
  const [formColor, setFormColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);



  const fetchGroups = () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    api.get<CellGroup[]>(`/api/v1/projects/${projectId}/groups`)
      .then(setGroups)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("upload_error")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroups();
  }, [projectId]);

  const openCreate = () => {
    setEditingGroup(null);
    setFormName("");
    setFormMode("prefix");
    setFormMatchValue("");
    setFormColor("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (g: CellGroup) => {
    setEditingGroup(g);
    setFormName(g.name);
    setFormMode(g.matchMode as "prefix" | "manual");
    setFormMatchValue(g.matchValue ?? "");
    setFormColor(g.color);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("请输入分组名称");
      return;
    }
    if (formMode === "prefix" && !formMatchValue.trim()) {
      setFormError("前缀模式请输入前缀值");
      return;
    }
    if (!projectId) return;

    setSaving(true);
    setFormError(null);
    try {
      if (editingGroup) {
        await api.put(`/api/v1/projects/${projectId}/groups/${editingGroup.id}`, {
          name: formName.trim(),
          color: formColor || undefined,
          matchMode: formMode,
          matchValue: formMode === "prefix" ? formMatchValue.trim() : undefined,
        });
      } else {
        await api.post(`/api/v1/projects/${projectId}/groups`, {
          name: formName.trim(),
          matchMode: formMode,
          matchValue: formMode === "prefix" ? formMatchValue.trim() : undefined,
          color: formColor || undefined,
        });
      }
      setModalOpen(false);
      fetchGroups();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };



  const unusedColors = GROUP_PALETTE.filter(
    (c: string) => !groups.some((g) => g.color === c) || editingGroup?.color === c,
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings2 className="w-6 h-6" />
            {t("group_management")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("group_management_desc")}
          </p>
        </div>
        <Button onClick={openCreate} variant="secondary">
          <Plus className="w-4 h-4" />
          {t("add_group")}
        </Button>
      </div>

      <div className="border-b border-gray-200" />

      {loading ? (
        <SkeletonCard rows={4} />
      ) : error ? (
        <div className="text-red-500 text-sm">{error}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border border-gray-200">
          <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("no_groups")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Color indicator */}
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                style={{ backgroundColor: g.color }}
              />

              {/* Group info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{g.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    g.matchMode === "prefix"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-purple-50 text-purple-600"
                  }`}>
                    {g.matchMode === "prefix" ? t("prefix_match") : t("manual_match")}
                  </span>
                </div>
                {g.matchMode === "prefix" && g.matchValue && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("prefix_value")}: <code className="bg-gray-100 px-1 rounded">{g.matchValue}</code>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Popconfirm
                  title={t("delete_group_confirm", { name: g.name }).replace(/<strong>|<\/strong>/g, "")}
                  onConfirm={async () => {
                    if (!projectId) return;
                    try {
                      await api.delete(`/api/v1/projects/${projectId}/groups/${g.id}`);
                      fetchGroups();
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : "删除失败");
                    }
                  }}
                  placement="left"
                >
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGroup ? t("edit_group") : t("add_group")}
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
            <Button size="sm" type="submit" form="modal-groups-form" loading={saving}>{t("save")}</Button>
          </>
        }
      >
        <form id="modal-groups-form" onSubmit={handleSave} className="space-y-4">
          {/* Group name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("group_name")}</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d74f5] focus:border-transparent"
              placeholder={t("group_name_placeholder")}
            />
          </div>

          {/* Match mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("match_mode")}</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="matchMode"
                  checked={formMode === "prefix"}
                  onChange={() => setFormMode("prefix")}
                  className="text-[#1d74f5]"
                />
                <span className="text-sm">{t("prefix_match")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="matchMode"
                  checked={formMode === "manual"}
                  onChange={() => setFormMode("manual")}
                  className="text-[#1d74f5]"
                />
                <span className="text-sm">{t("manual_match")}</span>
              </label>
            </div>
          </div>

          {/* Prefix value */}
          {formMode === "prefix" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("prefix_value")}</label>
              <input
                type="text"
                value={formMatchValue}
                onChange={(e) => setFormMatchValue(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d74f5] focus:border-transparent"
                placeholder={t("prefix_value_placeholder")}
              />
              <p className="text-xs text-gray-400 mt-1">{t("prefix_value_hint")}</p>
            </div>
          )}

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("color")}</label>
            <div className="flex flex-wrap gap-2">
              {unusedColors.map((c: string) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formColor === c ? "border-gray-800 scale-110" : "border-white shadow-sm"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}
        </form>
      </Modal>

    </div>
  );
}
