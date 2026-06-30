import React, { useEffect, useState } from "react";
import { Shield, Loader2, ChevronDown, ChevronRight, Plus, Edit3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { TextInput } from "../components/FormFields";
import { SearchInput } from "../components/SearchInput";
import { useViewMode } from "../hooks/useViewMode";
import { usePermissions } from "../hooks/usePermissions";
import { api, ApiError } from "../lib/api";
import type { Role } from "../types";

export function Roles() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [viewMode, setViewMode] = useViewMode("roles_view_mode", "grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const [permissionList, setPermissionList] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Create role state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/v1/roles", {
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setCurrentPage(1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t("create_failed"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (editingRole) {
      const raw = editingRole.permissionList || [];
      // Expand implied child permissions for the "data" parent group
      const childKeys = [
        "data_process", "data_calendar", "data_swelling", "data_efficiency",
        "data_dcr", "data_fastcharge", "data_htcycle",
      ];
      const expanded = new Set(raw);
      for (const action of ["read", "write"]) {
        if (raw.includes(`data:${action}`)) {
          childKeys.forEach((c) => expanded.add(`${c}:${action}`));
        }
      }
      if (raw.includes("data:*")) {
        childKeys.forEach((c) => expanded.add(`${c}:*`));
      }
      setPermissionList([...expanded]);
    } else {
      setPermissionList([]);
    }
  }, [editingRole]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(currentPage));
    queryParams.append("limit", String(pageSize));
    if (searchQuery.trim()) {
      queryParams.append("search", searchQuery.trim());
    }

    api.get<{ items: Role[]; total: number }>(`/api/v1/roles?${queryParams.toString()}`)
      .then((res) => { if (!cancelled) { setRoles(res.items); setTotalItems(res.total); } })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "加载角色列表失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, pageSize, searchQuery]);

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    setSaving(true);
    try {
      const updatedRole = await api.put<Role>(`/api/v1/roles/${editingRole.id}`, {
        permissionList,
      });
      setRoles((prev) => prev.map((r) => (r.id === editingRole.id ? updatedRole : r)));
      setIsEditModalOpen(false);
      setEditingRole(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "更新角色权限失败");
    } finally {
      setSaving(false);
    }
  };

  // ── Permission row helper ──
  const Cb = ({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) => (
    <label className={`flex items-center justify-center w-5 h-5 flex-none rounded border-2 transition-colors cursor-pointer mx-auto ${checked ? 'bg-[#1d74f5] border-[#1d74f5]' : 'border-gray-300 hover:border-gray-400'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <svg className={`w-3 h-3 text-white pointer-events-none ${checked ? 'block' : 'hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </label>
  );

  const permRow = (key: string, label: string) => {
    const isFC = permissionList.includes(`${key}:*`);
    const isRead = isFC || permissionList.includes(`${key}:read`);
    const isWrite = isFC || permissionList.includes(`${key}:write`);
    const toggle = (action: string, checked: boolean) => {
      const perm = `${key}:${action}`;
      if (checked) setPermissionList((prev) => [...prev, perm]);
      else setPermissionList((prev) => prev.filter((p) => p !== perm));
    };
    const disabled = editingRole?.name === "Owner";
    return (
      <tr key={key} className="hover:bg-gray-50/50 transition-colors">
        <td className="px-4 py-3 text-sm font-medium text-gray-700">{label}</td>
        <td className="px-4 py-3 text-center">
          <Cb checked={isRead} disabled={disabled || isFC} onChange={(v) => toggle("read", v)} />
        </td>
        <td className="px-4 py-3 text-center">
          <Cb checked={isWrite} disabled={disabled || isFC} onChange={(v) => toggle("write", v)} />
        </td>
        <td className="px-4 py-3 text-center">
          <Cb checked={isFC} disabled={disabled} onChange={(v) => toggle("*", v)} />
        </td>
      </tr>
    );
  };

  // ── Data (7 business tables) — expandable group ──
  const dataGroup = () => {
    const groupKey = "data_group";
    const isExpanded = expandedGroups.has(groupKey);
    const toggleGroup = () =>
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) next.delete(groupKey);
        else next.add(groupKey);
        return next;
      });

    // Parent row uses "data" key — when checked, auto-sets all child permissions
    const parentKey = "data";
    const parentFC = permissionList.includes(`${parentKey}:*`);
    const parentRead = parentFC || permissionList.includes(`${parentKey}:read`);
    const parentWrite = parentFC || permissionList.includes(`${parentKey}:write`);
    const handleParent = (action: string, checked: boolean) => {
      const perm = `${parentKey}:${action}`;
      const childKeys = [
        "data_process", "data_calendar", "data_swelling", "data_efficiency",
        "data_dcr", "data_fastcharge", "data_htcycle",
      ];
      if (checked) {
        const additions = [perm, ...childKeys.map((c) => `${c}:${action}`)];
        setPermissionList((prev) => [...new Set([...prev, ...additions])]);
      } else {
        setPermissionList((prev) => prev.filter((p) => p !== perm && !childKeys.some((c) => p.startsWith(c))));
      }
    };

    const childResources = [
      { key: "data_process",    label: t("process_data") },
      { key: "data_calendar",   label: t("calendar_life") },
      { key: "data_swelling",   label: t("storage_swelling") },
      { key: "data_efficiency", label: t("energy_efficiency") },
      { key: "data_dcr",        label: t("dcr_test") },
      { key: "data_fastcharge", label: t("fast_charge") },
      { key: "data_htcycle",    label: t("ht_cycle") },
    ];

    return (
      <React.Fragment key="data-group">
        {/* Parent / group header row */}
        <tr className="bg-blue-50/60 hover:bg-blue-100/50 cursor-pointer select-none" onClick={toggleGroup}>
          <td className="px-4 py-3 text-sm font-semibold text-[#1d74f5]">
            <span className="inline-flex items-center gap-1.5">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {t("data")}
            </span>
          </td>
          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
            <Cb checked={parentRead} disabled={parentFC || editingRole?.name === "Owner"} onChange={(v) => handleParent("read", v)} />
          </td>
          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
            <Cb checked={parentWrite} disabled={parentFC || editingRole?.name === "Owner"} onChange={(v) => handleParent("write", v)} />
          </td>
          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
            <Cb checked={parentFC} disabled={editingRole?.name === "Owner"} onChange={(v) => handleParent("*", v)} />
          </td>
        </tr>

        {/* Child rows */}
        {isExpanded && childResources.map((r) => {
          const isFC = permissionList.includes(`${r.key}:*`);
          const isRead = isFC || permissionList.includes(`${r.key}:read`);
          const isWrite = isFC || permissionList.includes(`${r.key}:write`);
          const toggle = (action: string, checked: boolean) => {
            const perm = `${r.key}:${action}`;
            if (checked) setPermissionList((prev) => [...prev, perm]);
            else setPermissionList((prev) => prev.filter((p) => p !== perm));
          };
          const disabled = editingRole?.name === "Owner";
          return (
            <tr key={r.key} className="bg-gray-50/80 hover:bg-gray-100/60 border-l-2 border-[#1d74f5]/30">
              <td className="pl-9 pr-4 py-2.5 text-sm text-gray-600">{r.label}</td>
              <td className="px-4 py-2.5 text-center"><Cb checked={isRead} disabled={disabled || isFC} onChange={(v) => toggle("read", v)} /></td>
              <td className="px-4 py-2.5 text-center"><Cb checked={isWrite} disabled={disabled || isFC} onChange={(v) => toggle("write", v)} /></td>
              <td className="px-4 py-2.5 text-center"><Cb checked={isFC} disabled={disabled} onChange={(v) => toggle("*", v)} /></td>
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("role_management")}
        </h1>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={() => { setSearchQuery(searchInput); setCurrentPage(1); }}
            placeholder={t("search_roles")}
          />
          <div className="flex items-center gap-4">
            <ViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              className="hidden sm:flex"
            />
            <Button size="sm" variant="secondary" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              {t("create_role")}
            </Button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="border border-gray-200 rounded bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("role_name")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("permissions")}
                    </th>
                    {hasPermission("roles:write") && (
                      <th scope="col" className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {t("actions")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-gray-50 rounded text-gray-600">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div className="text-[13px] font-medium text-gray-900">
                            {role.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[13px] text-gray-500 truncate max-w-md">
                          {Array.isArray(role.permissionList) ? role.permissionList.join(", ") : "No explicit permissions"}
                        </div>
                      </td>
                      {hasPermission("roles:write") && (
                        <td className="text-[13px] px-6 py-4 whitespace-nowrap text-right">
                          <Button variant="text" onClick={() => { setEditingRole(role); setIsEditModalOpen(true); }} className="!text-gray-400 hover:!text-[#1d74f5]">
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="border border-gray-200 rounded p-6 bg-white hover:border-gray-300 transition-colors flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 rounded text-gray-600">
                      <Shield className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-[17px] text-gray-900">
                      {role.name}
                    </h3>
                  </div>
                </div>
                <p className="text-[13px] text-gray-600 flex-1">
                  {Array.isArray(role.permissionList) ? role.permissionList.join(", ") : "No permissions configured"}
                </p>
                {hasPermission("roles:write") && (
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center">
                    <Button variant="text" onClick={() => { setEditingRole(role); setIsEditModalOpen(true); }} className="!text-gray-400 hover:!text-[#1d74f5]">
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          className={viewMode === "list" ? "border-t border-gray-200 bg-white" : ""}
        />
      </div>

      {/* Create Role Modal */}
      <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t("create_new_role")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" form="modal-create-role-form" loading={saving} disabled={saving}>{t("save_role")}</Button>
          </>
        }>
        <form id="modal-create-role-form" onSubmit={handleCreateRole} className="space-y-5">
          <TextInput
            id="role-name"
            label={t("role_name")}
            required
            placeholder={t("role_name_placeholder")}
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("description")}</label>
            <textarea
              rows={3}
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors resize-y"
              placeholder={t("role_desc_placeholder")}
            />
          </div>
        </form>
      </Modal>

      <Modal open={isEditModalOpen && !!editingRole} onClose={() => setIsEditModalOpen(false)} title={`${t("edit_permissions")}`} maxWidth="2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" form="modal-role-form" loading={saving} disabled={saving || editingRole?.name === "Owner"}>{t("save")}</Button>
          </>
        }>
        <form id="modal-role-form" onSubmit={handleUpdateRole} className="space-y-5">
          {/* Role info header */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{editingRole?.name}</p>
            </div>
            {editingRole?.name === "Owner" && (
              <span className="ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                {t("full_control")}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600">{t("adjust_access")}</p>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/80">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t("module_resource")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t("read")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t("write")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t("full_control")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {permRow("projects", t("projects"))}
                {permRow("experiments", t("experiments"))}
                {dataGroup()}
                {permRow("users", t("user_management"))}
                {permRow("roles", t("role_management"))}
              </tbody>
            </table>
          </div>
        </form>
      </Modal>
    </div>
  );
}
