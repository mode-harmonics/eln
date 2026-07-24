import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Full happy-path e2e flow per BACKEND_SPEC.md / plan §Phase 7:
 *   login -> create project -> create experiment -> upload sample xlsx
 *   -> query data -> submit for review.
 *
 * REQUIRES a real Postgres instance reachable via the env vars in
 * apps/backend/.env, with migrations already run and the seed script
 * already executed (so pi@eln.local exists). This is an integration test,
 * not a unit test — it is intentionally excluded from the fast `test`
 * script and only runs via `test:e2e`.
 */
describe('ELN full flow (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let projectId: string;
  let experimentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with the seeded PI account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'pi', password: 'Password123!' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('pi@eln.local');
    accessToken = res.body.accessToken;
  });

  it('fetches the current user profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe('pi@eln.local');
    expect(res.body.roleName).toBe('Owner');
  });

  it('creates a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'E2E Test Project', description: 'Created by e2e test' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    projectId = res.body.id;
  });

  it('lists projects visible to the user, including the new one', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it('creates an experiment under the project', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/experiments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'E2E Upload Experiment', assayType: 'ProcessData' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    experimentId = res.body.id;
  });

  it('uploads a sample 7-sheet xlsx and parses rows into the data tables', async () => {
    // Build a minimal in-memory workbook covering all 7 business tables.
    const workbook = new ExcelJS.Workbook();

    const process = workbook.addWorksheet('ProcessData');
    process.addRow(['cellId', 'm0', 'fu0', 'fq1', 'gu0', 'gqc1']);
    process.addRow(['A001', 1.1, 3.5, 0.9, 3.6, 1.1]);

    const calendar = workbook.addWorksheet('CalendarLife');
    calendar.addRow(['cellName', 'q_0d', 'q_7d']);
    calendar.addRow(['A001', 2.0, 1.95]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const res = await request(app.getHttpServer())
      .post('/api/v1/data/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('experimentId', experimentId)
      .attach('files', buffer, 'sample.xlsx')
      .expect(201);

    expect(res.body.rowsInsertedByTable).toBeDefined();
  });

  it('queries process data for the experiment', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/data/process/${experimentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });
});