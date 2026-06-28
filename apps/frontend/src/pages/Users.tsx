import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { MOCK_USERS } from "../mockData";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";

export function Users() {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("Scientist");
  const [viewMode, setViewMode] = useViewMode("users_view_mode", "list");

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    setNewUserEmail("");
    setNewUserName("");
    setNewUserRole("Scientist");
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

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
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("name")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("email")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("role")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {t("status")}
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
                  {MOCK_USERS.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold border border-blue-200">
                            {user.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
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
                          {user.roleId === "r1"
                            ? t("admin_role")
                            : t("editor_role")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-[#f0f9f4] text-[#1e8b4e]">
                          {t("active")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setEditingUser(user);
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
            {MOCK_USERS.map((user) => (
              <div
                key={user.id}
                className="border border-gray-200 rounded p-6 bg-white hover:border-gray-300 transition-colors flex flex-col items-center text-center"
              >
                <div className="h-16 w-16 mb-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold border border-blue-200">
                  {user.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <h3 className="font-semibold text-[17px] text-gray-900">
                  {user.fullName}
                </h3>
                <p className="text-[13px] text-gray-500 mt-1 mb-4">
                  {user.email}
                </p>

                <div className="flex items-center gap-2 mb-6">
                  <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                    {user.roleId === "r1" ? t("admin_role") : t("editor_role")}
                  </span>
                  <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium bg-[#f0f9f4] text-[#1e8b4e]">
                    {t("active")}
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
            ))}
          </div>
        )}
        <Pagination
          className={
            viewMode === "list" ? "border-t border-gray-200 bg-white" : ""
          }
        />
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
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="edit-email"
                >
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
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="edit-name"
                >
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
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="edit-role"
                >
                  {t("role")}
                </label>
                <select
                  id="edit-role"
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  defaultValue={editingUser.role}
                >
                  <option value="Admin">{t("admin_role")}</option>
                  <option value="Scientist">{t("scientist_role")}</option>
                  <option value="Viewer">{t("viewer_role")}</option>
                </select>
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
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="email"
                >
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
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="name"
                >
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
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="role"
                >
                  {t("role")}
                </label>
                <select
                  id="role"
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                >
                  <option value="Admin">{t("admin_role")}</option>
                  <option value="Scientist">{t("scientist_role")}</option>
                  <option value="Viewer">{t("viewer_role")}</option>
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
                  {t("send_invite")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
