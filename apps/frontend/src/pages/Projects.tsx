import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { X, Search, Loader2 } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { api, ApiError } from "../lib/api";
import type { Project } from "../types";

export function Projects() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useViewMode("projects_view_mode", "grid");

  useEffect(() => {
    api.get<Project[]>("/api/v1/projects")
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<Project>("/api/v1/projects", {
        name: newProjectName,
        description: newProjectDesc,
      });
      setProjects((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "创建失败");
    } finally {
      setCreating(false);
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
          {t("projects")}
        </h1>
        <div className="h-px bg-gray-200 w-full mb-6"></div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={t("search_projects")}
              className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-[#1d74f5] focus:border-[#1d74f5] sm:text-sm transition-colors"
            />
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-1.5 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors"
            >
              {t("new_project")}
            </button>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group flex flex-col border border-gray-200 rounded p-6 bg-white hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[17px] text-gray-900 group-hover:text-[#1d74f5]">
                      {project.name}
                    </h3>
                    <p className="text-[13px] text-gray-500 mt-1">
                      {t("created")}{" "}
                      {format(new Date(project.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                      project.status === "Active"
                        ? "bg-[#f0f9f4] text-[#1e8b4e]"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 flex-1">
                  {project.description}
                </p>
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">
                    {t("pi")}:{" "}
                    <span className="font-medium text-gray-700">
                      {project.createdBy}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
            {projects.length === 0 && (
              <div className="col-span-3 p-12 text-center text-sm text-gray-400">
                暂无项目，点击「新建项目」开始
              </div>
            )}
          </div>
        ) : (
          <div className="border border-gray-200 rounded bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("project_name")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("status")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      {t("created")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-gray-50/50 group cursor-pointer"
                      onClick={() => (window.location.href = `/projects/${project.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="text-[13px] font-medium text-gray-900 group-hover:text-[#1d74f5]">
                          {project.name}
                        </div>
                        <div className="text-[13px] text-gray-500 truncate max-w-sm mt-1">
                          {project.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
                            project.status === "Active"
                              ? "bg-[#f0f9f4] text-[#1e8b4e]"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[13px] text-gray-500">
                        {format(new Date(project.createdAt), "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Pagination />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded border border-gray-200 shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[17px] font-bold text-gray-900">
                {t("create_new_project")}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="projectName">
                  {t("project_name")}
                </label>
                <input
                  id="projectName"
                  type="text"
                  required
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  placeholder="e.g. Solid State Battery V3"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="projectDesc">
                  {t("description")}
                </label>
                <textarea
                  id="projectDesc"
                  rows={4}
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                  placeholder="Brief description of the project goals..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
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
                  disabled={creating}
                  className="px-4 py-2 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors disabled:opacity-70"
                >
                  {creating ? "创建中..." : t("create_project")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
