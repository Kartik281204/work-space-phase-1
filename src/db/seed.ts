import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { organizations, users, workers, tasks, reports, transactions } from './schema';

// Same demo password for every seeded account — dev/demo only, never for real use.
const SEED_PASSWORD = 'Password123!';

// worker "slug" -> role assigned in the new auth model
const AUTH_ROLE: Record<number, 'OWNER' | 'ADMIN' | 'MEMBER'> = {
  1: 'OWNER', // Arjun Mehta
  4: 'ADMIN', // Sneha Nair, Product Manager
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('Seeding...');

  const [org] = await db
    .insert(organizations)
    .values({ name: "Work(SPACE) Demo", plan: 'PRO' })
    .returning();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const workerSeed = [
    { legacyId: 1, name: 'Arjun Mehta', avatar: '🧙', role: 'Lead Engineer', dept: 'Engineering', pay: 120000, status: 'ONLINE' as const, skills: ['React', 'Node.js', 'AWS'], notes: 'Full-stack wizard. Loves coffee.', xp: 4200, tasksCompleted: 18 },
    { legacyId: 2, name: 'Priya Sharma', avatar: '👩‍🎨', role: 'UI/UX Designer', dept: 'Design', pay: 85000, status: 'ONLINE' as const, skills: ['Figma', 'Illustrator', 'Framer'], notes: 'Pixel-perfect designer.', xp: 3800, tasksCompleted: 14 },
    { legacyId: 3, name: 'Rohit Das', avatar: '🥷', role: 'Backend Dev', dept: 'Engineering', pay: 95000, status: 'WFH' as const, skills: ['Python', 'Django', 'PostgreSQL'], notes: 'Database whisperer.', xp: 3100, tasksCompleted: 11 },
    { legacyId: 4, name: 'Sneha Nair', avatar: '🦸', role: 'Product Manager', dept: 'Product', pay: 110000, status: 'ONLINE' as const, skills: ['Roadmapping', 'Jira', 'Analytics'], notes: 'Keeps the ship on course.', xp: 2900, tasksCompleted: 9 },
    { legacyId: 5, name: 'Karan Patel', avatar: '🤖', role: 'Data Analyst', dept: 'Engineering', pay: 78000, status: 'OFFLINE' as const, skills: ['Python', 'Tableau', 'SQL'], notes: 'Turns data into gold.', xp: 2400, tasksCompleted: 7 },
    { legacyId: 6, name: 'Divya Roy', avatar: '🧝', role: 'Marketing Lead', dept: 'Marketing', pay: 88000, status: 'ONLINE' as const, skills: ['SEO', 'Copywriting', 'Ads'], notes: 'Growth hacker extraordinaire.', xp: 2100, tasksCompleted: 6 },
  ];

  const legacyIdToWorkerId = new Map<number, string>();
  const legacyIdToUserEmail = new Map<number, string>();

  for (const w of workerSeed) {
    const email = `${w.name.split(' ')[0].toLowerCase()}@workspace.demo`;

    const [user] = await db
      .insert(users)
      .values({
        orgId: org.id,
        email,
        passwordHash,
        name: w.name,
        role: AUTH_ROLE[w.legacyId] ?? 'MEMBER',
        avatar: w.avatar,
      })
      .returning();

    const [worker] = await db
      .insert(workers)
      .values({
        orgId: org.id,
        userId: user.id,
        name: w.name,
        roleTitle: w.role,
        department: w.dept,
        monthlyPay: w.pay,
        status: w.status,
        skills: w.skills,
        notes: w.notes,
        avatarEmoji: w.avatar,
        xp: w.xp,
        tasksCompleted: w.tasksCompleted,
      })
      .returning();

    legacyIdToWorkerId.set(w.legacyId, worker.id);
    legacyIdToUserEmail.set(w.legacyId, email);
  }

  const taskSeed = [
    { title: 'Redesign onboarding flow', assignee: 2, priority: 'HIGH' as const, due: '2026-07-05', xp: 300, status: 'IN_PROGRESS' as const, progress: 60, desc: 'Complete UX redesign for new user onboarding' },
    { title: 'API rate limiting', assignee: 3, priority: 'HIGH' as const, due: '2026-07-02', xp: 200, status: 'IN_PROGRESS' as const, progress: 40, desc: 'Implement Redis-based rate limiting' },
    { title: 'Q2 analytics report', assignee: 5, priority: 'MED' as const, due: '2026-07-10', xp: 150, status: 'TODO' as const, progress: 0, desc: 'Generate Q2 performance analytics' },
    { title: 'Mobile responsive nav', assignee: 1, priority: 'MED' as const, due: '2026-07-08', xp: 100, status: 'TODO' as const, progress: 0, desc: 'Fix nav on mobile breakpoints' },
    { title: 'Write feature docs', assignee: 4, priority: 'LOW' as const, due: '2026-07-15', xp: 80, status: 'TODO' as const, progress: 0, desc: 'Documentation for v2.0 feature set' },
    { title: 'User interviews (5x)', assignee: 2, priority: 'MED' as const, due: '2026-06-28', xp: 200, status: 'DONE' as const, progress: 100, desc: 'Conduct user research interviews' },
    { title: 'Launch email campaign', assignee: 6, priority: 'HIGH' as const, due: '2026-06-30', xp: 250, status: 'DONE' as const, progress: 100, desc: 'Q3 product launch email campaign' },
  ];

  for (const t of taskSeed) {
    await db.insert(tasks).values({
      orgId: org.id,
      title: t.title,
      description: t.desc,
      assigneeId: legacyIdToWorkerId.get(t.assignee),
      priority: t.priority,
      dueDate: new Date(t.due),
      xpReward: t.xp,
      status: t.status,
      progress: t.progress,
    });
  }

  const reportSeed = [
    { worker: 1, date: '2026-06-29', summary: 'Implemented authentication middleware. Reviewed 3 PRs. Fixed critical production bug with JWT expiry. Ready for deployment tomorrow.', hours: 9, mood: 'ON_FIRE' as const },
    { worker: 2, date: '2026-06-29', summary: 'Finalized onboarding screens in Figma. Ran user testing session with 3 participants. Got great feedback on the new flow.', hours: 8, mood: 'ENERGIZED' as const },
    { worker: 3, date: '2026-06-28', summary: 'Set up Redis cluster for caching. Reduced DB query load by 40%. Working on rate limiter next.', hours: 9, mood: 'ON_FIRE' as const },
    { worker: 4, date: '2026-06-28', summary: 'Ran sprint planning session. Finalized Q3 roadmap items. Synced with design team on new feature specs.', hours: 7, mood: 'ENERGIZED' as const },
    { worker: 6, date: '2026-06-27', summary: 'Launched Q3 email campaign. Open rate: 42%. Working on A/B test for subject lines.', hours: 8, mood: 'ON_FIRE' as const },
  ];

  for (const r of reportSeed) {
    await db.insert(reports).values({
      orgId: org.id,
      workerId: legacyIdToWorkerId.get(r.worker)!,
      date: new Date(r.date),
      summary: r.summary,
      hours: r.hours,
      mood: r.mood,
    });
  }

  const transactionSeed = [
    { desc: 'Project Alpha – Client A', cat: 'Services', type: 'INCOME' as const, amount: 350000, date: '2026-06-01' },
    { desc: 'SaaS Subscriptions', cat: 'Product', type: 'INCOME' as const, amount: 120000, date: '2026-06-05' },
    { desc: 'Payroll – June', cat: 'Salary', type: 'EXPENSE' as const, amount: 576000, date: '2026-06-10' },
    { desc: 'AWS Infrastructure', cat: 'Infra', type: 'EXPENSE' as const, amount: 28000, date: '2026-06-15' },
    { desc: 'Project Beta – Client B', cat: 'Services', type: 'INCOME' as const, amount: 480000, date: '2026-06-18' },
    { desc: 'Google Ads', cat: 'Marketing', type: 'EXPENSE' as const, amount: 45000, date: '2026-06-20' },
    { desc: 'Tool Licenses', cat: 'Tools', type: 'EXPENSE' as const, amount: 12000, date: '2026-06-22' },
    { desc: 'Consulting – Client C', cat: 'Services', type: 'INCOME' as const, amount: 200000, date: '2026-06-25' },
  ];

  for (const tr of transactionSeed) {
    await db.insert(transactions).values({
      orgId: org.id,
      description: tr.desc,
      category: tr.cat,
      type: tr.type,
      amount: tr.amount,
      date: new Date(tr.date),
    });
  }

  console.log(`Seeded org "${org.name}" with ${workerSeed.length} workers, ${taskSeed.length} tasks, ${reportSeed.length} reports, ${transactionSeed.length} transactions.`);
  console.log('\nDemo logins (all use the same password):');
  for (const [legacyId, email] of legacyIdToUserEmail) {
    console.log(`  ${email}  —  role: ${AUTH_ROLE[legacyId] ?? 'MEMBER'}`);
  }
  console.log(`  password: ${SEED_PASSWORD}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
