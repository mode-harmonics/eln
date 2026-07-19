import React, { useEffect, useState } from "react";
import { Shield, Loader2, ChevronDown, ChevronRight, Plus, Edit3, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { TextInput } from "../components/FormFields";
import { SearchInput } from "../components/SearchInput";
import { Tooltip } from "../components/Tooltip";
import { Card, CardHeader, CardContent, CardFooter } from "../components/Card";
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/Table";
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

      // data:* → all child perms (all actions)
      if (raw.includes("data:*")) {
        expanded.add("data:read");
        expanded.add("data:write");
        for (const action of ["read", "write", "*"]) {
          childKeys.forEach((c) => expanded.add(`${c}:${action}`));
        }
      }
      // data:read → all child :read (only if data:* not present)
      if (!raw.includes("data:*") && raw.includes("data:read")) {
        childKeys.forEach((c) => expanded.add(`${c}:read`));
      }
      // data:write → all child :write (only if data:* not present)
      if (!raw.includes("data:*") && raw.includes("data:write")) {
        childKeys.forEach((c) => expanded.add(`${c}:write`));
      }

      setPermissionList(Array.from(expanded));
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

  const specialActionRow = (key: string, action: string, label: string) => {
    const isFC = permissionList.includes(`${key}:*`);
    const perm = `${key}:${action}`;
    const hasPerm = isFC || permissionList.includes(perm);
    const disabled = editingRole?.name === "Owner" || isFC;
    const toggle = (checked: boolean) => {
      if (checked) setPermissionList((prev) => [...prev, perm]);
      else setPermissionList((prev) => prev.filter((p) => p !== perm));
    };
    return (
      <tr key={`${key}-${action}`} className="hover:bg-gray-50/50 transition-colors bg-gray-50/30">
        <td className="px-4 py-3 text-sm text-gray-600 pl-8 flex items-center gap-2">
          <div className="w-1 h-1 bg-gray-300 rounded-full" />
          {label}
        </td>
        <td className="px-4 py-3 text-center"></td>
        <td className="px-4 py-3 text-center">
          <Cb checked={hasPerm} disabled={disabled} onChange={toggle} />
        </td>
        <td className="px-4 py-3 text-center"></td>
      </tr>
    );
  };

  // ── Data (7 business tables) — expandable group ──
  const DATA_CHILD_KEYS = [
    "data_process", "data_calendar", "data_swelling", "data_efficiency",
    "data_dcr", "data_fastcharge", "data_htcycle",
  ];

  const DATA_CHILD_RESOURCES = [
    { key: "data_process", label: t("process_data") },
    { key: "data_calendar", label: t("calendar_life") },
    { key: "data_swelling", label: t("storage_swelling") },
    { key: "data_efficiency", label: t("energy_efficiency") },
    { key: "data_dcr", label: t("dcr_test") },
    { key: "data_fastcharge", label: t("fast_charge") },
    { key: "data_htcycle", label: t("ht_cycle") },
  ];

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

    const parentFC = permissionList.includes("data:*");
    const parentRead = parentFC || permissionList.includes("data:read");
    const parentWrite = parentFC || permissionList.includes("data:write");
    const disabled = editingRole?.name === "Owner";

    const handleParent = (action: string, checked: boolean) => {
      if (checked) {
        const additions: string[] = [`data:${action}`];
        if (action === "*") {
          // data:* → data:read + data:write + all children *:read:write
          additions.push("data:read", "data:write");
          for (const c of DATA_CHILD_KEYS) {
            additions.push(`${c}:*`, `${c}:read`, `${c}:write`);
          }
        } else {
          // data:read or data:write → only matching child action
          for (const c of DATA_CHILD_KEYS) {
            additions.push(`${c}:${action}`);
          }
        }
        setPermissionList((prev) => [...new Set([...prev, ...additions])]);
      } else {
        // Uncheck: remove parent perm and matching child perms
        const removeKeys: string[] = [`data:${action}`];
        for (const c of DATA_CHILD_KEYS) {
          if (action === "*") {
            removeKeys.push(`${c}:read`, `${c}:write`, `${c}:*`);
          } else {
            removeKeys.push(`${c}:${action}`);
          }
        }
        if (action === "*") {
          removeKeys.push("data:read", "data:write");
        }
        const removeSet = new Set(removeKeys);
        setPermissionList((prev) => prev.filter((p) => !removeSet.has(p)));
      }
    };

    return (
      <React.Fragment key="data-group">
        {/* Parent / group header row */}
        <tr className="bg-blue-50/60 hover:bg-blue-100/50 cursor-pointer select-none" onClick={toggleGroup}>
          <td className="px-4 py-3 text-sm font-semibold text-[#1d74f5]">
            <span className="inline-flex items-center gap-1.5">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {t("data")}
              <Tooltip content={`${t("data")}: read/write/* → 控制所有子表`}>
                <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
              </Tooltip>
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
        {isExpanded && DATA_CHILD_RESOURCES.map((r) => {
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
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("role_name")}</TableHead>
                <TableHead>{t("permissions")}</TableHead>
                {hasPermission("roles:write") && <TableHead className="text-right sticky right-0 z-20 bg-white">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-gray-50 rounded text-gray-600">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="text-[13px] font-medium text-gray-900">
                        {role.name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[13px] text-gray-500 truncate max-w-md">
                      {Array.isArray(role.permissionList) ? role.permissionList.join(", ") : "No explicit permissions"}
                    </div>
                  </TableCell>
                  {hasPermission("roles:write") && (
                    <TableCell className="text-right sticky right-0 z-10 bg-white group-hover:bg-gray-50">
                      <Button variant="text" onClick={() => { setEditingRole(role); setIsEditModalOpen(true); }} className="text-gray-400! hover:text-[#1d74f5]!">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
        ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="flex flex-col">
              <CardHeader className="pb-0 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded text-gray-600">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-[17px] text-gray-900">
                    {role.name}
                  </h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-gray-600">
                  {Array.isArray(role.permissionList) ? role.permissionList.join(", ") : "No permissions configured"}
                </p>
              </CardContent>
              {hasPermission("roles:write") && (
                <CardFooter className="justify-center mt-auto">
                  <Button variant="text" onClick={() => { setEditingRole(role); setIsEditModalOpen(true); }} className="text-gray-400! hover:text-[#1d74f5]!">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
        )}
        {totalItems > pageSize && (
        <div className="flex justify-end pt-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
        )}
      </div>

      {/* Create Role Modal */}
      <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t("create_new_role")}
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t("cancel")}</Button>
            <Button size="sm" type="submit" form="modal-create-role-form" loading={saving} disabled={saving}>{t("save_role")}</Button>
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
            <Button size="sm" variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t("cancel")}</Button>
            <Button size="sm" type="submit" form="modal-role-form" loading={saving} disabled={saving || editingRole?.name === "Owner"}>{t("save")}</Button>
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

          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("module_resource")}</TableHead>
                  <TableHead className="text-center">{t("read")}</TableHead>
                  <TableHead className="text-center">{t("write")}</TableHead>
                  <TableHead className="text-center">{t("full_control")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permRow("projects", t("projects"))}
                {permRow("experiments", t("experiments"))}
                {specialActionRow("experiments", "approve", "审批 (Approve)")}
                {specialActionRow("experiments", "archive", "归档 (Archive)")}
                {dataGroup()}
                {permRow("workflow", "工作流")}
                {specialActionRow("workflow", "transition", "提交步骤 (Transition)")}
                {permRow("users", t("user_management"))}
                {permRow("roles", t("role_management"))}
              </TableBody>
            </Table>
          </TableWrapper>
        </form>
      </Modal>
    </div>
  );
}
