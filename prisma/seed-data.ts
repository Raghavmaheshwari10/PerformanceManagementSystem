import { PrismaClient, UserRole, RatingTier, CycleStatus, ReviewStatus, GoalStatus, GoalType } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as object)

// Counters for summary
const created = {
  cycles: 0,
  cycleDepartments: 0,
  kraTemplates: 0,
  kras: 0,
  kpis: 0,
  reviews: 0,
  appraisals: 0,
  goals: 0,
  goalUpdates: 0,
  feedback: 0,
  notifications: 0,
  aopTargets: 0,
  misActuals: 0,
  kpiMisMappings: 0,
  misConfig: 0,
  scoringConfigs: 0,
  competencies: 0,
  peerReviewRequests: 0,
  roleSlugs: 0,
}

const DEFAULT_ROLE_SLUGS = [
  { slug: 'software_engineer', label: 'Software Engineer', sort_order: 1 },
  { slug: 'senior_engineer', label: 'Senior Engineer', sort_order: 2 },
  { slug: 'engineering_manager', label: 'Engineering Manager', sort_order: 3 },
  { slug: 'product_manager', label: 'Product Manager', sort_order: 4 },
  { slug: 'qa_sdet', label: 'QA / SDET', sort_order: 5 },
  { slug: 'devops_sre', label: 'DevOps / SRE', sort_order: 6 },
  { slug: 'sales_bizdev', label: 'Sales / BizDev', sort_order: 7 },
  { slug: 'hr_people_ops', label: 'HR / People Ops', sort_order: 8 },
  { slug: 'finance', label: 'Finance', sort_order: 9 },
  { slug: 'operations_pm', label: 'Operations / PM', sort_order: 10 },
]

