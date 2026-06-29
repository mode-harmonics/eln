import React, { useEffect, useState } from "react";
import { Loader2, Trash2, Plus, Edit3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SearchInput } from "../components/SearchInput";
import { TextInput, Select, Checkbox } from "../components/FormFields";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { usePermissions } from "../hooks/usePermissions";
import { api, ApiError } from "../lib/api";
import type { User, Role } from "../types";

export function Users() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [viewMode, setViewMode] = useViewMode("users_view_mode", "list");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const [rolesLoaded, setRolesLoaded] = useState(false);

  const loadRolesIfNeeded = async () => {
    if (rolesLoaded) return;
    try {
      const data = await api.get<Role[]>("/api/v1/roles");
      setRoles(data);
      setRolesLoaded(true);
      if (data.length > 0 && !newUserRole) {
        setNewUserRole(data[0].id);
      }
    } catch (err) {
      console.error("加载角色失败", err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(currentPage));
    queryParams.append("limit", String(pageSize));
    queryParams.append("withRole", "true");
    if (searchQuery.trim()) {
      queryParams.append("search", searchQuery.trim());
    }

    api.get<{ items: any[]; total: number }>(`/api/v1/users?${queryParams.toString()}`)
      .then((res) => { if (!cancelled) { setUsers(res.items); setTotalItems(res.total); } })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "加载用户数据失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, pageSize, searchQuery, refetchTrigger]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName || !newUserUsername) return;
    try {
      await api.post<any>("/api/v1/users", {
        username: newUserUsername,
        email: newUserEmail,
        fullName: newUserName,
        roleId: newUserRole || undefined,
      });
      setIsModalOpen(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserUsername("");
      setSearchQuery("");
      setSearchInput("");
      setCurrentPage(1);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "创建用户失败");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const form = e.currentTarget as HTMLFormElement;
    const username = (form.elements.namedItem("edit-username") as HTMLInputElement).value;
    const email = (form.elements.namedItem("edit-email") as HTMLInputElement).value;
    const name = (form.elements.namedItem("edit-name") as HTMLInputElement).value;
    const roleId = (form.elements.namedItem("edit-role") as HTMLSelectElement).value;
    const isActive = (form.elements.namedItem("edit-active") as HTMLInputElement).checked;

    try {
      await api.put(`/api/v1/users/${editingUser.id}`, {
        username,
        email,
        fullName: name,
        roleId: roleId || undefined,
        isActive,
      });
      setIsEditModalOpen(false);
      setEditingUser(null);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "更新用户失败");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm(t("delete_project_confirm", { name: userId }))) return; // reuse generic confirm key
    try {
      await api.delete(`/api/v1/users/${userId}`);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "删除用户失败");
    }
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
          {t("user_management")}
        </h1>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={() => { setSearchQuery(searchInput); setCurrentPage(1); }}
            placeholder={t("search_users")}
          />
          <div className="flex items-center gap-4">
            <ViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              className="hidden sm:flex"
            />
            {hasPermission("users:write") && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  loadRolesIfNeeded();
                  setIsModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                {t("add_user")}
              </Button>
            )}
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="border border-gray-200 rounded bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("name")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("email")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("role")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("status")}
                    </th>
                    {hasPermission("users:write") && (
                      <th scope="col" className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {t("actions")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => {
                    const initials = user.fullName ? user.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase() : "U";
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold border border-blue-200">
                              {initials}
                            </div>
                            <div className="text-[13px] font-medium text-gray-900">
                              {user.fullName}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-[13px] text-gray-500">
                            {user.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                            {user.roleName || "No Role"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
                            user.isActive ? "bg-[#f0f9f4] text-[#1e8b4e]" : "bg-red-50 text-red-600"
                          )}>
                            {user.isActive ? t("active") : t("inactive", "Inactive")}
                          </span>
                        </td>
                        {hasPermission("users:write") && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="inline-flex items-center gap-3">
                              <Button variant="text" onClick={() => { loadRolesIfNeeded(); setEditingUser(user); setIsEditModalOpen(true); }} className="!text-gray-400 hover:!text-[#1d74f5]">
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button variant="text" onClick={() => handleDeleteUser(user.id)} className="!text-gray-400 hover:!text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => {
              const initials = user.fullName ? user.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase() : "U";
              return (
                <div
                  key={user.id}
                  className="border border-gray-200 rounded p-6 bg-white hover:border-gray-300 transition-colors flex flex-col items-center text-center relative group"
                >
                  {hasPermission("users:write") && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="text" onClick={() => { loadRolesIfNeeded(); setEditingUser(user); setIsEditModalOpen(true); }} className="!text-gray-400 hover:!text-[#1d74f5]">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="text" onClick={() => handleDeleteUser(user.id)} className="!text-gray-400 hover:!text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <div className="h-16 w-16 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold border border-blue-200">
                    {initials}
                  </div>
                  <h3 className="font-semibold text-[17px] text-gray-900">
                    {user.fullName}
                  </h3>
                  <p className="text-[13px] text-gray-500 mt-1 mb-4">
                    {user.email}
                  </p>

                  <div className="flex items-center gap-2 mb-6">
                    <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                      {user.roleName || "No Role"}
                    </span>
                    <span className={cn(
                      "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
                      user.isActive ? "bg-[#f0f9f4] text-[#1e8b4e]" : "bg-red-50 text-red-600"
                    )}>
                      {user.isActive ? t("active") : t("inactive", "Inactive")}
                    </span>
                  </div>
                </div>
              );
            })}
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

      <Modal open={isEditModalOpen && !!editingUser} onClose={() => setIsEditModalOpen(false)} title={t("edit_user")} maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" form="modal-user-edit-form">{t("save_changes")}</Button>
          </>
        }>
        <form id="modal-user-edit-form" onSubmit={handleUpdateUser} className="space-y-5">
          <TextInput
            id="edit-username"
            label="Username"
            required
            defaultValue={editingUser?.username}
          />
          <TextInput
            id="edit-email"
            label={t("email")}
            type="email"
            required
            defaultValue={editingUser?.email}
          />
          <TextInput
            id="edit-name"
            label={t("name")}
            required
            defaultValue={editingUser?.fullName}
          />
          <Select
            id="edit-role"
            label={t("role")}
            defaultValue={editingUser?.roleId || ""}
          >
            <option value="">No Role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </Select>
          <Checkbox
            id="edit-active"
            label={t("active")}
            defaultChecked={editingUser?.isActive}
          />
        </form>
      </Modal>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("add_user")} maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" form="modal-user-form">{t("create")}</Button>
          </>
        }>
        <form id="modal-user-form" onSubmit={handleCreateUser} className="space-y-5">
          <TextInput
            id="username"
            label="Username"
            required
            placeholder="e.g. johndoe"
            value={newUserUsername}
            onChange={(e) => setNewUserUsername(e.target.value)}
          />
          <TextInput
            id="email"
            label={t("email")}
            type="email"
            required
            placeholder={t("email_placeholder")}
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
          />
          <TextInput
            id="name"
            label={t("name")}
            required
            placeholder={t("name_placeholder")}
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
          />
          <Select
            id="role"
            label={t("role")}
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value)}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </Select>
        </form>
      </Modal>
    </div>
  );
}
