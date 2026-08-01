import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  type NodeTypes,
  MarkerType,
  Panel,
  Handle,
  Position,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import {
  Save, Plus, Trash2, Layers, Link2, X,
} from "lucide-react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { FormSelect } from "../components/FormFields";
import { PageLoader } from "../components/PageLoader";
import { PageHeader } from "../components/PageHeader";
import { toast } from "../components/Toast";
import { api, ApiError } from "../lib/api";

// ─── Types ──────────────────────────────────────────────────────

interface TemplateNode {
  id: string;
  label: string;
  builtInStep?: string;
}

interface TemplateEdge {
  from: string;
  to: string;
}

interface TemplateGraph {
  nodes?: TemplateNode[];
  edges?: TemplateEdge[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  steps: TemplateGraph;
  createdAt: string;
}

// ─── Custom Node Data Type ──────────────────────────────────────

interface StepNodeData {
  label: string;
  builtInStep?: string;
  nodeStyle?: "serial" | "parallel-parent" | "parallel-child";
  childCount?: number;
}

// ─── Single Step Node with Handles ──────────────────────────────

function StepNode({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as StepNodeData;

  return (
    <div
      className={`px-4 py-3 bg-white border border-gray-200 border-l-4 border-l-action rounded-lg shadow-sm min-w-[160px] text-left relative ${
        selected ? "ring-2 ring-focus/30" : ""
      }`}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5! h-2.5! border! border-gray-300! bg-gray-50!"
      />

      <div className="flex flex-col">
        <span className="text-[13px] font-bold text-gray-800">{data.label}</span>
        {data.builtInStep && (
          <span className="text-[10px] text-gray-400 font-mono mt-1">{data.builtInStep}</span>
        )}
      </div>

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5! h-2.5! border! border-gray-300! bg-gray-50!"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  step: StepNode,
};

// ─── Layout Helpers ─────────────────────────────────────────────

const NODE_W = 200;
const NODE_H_GAP = 120;
const CHILD_Y = 140;
const CHILD_GAP = 30;
const PARENT_Y = 0;

interface LayoutNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: StepNodeData;
}

/**
 * Build React Flow nodes+edges from template graph definition.
 * Serial steps: laid out left-to-right. Parallel: parent in main flow, children below.
 */
function buildLayout(graph: TemplateGraph): { nodes: LayoutNode[]; edges: Partial<Edge>[] } {
  const tNodes = graph.nodes || [];
  const tEdges = graph.edges || [];
  const nodes: LayoutNode[] = [];
  const edges: Partial<Edge>[] = [];

  // Compute topological order for layout
  const inDeg = new Map<string, number>();
  const outAdj = new Map<string, string[]>();
  const nodeMap = new Map(tNodes.map((n) => [n.id, n]));
  for (const n of tNodes) { inDeg.set(n.id, 0); outAdj.set(n.id, []); }
  for (const e of tEdges) {
    if (!nodeMap.has(e.from) || !nodeMap.has(e.to)) continue;
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    outAdj.get(e.from)!.push(e.to);
  }
  const queue = tNodes.filter((n) => inDeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const t of outAdj.get(cur) || []) {
      const d = (inDeg.get(t) || 1) - 1;
      inDeg.set(t, d);
      if (d === 0) queue.push(t);
    }
  }

  const placed = new Set<string>();
  let x = 0;
  const seenParents = new Map<string, string>(); // nodeId → parentId if parallel child

  for (const id of order) {
    if (placed.has(id)) continue;
    const outCount = outAdj.get(id)?.length || 0;
    const rId = `step-${id}`;

    if (outCount >= 2) {
      // Parallel group: parent + children in a block
      const children = outAdj.get(id) || [];
      const childIds = children.filter((c) => !placed.has(c));
      const childrenW = childIds.length * NODE_W + (childIds.length - 1) * CHILD_GAP;
      const blockW = Math.max(NODE_W, childrenW);

      // Parent node
      nodes.push({
        id: rId, type: "step", position: { x: x + (blockW - NODE_W) / 2, y: PARENT_Y },
        data: { label: nodeMap.get(id)?.label || id, builtInStep: nodeMap.get(id)?.builtInStep || id, nodeStyle: "parallel-parent", childCount: childIds.length },
      });
      placed.add(id);
      // Connect from previous serial
      if (x > 0) {
        const prev = nodes[nodes.length - 2];
        if (prev) edges.push({ id: `${prev.id}->${rId}`, source: prev.id, target: rId, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#64748b", strokeWidth: 2 } });
      }

      // Children
      const startX = x + (blockW - childrenW) / 2;
      childIds.forEach((cId, ci) => {
        const cRId = `step-${cId}`;
        nodes.push({
          id: cRId, type: "step", position: { x: startX + ci * (NODE_W + CHILD_GAP), y: CHILD_Y },
          data: { label: nodeMap.get(cId)?.label || cId, builtInStep: nodeMap.get(cId)?.builtInStep || cId, nodeStyle: "parallel-child" },
        });
        placed.add(cId);
        edges.push({ id: `${rId}->${cRId}`, source: rId, target: cRId, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "5 3" }, animated: true });
      });

      // Find where children converge to continue serial flow
      const convergeTo = childIds
        .flatMap((cId) => outAdj.get(cId) || [])
        .find((t) => outAdj.get(t)?.every((c) => childIds.includes(c)) === false);
      x += blockW + NODE_H_GAP;
    } else {
      // Serial node — skip if it's a parallel child (handled above)
      const parents = tEdges.filter((e) => e.to === id).map((e) => e.from);
      const isChild = parents.length === 1 && (outAdj.get(parents[0])?.length || 0) >= 2;
      if (isChild) {
        placed.add(id);
        continue;
      }
      nodes.push({
        id: rId, type: "step", position: { x, y: PARENT_Y },
        data: { label: nodeMap.get(id)?.label || id, builtInStep: nodeMap.get(id)?.builtInStep || id, nodeStyle: "serial" },
      });
      placed.add(id);
      if (x > 0) {
        const prev = nodes[nodes.length - 2];
        if (prev) edges.push({ id: `${prev.id}->${rId}`, source: prev.id, target: rId, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#64748b", strokeWidth: 2 } });
      }
      x += NODE_W + NODE_H_GAP;
    }
  }

  return { nodes, edges };
}

/**
 * Reconstruct template graph from React Flow nodes + edges.
 */
function graphFromFlow(nodes: Node[], edges: Edge[]): TemplateGraph {
  const tNodes: TemplateNode[] = nodes.map((n) => ({
    id: n.id.startsWith("step-") ? n.id.slice(5) : n.id,
    label: String((n.data as Record<string, unknown>).label || ""),
    builtInStep: String((n.data as Record<string, unknown>).builtInStep || ""),
  }));
  const tEdges: TemplateEdge[] = edges.map((e) => ({
    from: e.source.startsWith("step-") ? e.source.slice(5) : e.source,
    to: e.target.startsWith("step-") ? e.target.slice(5) : e.target,
  }));
  return { nodes: tNodes, edges: tEdges };
}

// ─── Generate unique step name ──────────────────────────────────

let nameCounter = 0;
function generateStepName(existingIds: Set<string>): string {
  nameCounter++;
  const base = `step_${nameCounter}`;
  if (!existingIds.has(`step-${base}`)) return base;
  return generateStepName(existingIds);
}

// ─── Page Component ─────────────────────────────────────────────

export function WorkflowConfigPage() {
  return (
    <ReactFlowProvider>
      <WorkflowConfig />
    </ReactFlowProvider>
  );
}

function WorkflowConfig() {
  const { t } = useTranslation();
  const reactFlow = useReactFlow();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Property editor modal
  const [propModalOpen, setPropModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId),
    [templates, activeTemplateId],
  );

  // ── Load templates ──
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Template[]>("/api/v1/workflow/templates");
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      if (list.length > 0 && !activeTemplateId) {
        setActiveTemplateId(list[0].id);
      }
    } catch {
      toast.error(t("load_failed"));
    } finally {
      setLoading(false);
    }
  }, [activeTemplateId, t]);

