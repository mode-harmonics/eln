import React, { useEffect, useState } from "react";
import { Search, Shield, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { useViewMode } from "../hooks/useViewMode";
import { api, ApiError } from "../lib/api";
import type { Role } from "../types";

export function Roles() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [viewMode, setViewMode] = useViewMode("roles_view_mode", "grid");

  useEffect(() => {
    api.get<Role[]>("/api/v1/roles")
      .then(setRoles)
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载角色列表失败"))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateRole = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setEditingRole(null);
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
          {t("role_management")}
        </h1>
        <div className="h-px bg-gray-200 w-full mb-6"></div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("search_roles")}
              className="w-full rounded border border-gray-300 pl-9 pr-4 py-1.5 text-sm focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5]"
            />
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              className="hidden sm:flex"
            />
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
                    <th scope="col" className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("actions")}
                    </th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setEditingRole(role);
                            setIsEditModalOpen(true);
                          }}
                          className="text-[13px] font-medium text-[#1d74f5] hover:text-blue-700"
                        >
                          {t("edit_permissions")}
                        </button>
                      </td>
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
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setEditingRole(role);
                      setIsEditModalOpen(true);
                    }}
                    className="text-[13px] font-medium text-[#1d74f5] hover:text-blue-700 ml-auto"
                  >
                    {t("edit_permissions")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination className={viewMode === "list" ? "border-t border-gray-200 bg-white" : ""} />
      </div>

      {isEditModalOpen && editingRole && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[17px] font-bold text-gray-900">
                {t("edit_permissions")} - {editingRole.name}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateRole} className="p-6 space-y-5">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  {t("adjust_access")}
                </p>
                <div className="space-y-3">
                  {[
                    "view_projects",
                    "edit_projects",
                    "manage_inventory",
                    "approve_experiments",
                    "system_settings_perm",
                  ].map((permKey, idx) => {
                    const isChecked = Array.isArray(editingRole.permissionList) && editingRole.permissionList.includes(permKey);
                    return (
                      <label key={idx} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          defaultChecked={isChecked || editingRole.name === "Admin"}
                          disabled
                          className="w-4 h-4 text-[#1d74f5] rounded border-gray-300 opacity-70 cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-700">
                          {t(permKey)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="pt-4 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  {t("close")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
