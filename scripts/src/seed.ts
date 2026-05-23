import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function rowId(rows: Array<{ id: number }>, idx: number): number | null {
  return rows[idx]?.id ?? null;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Departments
    const { rows: depts } = await client.query(`
      INSERT INTO departments (name, description) VALUES
        ('Engineering',    'Software development and infrastructure'),
        ('Product',        'Product strategy and design'),
        ('Marketing',      'Brand, growth, and communications'),
        ('Human Resources','People ops and talent acquisition'),
        ('Finance',        'Financial planning and accounting')
      RETURNING id, name
    `);
    console.log(`Departments: ${depts.length} inserted (ids ${depts.map((d: any) => d.id).join(",")})`);

    const dEng = depts.find((d: any) => d.name === "Engineering")!.id;
    const dPrd = depts.find((d: any) => d.name === "Product")!.id;
    const dMkt = depts.find((d: any) => d.name === "Marketing")!.id;
    const dHr  = depts.find((d: any) => d.name === "Human Resources")!.id;
    const dFin = depts.find((d: any) => d.name === "Finance")!.id;

    // Demo users
    const { rows: users } = await client.query(
      `INSERT INTO users (clerk_id, email, first_name, last_name, role, department_id, job_title, status) VALUES
        ($1,  'alex.morgan@company.com',   'Alex',   'Morgan', 'admin',    $9,  'VP of Engineering',        'active'),
        ($2,  'jamie.chen@company.com',    'Jamie',  'Chen',   'manager',  $9,  'Engineering Manager',      'active'),
        ($3,  'sam.patel@company.com',     'Sam',    'Patel',  'employee', $9,  'Senior Frontend Engineer', 'active'),
        ($4,  'riley.kim@company.com',     'Riley',  'Kim',    'employee', $10, 'Product Designer',         'active'),
        ($5,  'taylor.jones@company.com',  'Taylor', 'Jones',  'manager',  $10, 'Head of Product',          'active'),
        ($6,  'jordan.white@company.com',  'Jordan', 'White',  'employee', $11, 'Marketing Lead',           'active'),
        ($7,  'casey.brown@company.com',   'Casey',  'Brown',  'employee', $12, 'HR Specialist',            'active'),
        ($8,  'morgan.davis@company.com',  'Morgan', 'Davis',  'employee', $13, 'Finance Analyst',          'active')
      ON CONFLICT (clerk_id) DO NOTHING
      RETURNING id, first_name`,
      ['demo_user_1','demo_user_2','demo_user_3','demo_user_4',
       'demo_user_5','demo_user_6','demo_user_7','demo_user_8',
       dEng, dPrd, dMkt, dHr, dFin]
    );
    console.log(`Users: ${users.length} inserted`);

    if (users.length === 0) {
      console.log("Users already exist — skipping rest.");
      await client.query("COMMIT");
      return;
    }

    // Projects
    const { rows: projects } = await client.query(
      `INSERT INTO projects
         (name, description, status, priority, owner_id, department_id, start_date, due_date, progress)
       VALUES
        ($1,  'Full redesign of the customer-facing platform', 'active',   'high',     $6,  $11, '2026-01-15', '2026-06-30', 65),
        ($2,  'Rebuild analytics data pipeline',               'active',   'critical', $7,  $11, '2026-02-01', '2026-05-31', 40),
        ($3,  'Launch companion mobile app',                   'planning', 'high',     $8,  $12, '2026-04-01', '2026-09-30', 10),
        ($4,  'Implement automated marketing campaigns',       'active',   'medium',   $9,  $13, '2026-03-01', '2026-07-31', 55),
        ($5,  'Employee self-service portal for HR requests',  'review',   'medium',   $10, $14, '2026-01-01', '2026-04-30', 90)
      RETURNING id, name`,
      [
        'Platform Redesign', 'Data Pipeline v2', 'Mobile App Launch',
        'Marketing Automation', 'HR Self-Service Portal',
        rowId(users,0), rowId(users,1), rowId(users,2), rowId(users,3), rowId(users,4),
        dEng, dPrd, dMkt, dHr,
      ]
    );
    console.log(`Projects: ${projects.length} inserted`);

    // Tasks
    const tasks: [string, string, string, string, number|null, number|null, string, string][] = [
      ['Design system tokens',     'Define color, spacing, and typography tokens',  'done',        'high',     rowId(projects,0), rowId(users,2), '2026-02-28','8'],
      ['Component library setup',  'Bootstrap Storybook with core components',      'done',        'high',     rowId(projects,0), rowId(users,1), '2026-03-15','16'],
      ['Landing page redesign',    'Implement new landing page',                    'in_progress', 'high',     rowId(projects,0), rowId(users,2), '2026-05-15','24'],
      ['Dashboard widgets',        'Build analytics dashboard widgets',             'in_progress', 'medium',   rowId(projects,0), rowId(users,0), '2026-05-30','20'],
      ['Mobile responsiveness',    'Audit and fix all mobile breakpoints',          'todo',        'medium',   rowId(projects,0), rowId(users,1), '2026-06-15','12'],
      ['Schema design',            'Design new database schema for pipeline',       'done',        'critical', rowId(projects,1), rowId(users,1), '2026-02-15','8'],
      ['Kafka integration',        'Set up Kafka topics and consumers',             'in_progress', 'critical', rowId(projects,1), rowId(users,2), '2026-04-30','32'],
      ['Data validation layer',    'Build input validation pipeline',               'todo',        'high',     rowId(projects,1), rowId(users,0), '2026-05-15','20'],
      ['App navigation',           'Design and implement tab navigation',           'todo',        'high',     rowId(projects,2), rowId(users,3), '2026-05-30','16'],
      ['Auth flow',                'Implement sign-in and onboarding screens',      'todo',        'critical', rowId(projects,2), rowId(users,3), '2026-06-15','24'],
    ];
    for (const [title, desc, status, priority, projectId, assigneeId, dueDate, hours] of tasks) {
      await client.query(
        `INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, due_date, estimated_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [title, desc, status, priority, projectId, assigneeId, dueDate, hours]
      );
    }
    console.log(`Tasks: ${tasks.length} inserted`);

    // Documents
    const docs: [string, string, string, number|null, boolean, string[]][] = [
      ['Q1 2026 Engineering Report',    'pdf',         'Quarterly engineering metrics',          rowId(users,0), true,  ['engineering','quarterly']],
      ['Brand Guidelines v3',           'pdf',         'Updated brand identity guidelines',      rowId(users,5), true,  ['marketing','brand']],
      ['Employee Handbook 2026',        'pdf',         'Updated employee policies',              rowId(users,6), false, ['hr','policy']],
      ['Platform Architecture Diagram', 'image',       'System architecture overview',           rowId(users,0), true,  ['engineering','architecture']],
      ['Product Roadmap H1 2026',       'spreadsheet', 'Product feature roadmap for H1 2026',   rowId(users,3), false, ['product','roadmap']],
      ['Onboarding Checklist',          'doc',         'New employee onboarding steps',          rowId(users,6), false, ['hr','onboarding']],
      ['Finance Budget 2026',           'spreadsheet', 'Annual budget breakdown',                rowId(users,7), false, ['finance','budget']],
      ['API Documentation',             'doc',         'REST API reference for platform',        rowId(users,0), true,  ['engineering','api']],
    ];
    for (const [name, type, description, uploadedById, starred, tags] of docs) {
      await client.query(
        `INSERT INTO documents (name, type, description, uploaded_by_id, starred, tags)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [name, type, description, uploadedById, starred, tags]
      );
    }
    console.log(`Documents: ${docs.length} inserted`);

    // Announcements
    const announcements: [string, string, string, number|null, string][] = [
      ['Welcome to WorkSpace!',           'We are excited to launch our new digital workplace platform. Explore all the features — documents, projects, HR management, and more.',   'high',   rowId(users,0), 'true'],
      ['Q2 All-Hands Meeting — May 28',   'Join us for our quarterly all-hands meeting covering company performance, product updates, and team highlights.',                         'normal', rowId(users,4), 'false'],
      ['New PTO Policy Effective June 1', 'We are moving to unlimited PTO for all full-time employees. Please review the updated employee handbook.',                                'high',   rowId(users,6), 'true'],
      ['Platform v2.0 Beta Now Live',     'The engineering team has shipped the Platform v2.0 beta. Please test and report issues to the #platform-feedback channel.',              'normal', rowId(users,0), 'false'],
      ['Office Closed — Memorial Day',    'The office will be closed on Monday, May 26 for Memorial Day. Enjoy the long weekend!',                                                  'low',    rowId(users,6), 'false'],
    ];
    for (const [title, content, priority, authorId, pinned] of announcements) {
      await client.query(
        `INSERT INTO announcements (title, content, priority, author_id, pinned)
         VALUES ($1,$2,$3,$4,$5)`,
        [title, content, priority, authorId, pinned]
      );
    }
    console.log(`Announcements: ${announcements.length} inserted`);

    // Leaves
    const leaves: [number|null, string, string, string, number, string, string][] = [
      [rowId(users,0), 'annual',   '2026-06-09', '2026-06-13', 5, 'Family vacation', 'approved'],
      [rowId(users,1), 'sick',     '2026-05-20', '2026-05-21', 2, 'Feeling unwell',  'approved'],
      [rowId(users,2), 'annual',   '2026-07-14', '2026-07-18', 5, 'Summer break',    'pending'],
      [rowId(users,3), 'personal', '2026-05-30', '2026-05-30', 1, 'Personal errand', 'pending'],
      [rowId(users,4), 'annual',   '2026-08-04', '2026-08-08', 5, 'Holiday trip',    'approved'],
    ];
    for (const [userId, type, start, end, days, reason, status] of leaves) {
      await client.query(
        `INSERT INTO leaves (user_id, type, start_date, end_date, days, reason, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, type, start, end, days, reason, status]
      );
    }
    console.log(`Leaves: ${leaves.length} inserted`);

    // Activity log
    const activity: [string, string, number|null, string][] = [
      ['project_created',     'Created project "Platform Redesign"',                rowId(users,0), 'project'],
      ['task_completed',      'Completed task "Design system tokens"',              rowId(users,1), 'task'],
      ['document_uploaded',   'Uploaded "Q1 2026 Engineering Report"',              rowId(users,0), 'document'],
      ['task_assigned',       'Assigned "Landing page redesign" to Sam Patel',      rowId(users,1), 'task'],
      ['announcement_posted', 'Posted announcement: Welcome to WorkSpace!',         rowId(users,0), 'announcement'],
      ['leave_approved',      'Approved leave request for Alex Morgan',             rowId(users,6), 'leave'],
      ['project_updated',     'Updated "Data Pipeline v2" progress to 40%',         rowId(users,1), 'project'],
      ['document_starred',    'Starred "Brand Guidelines v3"',                      rowId(users,3), 'document'],
    ];
    for (const [type, description, actorId, entityType] of activity) {
      await client.query(
        `INSERT INTO activity_log (type, description, actor_id, entity_type)
         VALUES ($1,$2,$3,$4)`,
        [type, description, actorId, entityType]
      );
    }
    console.log(`Activity log: ${activity.length} inserted`);

    await client.query("COMMIT");
    console.log("\n✅ Seed complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
