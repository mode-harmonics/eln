import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { AppDataSource } from '../data-source';
import { Experiment } from './entities/experiment.entity';
import { Project } from './entities/project.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';

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
    permissionList: ['projects:read', 'experiments:read', 'experiments:write', 'data:read', 'data:write'],
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
        email: 'pi@eln.local',
        passwordHash: piPasswordHash,
        fullName: 'Dr. Alice Chen (PI)',
        roleId: roleByName.get('Owner')!.id,
        isActive: true,
      }),
    );
    console.log('Created demo user: pi@eln.local / Password123!');
  }

  const editorPasswordHash = await bcrypt.hash('Password123!', 10);
  let editorUser = await usersRepo.findOne({ where: { email: 'editor@eln.local' } });
  if (!editorUser) {
    editorUser = await usersRepo.save(
      usersRepo.create({
        id: uuid(),
        email: 'editor@eln.local',
        passwordHash: editorPasswordHash,
        fullName: 'Bob Tanaka (Editor)',
        roleId: roleByName.get('Editor')!.id,
        isActive: true,
      }),
    );
    console.log('Created demo user: editor@eln.local / Password123!');
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

  await AppDataSource.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});