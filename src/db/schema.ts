import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── ENUMS ──────────────────────────────────────────────
export const planEnum = pgEnum('plan', ['FREE', 'PRO', 'ENTERPRISE']);
export const roleEnum = pgEnum('role', ['OWNER', 'ADMIN', 'MEMBER']);
export const workerStatusEnum = pgEnum('worker_status', ['ONLINE', 'OFFLINE', 'WFH']);
export const priorityEnum = pgEnum('priority', ['LOW', 'MED', 'HIGH']);
export const taskStatusEnum = pgEnum('task_status', ['TODO', 'IN_PROGRESS', 'DONE']);
export const moodEnum = pgEnum('mood', ['ON_FIRE', 'ENERGIZED', 'NEUTRAL', 'TIRED', 'BLOCKED']);
export const transactionTypeEnum = pgEnum('transaction_type', ['INCOME', 'EXPENSE']);

// ── ORG + AUTH ─────────────────────────────────────────
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  plan: planEnum('plan').notNull().default('FREE'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: roleEnum('role').notNull().default('MEMBER'),
    avatar: text('avatar'),
    hashedRefreshToken: text('hashed_refresh_token'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('users_org_id_idx').on(t.orgId)],
);

// ── ROSTER ─────────────────────────────────────────────
export const workers = pgTable(
  'workers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').unique().references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    roleTitle: text('role_title').notNull(),
    department: text('department').notNull(),
    monthlyPay: integer('monthly_pay').notNull(),
    status: workerStatusEnum('status').notNull().default('ONLINE'),
    skills: text('skills').array().notNull().default([]),
    notes: text('notes'),
    avatarEmoji: text('avatar_emoji').notNull().default('🧙'),
    xp: integer('xp').notNull().default(0),
    tasksCompleted: integer('tasks_completed').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('workers_org_id_idx').on(t.orgId)],
);

// ── QUEST BOARD ────────────────────────────────────────
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    assigneeId: uuid('assignee_id').references(() => workers.id, { onDelete: 'set null' }),
    priority: priorityEnum('priority').notNull().default('MED'),
    dueDate: timestamp('due_date'),
    xpReward: integer('xp_reward').notNull().default(100),
    status: taskStatusEnum('status').notNull().default('TODO'),
    progress: integer('progress').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('tasks_org_id_idx').on(t.orgId), index('tasks_assignee_id_idx').on(t.assigneeId)],
);

// ── FIELD REPORTS ──────────────────────────────────────
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull().defaultNow(),
    summary: text('summary').notNull(),
    hours: integer('hours').notNull().default(8),
    mood: moodEnum('mood').notNull().default('ENERGIZED'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('reports_org_id_idx').on(t.orgId), index('reports_worker_id_idx').on(t.workerId)],
);

// ── TREASURY ───────────────────────────────────────────
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    category: text('category').notNull(),
    type: transactionTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),
    date: timestamp('date').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('transactions_org_id_idx').on(t.orgId), index('transactions_date_idx').on(t.date)],
);

// ── HALL OF FAME ───────────────────────────────────────
export const achievementUnlocks = pgTable(
  'achievement_unlocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    achievementKey: text('achievement_key').notNull(),
    unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
  },
  (t) => [
    unique('achievement_unlocks_worker_key_unique').on(t.workerId, t.achievementKey),
    index('achievement_unlocks_org_id_idx').on(t.orgId),
  ],
);

// ── RELATIONS (for drizzle's relational query API) ─────
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  workers: many(workers),
  tasks: many(tasks),
  reports: many(reports),
  transactions: many(transactions),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, { fields: [users.orgId], references: [organizations.id] }),
  worker: one(workers, { fields: [users.id], references: [workers.userId] }),
}));

export const workersRelations = relations(workers, ({ one, many }) => ({
  organization: one(organizations, { fields: [workers.orgId], references: [organizations.id] }),
  user: one(users, { fields: [workers.userId], references: [users.id] }),
  tasks: many(tasks),
  reports: many(reports),
  achievements: many(achievementUnlocks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  organization: one(organizations, { fields: [tasks.orgId], references: [organizations.id] }),
  assignee: one(workers, { fields: [tasks.assigneeId], references: [workers.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  organization: one(organizations, { fields: [reports.orgId], references: [organizations.id] }),
  worker: one(workers, { fields: [reports.workerId], references: [workers.id] }),
}));
