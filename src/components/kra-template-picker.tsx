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
import { applyKraTemplate } from '@/app/(dashboard)/manager/template-actions'

interface RoleOption {
  value: string
  label: string
}

interface Props {
  cycleId: string
  employeeId: string
  roleOptions?: RoleOption[]
}

export function KraTemplatePicker({ cycleId, employeeId, roleOptions = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleApply() {
    if (!selectedRole) return
    setPending(true)
    setError("")
    const result = await applyKraTemplate(selectedRole, cycleId, employeeId)
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
        <Button variant="outline" size="sm">KRA Template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply KRA Template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Pre-fills Key Result Areas based on a job role. You can edit or delete them after.
        </p>
        {error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <div className="space-y-1">
          <label htmlFor="kra-role-select" className="text-sm font-medium">Role</label>
          <select
            id="kra-role-select"
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="">Select a role...</option>
            {roleOptions.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleApply} disabled={!selectedRole || pending} className="w-full">
          {pending ? "Applying..." : "Apply KRA Template"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
