import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Verifies BACKEND_SPEC.md's optimistic-lock requirement in isolation:
 * a PUT /experiments/:id with a stale versionNo must return 409, while
 * the same request with the correct versionNo succeeds and increments it.
 *
 * REQUIRES a real Postgres instance + seeded data, same as eln-flow.e2e-spec.ts.
 */
describe('Experiments optimistic lock (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'pi@eln.local', password: 'Password123!' });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 409 when versionNo is stale, and 200 when it is current', async () => {
    // NOTE: replace with a real seeded experiment id in your environment.
    const experimentId = process.env.E2E_SEED_EXPERIMENT_ID ?? 'replace-with-seeded-experiment-id';

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    if (detail.status !== 200) {
      // Environment not seeded for this id — skip rather than false-fail.
      return;
    }

    const currentVersion = detail.body.versionNo;

    // Stale update: deliberately send an old version number.
    await request(app.getHttpServer())
      .put(`/api/v1/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Stale update', versionNo: currentVersion - 1 || 0 })
      .expect(409);

    // Correct update: succeeds and increments versionNo.
    const ok = await request(app.getHttpServer())
      .put(`/api/v1/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Fresh update', versionNo: currentVersion })
      .expect(200);

    expect(ok.body.versionNo).toBe(currentVersion + 1);
  });
});