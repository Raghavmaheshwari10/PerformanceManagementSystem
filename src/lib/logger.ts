import { captureServerActionError } from '@/lib/sentry'

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  action: string
  message: string
  context?: Record<string, unknown>
  error?: string
  timestamp: string
}

const isProd = process.env.NODE_ENV === 'production'

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

function emit(entry: LogEntry): void {
  if (isProd) {
    // Structured JSON for Vercel log drain
    console[entry.level](JSON.stringify(entry))
  } else {
    // Pretty output for local development
    const colour = entry.level === 'error' ? '\x1b[31m' : entry.level === 'warn' ? '\x1b[33m' : '\x1b[36m'
    const reset = '\x1b[0m'
    const prefix = `${colour}[${entry.level.toUpperCase()}]${reset} [${entry.action}]`
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? ` error="${entry.error}"` : ''
    console[entry.level](`${prefix} ${entry.message}${contextStr}${errorStr}`)
  }
}

const logger = {
  info(action: string, message: string, context?: Record<string, unknown>): void {
    emit({ level: 'info', action, message, context, timestamp: new Date().toISOString() })
  },

  warn(action: string, message: string, context?: Record<string, unknown>): void {
    emit({ level: 'warn', action, message, context, timestamp: new Date().toISOString() })
  },

  error(action: string, message: string, context?: Record<string, unknown>, error?: unknown): void {
    const entry: LogEntry = {
      level: 'error',
      action,
      message,
      context,
      timestamp: new Date().toISOString(),
    }
    if (error !== undefined) {
      entry.error = formatError(error)
      // Auto-report to Sentry — one call covers both Vercel logs AND Sentry
      captureServerActionError(action, error, context)
    }
    emit(entry)
  },
}

export default logger
