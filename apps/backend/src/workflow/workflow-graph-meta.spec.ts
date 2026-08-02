import { deriveWorkflowGraphMeta } from '@eln/shared';

/**
 * Default seed template:
 * - experiment_design: container group via parentId (design, procurement are its children)
 * - testing: parallel group via edge fan-out (6 test children)
 * - remaining steps: serial chain
 */
const DEFAULT_GRAPH = {
  nodes: [
    { id: 'experiment_design', label: '实验设计' },
    { id: 'design', label: '实验设计', parentId: 'experiment_design' },
    { id: 'procurement', label: '试剂采购', parentId: 'experiment_design' },
    { id: 'solution_preparation', label: '配液' },
    { id: 'drying_injection', label: '干燥/注液' },
    { id: 'formation', label: '化成' },
    { id: 'second_sealing', label: '二封' },
    { id: 'capacity_grading', label: '定容' },
    { id: 'battery_selection', label: '挑选电池' },
    { id: 'testing', label: '测试' },
    { id: 'calendar_life', label: '日历寿命', parentId: 'testing' },
    { id: 'storage_swelling', label: '存储胀气', parentId: 'testing' },
    { id: 'energy_efficiency', label: '能量效率', parentId: 'testing' },
    { id: 'dcr_test', label: 'DCR测试', parentId: 'testing' },
    { id: 'fast_charge', label: '快充测试', parentId: 'testing' },
    { id: 'ht_cycle', label: '高温循环', parentId: 'testing' },
  ],
  edges: [
    { from: 'experiment_design', to: 'design' },
    { from: 'design', to: 'procurement' },
    { from: 'procurement', to: 'solution_preparation' },
    { from: 'solution_preparation', to: 'drying_injection' },
    { from: 'drying_injection', to: 'formation' },
    { from: 'formation', to: 'second_sealing' },
    { from: 'second_sealing', to: 'capacity_grading' },
    { from: 'capacity_grading', to: 'battery_selection' },
    { from: 'battery_selection', to: 'testing' },
    { from: 'testing', to: 'calendar_life' },
    { from: 'testing', to: 'storage_swelling' },
    { from: 'testing', to: 'energy_efficiency' },
    { from: 'testing', to: 'dcr_test' },
    { from: 'testing', to: 'fast_charge' },
    { from: 'testing', to: 'ht_cycle' },
  ],
};

describe('deriveWorkflowGraphMeta', () => {
  it('derives groups from explicit parentId', () => {
    const meta = deriveWorkflowGraphMeta(DEFAULT_GRAPH);
    expect(meta.isGroup['experiment_design']).toBe(true);
    expect(meta.parentOf['design']).toBe('experiment_design');
    expect(meta.parentOf['procurement']).toBe('experiment_design');
    expect(meta.childrenOf['experiment_design']).toEqual(['design', 'procurement']);
  });

  it('derives parallel groups from edge fan-out', () => {
    const meta = deriveWorkflowGraphMeta(DEFAULT_GRAPH);
    expect(meta.isGroup['testing']).toBe(true);
    expect(meta.parentOf['calendar_life']).toBe('testing');
    expect(meta.parentOf['ht_cycle']).toBe('testing');
    expect(meta.childrenOf['testing']).toEqual([
      'calendar_life',
      'storage_swelling',
      'energy_efficiency',
      'dcr_test',
      'fast_charge',
      'ht_cycle',
    ]);
  });

  it('treats experiment_design as a SERIAL group (design → procurement)', () => {
    const meta = deriveWorkflowGraphMeta(DEFAULT_GRAPH);
    // experiment_design has out-degree 1 (only edge to design), so its two
    // parentId children must run in order: design first, then procurement.
    expect(meta.isGroup['experiment_design']).toBe(true);
    expect(meta.groupType['experiment_design']).toBe('serial');
    expect(meta.childrenOf['experiment_design']).toEqual(['design', 'procurement']);
    expect(meta.isGroup['design']).toBe(false);
    expect(meta.isGroup['procurement']).toBe(false);
  });

  it('treats testing as a PARALLEL group (fan-out)', () => {
    const meta = deriveWorkflowGraphMeta(DEFAULT_GRAPH);
    expect(meta.isGroup['testing']).toBe(true);
    expect(meta.groupType['testing']).toBe('parallel');
  });

  it('treats serial steps as non-groups with no parent', () => {
    const meta = deriveWorkflowGraphMeta(DEFAULT_GRAPH);
    expect(meta.isGroup['solution_preparation']).toBe(false);
    expect(meta.isGroup['formation']).toBe(false);
    expect(meta.parentOf['formation']).toBeUndefined();
  });

  it('handles a fan-out-only graph (WorkflowConfig UI templates have no parentId)', () => {
    const meta = deriveWorkflowGraphMeta({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ],
    });
    expect(meta.isGroup['a']).toBe(true);
    expect(meta.groupType['a']).toBe('parallel');
    expect(meta.parentOf['b']).toBe('a');
    expect(meta.parentOf['c']).toBe('a');
    // d is a merge point, not a child of the group
    expect(meta.parentOf['d']).toBeUndefined();
    expect(meta.isGroup['d']).toBe(false);
  });

  it('orders serial group children by topology (design before procurement)', () => {
    const meta = deriveWorkflowGraphMeta({
      nodes: [
        { id: 'container', label: 'C' },
        { id: 'x', label: 'X', parentId: 'container' },
        { id: 'y', label: 'Y', parentId: 'container' },
      ],
      // y depends on x → serial order must be [x, y] even though nodes list y first
      edges: [
        { from: 'container', to: 'x' },
        { from: 'x', to: 'y' },
      ],
    });
    expect(meta.groupType['container']).toBe('serial');
    expect(meta.childrenOf['container']).toEqual(['x', 'y']);
  });

  it('ignores edges referencing unknown nodes', () => {
    const meta = deriveWorkflowGraphMeta({
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ from: 'a', to: 'ghost' }],
    });
    expect(meta.isGroup['a']).toBe(false);
  });
});
