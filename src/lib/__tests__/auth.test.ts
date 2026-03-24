import { describe, it, expect } from 'vitest'
import { checkManagerOwnership } from '../auth'
import type { User } from '../types'

const makeUser = (id: string): User => ({
  id,
  zimyo_id: `zimyo-${id}`,
  email: `${id}@test.com`,
  full_name: 'Test User',
  role: 'manager',
  department_id: null,
  is_also_employee: false,
  designation: null,
  manager_id: null,
  variable_pay: 0,
  is_active: true,
  synced_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
})

describe('checkManagerOwnership', () => {
  it('returns true when user id matches managerId', () => {
    const user = makeUser('manager-1')
    expect(checkManagerOwnership(user.id, 'manager-1')).toBe(true)
  })

  it('returns false when user id does not match managerId', () => {
    const user = makeUser('manager-1')
    expect(checkManagerOwnership(user.id, 'manager-2')).toBe(false)
  })

  it('returns false for empty managerId', () => {
    const user = makeUser('manager-1')
    expect(checkManagerOwnership(user.id, '')).toBe(false)
  })
})
