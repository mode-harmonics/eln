import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { AppDataSource } from './data-source';
import {
  CalendarLife,
  DcrTest,
  EnergyEfficiency,
  Experiment,
  FastCharge,
  HtCycle,
  Project,
  StorageSwelling,
  User,
  WorkflowInstance,
  WorkflowStepAssignment,
  WorkflowTemplate,
} from './entities';

const PROJECT_NAME = '图表验收演示项目（A/B/C 三组）';
const groups = [
  { name: 'A', factor: 1.02 },
  { name: 'B', factor: 1.0 },
  { name: 'C', factor: 0.97 },
];
const cells = groups.flatMap((group) =>
  Array.from({ length: 6 }, (_, index) => ({
    cellName: `${group.name}${String(index + 1).padStart(2, '0')}`,
    group: group.name,
    factor: group.factor,
    offset: (index - 2.5) * 0.002,
  })),
);

async function ensureTestingWorkflow(project: Project, owner: User): Promise<string> {
  const instanceRepo = AppDataSource.getRepository(WorkflowInstance);
  const existing = await instanceRepo.findOne({ where: { projectId: project.id } });
  if (existing) {
    if (project.workflowInstanceId !== existing.id || project.workflowStatus !== 'Active') {
      await AppDataSource.getRepository(Project).update(project.id, { workflowInstanceId: existing.id, workflowStatus: 'Active' });
    }
    return existing.id;
  }

  const template = await AppDataSource.getRepository(WorkflowTemplate).findOne({ where: { isDefault: true } });
  if (!template) throw new Error('Default workflow template is missing. Run the standard seed first.');
  const nodes: Array<{ id: string; parentId?: string }> = (template.steps as any)?.nodes ?? [];
  const testingIndex = nodes.findIndex((node) => node.id === 'testing');
  if (testingIndex < 0) throw new Error('The default workflow template has no testing step.');

  return AppDataSource.transaction(async (manager) => {
    const instance = await manager.getRepository(WorkflowInstance).save(manager.getRepository(WorkflowInstance).create({
      id: randomUUID(), projectId: project.id, templateId: template.id, status: 'Active', currentStepIndex: testingIndex,
    }));
    const now = new Date();
    const assignments = nodes.map((node, index) => {
      const isTestingChild = node.parentId === 'testing';
      const isCompleted = index < testingIndex;
      return manager.getRepository(WorkflowStepAssignment).create({
        id: randomUUID(), workflowInstanceId: instance.id, stepName: node.id, stepIndex: index,
        assignedUserId: owner.id, status: isCompleted ? 'completed' : (node.id === 'testing' || isTestingChild ? 'in_progress' : 'pending'),
        canViewOtherSteps: true, canViewInternalCode: true, visibleToUserIds: [owner.id],
        completedAt: isCompleted ? now : null, completedBy: isCompleted ? owner.id : null,
      });
    });
    await manager.getRepository(WorkflowStepAssignment).save(assignments);
    await manager.getRepository(Project).update(project.id, { workflowInstanceId: instance.id, workflowStatus: 'Active' });
    return instance.id;
  });
}

