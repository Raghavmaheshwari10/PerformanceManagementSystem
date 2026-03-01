import { describe, it, expect } from 'vitest'
import { getTourForPath } from '../tour-content'
import { tourReducer, type TourState } from '../tour'

describe('getTourForPath', () => {
  it('matches employee route', () => {
    expect(getTourForPath('/employee')?.id).toBe('employee-review')
  })
  it('matches manager kpis route with dynamic segment', () => {
    expect(getTourForPath('/manager/abc123/kpis')?.id).toBe('manager-kpis')
  })
  it('returns null for unknown route', () => {
    expect(getTourForPath('/admin/audit-log')).toBeNull()
  })
})

describe('tourReducer', () => {
  const idle: TourState = { status: 'idle', tourId: null, stepIndex: 0 }

  it('starts a tour', () => {
    const state = tourReducer(idle, { type: 'START', tourId: 'employee-review' })
    expect(state.status).toBe('active')
    expect(state.tourId).toBe('employee-review')
    expect(state.stepIndex).toBe(0)
  })

  it('advances to next step', () => {
    const active: TourState = { status: 'active', tourId: 'employee-review', stepIndex: 0 }
    const state = tourReducer(active, { type: 'NEXT' })
    expect(state.stepIndex).toBe(1)
  })

  it('finishes the tour', () => {
    const state = tourReducer({ status: 'active', tourId: 'employee-review', stepIndex: 3 }, { type: 'FINISH' })
    expect(state.status).toBe('idle')
  })
})
