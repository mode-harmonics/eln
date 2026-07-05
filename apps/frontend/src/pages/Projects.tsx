import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Edit3, Trash2, Plus } from "lucide-react";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SearchInput } from "../components/SearchInput";
import { TextInput, Textarea, Select } from "../components/FormFields";
import { PageLoader } from "../components/PageLoader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/Card";
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/Table";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { usePermissions } from "../hooks/usePermissions";
import { api, ApiError } from "../lib/api";
import type { Project, PaginatedProjects } from "../types";
import { Popconfirm } from "../components/Popconfirm";

export function Projects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useViewMode("projects_view_mode", "grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [pageSize, setPageSize] = useState(6);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(currentPage));
    queryParams.append("limit", String(pageSize));
    if (searchQuery.trim()) {
      queryParams.append("search", searchQuery.trim());
    }

    api.get<PaginatedProjects>(`/api/v1/projects?${queryParams.toString()}`)
      .then((res) => { if (!cancelled) { setProjects(res.items); setTotalItems(res.total); } })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : t("load_failed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, searchQuery, refetchTrigger]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      await api.post<Project>("/api/v1/projects", {
        name: newProjectName,
        description: newProjectDesc,
      });
      setIsModalOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setSearchQuery("");
      setSearchInput("");
      setCurrentPage(1);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t("create_failed"));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/projects/${editingProject.id}`, {
        name: editName,
        description: editDesc,
        status: editStatus,
      });
      setIsEditModalOpen(false);
      setEditingProject(null);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t("update_failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    try {
      await api.delete(`/api/v1/projects/${project.id}`);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t("delete_failed"));
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return <div className="p-8 text-center text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("projects")}
        </h1>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={() => { setSearchQuery(searchInput); setCurrentPage(1); }}
            placeholder={t("search_projects")}
          />
          <div className="flex items-center gap-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
            {hasPermission("projects:write") && (
              <Button onClick={() => setIsModalOpen(true)} size="sm" variant="secondary">
                <Plus className="w-4 h-4" />
                {t("new_project")}
              </Button>
            )}
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="group h-full flex flex-col">
                  <CardHeader>
                    <div>
                      <CardTitle className="group-hover:text-[#1d74f5]">{project.name}</CardTitle>
                      <CardDescription>{t("created")} {format(new Date(project.createdAt), "MMM d, yyyy")}</CardDescription>
                    </div>
                    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${project.status === "Active" ? "bg-[#f0f9f4] text-[#1e8b4e]" : "bg-gray-100 text-gray-600"}`}>
                      {project.status === "Active" ? t("status_active") : t("status_inactive")}
                    </span>
                  </CardHeader>
                  <CardContent className="line-clamp-2">
                    {project.description}
                  </CardContent>
                  <CardFooter>
                    <span className="text-[13px] text-gray-500">
                      {t("pi")}: <span className="font-medium text-gray-700">{project.creator?.fullName || project.createdBy}</span>
                    </span>
                    {hasPermission("projects:write") && (
                      <div className="flex items-center gap-2">
                        <Popconfirm
                          title={t("delete_project_confirm", { name: project.name })}
                          onConfirm={() => handleDeleteProject(project)}
                          placement="top"
                        >
                          <Button variant="text" onClick={(e) => { e.stopPropagation(); }} className="!text-gray-400 hover:!text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </Popconfirm>
                        <Button variant="text" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProject(project); setEditName(project.name); setEditDesc(project.description || ""); setEditStatus(project.status); setIsEditModalOpen(true); }} className="!text-gray-400 hover:!text-[#1d74f5]">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </Link>
            ))}
            {projects.length === 0 && (
              <div className="col-span-3 p-12 text-center text-sm text-gray-400">
                {t("no_projects")}
              </div>
            )}
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("project_name")}</TableHead>
                  <TableHead>{t("pi")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  {hasPermission("projects:write") && <TableHead className="text-right">{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} className="cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                    <TableCell>
                      <div className="text-[13px] font-medium text-gray-900 group-hover:text-[#1d74f5]">{project.name}</div>
                      <div className="text-[13px] text-gray-500 truncate max-w-sm mt-1">{project.description}</div>
                    </TableCell>
                    <TableCell>{project.creator?.fullName || project.createdBy}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${project.status === "Active" ? "bg-[#f0f9f4] text-[#1e8b4e]" : "bg-gray-100 text-gray-600"}`}>
                        {project.status === "Active" ? t("status_active") : t("status_inactive")}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(project.createdAt), "MMM d, yyyy")}</TableCell>
                    {hasPermission("projects:write") && (
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-3">
                          <Button variant="text" onClick={(e) => { e.stopPropagation(); setEditingProject(project); setEditName(project.name); setEditDesc(project.description || ""); setEditStatus(project.status); setIsEditModalOpen(true); }} className="!text-gray-400 hover:!text-[#1d74f5]"><Edit3 className="w-4 h-4" /></Button>
                          <Popconfirm
                            title={t("delete_project_confirm", { name: project.name })}
                            onConfirm={() => handleDeleteProject(project)}
                            placement="top"
                          >
                            <Button variant="text" onClick={(e) => { e.stopPropagation(); }} className="!text-gray-400 hover:!text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </Popconfirm>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("create_new_project")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" form="modal-form" loading={creating}>{t("create_project")}</Button>
          </>
        }>
        <form id="modal-form" onSubmit={handleCreateProject} className="space-y-5">
          <TextInput
            id="projectName"
            label={t("project_name")}
            required
            placeholder={t("project_name_placeholder")}
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <Textarea
            id="projectDesc"
            label={t("description")}
            rows={4}
            placeholder={t("project_desc_placeholder")}
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
          />
        </form>
      </Modal>

      <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={t("edit_project")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" form="modal-edit-form" loading={saving}>{t("save")}</Button>
          </>
        }>
        <form id="modal-edit-form" onSubmit={handleUpdateProject} className="space-y-5">
          <TextInput
            id="editName"
            label={t("project_name")}
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Textarea
            id="editDesc"
            label={t("description")}
            rows={4}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
          <Select
            id="editStatus"
            label={t("status")}
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
          >
            <option value="Active">{t("status_active")}</option>
            <option value="Inactive">{t("status_inactive")}</option>
          </Select>
        </form>
      </Modal>
    </div>
  );
}
