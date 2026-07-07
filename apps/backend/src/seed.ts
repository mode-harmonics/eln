import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { AppDataSource } from './data-source';
import { Experiment } from './entities/experiment.entity';
import { Project } from './entities/project.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { ProcessData } from './entities/process-data.entity';
import { CalendarLife } from './entities/calendar-life.entity';
import { StorageSwelling } from './entities/storage-swelling.entity';
import { EnergyEfficiency } from './entities/energy-efficiency.entity';
import { DcrTest } from './entities/dcr-test.entity';
import { FastCharge } from './entities/fast-charge.entity';
import { HtCycle } from './entities/ht-cycle.entity';

const ROLE_DEFS: Array<{ name: string; permissionList: string[] }> = [
  {
    name: 'Owner',
    permissionList: [
      'projects:*', 'experiments:*', 'data:*', 'users:*', 'roles:*',
    ],
  },
  {
    name: 'Admin',
    permissionList: [
      'projects:read', 'projects:write', 'experiments:*', 'data:*', 'users:read',
    ],
  },
  {
    name: 'Editor',
    permissionList: [
      'projects:read', 'experiments:read', 'experiments:write',
      'data:read', 'data:write',
    ],
  },
  {
    name: 'Viewer',
    permissionList: ['projects:read', 'experiments:read', 'data:read'],
  },
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('DataSource initialized for seeding.');

  const rolesRepo = AppDataSource.getRepository(Role);
  const usersRepo = AppDataSource.getRepository(User);
  const projectsRepo = AppDataSource.getRepository(Project);
  const experimentsRepo = AppDataSource.getRepository(Experiment);

  // --- 1. Roles ---
  const roleByName = new Map<string, Role>();
  for (const def of ROLE_DEFS) {
    let role = await rolesRepo.findOne({ where: { name: def.name } });
    if (!role) {
      role = await rolesRepo.save(
        rolesRepo.create({ id: uuid(), name: def.name, permissionList: def.permissionList }),
      );
      console.log(`Created role: ${def.name}`);
    }
    roleByName.set(def.name, role);
  }

  // --- 2. Demo users: one PI (Owner), one Editor ---
  const piPasswordHash = await bcrypt.hash('Password123!', 10);
  let piUser = await usersRepo.findOne({ where: { email: 'pi@eln.local' } });
  if (!piUser) {
    piUser = await usersRepo.save(
      usersRepo.create({
        id: uuid(),
        username: 'pi',
        email: 'pi@eln.local',
        passwordHash: piPasswordHash,
        fullName: 'Dr. Alice Chen (PI)',
        roleId: roleByName.get('Owner')!.id,
        isActive: true,
      }),
    );
    console.log('Created demo user: pi / Password123!');
  }

  const editorPasswordHash = await bcrypt.hash('Password123!', 10);
  const existingEditor = await usersRepo.findOne({ where: { email: 'editor@eln.local' } });
  if (!existingEditor) {
    await usersRepo.save(
      usersRepo.create({
        id: uuid(),
        username: 'editor',
        email: 'editor@eln.local',
        passwordHash: editorPasswordHash,
        fullName: 'Bob Tanaka (Editor)',
        roleId: roleByName.get('Editor')!.id,
        isActive: true,
      }),
    );
    console.log('Created demo user: editor / Password123!');
  }

  // --- 3. Sample project ---
  let project = await projectsRepo.findOne({ where: { name: 'NMC811 Fast-Charge Qualification' } });
  if (!project) {
    project = await projectsRepo.save(
      projectsRepo.create({
        id: uuid(),
        name: 'NMC811 Fast-Charge Qualification',
        description: 'Qualification campaign for NMC811 cells under stepped fast-charge protocols.',
        status: 'Active',
        createdBy: piUser.id,
      }),
    );
    console.log('Created sample project.');
  }

  // --- 4. Sample experiment ---
  const existingExperiment = await experimentsRepo.findOne({
    where: { projectId: project.id, title: 'Batch 001 — Fast Charge & Calendar Life' },
  });
  if (!existingExperiment) {
    await experimentsRepo.save(
      experimentsRepo.create({
        id: uuid(),
        projectId: project.id,
        title: 'Batch 001 — Fast Charge & Calendar Life',
        content: '# Batch 001\n\nInitial qualification run for the NMC811 cell batch.',
        status: 'Draft',
        metadata: {
          assayType: 'fast-charge-qualification',
          notebookRef: 'NB-2026-001',
          deviceUsed: 'Neware CT-4008',
          reagentLotId: 'LOT-NMC811-0042',
        },
        versionNo: 1,
        createdBy: piUser.id,
      }),
    );
    console.log('Created sample experiment.');
  }

  // --- 5. Business-table experiments for the sample project ---
  // These are auto-created by syncCellsToTables at runtime, but pre-creating
  // them at seed time gives cleaner test data.
  const existingAssayTypes = new Set(
    (await experimentsRepo.find({ where: { projectId: project.id } as any }))
      .map((e) => (e.metadata as any)?.assayType)
      .filter(Boolean),
  );
  const ASSAY_TYPES: { key: string; label: string }[] = [
    { key: 'CalendarLife', label: '日历寿命' },
    { key: 'StorageSwelling', label: '存储胀气' },
    { key: 'EnergyEfficiency', label: '能量效率' },
    { key: 'DcrTest', label: 'DCR测试' },
    { key: 'FastCharge', label: '快充时间' },
    { key: 'HtCycle', label: '高温循环' },
  ];
  for (const at of ASSAY_TYPES) {
    if (!existingAssayTypes.has(at.key)) {
      await experimentsRepo.save(
        experimentsRepo.create({
          id: uuid(),
          projectId: project.id,
          title: `${at.label} - ${new Date().toISOString().split('T')[0]}`,
          status: 'Draft',
          metadata: { assayType: at.key },
          versionNo: 1,
          createdBy: piUser.id,
        }),
      );
      console.log(`Created business-table experiment: ${at.label}`);
    }
  }

  // --- 6. ProcessData experiment + 20 demo cells ---
  const pdExpId = 'f5bc6334-3f11-4011-bcb2-59dde1f17375';
  let pdExp = await experimentsRepo.findOne({ where: { id: pdExpId } });
  if (!pdExp) {
    pdExp = await experimentsRepo.save(
      experimentsRepo.create({
        id: pdExpId,
        projectId: project.id,
        title: 'ProcessData - Demo 20 Cells',
        status: 'Draft',
        metadata: { assayType: 'ProcessData' },
        versionNo: 1,
        createdBy: piUser.id,
      }),
    );
    console.log('Created ProcessData experiment.');
  }

  // Seed 20 demo processData rows if they don't already exist
  const existingPd = await AppDataSource.getRepository(ProcessData).count({
    where: { experimentId: pdExp.id } as any,
  });
  if (existingPd === 0) {
    const rows: Partial<ProcessData>[] = [];
    for (let i = 1; i <= 20; i++) {
      const cellId = `S${String(i).padStart(2, '0')}`;
      const r = (min: number, max: number) => min + (Math.random() - 0.5) * (max - min);
      const m0 = (48 + r(0, 2)).toFixed(6);
      const m1 = (49 + r(0, 2)).toFixed(6);
      const m2 = (48.5 + r(0, 2)).toFixed(6);
      const m3 = (49.2 + r(0, 2)).toFixed(6);
      const m4 = (48.8 + r(0, 2)).toFixed(6);
      const v0 = (3.65 + r(0, 0.1)).toFixed(6);
      const v1 = (3.72 + r(0, 0.1)).toFixed(6);
      const fu0 = (3.45 + r(0, 0.1)).toFixed(6);
      const fr0 = (0.8 + r(0, 0.2)).toFixed(6);
      const fq1 = (25 + r(0, 2)).toFixed(6);
      const fq2 = (0.5 + r(0, 0.1)).toFixed(6);
      const fu1 = (3.72 + r(0, 0.02)).toFixed(6);
      const fr1 = (0.9 + r(0, 0.2)).toFixed(6);
      const fu2 = (3.69 + r(0, 0.02)).toFixed(6);
      const fr2 = (0.95 + r(0, 0.2)).toFixed(6);
      const gu0 = (3.50 + r(0, 0.08)).toFixed(6);
      const gr0 = (0.85 + r(0, 0.15)).toFixed(6);
      const gqc1 = (25.2 + r(0, 2)).toFixed(6);
      const gqd1 = (24.8 + r(0, 1.5)).toFixed(6);
      const gqc2 = (0.6 + r(0, 0.1)).toFixed(6);
      const gu1 = (3.68 + r(0, 0.02)).toFixed(6);
      const gr1 = (0.92 + r(0, 0.18)).toFixed(6);

      const mIn = (Number(m1) - Number(m0)).toFixed(6);
      const mLoss = (Number(m1) - Number(m2)).toFixed(6);
      const mHold = (Number(m4) - Number(m0)).toFixed(6);
      const fq = (Number(fq1) + Number(fq2)).toFixed(6);
      const qdFirst = gqd1;
      const fvg = v0 !== '0' && v1 !== '0' ? ((Number(v1) - Number(v0)) / Number(gqd1)).toFixed(6) : '0';
      const ku = (Number(fu1) - Number(fu2)).toFixed(6);
      const qcFirst = (Number(fq) + Number(gqc1)).toFixed(6);
      const ceFirst = ((Number(qdFirst) / Number(qcFirst)) * 100).toFixed(6);

      rows.push({
        id: uuid(),
        experimentId: pdExp.id,
        cellId,
        m0, m1, m2, m3, m4,
        v0, v1,
        fu0, fr0, fq1, fq2, fu1, fr1, fu2, fr2,
        gu0, gr0, gqc1, gqd1, gqc2, gu1, gr1,
        mIn, mLoss, mHold, fq, qdFirst, fvg, ku, qcFirst, ceFirst,
      } as ProcessData);
    }
    await AppDataSource.getRepository(ProcessData).save(rows);
    console.log(`Seeded ${rows.length} demo processData rows.`);
  } else {
    console.log(`ProcessData already has ${existingPd} rows, skipping seed.`);
  }

  // --- 7. Demo data for 6 business tables ---
  const cellIds = Array.from({ length: 20 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
  const r = (min: number, max: number) => min + Math.random() * (max - min);

  // Helper: find experiment by assayType
  const expByAssay = async (at: string) => {
    const all = await experimentsRepo.find({ where: { projectId: project.id } as any });
    return all.find((e) => (e.metadata as any)?.assayType === at)!;
  };

  /** CalendarLife — 3 checkpoints per cell (day 0, 30, 60) */
  {
    const eid = (await expByAssay('CalendarLife')).id;
    const repo = AppDataSource.getRepository(CalendarLife);
    const cnt = await repo.count({ where: { experimentId: eid } as any });
    if (cnt === 0) {
      const rows: Partial<CalendarLife>[] = [];
      const q0 = 24.5, ddcr0 = 0.018, cdcr0 = 0.015, u0 = 3.7, r0 = 0.9;
      for (const cellId of cellIds) {
        for (const [day, qDrop, dqDrop, ddcrMul, cdcrMul, uShift, rMul] of [
          [0, 1, 1, 1, 1, 0, 1],
          [30, 0.97, 0.95, 1.12, 1.10, -0.02, 1.05],
          [60, 0.94, 0.91, 1.25, 1.22, -0.04, 1.10],
        ]) {
          const q = (q0 * qDrop * r(0.98, 1.02)).toFixed(6);
          const dq = (q0 * dqDrop * r(0.98, 1.02)).toFixed(6);
          const ddcr = (ddcr0 * ddcrMul * r(0.95, 1.05)).toFixed(6);
          const cdcr = (cdcr0 * cdcrMul * r(0.95, 1.05)).toFixed(6);
          const u = (u0 + uShift + r(-0.01, 0.01)).toFixed(6);
          const rr = (r0 * rMul * r(0.97, 1.03)).toFixed(6);
          const qRet = ((Number(dq) / q0) * 100).toFixed(6);
          const qRec = ((Number(q) / q0) * 100).toFixed(6);
          const ddcrG = ((Number(ddcr) / ddcr0 - 1) * 100).toFixed(6);
          const cdcrG = ((Number(cdcr) / cdcr0 - 1) * 100).toFixed(6);
          const uG = ((Number(u) / u0 - 1) * 100).toFixed(6);
          const rG = ((Number(rr) / r0 - 1) * 100).toFixed(6);
          rows.push({ id: uuid(), experimentId: eid, cellName: cellId, dayCount: day, q, dq, ddcr, cdcr, u: u, r: rr, qRetention: qRet, qRecovery: qRec, ddcrGrowth: ddcrG, cdcrGrowth: cdcrG, uGrowth: uG, rGrowth: rG } as CalendarLife);
        }
      }
      await repo.save(rows);
      console.log(`Seeded ${rows.length} CalendarLife rows.`);
    } else {
      console.log(`CalendarLife already has ${cnt} rows, skipping.`);
    }
  }

  /** StorageSwelling — 3 checkpoints per cell (day 0, 15, 30) */
  {
    const eid = (await expByAssay('StorageSwelling')).id;
    const repo = AppDataSource.getRepository(StorageSwelling);
    const cnt = await repo.count({ where: { experimentId: eid } as any });
    if (cnt === 0) {
      const rows: Partial<StorageSwelling>[] = [];
      for (const cellId of cellIds) {
        const qd1st = (24.8 + r(-1, 1)).toFixed(6);
        const v0 = (12.5 + r(-0.2, 0.2)).toFixed(6);
        for (const [day, vMul] of [[0, 1], [15, 1.03], [30, 1.06]]) {
          const v = (Number(v0) * vMul * r(0.99, 1.01)).toFixed(6);
          const vg = day === 0 ? '0' : ((Number(v) - Number(v0)) / Number(qd1st)).toFixed(6);
          rows.push({ id: uuid(), experimentId: eid, cellName: cellId, qd1st, dayCount: day, v, vg } as StorageSwelling);
        }
      }
      await repo.save(rows);
      console.log(`Seeded ${rows.length} StorageSwelling rows.`);
    } else {
      console.log(`StorageSwelling already has ${cnt} rows, skipping.`);
    }
  }

  /** EnergyEfficiency — 1 row per cell */
  {
    const eid = (await expByAssay('EnergyEfficiency')).id;
    const repo = AppDataSource.getRepository(EnergyEfficiency);
    const cnt = await repo.count({ where: { experimentId: eid } as any });
    if (cnt === 0) {
      const rows: Partial<EnergyEfficiency>[] = cellIds.map((cellId) => {
        const de = (23.5 + r(-1, 1)).toFixed(6);
        const ce = (24.8 + r(-1, 1)).toFixed(6);
        const ee = (Number(de) / Number(ce)).toFixed(6);
        return { id: uuid(), experimentId: eid, cellName: cellId, de, ce, ee };
      }) as EnergyEfficiency[];
      await repo.save(rows);
      console.log(`Seeded ${rows.length} EnergyEfficiency rows.`);
    } else {
      console.log(`EnergyEfficiency already has ${cnt} rows, skipping.`);
    }
  }

  /** DcrTest — 1 row per cell */
  {
    const eid = (await expByAssay('DcrTest')).id;
    const repo = AppDataSource.getRepository(DcrTest);
    const cnt = await repo.count({ where: { experimentId: eid } as any });
    if (cnt === 0) {
      const rows: Partial<DcrTest>[] = cellIds.map((cellId) => {
        const q0 = (24.5 + r(-1, 1)).toFixed(6);
        const du0 = (3.68 + r(-0.02, 0.02)).toFixed(6);
        const du1 = (3.52 + r(-0.02, 0.02)).toFixed(6);
        const di = (24 + r(-1, 1)).toFixed(6);
        const cu0 = (3.72 + r(-0.02, 0.02)).toFixed(6);
        const cu1 = (3.88 + r(-0.02, 0.02)).toFixed(6);
        const ci = (24 + r(-1, 1)).toFixed(6);
        const ddcr = (Math.abs(Number(du1) - Number(du0)) / Number(di)).toFixed(6);
        const cdcr = (Math.abs(Number(cu1) - Number(cu0)) / Number(ci)).toFixed(6);
        const dRc = (Number(q0) * Number(ddcr)).toFixed(6);
        const cRc = (Number(q0) * Number(cdcr)).toFixed(6);
        return { id: uuid(), experimentId: eid, cellName: cellId, q0, du0, du1, di, cu0, cu1, ci, ddcr, cdcr, dRcProduct: dRc, cRcProduct: cRc };
      }) as DcrTest[];
      await repo.save(rows);
      console.log(`Seeded ${rows.length} DcrTest rows.`);
    } else {
      console.log(`DcrTest already has ${cnt} rows, skipping.`);
    }
  }

  /** FastCharge — 1 row per cell with steps */
  {
    const eid = (await expByAssay('FastCharge')).id;
    const repo = AppDataSource.getRepository(FastCharge);
    const cnt = await repo.count({ where: { experimentId: eid } as any });
    if (cnt === 0) {
      const rows: Partial<FastCharge>[] = cellIds.map((cellId) => {
        const c0 = (3.0 + r(-0.1, 0.1)).toFixed(6);
        const steps = [
          { stepNo: 1, rate: '3.0C0', cutOffVoltage: 3.45, current: 9.0, stepCapacity: 0.6, stepTime: 4.0, stepSoc: 0.2, cumulativeSoc: 0.2 },
          { stepNo: 2, rate: '4.0C0', cutOffVoltage: 3.65, current: 12.0, stepCapacity: 0.75, stepTime: 3.75, stepSoc: 0.25, cumulativeSoc: 0.45 },
          { stepNo: 3, rate: '4.5C0', cutOffVoltage: 3.85, current: 13.5, stepCapacity: 0.6, stepTime: 2.67, stepSoc: 0.2, cumulativeSoc: 0.65 },
          { stepNo: 4, rate: '2.0C0', cutOffVoltage: 4.2, current: 6.0, stepCapacity: 0.45, stepTime: 4.5, stepSoc: 0.15, cumulativeSoc: 0.8 },
        ];
        const computedTime = steps.reduce((s, st) => s + st.stepTime, 0);
        return { id: uuid(), experimentId: eid, cellName: cellId, c0, providedFastChargeTime: null, computedFastChargeTime: computedTime.toFixed(6), steps };
      }) as FastCharge[];
      await repo.save(rows);
      console.log(`Seeded ${rows.length} FastCharge rows.`);
    } else {
      console.log(`FastCharge already has ${cnt} rows, skipping.`);
    }
  }

  /** HtCycle — 3 cycles per cell (100, 300, 500) */
  {
    const eid = (await expByAssay('HtCycle')).id;
    const repo = AppDataSource.getRepository(HtCycle);
    const cnt = await repo.count({ where: { experimentId: eid } as any });
    if (cnt === 0) {
      const rows: Partial<HtCycle>[] = [];
      for (const cellId of cellIds) {
        const base = 24.8;
        for (const [cycle, retention] of [[100, 0.96], [300, 0.89], [500, 0.82]]) {
          const cap = (base * retention * r(0.98, 1.02)).toFixed(6);
          rows.push({ id: uuid(), experimentId: eid, cellName: cellId, cycle, dischargeCapacity: cap, capacityRetention: (retention * 100 * r(0.99, 1.01)).toFixed(6), ironDissolution: (50 + r(-20, 80)).toFixed(6) } as HtCycle);
        }
      }
      await repo.save(rows);
      console.log(`Seeded ${rows.length} HtCycle rows.`);
    } else {
      console.log(`HtCycle already has ${cnt} rows, skipping.`);
    }
  }

  await AppDataSource.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});