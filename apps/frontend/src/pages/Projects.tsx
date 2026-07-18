import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Edit3, Trash2, Plus, FileText } from "lucide-react";

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

import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SearchInput } from "../components/SearchInput";
import { Pagination } from "../components/Pagination";
import { TextInput, Textarea, FormSelect, MultiSelect, Select } from "../components/FormFields";
import { PageLoader } from "../components/PageLoader";
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/Table";
import { cn } from "../lib/utils";

import { usePermissions } from "../hooks/usePermissions";
import { api, ApiError } from "../lib/api";
import type { Project } from "../types";
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

  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

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
  const [stepVisibleTo, setStepVisibleTo] = useState<Record<string, string[]>>({});
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const [users, setUsers] = useState<any[]>([]);

  // Fetch templates & users for workflow assignment
  useEffect(() => {
    if (!isModalOpen) { setCreateStep(1); setAssignmentError(null); return; }
    api.get<Template[]>("/api/v1/workflow/templates").then((d) => setTemplates(Array.isArray(d) ? d : [])).catch(() => { });
    api.get<any[]>("/api/v1/users/assignable").then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => { });
  }, [isModalOpen]);

  // Resolve selected template steps
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates.find((t) => t.isDefault);
  const selectedTemplateSteps = selectedTemplate?.steps?.sort((a, b) => a.sortOrder - b.sortOrder) || [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const queryParams = new URLSearchParams();
    queryParams.append("page", page.toString());
    queryParams.append("limit", limit.toString());
    if (searchQuery.trim()) {
      queryParams.append("search", searchQuery.trim());
    }

    api.get<any>(`/api/v1/projects?${queryParams.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res)) {
          setProjects(res);
          setTotalItems(res.length);
        } else {
          setProjects(res.items || []);
          setTotalItems(res.total || 0);
        }
      })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : t("load_failed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [searchQuery, page, limit, refetchTrigger]);

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
            visibleToUserIds: stepVisibleTo[s.name] || [],
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
                  visibleToUserIds: stepVisibleTo[child] || [],
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
      setStepVisibleTo({});
      setSelectedTemplateId(null);
      setCreateStep(1);
      setSearchQuery("");
      setSearchInput("");
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

  if (loading && projects.length === 0) {
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
            onSubmit={() => {
              setPage(1);
              setSearchQuery(searchInput);
            }}
            placeholder={t("search_projects")}
          />
          <div className="flex items-center gap-4">

            {hasPermission("projects:write") && (
              <Button onClick={() => setIsModalOpen(true)} size="sm" variant="secondary">
                <Plus className="w-4 h-4" />
                {t("new_project")}
              </Button>
            )}
          </div>
        </div>

        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("project_name")}</TableHead>
                <TableHead>{t("pi")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("created")}</TableHead>
                {hasPermission("projects:write") && <TableHead className="text-right sticky right-0 z-20 bg-white">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id} className="cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                  <TableCell>
                    <div className="text-[13px] font-medium text-gray-900 group-hover:text-[#1d74f5]">{project.name}</div>
                    <div className="text-[13px] text-gray-500 truncate max-w-sm mt-1">{project.description || '\u00A0'}</div>
                  </TableCell>
                  <TableCell>{project.creator?.fullName || project.createdBy}</TableCell>
                  <TableCell>
                    {projectStatusBadge(project)}
                  </TableCell>
                  <TableCell>{format(new Date(project.createdAt), "MMM d, yyyy")}</TableCell>
                  {hasPermission("projects:write") && (
                    <TableCell className="text-right sticky right-0 z-10 bg-white group-hover:bg-gray-50">
                      <div className="flex items-center justify-end gap-3">
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
              {projects.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-24">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <FileText className="w-5 h-5 text-gray-500" />
                      </div>
                      <h3 className="text-[15px] font-semibold text-gray-900 mb-1">{t("no_projects")}</h3>
                      <p className="text-[13px] text-gray-500">Projects will appear here once created.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableWrapper>
      </div>

      {totalItems > limit && (
        <div className="flex justify-end pt-4 border-t border-gray-100">
          <Pagination
            currentPage={page}
            totalItems={totalItems}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setLimit(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("create_new_project")}
        maxWidth="2xl"
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setIsModalOpen(false)}>{t("cancel")}</Button>
            {createStep === 2 && (
              <Button size="sm" type="button" variant="secondary" onClick={() => { setCreateStep(1); setAssignmentError(null); }}>{t("previous")}</Button>
            )}
            {createStep === 2 ? (
              <Button size="sm" type="button" loading={creating} onClick={handleCreateProject}>{t("create_project")}</Button>
            ) : (
              <Button size="sm" type="button" onClick={() => {
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
                    <TableHead className="w-[180px]">{t("assignee", "Assignee")} <span className="text-red-500">*</span></TableHead>
                    <TableHead className="w-[180px]">{t("visible_to", "可见人员")}</TableHead>
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
                              <Select
                                value={stepAssignments[step.name] || ""}
                                onChange={(val) => setStepAssignments((prev) => ({ ...prev, [step.name]: val }))}
                                options={users.map((u: any) => ({ value: u.id, label: u.fullName || u.username }))}
                                placeholder={t("select_user", "Select user...")}
                                className="min-w-[130px]!"
                              />
                            </TableCell>
                            <TableCell>
                              <MultiSelect
                                value={stepVisibleTo[step.name] || []}
                                onChange={(values) => setStepVisibleTo((prev) => ({ ...prev, [step.name]: values }))}
                                options={users.map((u: any) => ({ value: u.id, label: u.fullName || u.username }))}
                                placeholder={t("select_user", "Select user...")}
                                className="min-w-[130px]!"
                              />
                            </TableCell>
                          </TableRow>
                        )];
                      }

                      // Parallel group → header row + child rows
                      return [
                        <TableRow key={step.name} className="bg-amber-50/60">
                          <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium text-amber-800">{step.label}</TableCell>
                          <TableCell colSpan={2} className="text-center">
                            <span className="text-xs text-amber-600 font-medium">{t("parallel_group")}</span>
                          </TableCell>
                        </TableRow>,
                        ...step.parallelChildren.map((child, ci) => (
                          <TableRow key={child} className="bg-amber-50/30">
                            <TableCell className="text-gray-300 text-xs">{i + 1}.{ci + 1}</TableCell>
                            <TableCell className="text-sm text-gray-700 pl-8">
                              {childLabel(child)}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={stepAssignments[child] || ""}
                                onChange={(val) => setStepAssignments((prev) => ({ ...prev, [child]: val }))}
                                options={users.map((u: any) => ({ value: u.id, label: u.fullName || u.username }))}
                                placeholder={t("select_user", "Select user...")}
                                className="min-w-[130px]!"
                              />
                            </TableCell>
                            <TableCell>
                              <MultiSelect
                                value={stepVisibleTo[child] || []}
                                onChange={(values) => setStepVisibleTo((prev) => ({ ...prev, [child]: values }))}
                                options={users.map((u: any) => ({ value: u.id, label: u.fullName || u.username }))}
                                placeholder={t("select_user", "Select user...")}
                                className="min-w-[130px]!"
                              />
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
            <Button size="sm" variant="secondary" onClick={() => setIsEditModalOpen(false)}>{t("cancel")}</Button>
            <Button size="sm" type="submit" form="modal-edit-form" loading={saving}>{t("save")}</Button>
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
