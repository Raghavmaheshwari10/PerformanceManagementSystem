import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fetchAopTargets, fetchMisActuals } from '@/lib/mis-api-client'
import { captureServerActionError } from '@/lib/sentry'

// ---------------------------------------------------------------------------
// Types for MIS API responses
// ---------------------------------------------------------------------------

interface MisTargetRecord {
  external_id: string
  fiscal_year: number
  level: string
  department_code?: string
  employee_email?: string
  metric_name: string
  category?: string
  annual_target: number
  unit?: string
  currency?: string
  monthly_targets?: Record<string, number>
  red_threshold?: number
  amber_threshold?: number
}

interface MisActualRecord {
  target_id: string // external_id of the AopTarget
  year: number
  month: number
  actual_value: number
  ytd_actual?: number
  notes?: string
}

// ---------------------------------------------------------------------------
// syncTargets — pull AOP targets from MIS and upsert into DB
// ---------------------------------------------------------------------------

export async function syncTargets(
  fiscalYear: number,
  triggeredBy?: string,
): Promise<{ synced: number; failed: number }> {
  // 1. Create sync-log entry
  const log = await prisma.misSyncLog.create({
    data: {
      sync_type: 'targets',
      status: 'running',
      triggered_by: triggeredBy ?? null,
    },
  })

  try {
    // 2. Load MIS config for department_mapping
    const config = await prisma.misConfig.findFirst()
    const deptMapping: Record<string, string> = (config?.department_mapping as Record<string, string>) ?? {}

    // 3. Find last successful targets sync → use as updated_since cursor
    const lastSync = await prisma.misSyncLog.findFirst({
      where: { sync_type: 'targets', status: 'success' },
      orderBy: { started_at: 'desc' },
    })
    const updatedSince = lastSync?.completed_at?.toISOString()

    // 4. Fetch from MIS API
    const { data: records } = await fetchAopTargets(fiscalYear, updatedSince)

    let synced = 0
    let failed = 0
    const errors: string[] = []

    // 5. Process each target
    for (const raw of records) {
      try {
        const rec = raw as MisTargetRecord

        // Resolve department_id from mapping
        let departmentId: string | null = null
        if (rec.department_code && deptMapping[rec.department_code]) {
          departmentId = deptMapping[rec.department_code]
        }

        // Resolve employee_id by email
        let employeeId: string | null = null
        if (rec.employee_email) {
          const user = await prisma.user.findFirst({
            where: { email: rec.employee_email },
            select: { id: true },
          })
          employeeId = user?.id ?? null
        }

        // Upsert AopTarget by external_id
        await prisma.aopTarget.upsert({
          where: { external_id: rec.external_id },
          create: {
            external_id: rec.external_id,
            fiscal_year: rec.fiscal_year,
            level: rec.level,
            department_id: departmentId,
            employee_id: employeeId,
            metric_name: rec.metric_name,
            category: rec.category ?? 'financial',
            annual_target: rec.annual_target,
            unit: rec.unit ?? 'number',
            currency: rec.currency ?? null,
            monthly_targets: rec.monthly_targets ?? Prisma.DbNull,
            red_threshold: rec.red_threshold ?? 80,
            amber_threshold: rec.amber_threshold ?? 95,
            synced_at: new Date(),
          },
          update: {
            fiscal_year: rec.fiscal_year,
            level: rec.level,
            department_id: departmentId,
            employee_id: employeeId,
            metric_name: rec.metric_name,
            category: rec.category ?? 'financial',
            annual_target: rec.annual_target,
            unit: rec.unit ?? 'number',
            currency: rec.currency ?? null,
            monthly_targets: rec.monthly_targets ?? Prisma.DbNull,
            red_threshold: rec.red_threshold ?? 80,
            amber_threshold: rec.amber_threshold ?? 95,
            synced_at: new Date(),
          },
        })
        synced++
      } catch (err) {
        failed++
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(msg)
      }
    }

    // 6. Update sync log
    const status = failed === 0 ? 'success' : synced > 0 ? 'partial' : 'failed'
    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: {
        status,
        records_synced: synced,
        records_failed: failed,
        error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
        completed_at: new Date(),
      },
    })

    return { synced, failed }
  } catch (err) {
    // Fatal error — mark log as failed and re-throw
    captureServerActionError('syncTargets', err, { fiscalYear })
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        error_message: msg,
        completed_at: new Date(),
      },
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// syncActuals — pull monthly actuals from MIS and upsert into DB
// ---------------------------------------------------------------------------

export async function syncActuals(
  fiscalYear: number,
  month: number,
  triggeredBy?: string,
): Promise<{ synced: number; failed: number }> {
  // 1. Create sync-log entry
  const log = await prisma.misSyncLog.create({
    data: {
      sync_type: 'actuals',
      status: 'running',
      triggered_by: triggeredBy ?? null,
    },
  })

  try {
    // 2. Find last successful actuals sync → use as updated_since cursor
    const lastSync = await prisma.misSyncLog.findFirst({
      where: { sync_type: 'actuals', status: 'success' },
      orderBy: { started_at: 'desc' },
    })
    const updatedSince = lastSync?.completed_at?.toISOString()

    // 3. Fetch from MIS API
    const { data: records } = await fetchMisActuals(fiscalYear, month, updatedSince)

    let synced = 0
    let failed = 0
    const errors: string[] = []

    // 4. Process each actual
    for (const raw of records) {
      try {
        const rec = raw as MisActualRecord

        // Find the parent AopTarget by external_id (target_id from MIS)
        const target = await prisma.aopTarget.findUnique({
          where: { external_id: rec.target_id },
          select: { id: true },
        })
        if (!target) {
          throw new Error(`AopTarget not found for external_id=${rec.target_id}`)
        }

        // Upsert MisActual by unique [aop_target_id, year, month]
        await prisma.misActual.upsert({
          where: {
            uq_mis_actual_target_month: {
              aop_target_id: target.id,
              year: rec.year,
              month: rec.month,
            },
          },
          create: {
            aop_target_id: target.id,
            year: rec.year,
            month: rec.month,
            actual_value: rec.actual_value,
            ytd_actual: rec.ytd_actual ?? null,
            notes: rec.notes ?? null,
            synced_at: new Date(),
          },
          update: {
            actual_value: rec.actual_value,
            ytd_actual: rec.ytd_actual ?? null,
            notes: rec.notes ?? null,
            synced_at: new Date(),
          },
        })

        // Update ytd_actual on parent AopTarget
        if (rec.ytd_actual != null) {
          await prisma.aopTarget.update({
            where: { id: target.id },
            data: { ytd_actual: rec.ytd_actual, synced_at: new Date() },
          })
        }

        synced++
      } catch (err) {
        failed++
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(msg)
      }
    }

    // 5. Update sync log
    const status = failed === 0 ? 'success' : synced > 0 ? 'partial' : 'failed'
    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: {
        status,
        records_synced: synced,
        records_failed: failed,
        error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
        completed_at: new Date(),
      },
    })

    return { synced, failed }
  } catch (err) {
    // Fatal error — mark log as failed and re-throw
    captureServerActionError('syncActuals', err, { fiscalYear, month })
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        error_message: msg,
        completed_at: new Date(),
      },
    })
    throw err
  }
}