  useEffect(() => { fetchTemplates(); }, []);

  // ── Convert template → flow ──
  useEffect(() => {
    if (!activeTemplate) return;
    const { nodes: layoutNodes, edges: layoutEdges } = buildLayout(activeTemplate.steps);
    setNodes(layoutNodes as any);
    setEdges(layoutEdges as any);
  }, [activeTemplate?.id]);

  // ── Connect edges interactively ──
  const onConnect = useCallback(
    (connection: Connection) => {
      // Prevent self-connections
      if (connection.source === connection.target) return;

      // Check for duplicate edge
      const exists = edges.some(
        (e) => e.source === connection.source && e.target === connection.target,
      );
      if (exists) return;

      const newEdge: Edge = {
        id: `${connection.source}->${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#64748b", strokeWidth: 2 },
      };

      // Update node styles based on new topology
      setEdges((eds) => {
        const updated = addEdge(newEdge, eds);
        // Count outgoing for source
        const sourceOutgoing = updated.filter((e) => e.source === connection.source).length;
        const childIncoming = updated.filter((e) => e.target === connection.target).length;

        setNodes((nds) =>
          nds.map((n) => {
            const data = { ...n.data };
            if (n.id === connection.source && sourceOutgoing >= 2) {
              data.nodeStyle = "parallel-parent";
            } else if (n.id === connection.target && childIncoming === 1) {
              // Check if source has multiple outgoing
              const sourceOut = updated.filter((e) => e.source === connection.source).length;
              data.nodeStyle = sourceOut >= 2 ? "parallel-child" : "serial";
            } else if (n.id !== connection.source && n.id !== connection.target) {
              // Re-evaluate: if this node has no incoming from a multi-out source, ensure serial
              const incoming = updated.filter((e) => e.target === n.id);
              if (incoming.length > 0) {
                const srcOut = updated.filter((e) => e.source === incoming[0].source).length;
                data.nodeStyle = srcOut >= 2 ? "parallel-child" : "serial";
              }
            }
            return { ...n, data };
          }),
        );
        return updated;
      });
    },
    [edges, setEdges, setNodes],
  );

  // ── Click node → edit properties ──
  const onNodeClick = useCallback((_event: any, node: Node) => {
    setEditingNodeId(node.id);
    setEditLabel(String((node.data as Record<string, unknown>).label));
    setPropModalOpen(true);
  }, []);

  const handleSaveProps = () => {
    if (!editingNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === editingNodeId ? { ...n, data: { ...n.data, label: editLabel } } : n,
      ),
    );
    setPropModalOpen(false);
    setEditingNodeId(null);
  };

  // ── Add new step node ──
  const handleAddNode = useCallback(() => {
    const existingIds = new Set(nodes.map((n) => n.id));
    const name = generateStepName(existingIds);
    const id = `step-${name}`;

    // Place it to the right of the rightmost node
    const maxX = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position.x)) : 0;

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "step",
        position: { x: maxX + NODE_W + NODE_H_GAP, y: PARENT_Y },
        data: { label: name.replace(/_/g, " "), builtInStep: name, nodeStyle: "serial" },
      } as Node,
    ]);
  }, [nodes, setNodes]);

  // ── Delete selected ──
  const handleDeleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);

    if (selectedNodes.length > 0) {
      const ids = new Set(selectedNodes.map((n) => n.id));
      setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
      setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    } else if (selectedEdges.length > 0) {
      const ids = new Set(selectedEdges.map((e) => e.id));
      setEdges((eds) => eds.filter((e) => !ids.has(e.id)));
    }
  }, [nodes, edges, setNodes, setEdges]);

  // ── Edge click → delete ──
  const onEdgeClick = useCallback(
    (_event: any, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      // Re-evaluate node styles
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === edge.source) {
            const remaining = edges.filter((e) => e.source === n.id && e.id !== edge.id);
            const style = remaining.length >= 2 ? "parallel-parent" : "serial";
            return { ...n, data: { ...n.data, nodeStyle: style } };
          }
          if (n.id === edge.target) {
            return { ...n, data: { ...n.data, nodeStyle: "serial" } };
          }
          return n;
        }),
      );
    },
    [edges, setEdges, setNodes],
  );

  // ── Save template ──
  const handleSave = async () => {
    if (!activeTemplate) return;
    setSaving(true);
    try {
      const steps = graphFromFlow(nodes, edges);
      await api.put(`/api/v1/workflow/templates/${activeTemplate.id}`, {
        name: activeTemplate.name,
        description: activeTemplate.description,
        isDefault: activeTemplate.isDefault,
        steps,
      });
      toast.success(t("save_success"));
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("save_failed", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  // ── Create new template ──
  const handleNewTemplate = async () => {
    try {
      await api.post("/api/v1/workflow/templates", {
        name: `Template ${templates.length + 1}`,
        description: "",
        isDefault: false,
        steps: { nodes: [], edges: [] },
      });
      toast.success(t("create_success", "Created"));
      fetchTemplates();
    } catch (err) {
      toast.error(t("create_failed"));
    }
  };

  // Keyboard delete listener disabled for read-only mode

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[560px] flex-col">
      {/* Header */}
      <PageHeader
        title={t("workflow_config")}
        description={t("workflow_config_desc", "View workflow templates")}
        icon={<Layers className="h-5 w-5" />}
        actions={<FormSelect
            value={activeTemplateId ?? ""}
            onChange={(e) => setActiveTemplateId(e.target.value || null)}
            className="w-auto! min-w-[250px]!"
          >
            <option value="">{t("select_template", "Select template...")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} {tpl.isDefault ? `[${t("default")}]` : ""}
              </option>
            ))}
          </FormSelect>}
        bordered
        className="shrink-0 px-1 pb-4"
      />

      {/* React Flow Canvas */}
      <div className="flex-1 relative bg-slate-50">
        {activeTemplate ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
            maxZoom={2}
            connectionLineStyle={{ stroke: "var(--color-action)", strokeWidth: 2 }}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
          >
            <Background color="#cbd5e1" gap={20} size={1} variant={BackgroundVariant.Dots} />
            <Controls showInteractive={false} position="bottom-right" />
            <MiniMap
              nodeStrokeColor="#6366f1"
              nodeColor="#e0e7ff"
              maskColor="rgba(255,255,255,0.8)"
              style={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              position="top-right"
            />
            <Panel position="bottom-left" className="text-[11px] text-gray-400 bg-white/80 rounded-lg px-3 py-2 shadow-sm border border-gray-100 leading-relaxed mb-2 ml-2">
              <div>ℹ️ {t("flow_hint_readonly", "流程配置当前为只读模式")}</div>
            </Panel>
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            {t("no_templates")}
          </div>
        )}
      </div>

      {/* Properties Modal */}
      <Modal
        open={propModalOpen}
        onClose={() => setPropModalOpen(false)}
        title={t("edit_properties")}
        maxWidth="md"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setPropModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={handleSaveProps}>
              <Save className="w-4 h-4" />
              {t("save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("step_key")}
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
              value={editingNodeId?.replace("step-", "") || ""}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("step_label")}
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/30"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
            />
          </div>

        </div>
      </Modal>
    </div>
  );
}
