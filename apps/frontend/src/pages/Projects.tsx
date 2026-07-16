import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Edit3, Trash2, Plus } from "lucide-react";

function childLabel(name: string): string {
  const map: Record<string, string> = {
    calendar_life: "Calendar Life",
    storage_swelling: "Storage Swelling",
    energy_efficiency: "Energy Efficiency",
    dcr_test: "DCR Test",
    fast_charge: "Fast Charge",
    ht_cycle: "HT Cycle",
  };
  return map[name] || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SearchInput } from "../components/SearchInput";
import { TextInput, Textarea, FormSelect } from "../components/FormFields";
import { PageLoader } from "../components/PageLoader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/Card";
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/Table";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { usePermissions } from "../hooks/usePermissions";
import { api, ApiError } from "../lib/api";
import type { Project, PaginatedProjects } from "../types";
import { Popconfirm } from "../components/Popconfirm";
import { toast } from "../components/Toast";

function projectStatusBadge(project: any) {
  const wf = project.workflowStatus;
  const cls = wf === "Completed" ? "bg-green-50 text-green-700"
    : wf === "Active" ? "bg-blue-50 text-blue-700"
    : wf === "Paused" ? "bg-amber-50 text-amber-700"
    : "bg-gray-100 text-gray-400";
  const label = wf === "Completed" ? "已完成"
    : wf === "Active" ? "进行中"
    : wf === "Paused" ? "已暂停"
    : "未配置";
  return <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
  steps: Array<{
    name: string;
    label: string;
    isParallel?: boolean;
    parallelChildren?: string[];
    sortOrder: number;
  }>;
}

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

  // Create project wizard
  const [createStep, setCreateStep] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [stepAssignments, setStepAssignments] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Fetch templates & users for workflow assignment
  useEffect(() => {
    if (!isModalOpen) { setCreateStep(1); setAssignmentError(null); return; }
    api.get<Template[]>("/api/v1/workflow/templates").then((d) => setTemplates(Array.isArray(d) ? d : [])).catch(() => {});
    api.get<any[]>("/api/v1/users/assignable").then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isModalOpen]);

  // Resolve selected template steps
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates.find((t) => t.isDefault);
  const selectedTemplateSteps = selectedTemplate?.steps?.sort((a, b) => a.sortOrder - b.sortOrder) || [];

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
  }, [currentPage, searchQuery, refetchTrigger, pageSize]);

  const handleCreateProject = async () => {
    if (createStep !== 2) return;
    if (!newProjectName.trim()) return;

    // Validate all steps have assignees
    const missing: string[] = [];
    for (const step of selectedTemplateSteps) {
      if (step.isParallel && step.parallelChildren?.length) {
        for (const child of step.parallelChildren) {
          if (!stepAssignments[child]) missing.push(childLabel(child));
        }
      } else {
        if (!stepAssignments[step.name]) missing.push(step.label);
      }
    }
    if (missing.length > 0) {
      setAssignmentError(`Please assign a user to: ${missing.join(", ")}`);
      return;
    }
    setAssignmentError(null);

    setCreating(true);
    try {
      // 1. Create project
      const project = await api.post<Project>("/api/v1/projects", {
        name: newProjectName,
        description: newProjectDesc,
      });

      // 2. Create workflow instance with assignments
      if (selectedTemplateSteps.length > 0) {
        const assignments = selectedTemplateSteps
          .filter((s) => stepAssignments[s.name])
          .map((s) => ({
            stepName: s.name,
            assignedUserId: stepAssignments[s.name],
            canViewOtherSteps: true,
            canViewInternalCode: true,
          }));

        // For parallel children, also assign if specified
        for (const step of selectedTemplateSteps) {
          if (step.isParallel && step.parallelChildren) {
            for (const child of step.parallelChildren) {
              if (stepAssignments[child]) {
                assignments.push({
                  stepName: child,
                  assignedUserId: stepAssignments[child],
                  canViewOtherSteps: false,
                  canViewInternalCode: false,
                });
              }
            }
          }
        }

        if (assignments.length > 0) {
          await api.post("/api/v1/workflow/instances", {
            projectId: project.id,
            templateId: selectedTemplateId || undefined,
            assignments,
          });
        }
      }

      setIsModalOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setStepAssignments({});
      setSelectedTemplateId(null);
      setCreateStep(1);
      setSearchQuery("");
      setSearchInput("");
      setCurrentPage(1);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("create_failed"));
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
                    {projectStatusBadge(project)}
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
                      {projectStatusBadge(project)}
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
        maxWidth="2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("cancel")}</Button>
            {createStep === 2 && (
              <Button type="button" variant="secondary" onClick={() => { setCreateStep(1); setAssignmentError(null); }}>{t("previous")}</Button>
            )}
            {createStep === 2 ? (
              <Button type="button" loading={creating} onClick={handleCreateProject}>{t("create_project")}</Button>
            ) : (
              <Button type="button" onClick={() => {
                if (!newProjectName.trim()) return;
                setCreateStep(2);
              }}>{t("next")}</Button>
            )}
          </>
        }>
        {createStep === 1 ? (
          <div className="space-y-5">
            <TextInput
              id="projectName"
              label={t("project_name")}
              required
              placeholder={t("project_name_placeholder")}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newProjectName.trim()) {
                  e.preventDefault();
                  setCreateStep(2);
                }
              }}
            />
            <Textarea
              id="projectDesc"
              label={t("description")}
              rows={4}
              placeholder={t("project_desc_placeholder")}
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm font-medium text-gray-700">{t("step_assign_title", "Assign Team Members to Workflow Steps")}</p>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("workflow_template", "Workflow Template")}</label>
              <FormSelect
                value={selectedTemplateId || ""}
                onChange={(e) => setSelectedTemplateId(e.target.value || null)}
              >
                <option value="">{t("use_default", "Use Default Template")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} {tpl.isDefault ? `[${t("default")}]` : ""}
                  </option>
                ))}
              </FormSelect>
            </div>

            {/* Step Assignments Table */}
            {assignmentError && (
              <p className="text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">{assignmentError}</p>
            )}
            <TableWrapper className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{t("step", "Step")}</TableHead>
                    <TableHead>{t("description")}</TableHead>
                    <TableHead className="w-[200px]">{t("assignee", "Assignee")} <span className="text-red-500">*</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTemplateSteps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                        {t("select_template_hint")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedTemplateSteps.flatMap((step, i) => {
                      // Serial step → one row
                      if (!step.isParallel || !step.parallelChildren?.length) {
                        return [(
                          <TableRow key={step.name}>
                            <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                            <TableCell className="font-medium text-gray-800">{step.label}</TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-400">{step.name}</span>
                            </TableCell>
                            <TableCell>
                              <FormSelect
                                value={stepAssignments[step.name] || ""}
                                onChange={(e) => setStepAssignments((prev) => ({ ...prev, [step.name]: e.target.value }))}
                                className="min-w-[150px]!"
                              >
                                <option value="">{t("select_user", "Select user...")}</option>
                                {users.map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                                ))}
                              </FormSelect>
                            </TableCell>
                          </TableRow>
                        )];
                      }

                      // Parallel group → header row + child rows
                      return [
                        <TableRow key={step.name} className="bg-amber-50/60">
                          <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium text-amber-800">{step.label}</TableCell>
                          <TableCell>
                            <span className="text-xs text-amber-600 font-medium">{t("parallel_group")}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-400">—</span>
                          </TableCell>
                        </TableRow>,
                        ...step.parallelChildren.map((child, ci) => (
                          <TableRow key={child} className="bg-amber-50/30">
                            <TableCell className="text-gray-300 text-xs">{i + 1}.{ci + 1}</TableCell>
                            <TableCell className="text-sm text-gray-700 pl-8">
                              {childLabel(child)}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-400">{child}</span>
                            </TableCell>
                            <TableCell>
                              <FormSelect
                                value={stepAssignments[child] || ""}
                                onChange={(e) => setStepAssignments((prev) => ({ ...prev, [child]: e.target.value }))}
                                className="min-w-[150px]!"
                              >
                                <option value="">{t("select_user")}</option>
                                {users.map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                                ))}
                              </FormSelect>
                            </TableCell>
                          </TableRow>
                        )),
                      ];
                    })
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </div>
        )}
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
          <FormSelect
            id="editStatus"
            label={t("status")}
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
          >
            <option value="Active">{t("status_active")}</option>
            <option value="Inactive">{t("status_inactive")}</option>
          </FormSelect>
        </form>
      </Modal>
    </div>
  );
}