async function main() {
  await AppDataSource.initialize();
  const projectRepo = AppDataSource.getRepository(Project);
  const experimentRepo = AppDataSource.getRepository(Experiment);
  const existing = await projectRepo.findOne({ where: { name: PROJECT_NAME } });
  if (existing) {
    const owner = await AppDataSource.getRepository(User).findOne({ where: { id: existing.createdBy } });
    if (!owner) throw new Error('The demo project owner no longer exists.');
    const workflowInstanceId = await ensureTestingWorkflow(existing, owner);
    const experiments = await experimentRepo.find({ where: { projectId: existing.id } });
    console.log(JSON.stringify({ projectId: existing.id, projectName: existing.name, workflowInstanceId, repaired: true, experiments: experiments.map((e) => ({ id: e.id, title: e.title })) }, null, 2));
    await AppDataSource.destroy();
    return;
  }

  const owner = await AppDataSource.getRepository(User).findOne({ where: { email: 'pi@eln.local' } });
  if (!owner) throw new Error('Seed user pi@eln.local is missing. Run the standard seed first.');

  const project = await projectRepo.save(projectRepo.create({
    id: randomUUID(),
    name: PROJECT_NAME,
    description: '用于验收实验详情双图、A/B/C 分组图例以及点击图例显隐功能的完整模拟数据。',
    status: 'Active',
    workflowStatus: 'testing',
    defaultCellCount: cells.length,
    versionNo: 1,
    createdBy: owner.id,
  }));

  const definitions = [
    ['CalendarLife', 'calendar_life', '日历寿命'],
    ['StorageSwelling', 'storage_swelling', '存储胀气'],
    ['EnergyEfficiency', 'energy_efficiency', '能量效率'],
    ['DcrTest', 'dcr_test', 'DCR 测试'],
    ['FastCharge', 'fast_charge', '快充测试'],
    ['HtCycle', 'ht_cycle', '高温循环'],
  ] as const;
  const experimentByType = new Map<string, Experiment>();
  for (const [assayType, workflowStepName, title] of definitions) {
    const experiment = await experimentRepo.save(experimentRepo.create({
      id: randomUUID(), projectId: project.id, title: `${title}－三组对比`,
      content: `# ${title}\n\nA/B/C 三组，每组 6 颗电芯，用于双图与图例交互验收。`,
      status: 'Draft', metadata: { assayType, workflowStepName }, workflowStepName,
      versionNo: 1, createdBy: owner.id,
    }));
    experimentByType.set(assayType, experiment);
  }

  const calendarRows: Partial<CalendarLife>[] = [];
  for (const cell of cells) for (const day of [0, 15, 30, 60, 90]) {
    const q0 = 24.8 * cell.factor + cell.offset;
    const retention = 100 - day * (cell.group === 'A' ? 0.055 : cell.group === 'B' ? 0.075 : 0.1) + cell.offset * 10;
    const recovery = retention + 1.2;
    const ddcrGrowth = day * (cell.group === 'A' ? 0.12 : cell.group === 'B' ? 0.17 : 0.23);
    const ddcr0 = 0.0065 / cell.factor;
    calendarRows.push({
      id: randomUUID(), experimentId: experimentByType.get('CalendarLife')!.id, cellName: cell.cellName, dayCount: day,
      dq: (q0 * retention / 100).toFixed(6), q: (q0 * recovery / 100).toFixed(6),
      qRetention: retention.toFixed(6), qRecovery: recovery.toFixed(6),
      ddcr: (ddcr0 * (1 + ddcrGrowth / 100)).toFixed(6), cdcr: (ddcr0 * 0.9 * (1 + ddcrGrowth / 110)).toFixed(6),
      ddcrGrowth: ddcrGrowth.toFixed(6), cdcrGrowth: (ddcrGrowth * 0.9).toFixed(6),
      u: (3.72 - day * 0.0003).toFixed(6), uGrowth: (-day * 0.008).toFixed(6),
      r: (0.82 * (1 + ddcrGrowth / 150)).toFixed(6), rGrowth: (ddcrGrowth / 1.5).toFixed(6),
    });
  }
  await AppDataSource.getRepository(CalendarLife).save(calendarRows);

  const swellingRows: Partial<StorageSwelling>[] = [];
  for (const cell of cells) {
    const qd1st = 24.7 * cell.factor;
    const v0 = 12.2 + cell.offset;
    for (const day of [0, 7, 14, 21, 30]) {
      const growth = day * (cell.group === 'A' ? 0.006 : cell.group === 'B' ? 0.009 : 0.013);
      const volume = v0 + growth;
      swellingRows.push({ id: randomUUID(), experimentId: experimentByType.get('StorageSwelling')!.id, cellName: cell.cellName, dayCount: day, qd1st: qd1st.toFixed(6), v: volume.toFixed(6), vg: ((volume - v0) / qd1st).toFixed(6) });
    }
  }
  await AppDataSource.getRepository(StorageSwelling).save(swellingRows);

  await AppDataSource.getRepository(EnergyEfficiency).save(cells.map((cell) => {
    const ce = 92 * cell.factor + cell.offset * 10;
    const efficiency = cell.group === 'A' ? 0.965 : cell.group === 'B' ? 0.945 : 0.92;
    const de = ce * efficiency;
    return { id: randomUUID(), experimentId: experimentByType.get('EnergyEfficiency')!.id, cellName: cell.cellName, ce: ce.toFixed(6), de: de.toFixed(6), ee: efficiency.toFixed(6), eePct: (efficiency * 100).toFixed(6) } as Partial<EnergyEfficiency>;
  }));

  await AppDataSource.getRepository(DcrTest).save(cells.map((cell) => {
    const q0 = 24.7 * cell.factor;
    const ddcr = (cell.group === 'A' ? 0.0058 : cell.group === 'B' ? 0.0067 : 0.0081) + cell.offset * 0.01;
    const cdcr = ddcr * 0.91;
    const di = 24; const ci = 24; const du0 = 3.72; const cu0 = 3.7;
    return { id: randomUUID(), experimentId: experimentByType.get('DcrTest')!.id, cellName: cell.cellName, q0: q0.toFixed(6), du0: du0.toFixed(6), du1: (du0 - ddcr * di).toFixed(6), di: di.toFixed(6), ddcr: ddcr.toFixed(6), cu0: cu0.toFixed(6), cu1: (cu0 + cdcr * ci).toFixed(6), ci: ci.toFixed(6), cdcr: cdcr.toFixed(6), dRcProduct: (q0 * ddcr).toFixed(6), cRcProduct: (q0 * cdcr).toFixed(6) } as Partial<DcrTest>;
  }));

  await AppDataSource.getRepository(FastCharge).save(cells.map((cell) => {
    const speed = cell.group === 'A' ? 0.9 : cell.group === 'B' ? 1 : 1.12;
    const increments = [0.18, 0.22, 0.2, 0.16, 0.12];
    let cumulative = 0;
    const steps = increments.map((soc, index) => { cumulative += soc; return { stepNo: index + 1, rate: `${[2.5, 3.5, 4, 3, 1.5][index]}C`, cutOffVoltage: [3.45, 3.62, 3.8, 4.0, 4.2][index], current: [7.5, 10.5, 12, 9, 4.5][index], stepCapacity: soc * 3, stepSoc: soc, cumulativeSoc: cumulative, stepTime: Number((soc * 20 * speed).toFixed(3)) }; });
    const total = steps.reduce((sum, step) => sum + step.stepTime, 0);
    return { id: randomUUID(), experimentId: experimentByType.get('FastCharge')!.id, cellName: cell.cellName, c0: '3.000000', providedFastChargeTime: null, computedFastChargeTime: total.toFixed(6), steps } as Partial<FastCharge>;
  }));

  const cycleRows: Partial<HtCycle>[] = [];
  for (const cell of cells) for (const cycle of [0, 100, 200, 300, 500, 800]) {
    const decay = cell.group === 'A' ? 0.00014 : cell.group === 'B' ? 0.0002 : 0.00028;
    const retention = 100 - cycle * decay * 100;
    const base = 24.8 * cell.factor;
    cycleRows.push({ id: randomUUID(), experimentId: experimentByType.get('HtCycle')!.id, cellName: cell.cellName, cycle, dischargeCapacity: (base * retention / 100).toFixed(6), capacityRetention: retention.toFixed(6), ironDissolution: (12 + cycle * (cell.group === 'C' ? 0.045 : 0.028)).toFixed(6) });
  }
  await AppDataSource.getRepository(HtCycle).save(cycleRows);

  const workflowInstanceId = await ensureTestingWorkflow(project, owner);

  console.log(JSON.stringify({ projectId: project.id, projectName: project.name, workflowInstanceId, experiments: [...experimentByType.values()].map((e) => ({ id: e.id, title: e.title })), rows: { calendar: calendarRows.length, swelling: swellingRows.length, efficiency: cells.length, dcr: cells.length, fastCharge: cells.length, htCycle: cycleRows.length } }, null, 2));
  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});
