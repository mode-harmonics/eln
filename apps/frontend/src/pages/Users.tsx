import React, { useEffect, useState } from "react";
import { Search, X, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { api, ApiError } from "../lib/api";
import type { User, Role } from "../types";

export function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [viewMode, setViewMode] = useViewMode("users_view_mode", "list");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<any[]>("/api/v1/users"),
      api.get<Role[]>("/api/v1/roles"),
    ])
      .then(([userData, roleData]) => {
        setUsers(userData);
        setRoles(roleData);
        if (roleData.length > 0) {
          setNewUserRole(roleData[0].id);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载用户数据失败"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) return;
    try {
      const created = await api.post<any>("/api/v1/users", {
        email: newUserEmail,
        fullName: newUserName,
        roleId: newUserRole || undefined,
      });
      // Refresh user list
      const updatedList = await api.get<any[]>("/api/v1/users");
      setUsers(updatedList);
      setIsModalOpen(false);
      setNewUserEmail("");
      setNewUserName("");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "创建用户失败");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const form = e.currentTarget as HTMLFormElement;
    const email = (form.elements.namedItem("edit-email") as HTMLInputElement).value;
    const name = (form.elements.namedItem("edit-name") as HTMLInputElement).value;
    const roleId = (form.elements.namedItem("edit-role") as HTMLSelectElement).value;
    const isActive = (form.elements.namedItem("edit-active") as HTMLInputElement).checked;

    try {
      await api.put(`/api/v1/users/${editingUser.id}`, {
        email,
        fullName: name,
        roleId: roleId || undefined,
        isActive,
      });
      const updatedList = await api.get<any[]>("/api/v1/users");
      setUsers(updatedList);
      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "更新用户失败");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("确定要删除此用户吗？")) return;
    try {
      await api.delete(`/api/v1/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {t("user_management")}
        </h1>
        <div className="h-px bg-gray-200 w-full mb-6"></div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("search_users")}
              className="w-full rounded border border-gray-300 pl-9 pr-4 py-1.5 text-sm focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5]"
            />
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              className="hidden sm:flex"
            />
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-1.5 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              {t("add_user")}
            </button>
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
                    <th scope="col" className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("actions")}
                    </th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setIsEditModalOpen(true);
                            }}
                            className="text-[#1d74f5] hover:text-blue-700 font-medium"
                          >
                            {t("edit")}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
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
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

                  <div className="mt-auto w-full pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setIsEditModalOpen(true);
                      }}
                      className="w-full py-1.5 text-[13px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                    >
                      {t("edit_user")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination className={viewMode === "list" ? "border-t border-gray-200 bg-white" : ""} />
      </div>

      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[17px] font-bold text-gray-900">
                {t("edit_user")}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-email">
                  {t("email")}
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  defaultValue={editingUser.email}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-name">
                  {t("name")}
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  defaultValue={editingUser.fullName}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-role">
                  {t("role")}
                </label>
                <select
                  id="edit-role"
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  defaultValue={editingUser.roleId || ""}
                >
                  <option value="">No Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="edit-active"
                  type="checkbox"
                  defaultChecked={editingUser.isActive}
                  className="w-4 h-4 text-[#1d74f5] rounded border-gray-300"
                />
                <label className="text-sm text-gray-700 font-medium" htmlFor="edit-active">
                  {t("active")}
                </label>
              </div>
              <div className="pt-4 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors"
                >
                  {t("save_changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[17px] font-bold text-gray-900">
                {t("add_user")}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  placeholder={t("email_placeholder")}
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">
                  {t("name")}
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  placeholder={t("name_placeholder")}
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="role">
                  {t("role")}
                </label>
                <select
                  id="role"
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors"
                >
                  {t("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
