import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toastReducer, type ToastState, type ToastReducerAction } from '../toast'

describe('toastReducer', () => {
  const initialState: ToastState = { toasts: [] }

  it('adds a toast', () => {
    const action: ToastReducerAction = { type: 'ADD', toast: { id: '1', variant: 'success', message: 'Done' } }
    const state = toastReducer(initialState, action)
    expect(state.toasts).toHaveLength(1)
    expect(state.toasts[0].message).toBe('Done')
  })

  it('dismisses a toast by id', () => {
    const withToast: ToastState = { toasts: [{ id: '1', variant: 'success', message: 'Done' }] }
    const state = toastReducer(withToast, { type: 'DISMISS', id: '1' })
    expect(state.toasts).toHaveLength(0)
  })

  it('caps at 3 toasts, removing oldest', () => {
    const full: ToastState = {
      toasts: [
        { id: '1', variant: 'success', message: 'A' },
        { id: '2', variant: 'info', message: 'B' },
        { id: '3', variant: 'warning', message: 'C' },
      ]
    }
    const state = toastReducer(full, { type: 'ADD', toast: { id: '4', variant: 'error', message: 'D' } })
    expect(state.toasts).toHaveLength(3)
    expect(state.toasts[0].id).toBe('2') // oldest removed
    expect(state.toasts[2].id).toBe('4') // newest added
  })
})
