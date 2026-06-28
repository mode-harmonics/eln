import React, { useState } from "react";
import { Search, Shield, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { useViewMode } from "../hooks/useViewMode";

const MOCK_ROLES = [
  {
    id: "1",
    name: "Admin",
    description: "Full access to all system features and settings.",
    usersCount: 2,
  },
  {
    id: "2",
    name: "Scientist",
    description: "Can create and edit experiments, inventory, and projects.",
    usersCount: 15,
  },
  {
    id: "3",
    name: "Viewer",
    description: "Read-only access to experiments and projects.",
    usersCount: 8,
  },
];

export function Roles() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [viewMode, setViewMode] = useViewMode("roles_view_mode", "grid");

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    setNewRoleName("");
    setNewRoleDesc("");
  };

  const handleUpdateRole = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setEditingRole(null);
  };

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
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-1.5 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              {t("create_role")}
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="border border-gray-200 rounded bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("role_name")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("description")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("users")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {MOCK_ROLES.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-gray-50 rounded text-gray-600">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div className="text-[13px] font-medium text-gray-900">
                            {role.name === "Admin"
                              ? t("admin_role")
                              : role.name === "Scientist"
                                ? t("scientist_role")
                                : t("viewer_role")}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[13px] text-gray-500">
                          {role.id === "1"
                            ? t("role_desc_admin")
                            : role.id === "2"
                              ? t("role_desc_scientist")
                              : t("role_desc_viewer")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                          {role.usersCount} {t("users")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setEditingRole(role);
                            setIsEditModalOpen(true);
                          }}
                          className="text-[13px] font-medium text-[#1d74f5] hover:text-blue-700"
                        >
                          {t("edit")}
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
            {MOCK_ROLES.map((role) => (
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
                      {role.name === "Admin"
                        ? t("admin_role")
                        : role.name === "Scientist"
                          ? t("scientist_role")
                          : t("viewer_role")}
                    </h3>
                  </div>
                </div>
                <p className="text-[13px] text-gray-600 flex-1">
                  {role.id === "1"
                    ? t("role_desc_admin")
                    : role.id === "2"
                      ? t("role_desc_scientist")
                      : t("role_desc_viewer")}
                </p>
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">
                    {role.usersCount} {t("users")}
                  </span>
                  <button
                    onClick={() => {
                      setEditingRole(role);
                      setIsEditModalOpen(true);
                    }}
                    className="text-[13px] font-medium text-[#1d74f5] hover:text-blue-700"
                  >
                    {t("edit_permissions")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          className={
            viewMode === "list" ? "border-t border-gray-200 bg-white" : ""
          }
        />
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
                  ].map((permKey, idx) => (
                    <label key={idx} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        defaultChecked={idx < 3 || editingRole.name === "Admin"}
                        className="w-4 h-4 text-[#1d74f5] rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">
                        {t(permKey)}
                      </span>
                    </label>
                  ))}
                </div>
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
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[17px] font-bold text-gray-900">
                {t("create_new_role")}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="p-6 space-y-5">
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="roleName"
                >
                  {t("role_name")}
                </label>
                <input
                  id="roleName"
                  type="text"
                  required
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  placeholder={t("role_name_placeholder")}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="roleDesc"
                >
                  {t("description")}
                </label>
                <textarea
                  id="roleDesc"
                  rows={4}
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  placeholder={t("role_desc_placeholder")}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                />
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
                  {t("create_role")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
