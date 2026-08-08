import React, { useEffect, useState } from "react";
import { Shield, Loader2, Plus, Edit3, Check, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PERMISSION_TREE_META, PermissionGroupMeta } from "@eln/shared";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { TextInput } from "../components/FormFields";
import { SearchInput } from "../components/SearchInput";
import { Card, CardHeader, CardContent, CardFooter } from "../components/Card";
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/Table";
import { useViewMode } from "../hooks/useViewMode";
import { usePermissions } from "../hooks/usePermissions";
import { api, ApiError } from "../lib/api";
import type { Role } from "../types";
import { PageHeader } from "../components/PageHeader";
import { ListToolbar } from "../components/ListToolbar";

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
  const [refetchTrigger, setRefetchTrigger] = useState(0);

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
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t("create_failed"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (editingRole) {
      setPermissionList(editingRole.permissionList || []);
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
  }, [currentPage, pageSize, searchQuery, refetchTrigger]);

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

  const isOwner = editingRole?.name === "Owner";

  const isPermChecked = (permKey: string) => {
    if (isOwner || permissionList.includes("*")) return true;
    const [res] = permKey.split(":");
    if (permissionList.includes(`${res}:*`)) return true;
    return permissionList.includes(permKey);
  };

  const togglePerm = (permKey: string, checked: boolean) => {
    if (isOwner) return;
    setPermissionList((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, permKey]));
      } else {
        const [res] = permKey.split(":");
        return prev.filter((p) => p !== permKey && p !== "*" && p !== `${res}:*`);
      }
    });
  };

  const applyPreset = (preset: "read_all" | "full_all" | "reset") => {
    if (isOwner) return;
    if (preset === "full_all") {
      setPermissionList(["experiments:*", "workflow:*", "system:*"]);
    } else if (preset === "read_all") {
      setPermissionList(["experiments:read", "workflow:read", "system:read"]);
    } else {
      setPermissionList(editingRole?.permissionList || []);
    }
  };

  const Cb = ({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) => (
    <label className={`flex items-center justify-center w-5 h-5 flex-none rounded border-2 transition-colors cursor-pointer ${checked ? 'bg-action border-action' : 'border-gray-300 hover:border-gray-400'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <Check className={`w-3 h-3 text-white pointer-events-none ${checked ? 'block' : 'hidden'}`} strokeWidth={3} />
    </label>
  );

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
    <div className="relative space-y-6">
      <PageHeader title={t("role_management")} />

      <div className="space-y-6">
        <ListToolbar
          search={<SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={() => { setSearchQuery(searchInput); setCurrentPage(1); }}
            placeholder={t("search_roles")}
          />}
          view={<ViewToggle
            viewMode={viewMode}
            setViewMode={setViewMode}
            className="hidden sm:flex"
          />}
          actions={hasPermission("system:write") ? (
            <Button size="sm" variant="secondary" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              {t("create_role")}
            </Button>
          ) : undefined}
        />

        {viewMode === "list" ? (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("role_name")}</TableHead>
                  <TableHead>{t("permissions")}</TableHead>
                  {hasPermission("system:write") && <TableHead className="sticky right-0 z-20 bg-gray-50 text-right">{t("actions")}</TableHead>}
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
                        {Array.isArray(role.permissionList) ? role.permissionList.join(", ") : "未配置特定权限"}
                      </div>
                    </TableCell>
                    {hasPermission("system:write") && (
                      <TableCell className="text-right sticky right-0 z-10 bg-white group-hover:bg-gray-50">
                        <Button variant="text" onClick={() => { setEditingRole(role); setIsEditModalOpen(true); }} className="text-gray-400! hover:text-action!">
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
                  <p className="text-[13px] text-gray-600 break-words">
                    {Array.isArray(role.permissionList) ? role.permissionList.join(", ") : "未配置特定权限"}
                  </p>
                </CardContent>
                {hasPermission("system:write") && (
                  <CardFooter className="justify-center mt-auto">
                    <Button variant="text" onClick={() => { setEditingRole(role); setIsEditModalOpen(true); }} className="text-gray-400! hover:text-action!">
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
              className="block w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 transition-colors focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus/30 sm:text-sm"
              placeholder={t("role_desc_placeholder")}
            />
          </div>
        </form>
      </Modal>

      {/* Edit Role Permissions Modal */}
      <Modal open={isEditModalOpen && !!editingRole} onClose={() => setIsEditModalOpen(false)} title="配置角色权限" maxWidth="2xl"
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t("cancel")}</Button>
            <Button size="sm" type="submit" form="modal-role-form" loading={saving} disabled={saving || isOwner}>{t("save")}</Button>
          </>
        }>
        <form id="modal-role-form" onSubmit={handleUpdateRole} className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{editingRole?.name}</p>
                <p className="text-xs text-gray-500">配置该角色的功能权限与可访问范围</p>
              </div>
            </div>
            {!isOwner && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" type="button" onClick={() => applyPreset("read_all")}>只读权限</Button>
                <Button size="sm" variant="secondary" type="button" onClick={() => applyPreset("full_all")}>全部权限</Button>
                <Button size="sm" variant="text" type="button" onClick={() => applyPreset("reset")}><RotateCcw className="w-3.5 h-3.5" /></Button>
              </div>
            )}
            {isOwner && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                超级管理员
              </span>
            )}
          </div>

          {/* Clean 3-Domain Matrix */}
          <div className="space-y-5">
            {PERMISSION_TREE_META.map((group: PermissionGroupMeta) => (
              <div key={group.key} className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs transition-all hover:border-gray-300">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{group.label}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
                  {group.actions.map((act) => {
                    const permKey = `${group.key}:${act.key}`;
                    const checked = isPermChecked(permKey);
                    return (
                      <div
                        key={act.key}
                        onClick={() => togglePerm(permKey, !checked)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${checked ? 'bg-orange-50/60 border-action/40 text-action-muted' : 'border-gray-100 hover:border-gray-200 text-gray-700'}`}
                      >
                        <Cb checked={checked} disabled={isOwner} onChange={(v) => togglePerm(permKey, v)} />
                        <span className="text-xs font-medium select-none">{act.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>
    </div>
  );
}
