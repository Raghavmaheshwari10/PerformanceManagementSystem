import { PrismaClient, UserRole, RatingTier } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import { hash } from 'bcryptjs'
import ws from 'ws'

// Use ws for Node.js environment (not edge)
neonConfig.webSocketConstructor = ws

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as object)

async function main() {
  console.log('Seeding database...')

  // Departments
  const engineering = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering' },
  })
  const product = await prisma.department.upsert({
    where: { name: 'Product' },
    update: {},
    create: { name: 'Product' },
  })

  // Admin
  const adminHash = await hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      zimyo_id: 'zimyo-admin',
      email: 'admin@test.com',
      full_name: 'Admin User',
      role: UserRole.admin,
      department_id: engineering.id,
      designation: 'System Administrator',
      password_hash: adminHash,
    },
  })

  // Manager
  const managerHash = await hash('manager123', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@test.com' },
    update: {},
    create: {
      zimyo_id: 'zimyo-manager',
      email: 'manager@test.com',
      full_name: 'Alice Manager',
      role: UserRole.manager,
      department_id: engineering.id,
      designation: 'Engineering Manager',
      password_hash: managerHash,
    },
  })

  // HRBP
  const hrbpHash = await hash('hrbp123', 12)
  const hrbp = await prisma.user.upsert({
    where: { email: 'hrbp@test.com' },
    update: {},
    create: {
      zimyo_id: 'zimyo-hrbp',
      email: 'hrbp@test.com',
      full_name: 'HRBP User',
      role: UserRole.hrbp,
      department_id: product.id,
      designation: 'HR Business Partner',
      password_hash: hrbpHash,
    },
  })

  // HRBP → Engineering department mapping
  await prisma.hrbpDepartment.upsert({
    where: { hrbp_id_department_id: { hrbp_id: hrbp.id, department_id: engineering.id } },
    update: {},
    create: { hrbp_id: hrbp.id, department_id: engineering.id },
  })

  // Employees
  const employees = [
    { email: 'employee@test.com', password: 'employee123', name: 'Bob Employee',   zimyo: 'zimyo-bob'   },
    { email: 'frank@test.com',    password: 'frank123',    name: 'Frank Employee', zimyo: 'zimyo-frank' },
    { email: 'dave@test.com',     password: 'dave123',     name: 'Dave Employee',  zimyo: 'zimyo-dave'  },
    { email: 'eve@test.com',      password: 'eve123',      name: 'Eve Employee',   zimyo: 'zimyo-eve'   },
    { email: 'grace@test.com',    password: 'grace123',    name: 'Grace Employee', zimyo: 'zimyo-grace' },
    { email: 'henry@test.com',    password: 'henry123',    name: 'Henry Employee', zimyo: 'zimyo-henry' },
    { email: 'irene@test.com',    password: 'irene123',    name: 'Irene Employee', zimyo: 'zimyo-irene' },
  ]

  for (const emp of employees) {
    const h = await hash(emp.password, 12)
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        zimyo_id:     emp.zimyo,
        email:        emp.email,
        full_name:    emp.name,
        role:         UserRole.employee,
        department_id: engineering.id,
        designation:  'Software Engineer',
        manager_id:   manager.id,
        password_hash: h,
        variable_pay: 50000,
      },
    })
  }

  // Payout config
  const payoutData = [
    { rating_tier: RatingTier.FEE, multiplier: 1.25 },
    { rating_tier: RatingTier.EE,  multiplier: 1.10 },
    { rating_tier: RatingTier.ME,  multiplier: 1.00 },
    { rating_tier: RatingTier.SME, multiplier: 1.00 },
    { rating_tier: RatingTier.BE,  multiplier: 0.00 },
  ]
  for (const p of payoutData) {
    await prisma.payoutConfig.upsert({
      where:  { rating_tier: p.rating_tier },
      update: { multiplier: p.multiplier },
      create: p,
    })
  }

  // Feature flags
  const flags = [
    { key: 'module.kpi_copy_forward',    name: 'KPI Copy-Forward',      category: 'module', default_value: true,  description: 'Suggest previous cycle KPIs' },
    { key: 'module.gamification',        name: 'Gamification',          category: 'module', default_value: false, description: 'Streak counters, leaderboards' },
    { key: 'module.360_feedback',        name: '360 Feedback',          category: 'module', default_value: false, description: 'Peer nomination and feedback' },
    { key: 'module.continuous_feedback', name: 'Continuous Feedback',   category: 'module', default_value: false, description: 'Weekly pulse check-ins' },
    { key: 'module.ai_assist',           name: 'AI Review Assistant',   category: 'module', default_value: false, description: 'Claude-powered draft suggestions' },
    { key: 'ui.compact_mode',            name: 'Compact Mode',          category: 'ui',     default_value: false, description: 'Denser layout' },
    { key: 'ui.density_toggle',          name: 'Density Toggle Button', category: 'ui',     default_value: true,  description: 'Show toggle in sidebar' },
    { key: 'ui.keyboard_shortcuts',      name: 'Keyboard Shortcuts',    category: 'ui',     default_value: true,  description: 'Command palette' },
    { key: 'notify.email',               name: 'Email Notifications',   category: 'notify', default_value: true,  description: 'Send email reminders' },
    { key: 'notify.in_app',              name: 'In-App Notifications',  category: 'notify', default_value: true,  description: 'Show notification bell' },
  ]
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where:  { key: f.key },
      update: {},
      create: f,
    })
  }

  console.log('Seed complete')
  console.log('   admin@test.com / admin123')
  console.log('   manager@test.com / manager123')
  console.log('   employee@test.com / employee123')
  console.log('   hrbp@test.com / hrbp123')

  void admin
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
