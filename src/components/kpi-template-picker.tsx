'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { applyKpiTemplate } from '@/app/(dashboard)/manager/template-actions'

const ROLE_OPTIONS = [
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'senior_engineer', label: 'Senior / Staff Engineer' },
  { value: 'engineering_manager', label: 'Engineering Manager' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'qa_sdet', label: 'QA / SDET' },
  { value: 'devops_sre', label: 'DevOps / SRE' },
  { value: 'sales_bizdev', label: 'Sales / BizDev' },
  { value: 'hr_people_ops', label: 'HR / People Ops' },
  { value: 'finance', label: 'Finance / Accounting' },
  { value: 'operations_pm', label: 'Operations / PM' },
]

interface Props {
  cycleId: string
  employeeId: string
}

export function KpiTemplatePicker({ cycleId, employeeId }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleApply() {
    if (!selectedRole) return
    setPending(true)
    setError("")
    const result = await applyKpiTemplate(selectedRole, cycleId, employeeId)
    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      setSelectedRole("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Use Template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply KPI Template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Pre-fills KPIs based on a job role. You can edit or delete them after.
        </p>
        {error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <div className="space-y-1">
          <label htmlFor="role-select" className="text-sm font-medium">Role</label>
          <select
            id="role-select"
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="">Select a role...</option>
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleApply} disabled={!selectedRole || pending} className="w-full">
          {pending ? "Applying..." : "Apply Template"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