async function main() {
  console.log('=== Seeding comprehensive test data ===\n')

  // ─── Seed default role slugs ───
  for (const role of DEFAULT_ROLE_SLUGS) {
    await prisma.roleSlug.upsert({
      where: { slug: role.slug },
      update: {},
      create: role,
    })
    created.roleSlugs++
  }
  console.log(`  ✓ ${created.roleSlugs} role slugs seeded`)

  // ─── Lookup existing users ───
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@test.com' } })
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@test.com' } })
  const hrbp = await prisma.user.findUniqueOrThrow({ where: { email: 'hrbp@test.com' } })
  const bob = await prisma.user.findUniqueOrThrow({ where: { email: 'employee@test.com' } })
  const frank = await prisma.user.findUniqueOrThrow({ where: { email: 'frank@test.com' } })
  const dave = await prisma.user.findUniqueOrThrow({ where: { email: 'dave@test.com' } })
  const eve = await prisma.user.findUniqueOrThrow({ where: { email: 'eve@test.com' } })
  const grace = await prisma.user.findUniqueOrThrow({ where: { email: 'grace@test.com' } })
  const henry = await prisma.user.findUniqueOrThrow({ where: { email: 'henry@test.com' } })
  const irene = await prisma.user.findUniqueOrThrow({ where: { email: 'irene@test.com' } })

  const allEmployees = [bob, frank, dave, eve, grace, henry, irene]

  // Lookup departments
  const engineering = await prisma.department.findUniqueOrThrow({ where: { name: 'Engineering' } })

  console.log('Looked up 10 users + Engineering department\n')

  // ─────────────────────────────────────────
  // 1. THREE CYCLES
  // ─────────────────────────────────────────
  console.log('1. Creating cycles...')

  // Q4 2025 — Published (completed)
  const q4_2025 = await prisma.cycle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000c01' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000c01',
      name: 'Q4 2025 Performance Review',
      quarter: 'Q4',
      year: 2025,
      status: CycleStatus.published,
      kpi_setting_deadline: new Date('2025-10-15'),
      self_review_deadline: new Date('2025-12-15'),
      manager_review_deadline: new Date('2025-12-31'),
      calibration_deadline: new Date('2026-01-10'),
      published_at: new Date('2026-01-15'),
      created_by: admin.id,
      total_budget: 500000,
      fee_multiplier: 1.25,
      ee_multiplier: 1.10,
      me_multiplier: 1.00,
      sme_multiplier: 1.00,
    },
  })
  created.cycles++

  // Q1 2026 — Manager Review (active mid-flow)
  const q1_2026 = await prisma.cycle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000c02' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000c02',
      name: 'Q1 2026 Performance Review',
      quarter: 'Q1',
      year: 2026,
      status: CycleStatus.manager_review,
      kpi_setting_deadline: new Date('2026-01-15'),
      self_review_deadline: new Date('2026-03-15'),
      manager_review_deadline: new Date('2026-04-03'),
      calibration_deadline: new Date('2026-04-15'),
      created_by: admin.id,
      total_budget: 500000,
    },
  })
  created.cycles++

  // Q2 2026 — Draft (upcoming)
  const q2_2026 = await prisma.cycle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000c03' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000c03',
      name: 'Q2 2026 Performance Review',
      quarter: 'Q2',
      year: 2026,
      status: CycleStatus.draft,
      created_by: admin.id,
    },
  })
  created.cycles++
  void q2_2026

  // CycleDepartment mappings (Q4 2025 + Q1 2026 → Engineering)
  for (const cycle of [q4_2025, q1_2026]) {
    await prisma.cycleDepartment.upsert({
      where: { cycle_id_department_id: { cycle_id: cycle.id, department_id: engineering.id } },
      update: {},
      create: { cycle_id: cycle.id, department_id: engineering.id },
    })
    created.cycleDepartments++
  }

  console.log(`   Created ${created.cycles} cycles, ${created.cycleDepartments} cycle-department links`)

  // ─────────────────────────────────────────
  // 2. KRA TEMPLATES
  // ─────────────────────────────────────────
  console.log('2. Creating KRA templates...')

  const kraTemplateData = [
    { title: 'Product Delivery', category: 'performance', weight: 30, sort_order: 1 },
    { title: 'Code Quality', category: 'performance', weight: 25, sort_order: 2 },
    { title: 'Technical Growth', category: 'learning', weight: 15, sort_order: 3 },
    { title: 'Team Collaboration', category: 'behaviour', weight: 15, sort_order: 4 },
    { title: 'Innovation', category: 'performance', weight: 10, sort_order: 5 },
    { title: 'Process Improvement', category: 'behaviour', weight: 5, sort_order: 6 },
  ]

  for (const t of kraTemplateData) {
    // Use findFirst + create pattern since there's no unique on title
    const existing = await prisma.kraTemplate.findFirst({
      where: { title: t.title, role_slug: 'software_engineer' },
    })
    if (!existing) {
      await prisma.kraTemplate.create({
        data: {
          title: t.title,
          description: `${t.title} KRA for software engineers`,
          category: t.category,
          role_slug: 'software_engineer',
          department_id: engineering.id,
          weight: t.weight,
          sort_order: t.sort_order,
          is_active: true,
        },
      })
      created.kraTemplates++
    }
  }

  console.log(`   Created ${created.kraTemplates} KRA templates`)

  // ─────────────────────────────────────────
  // 3. KRAs for Bob, Frank, Dave (Q1 2026)
  // ─────────────────────────────────────────
  console.log('3. Creating KRAs...')

  const kraMap: Record<string, Record<string, string>> = {} // userId -> kraTitle -> kraId

  for (const emp of [bob, frank, dave]) {
    kraMap[emp.id] = {}
    const kraEntries = [
      { title: 'Product Delivery', category: 'performance', weight: 40, sort_order: 1 },
      { title: 'Code Quality', category: 'performance', weight: 35, sort_order: 2 },
      { title: 'Team Collaboration', category: 'behaviour', weight: 25, sort_order: 3 },
    ]
    for (const k of kraEntries) {
      const existing = await prisma.kra.findFirst({
        where: { cycle_id: q1_2026.id, employee_id: emp.id, title: k.title },
      })
      if (existing) {
        kraMap[emp.id][k.title] = existing.id
      } else {
        const kra = await prisma.kra.create({
          data: {
            cycle_id: q1_2026.id,
            employee_id: emp.id,
            title: k.title,
            description: `${k.title} objectives for ${emp.full_name}`,
            category: k.category,
            weight: k.weight,
            sort_order: k.sort_order,
          },
        })
        kraMap[emp.id][k.title] = kra.id
        created.kras++
      }
    }
  }

  // Also create KRAs for eve, grace, henry, irene (Q1 2026) so their KPIs can link
  for (const emp of [eve, grace, henry, irene]) {
    kraMap[emp.id] = {}
    const kraEntries = [
      { title: 'Product Delivery', category: 'performance', weight: 40, sort_order: 1 },
      { title: 'Code Quality', category: 'performance', weight: 35, sort_order: 2 },
      { title: 'Team Collaboration', category: 'behaviour', weight: 25, sort_order: 3 },
    ]
    for (const k of kraEntries) {
      const existing = await prisma.kra.findFirst({
        where: { cycle_id: q1_2026.id, employee_id: emp.id, title: k.title },
      })
      if (existing) {
        kraMap[emp.id][k.title] = existing.id
      } else {
        const kra = await prisma.kra.create({
          data: {
            cycle_id: q1_2026.id,
            employee_id: emp.id,
            title: k.title,
            description: `${k.title} objectives for ${emp.full_name}`,
            category: k.category,
            weight: k.weight,
            sort_order: k.sort_order,
          },
        })
        kraMap[emp.id][k.title] = kra.id
        created.kras++
      }
    }
  }

  console.log(`   Created ${created.kras} KRAs`)

  // ─────────────────────────────────────────
  // 4. KPIs
  // ─────────────────────────────────────────
  console.log('4. Creating KPIs...')

  // Track KPI IDs for MIS mapping later
  const kpiIds: Record<string, Record<string, string>> = {} // q1 KPIs: empId -> kpiTitle -> kpiId

  // Q4 2025 KPIs (no KRA link)
  for (const emp of allEmployees) {
    const q4Kpis = [
      { title: 'Sprint Velocity', weight: 40, description: 'Average story points per sprint' },
      { title: 'Code Review Turnaround', weight: 30, description: 'Average hours to complete code reviews' },
      { title: 'Bug Fix Rate', weight: 30, description: 'Percentage of assigned bugs fixed within SLA' },
    ]
    for (const k of q4Kpis) {
      const existing = await prisma.kpi.findFirst({
        where: { cycle_id: q4_2025.id, employee_id: emp.id, title: k.title },
      })
      if (!existing) {
        await prisma.kpi.create({
          data: {
            cycle_id: q4_2025.id,
            employee_id: emp.id,
            manager_id: manager.id,
            title: k.title,
            description: k.description,
            weight: k.weight,
          },
        })
        created.kpis++
      }
    }
  }

  // Q1 2026 KPIs (linked to KRAs)
  for (const emp of allEmployees) {
    kpiIds[emp.id] = {}
    const q1Kpis = [
      { title: 'Feature Delivery Rate', weight: 35, description: 'Percentage of planned features delivered on time', kraTitle: 'Product Delivery' },
      { title: 'Test Coverage', weight: 35, description: 'Unit and integration test coverage percentage', kraTitle: 'Code Quality' },
      { title: 'Knowledge Sharing Sessions', weight: 30, description: 'Number of tech talks or documentation sessions', kraTitle: 'Team Collaboration' },
    ]
    for (const k of q1Kpis) {
      const existing = await prisma.kpi.findFirst({
        where: { cycle_id: q1_2026.id, employee_id: emp.id, title: k.title },
      })
      if (existing) {
        kpiIds[emp.id][k.title] = existing.id
      } else {
        const kpi = await prisma.kpi.create({
          data: {
            cycle_id: q1_2026.id,
            employee_id: emp.id,
            manager_id: manager.id,
            title: k.title,
            description: k.description,
            weight: k.weight,
            kra_id: kraMap[emp.id]?.[k.kraTitle] ?? null,
          },
        })
        kpiIds[emp.id][k.title] = kpi.id
        created.kpis++
      }
    }
  }

  console.log(`   Created ${created.kpis} KPIs`)

  // ─────────────────────────────────────────
  // 5. REVIEWS (self-assessments)
  // ─────────────────────────────────────────
  console.log('5. Creating reviews...')

  // Q4 2025 reviews — all submitted
  const q4Ratings: Array<{ emp: typeof bob; rating: RatingTier }> = [
    { emp: bob, rating: RatingTier.EE },
    { emp: frank, rating: RatingTier.ME },
    { emp: dave, rating: RatingTier.FEE },
    { emp: eve, rating: RatingTier.EE },
    { emp: grace, rating: RatingTier.ME },
    { emp: henry, rating: RatingTier.SME },
    { emp: irene, rating: RatingTier.EE },
  ]

  for (const { emp, rating } of q4Ratings) {
    await prisma.review.upsert({
      where: { cycle_id_employee_id: { cycle_id: q4_2025.id, employee_id: emp.id } },
      update: {},
      create: {
        cycle_id: q4_2025.id,
        employee_id: emp.id,
        self_rating: rating,
        self_comments: `Self assessment for Q4 2025 by ${emp.full_name}. I believe I performed at the ${rating} level this quarter.`,
        status: ReviewStatus.submitted,
        submitted_at: new Date('2025-12-14'),
      },
    })
    created.reviews++
  }

  // Q1 2026 reviews — mixed statuses
  const q1Reviews: Array<{ emp: typeof bob; rating: RatingTier | null; status: ReviewStatus; submitted: boolean }> = [
    { emp: bob, rating: RatingTier.EE, status: ReviewStatus.submitted, submitted: true },
    { emp: frank, rating: RatingTier.ME, status: ReviewStatus.submitted, submitted: true },
    { emp: dave, rating: RatingTier.EE, status: ReviewStatus.submitted, submitted: true },
    { emp: eve, rating: RatingTier.ME, status: ReviewStatus.draft, submitted: false },
    { emp: grace, rating: RatingTier.EE, status: ReviewStatus.draft, submitted: false },
    { emp: henry, rating: null, status: ReviewStatus.draft, submitted: false },
    { emp: irene, rating: null, status: ReviewStatus.draft, submitted: false },
  ]

  for (const { emp, rating, status, submitted } of q1Reviews) {
    // Skip Henry and Irene (no review at all) — actually the spec says "not yet" so we skip creating
    if (!rating && !submitted) continue

    await prisma.review.upsert({
      where: { cycle_id_employee_id: { cycle_id: q1_2026.id, employee_id: emp.id } },
      update: {},
      create: {
        cycle_id: q1_2026.id,
        employee_id: emp.id,
        self_rating: rating,
        self_comments: rating
          ? `Q1 2026 self-review by ${emp.full_name}. Rating: ${rating}.`
          : `Q1 2026 draft self-review by ${emp.full_name} — work in progress.`,
        status,
        submitted_at: submitted ? new Date('2026-03-14') : null,
      },
    })
    created.reviews++
  }

  console.log(`   Created ${created.reviews} reviews`)

  // ─────────────────────────────────────────
  // 6. APPRAISALS
  // ─────────────────────────────────────────
  console.log('6. Creating appraisals...')

  // Q4 2025 — all finalized
  const q4Appraisals: Array<{
    emp: typeof bob
    managerRating: RatingTier
    finalRating: RatingTier
    payoutMult: number
    payoutAmt: number
    overrideReason?: string
  }> = [
    { emp: bob, managerRating: RatingTier.EE, finalRating: RatingTier.EE, payoutMult: 1.10, payoutAmt: 55000 },
    { emp: frank, managerRating: RatingTier.ME, finalRating: RatingTier.ME, payoutMult: 1.00, payoutAmt: 50000 },
    { emp: dave, managerRating: RatingTier.FEE, finalRating: RatingTier.EE, payoutMult: 1.10, payoutAmt: 55000, overrideReason: 'HRBP override: adjusted from FEE to EE based on calibration review' },
    { emp: eve, managerRating: RatingTier.EE, finalRating: RatingTier.EE, payoutMult: 1.10, payoutAmt: 55000 },
    { emp: grace, managerRating: RatingTier.ME, finalRating: RatingTier.SME, payoutMult: 1.00, payoutAmt: 50000, overrideReason: 'HRBP downgrade: performance below expectations in final month' },
    { emp: henry, managerRating: RatingTier.SME, finalRating: RatingTier.SME, payoutMult: 1.00, payoutAmt: 50000 },
    { emp: irene, managerRating: RatingTier.EE, finalRating: RatingTier.EE, payoutMult: 1.10, payoutAmt: 55000 },
  ]

  for (const a of q4Appraisals) {
    await prisma.appraisal.upsert({
      where: { cycle_id_employee_id: { cycle_id: q4_2025.id, employee_id: a.emp.id } },
      update: {},
      create: {
        cycle_id: q4_2025.id,
        employee_id: a.emp.id,
        manager_id: manager.id,
        manager_rating: a.managerRating,
        manager_comments: `Q4 2025 manager review for ${a.emp.full_name}. Rating: ${a.managerRating}.`,
        manager_submitted_at: new Date('2025-12-30'),
        final_rating: a.finalRating,
        final_rating_set_by: a.overrideReason ? hrbp.id : manager.id,
        payout_multiplier: a.payoutMult,
        payout_amount: a.payoutAmt,
        snapshotted_variable_pay: 50000,
        override_reason: a.overrideReason ?? null,
        locked_at: new Date('2026-01-10'),
        is_final: true,
      },
    })
    created.appraisals++
  }

  // Q1 2026 — Bob and Frank have manager ratings (not locked)
  const q1Appraisals: Array<{ emp: typeof bob; managerRating: RatingTier }> = [
    { emp: bob, managerRating: RatingTier.EE },
    { emp: frank, managerRating: RatingTier.ME },
  ]

  for (const a of q1Appraisals) {
    await prisma.appraisal.upsert({
      where: { cycle_id_employee_id: { cycle_id: q1_2026.id, employee_id: a.emp.id } },
      update: {},
      create: {
        cycle_id: q1_2026.id,
        employee_id: a.emp.id,
        manager_id: manager.id,
        manager_rating: a.managerRating,
        manager_comments: `Q1 2026 manager review for ${a.emp.full_name}. Rating: ${a.managerRating}.`,
        manager_submitted_at: new Date('2026-03-25'),
        is_final: false,
      },
    })
    created.appraisals++
  }

  console.log(`   Created ${created.appraisals} appraisals`)

  // ─────────────────────────────────────────
  // 7. GOALS (Q1 2026)
  // ─────────────────────────────────────────
  console.log('7. Creating goals...')

  // Bob's goals
  const bobGoal1 = await prisma.goal.findFirst({
    where: { cycle_id: q1_2026.id, employee_id: bob.id, title: 'Migrate auth to NextAuth' },
  })
  if (!bobGoal1) {
    const g = await prisma.goal.create({
      data: {
        cycle_id: q1_2026.id,
        employee_id: bob.id,
        title: 'Migrate auth to NextAuth',
        description: 'Complete migration from Supabase auth to NextAuth.js with credential and SSO providers',
        goal_type: GoalType.business,
        target_value: 100,
        current_value: 75,
        unit: 'percent',
        weight: 60,
        start_date: new Date('2026-01-01'),
        due_date: new Date('2026-03-31'),
        status: GoalStatus.approved,
        approved_by: manager.id,
        approved_at: new Date('2026-01-10'),
      },
    })
    created.goals++

    // Goal update
    await prisma.goalUpdate.create({
      data: {
        goal_id: g.id,
        updated_by: bob.id,
        previous_value: 50,
        new_value: 75,
        note: 'Completed SSO integration, password reset flow remaining',
      },
    })
    created.goalUpdates++
  }

  const bobGoal2 = await prisma.goal.findFirst({
    where: { cycle_id: q1_2026.id, employee_id: bob.id, title: 'Complete AWS certification' },
  })
  if (!bobGoal2) {
    await prisma.goal.create({
      data: {
        cycle_id: q1_2026.id,
        employee_id: bob.id,
        title: 'Complete AWS certification',
        description: 'Pass AWS Solutions Architect Associate exam',
        goal_type: GoalType.development,
        target_value: 1,
        current_value: 0,
        unit: 'certification',
        weight: 40,
        start_date: new Date('2026-01-15'),
        due_date: new Date('2026-03-31'),
        status: GoalStatus.approved,
        approved_by: manager.id,
        approved_at: new Date('2026-01-15'),
      },
    })
    created.goals++
  }

  // Frank's goal
  const frankGoal = await prisma.goal.findFirst({
    where: { cycle_id: q1_2026.id, employee_id: frank.id, title: 'Reduce API latency by 30%' },
  })
  if (!frankGoal) {
    const g = await prisma.goal.create({
      data: {
        cycle_id: q1_2026.id,
        employee_id: frank.id,
        title: 'Reduce API latency by 30%',
        description: 'Optimize critical API endpoints to reduce p95 latency by 30% from baseline',
        goal_type: GoalType.business,
        target_value: 30,
        current_value: 18,
        unit: 'percent',
        weight: 100,
        start_date: new Date('2026-01-01'),
        due_date: new Date('2026-03-31'),
        status: GoalStatus.approved,
        approved_by: manager.id,
        approved_at: new Date('2026-01-10'),
      },
    })
    created.goals++

    await prisma.goalUpdate.create({
      data: {
        goal_id: g.id,
        updated_by: frank.id,
        previous_value: 10,
        new_value: 18,
        note: 'Implemented query caching and connection pooling',
      },
    })
    created.goalUpdates++
  }

  console.log(`   Created ${created.goals} goals, ${created.goalUpdates} goal updates`)

  // ─────────────────────────────────────────
  // 8. FEEDBACK
  // ─────────────────────────────────────────
  console.log('8. Creating feedback...')

  // Check if feedback already exists by looking for matching entries
  const existingFeedback = await prisma.feedback.findMany({
    where: { from_user_id: { in: [manager.id, bob.id, eve.id] } },
  })

  if (existingFeedback.length === 0) {
    await prisma.feedback.createMany({
      data: [
        {
          from_user_id: manager.id,
          to_user_id: bob.id,
          category: 'teamwork',
          message: 'Great teamwork on the auth migration. Bob consistently helped teammates understand the new architecture and unblocked others during the transition.',
          visibility: 'recipient_and_manager',
        },
        {
          from_user_id: bob.id,
          to_user_id: frank.id,
          category: 'ownership',
          message: 'Excellent code reviews. Frank provides thorough, constructive feedback that has measurably improved our codebase quality.',
          visibility: 'private',
        },
        {
          from_user_id: eve.id,
          to_user_id: bob.id,
          category: 'leadership',
          message: 'Helpful mentoring sessions. Bob took time to pair program with me and explain complex patterns patiently.',
          visibility: 'public_team',
        },
      ],
    })
    created.feedback = 3
  }

  console.log(`   Created ${created.feedback} feedback entries`)

  // ─────────────────────────────────────────
  // 9. NOTIFICATIONS
  // ─────────────────────────────────────────
  console.log('9. Creating notifications...')

  // Delete old seed notifications to avoid duplicates, then create fresh
  const notifData = [
    {
      recipient_id: bob.id,
      type: 'cycle_self_review_open' as const,
      payload: { cycle_id: q1_2026.id, cycle_name: 'Q1 2026 Performance Review', deadline: '2026-03-15' },
      status: 'pending' as const,
    },
    {
      recipient_id: bob.id,
      type: 'manager_review_submitted' as const,
      payload: { cycle_id: q4_2025.id, cycle_name: 'Q4 2025 Performance Review', manager_name: 'Alice Manager' },
      status: 'sent' as const,
      sent_at: new Date('2026-01-10'),
    },
    {
      recipient_id: frank.id,
      type: 'cycle_self_review_open' as const,
      payload: { cycle_id: q1_2026.id, cycle_name: 'Q1 2026 Performance Review', deadline: '2026-03-15' },
      status: 'sent' as const,
      sent_at: new Date('2026-02-28'),
    },
    {
      recipient_id: manager.id,
      type: 'cycle_kpi_setting_open' as const,
      payload: { cycle_id: q1_2026.id, cycle_name: 'Q1 2026 Performance Review', deadline: '2026-01-15' },
      status: 'sent' as const,
      sent_at: new Date('2026-01-02'),
    },
    {
      recipient_id: hrbp.id,
      type: 'manager_review_submitted' as const,
      payload: { cycle_id: q1_2026.id, cycle_name: 'Q1 2026 Performance Review', employee_name: 'Bob Employee' },
      status: 'pending' as const,
    },
  ]

  // Use a simple approach: check count and only add if none exist for this seed
  const existingNotifCount = await prisma.notification.count({
    where: { type: { in: ['cycle_self_review_open', 'manager_review_submitted', 'cycle_kpi_setting_open'] } },
  })

  if (existingNotifCount === 0) {
    await prisma.notification.createMany({ data: notifData })
    created.notifications = 5
  }

  console.log(`   Created ${created.notifications} notifications`)

  // ─────────────────────────────────────────
  // 10. AOP TARGETS + MIS ACTUALS
  // ─────────────────────────────────────────
  console.log('10. Creating AOP targets, MIS actuals, and mappings...')

  // MIS Config
  const existingMisConfig = await prisma.misConfig.findFirst()
  if (!existingMisConfig) {
    await prisma.misConfig.create({
      data: {
        api_base_url: '',
        api_key_encrypted: '',
        fiscal_year: 2026,
        auto_sync_enabled: false,
        sync_cron: '0 6 * * *',
        department_mapping: {},
      },
    })
    created.misConfig = 1
  }

  // AOP Targets for Bob
  const aopTargetData = [
    {
      external_id: 'aop-bob-revenue-fy2026',
      metric_name: 'Revenue Target',
      category: 'financial',
      annual_target: 1200,
      unit: 'lakhs',
      currency: 'INR',
      monthly_targets: { jan: 100, feb: 100, mar: 100, apr: 100, may: 100, jun: 100, jul: 100, aug: 100, sep: 100, oct: 100, nov: 100, dec: 100 },
    },
    {
      external_id: 'aop-bob-velocity-fy2026',
      metric_name: 'Sprint Velocity',
      category: 'operational',
      annual_target: 480,
      unit: 'story_points',
      monthly_targets: { jan: 40, feb: 40, mar: 40, apr: 40, may: 40, jun: 40, jul: 40, aug: 40, sep: 40, oct: 40, nov: 40, dec: 40 },
    },
    {
      external_id: 'aop-bob-nps-fy2026',
      metric_name: 'Client NPS',
      category: 'customer',
      annual_target: 85,
      unit: 'score',
      monthly_targets: { jan: 85, feb: 85, mar: 85, apr: 85, may: 85, jun: 85, jul: 85, aug: 85, sep: 85, oct: 85, nov: 85, dec: 85 },
    },
  ]

  const aopTargetIds: string[] = []

  for (const t of aopTargetData) {
    const target = await prisma.aopTarget.upsert({
      where: { external_id: t.external_id },
      update: {},
      create: {
        external_id: t.external_id,
        fiscal_year: 2026,
        level: 'individual',
        department_id: engineering.id,
        employee_id: bob.id,
        metric_name: t.metric_name,
        category: t.category,
        annual_target: t.annual_target,
        unit: t.unit,
        currency: t.currency ?? null,
        monthly_targets: t.monthly_targets,
        red_threshold: 80,
        amber_threshold: 95,
      },
    })
    aopTargetIds.push(target.id)
    created.aopTargets++
  }

  // MIS Actuals for Bob (Jan, Feb, Mar 2026)
  const actualsData = [
    // Revenue: Jan=95, Feb=105, Mar=110
    { targetIdx: 0, month: 1, actual: 95, ytd: 95 },
    { targetIdx: 0, month: 2, actual: 105, ytd: 200 },
    { targetIdx: 0, month: 3, actual: 110, ytd: 310 },
    // Sprint Velocity: Jan=38, Feb=42, Mar=40
    { targetIdx: 1, month: 1, actual: 38, ytd: 38 },
    { targetIdx: 1, month: 2, actual: 42, ytd: 80 },
    { targetIdx: 1, month: 3, actual: 40, ytd: 120 },
    // Client NPS: Jan=78, Feb=80, Mar=82 (NPS is a score, ytd = latest)
    { targetIdx: 2, month: 1, actual: 78, ytd: 78 },
    { targetIdx: 2, month: 2, actual: 80, ytd: 80 },
    { targetIdx: 2, month: 3, actual: 82, ytd: 82 },
  ]

  for (const a of actualsData) {
    const existing = await prisma.misActual.findUnique({
      where: { uq_mis_actual_target_month: { aop_target_id: aopTargetIds[a.targetIdx], year: 2026, month: a.month } },
    })
    if (!existing) {
      await prisma.misActual.create({
        data: {
          aop_target_id: aopTargetIds[a.targetIdx],
          year: 2026,
          month: a.month,
          actual_value: a.actual,
          ytd_actual: a.ytd,
        },
      })
      created.misActuals++
    }
  }

  // Update ytd_actual on AOP targets
  await prisma.aopTarget.update({ where: { external_id: 'aop-bob-revenue-fy2026' }, data: { ytd_actual: 310 } })
  await prisma.aopTarget.update({ where: { external_id: 'aop-bob-velocity-fy2026' }, data: { ytd_actual: 120 } })
  await prisma.aopTarget.update({ where: { external_id: 'aop-bob-nps-fy2026' }, data: { ytd_actual: 82 } })

  // KPI → MIS Mappings (link Bob's Q1 KPIs to AOP targets)
  const bobKpiIds = kpiIds[bob.id] ?? {}
  const mappings = [
    { kpiTitle: 'Feature Delivery Rate', targetIdx: 0 },
    { kpiTitle: 'Test Coverage', targetIdx: 1 },
    { kpiTitle: 'Knowledge Sharing Sessions', targetIdx: 2 },
  ]

  for (const m of mappings) {
    const kpiId = bobKpiIds[m.kpiTitle]
    if (kpiId) {
      const existing = await prisma.kpiMisMapping.findUnique({
        where: { uq_kpi_mis_mapping: { kpi_id: kpiId, aop_target_id: aopTargetIds[m.targetIdx] } },
      })
      if (!existing) {
        await prisma.kpiMisMapping.create({
          data: {
            kpi_id: kpiId,
            aop_target_id: aopTargetIds[m.targetIdx],
            weight_factor: 1.0,
            score_formula: 'linear',
          },
        })
        created.kpiMisMappings++
      }
    }
  }

  // Scoring Config
  const scoringData: Array<{ tier: RatingTier; minScore: number }> = [
    { tier: RatingTier.FEE, minScore: 110 },
    { tier: RatingTier.EE, minScore: 95 },
    { tier: RatingTier.ME, minScore: 80 },
    { tier: RatingTier.SME, minScore: 60 },
    { tier: RatingTier.BE, minScore: 0 },
  ]

  for (const s of scoringData) {
    const existing = await prisma.scoringConfig.findFirst({
      where: { rating_tier: s.tier },
    })
    if (!existing) {
      await prisma.scoringConfig.create({
        data: {
          rating_tier: s.tier,
          min_score: s.minScore,
          is_active: true,
        },
      })
      created.scoringConfigs++
    }
  }

  console.log(`   Created ${created.aopTargets} AOP targets, ${created.misActuals} MIS actuals`)
  console.log(`   Created ${created.kpiMisMappings} KPI-MIS mappings, ${created.scoringConfigs} scoring configs`)
  console.log(`   Created ${created.misConfig} MIS config`)

  // ─────────────────────────────────────────
  // 11. COMPETENCIES
  // ─────────────────────────────────────────
  console.log('11. Creating competencies...')

  const competencyNames = [
    'Technical Excellence',
    'Leadership',
    'Communication',
    'Problem Solving',
    'Innovation',
  ]

  for (const name of competencyNames) {
    const existing = await prisma.competency.findUnique({ where: { name } })
    if (!existing) {
      await prisma.competency.create({
        data: {
          name,
          description: `${name} competency for performance evaluation`,
        },
      })
      created.competencies++
    }
  }

  console.log(`   Created ${created.competencies} competencies`)

  // ─────────────────────────────────────────
  // 12. PEER REVIEW REQUESTS
  // ─────────────────────────────────────────
  console.log('12. Creating peer review requests...')

  // Bob requests Frank as peer reviewer (submitted with rating)
  await prisma.peerReviewRequest.upsert({
    where: {
      cycle_id_reviewee_id_peer_user_id: {
        cycle_id: q1_2026.id,
        reviewee_id: bob.id,
        peer_user_id: frank.id,
      },
    },
    update: {},
    create: {
      cycle_id: q1_2026.id,
      reviewee_id: bob.id,
      peer_user_id: frank.id,
      requested_by: bob.id,
      status: 'submitted',
      peer_rating: RatingTier.EE,
      peer_comments: 'Strong technical skills. Bob consistently delivers high-quality code and is proactive in solving complex problems.',
    },
  })
  created.peerReviewRequests++

  // Bob requests Eve as peer reviewer (just requested)
  await prisma.peerReviewRequest.upsert({
    where: {
      cycle_id_reviewee_id_peer_user_id: {
        cycle_id: q1_2026.id,
        reviewee_id: bob.id,
        peer_user_id: eve.id,
      },
    },
    update: {},
    create: {
      cycle_id: q1_2026.id,
      reviewee_id: bob.id,
      peer_user_id: eve.id,
      requested_by: bob.id,
      status: 'requested',
    },
  })
  created.peerReviewRequests++

  console.log(`   Created ${created.peerReviewRequests} peer review requests`)

  // ─────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────
  console.log('\n=== Seed data summary ===')
  console.log(`  Cycles:              ${created.cycles}`)
  console.log(`  Cycle-Departments:   ${created.cycleDepartments}`)
  console.log(`  KRA Templates:       ${created.kraTemplates}`)
  console.log(`  KRAs:                ${created.kras}`)
  console.log(`  KPIs:                ${created.kpis}`)
  console.log(`  Reviews:             ${created.reviews}`)
  console.log(`  Appraisals:          ${created.appraisals}`)
  console.log(`  Goals:               ${created.goals}`)
  console.log(`  Goal Updates:        ${created.goalUpdates}`)
  console.log(`  Feedback:            ${created.feedback}`)
  console.log(`  Notifications:       ${created.notifications}`)
  console.log(`  AOP Targets:         ${created.aopTargets}`)
  console.log(`  MIS Actuals:         ${created.misActuals}`)
  console.log(`  KPI-MIS Mappings:    ${created.kpiMisMappings}`)
  console.log(`  MIS Config:          ${created.misConfig}`)
  console.log(`  Scoring Configs:     ${created.scoringConfigs}`)
  console.log(`  Competencies:        ${created.competencies}`)
  console.log(`  Peer Review Requests:${created.peerReviewRequests}`)
  console.log('\n=== Done! ===')
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
