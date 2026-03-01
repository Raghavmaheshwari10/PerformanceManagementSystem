import { describe, it, expect } from 'vitest'

// Pure logic mirroring sendManualNotification's scope-building
function buildScope(recipientType: string, roles: string[], depts: string[]): string {
  if (recipientType === 'individual') return 'individual'
  if (recipientType === 'role') return `role:${roles.join(',')}`
  if (recipientType === 'department') return `dept:${depts.join(',')}`
  return 'everyone'
}

describe('buildScope', () => {
  it('individual', () => expect(buildScope('individual', [], [])).toBe('individual'))
  it('role', () => expect(buildScope('role', ['employee', 'manager'], [])).toBe('role:employee,manager'))
  it('department', () => expect(buildScope('department', [], ['Engineering', 'HR'])).toBe('dept:Engineering,HR'))
  it('everyone', () => expect(buildScope('everyone', [], [])).toBe('everyone'))
})
