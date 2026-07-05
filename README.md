# Work(SPACE) — SaaS rebuild

Production rebuild of the Work(SPACE) pixel-art workplace tracker. Monorepo with a
NestJS API (this phase) and a Next.js frontend (next phase).

## Status: Phase 1 of 4 — data model + auth ✅

- [x] **Phase 1 — data model + auth scaffold** (this delivery)
- [ ] Phase 2 — full CRUD for workers/quests/reports/treasury, including edit
- [ ] Phase 3 — dashboards, kanban, gamification wired to real data (the actual UI)
- [ ] Phase 4 — broader test coverage, CI, polish pass on docs

What's real right now: a running Postgres database with the full schema applied,
a NestJS API with working registration/login/refresh/logout/RBAC, the original
app's sample data seeded in, and an 11-test e2e suite — all actually run against
a live database, not just written and assumed to work.

## Quick start (no Docker)

Requires Node 22+ and a local Postgres 16 server.

```bash
npm install

# create two databases: one for dev, one for tests
createdb workspace_saas
createdb workspace_saas_test

cd apps/api
cp .env.example .env          # edit DATABASE_URL / JWT secrets
npm run db:migrate            # applies drizzle/0000_lame_morbius.sql
npm run db:seed               # loads the original app's sample data

npm run start:dev             # → http://localhost:4000
```

In another terminal:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"arjun@workspace.demo","password":"Password123!"}'
```

Any of the 6 seeded workers can log in with `<firstname>@workspace.demo` /
`Password123!` (see the console output of `db:seed` for the full list and roles).

## Quick start (Docker)

```bash
docker compose up --build
```

Brings up Postgres + the API on `:4000`. Run migrations/seed once the containers
are healthy:

```bash
docker compose exec api node apps/api/dist/src/db/migrate.js
docker compose exec api node apps/api/dist/src/db/seed.js
```

## Running tests

```bash
cd apps/api
createdb workspace_saas_test          # once
npm run db:migrate -- --env test      # or just point DATABASE_URL at the test db
npm run test:e2e
```

All 11 auth e2e tests should pass. See `apps/api/test/auth.e2e-spec.ts`.

## API reference (Phase 1)

| Method | Route            | Auth              | Notes                              |
|--------|------------------|--------------------|-------------------------------------|
| GET    | `/health`        | Public             | Liveness check                      |
| POST   | `/auth/register` | Public             | Creates an Organization + OWNER user |
| POST   | `/auth/login`    | Public             | Returns access + refresh tokens     |
| POST   | `/auth/refresh`  | Refresh token      | Rotates both tokens                 |
| POST   | `/auth/logout`   | Access token       | Invalidates the stored refresh hash |
| GET    | `/auth/me`       | Access token       | Returns the decoded JWT payload     |

Every non-`@Public()` route requires `Authorization: Bearer <accessToken>`.
Role checks use `@Roles('OWNER', 'ADMIN')` + the global `RolesGuard` — not used
by any route yet, since Phase 1 has no business-data endpoints, but it's wired
and ready for Phase 2.

## Why Drizzle instead of Prisma

The original plan (and still a perfectly reasonable choice) was Prisma. Mid-build,
its schema-engine binary turned out to be unreachable from this sandbox's network
allowlist — a real, currently-open limitation of Prisma's rust-based tooling in
network-restricted environments, not specific to this project. Rather than hand
over code I couldn't actually run and verify, I switched to Drizzle: pure
TypeScript, no native binary, and it let me generate real migrations, apply them
to a real Postgres instance, and run a real test suite against it — all of which
you can see happened in this build. It's also a lighter dependency for a
Vercel-deployed API. If you'd rather use Prisma, the schema translates directly
(same tables/columns/relations) and nothing else in the API layer depends on
which ORM is underneath.

## Project layout

```
apps/
  api/            NestJS API (this phase)
    src/
      auth/       registration, login, JWT strategies, guards, RBAC
      db/         Drizzle schema, migrations, seed script
      common/     global exception filter
    drizzle/      generated SQL migrations
    test/         e2e suite
  web/            Next.js frontend (Phase 3)
packages/
  shared/         cross-package Zod schemas (Phase 2)
docker-compose.yml
```
