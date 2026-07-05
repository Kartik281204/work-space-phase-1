import 'dotenv/config';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DB, Database } from '../src/db/db.module';
import { users, organizations } from '../src/db/schema';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let db: Database;

  const owner = {
    orgName: 'E2E Test Org',
    name: 'E2E Owner',
    email: 'e2e-owner@example.com',
    password: 'CorrectHorse123',
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    db = moduleRef.get<Database>(DB);
    // Clean slate so re-runs don't collide on the unique email constraint.
    await db.delete(users);
    await db.delete(organizations);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects a weak password on registration', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...owner, password: 'short' })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('Password must be at least 8 characters')]),
    );
  });

  it('rejects unexpected fields on registration (anti privilege-escalation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...owner, role: 'OWNER_OVERRIDE' })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('role should not exist')]),
    );
  });

  let accessToken: string;
  let refreshToken: string;

  it('registers a new organization + owner user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(owner)
      .expect(201);

    expect(res.body.user).toMatchObject({ email: owner.email, role: 'OWNER' });
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it('rejects a duplicate registration with the same email', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(owner).expect(409);
  });

  it('rejects login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, password: owner.password })
      .expect(200);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('allows access to a protected route with a valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({ email: owner.email, role: 'OWNER' });
  });

  it('rejects a request using the refresh token as if it were an access token', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401);
  });

  it('issues a new token pair from a valid refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('invalidates the refresh token on logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(401);
  });
});
