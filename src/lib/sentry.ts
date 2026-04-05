import * as Sentry from '@sentry/nextjs'

/**
 * Wrap a server action with Sentry error capture.
 * Usage: captureServerActionError('uploadUsersCsv', error, { source: 'csv' })
 */
export function captureServerActionError(
  actionName: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope(scope => {
    scope.setTag('server_action', actionName)
    if (context) scope.setContext('action_context', context)
    Sentry.captureException(error)
  })
}
