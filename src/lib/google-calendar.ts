/**
 * Google Calendar API integration for Review Discussion Meetings.
 *
 * Creates Google Calendar events with Google Meet links and sends
 * invitations to employee, manager, and HRBP.
 *
 * Requires a Google Service Account with domain-wide delegation,
 * OR falls back to manual meet link generation when credentials
 * are not configured.
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

interface CalendarEventAttendee {
  email: string
  displayName?: string
  responseStatus?: string
}

interface CalendarEventResult {
  eventId: string
  meetLink: string
  htmlLink: string
}

interface ScheduleMeetingParams {
  summary: string
  description: string
  startTime: Date
  durationMinutes?: number
  attendees: CalendarEventAttendee[]
  organizerEmail: string
}

/**
 * Get an access token using Google Service Account credentials.
 * The service account must have domain-wide delegation enabled
 * and the Calendar scope authorized in Google Workspace admin.
 */
async function getServiceAccountToken(impersonateEmail: string): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    console.warn('[Google Calendar] Missing credentials:', { hasEmail: !!clientEmail, hasKey: !!privateKey })
    return null
  }

  // Build JWT for service account
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    sub: impersonateEmail, // Impersonate the organizer
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url')

  // Sign with RSA-SHA256
  const crypto = await import('crypto')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(privateKey, 'base64url')

  const jwt = `${header}.${payload}.${signature}`

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('[Google Calendar] Token exchange failed:', tokenRes.status, errText)
    console.error('[Google Calendar] Service account:', clientEmail, '| Impersonating:', impersonateEmail)
    return null
  }

  const data = await tokenRes.json()
  console.log('[Google Calendar] Token acquired for:', impersonateEmail)
  return data.access_token
}

/**
 * Create a Google Calendar event with an auto-generated Google Meet link.
 * Falls back to generating a plain meet link if API is not configured.
 */
export async function createCalendarEvent(params: ScheduleMeetingParams): Promise<CalendarEventResult | null> {
  const { summary, description, startTime, durationMinutes = 60, attendees, organizerEmail } = params

  const token = await getServiceAccountToken(organizerEmail)
  if (!token) {
    console.warn('Google Calendar API not configured — returning null. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.')
    return null
  }

  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

  const event = {
    summary,
    description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: `pms-meeting-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  }

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(organizerEmail)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    console.error('Failed to create calendar event:', errText)
    return null
  }

  const created = await res.json()

  const meetLink = created.hangoutLink
    ?? created.conferenceData?.entryPoints?.find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === 'video')?.uri
    ?? created.conferenceData?.entryPoints?.[0]?.uri
    ?? null

  if (!meetLink) {
    console.warn('Calendar event created but no Meet link found in response — will use fallback')
    return null
  }

  return {
    eventId: created.id,
    meetLink,
    htmlLink: created.htmlLink ?? '',
  }
}

/**
 * Delete/cancel a Google Calendar event.
 */
export async function cancelCalendarEvent(eventId: string, organizerEmail: string): Promise<boolean> {
  const token = await getServiceAccountToken(organizerEmail)
  if (!token) return false

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(organizerEmail)}/events/${eventId}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  return res.ok || res.status === 410 // 410 = already deleted
}

/**
 * Generate a fallback Google Meet link (for when Calendar API is not configured).
 * Uses meet.google.com/new which creates an instant meeting when opened.
 * Note: Random meet codes (xxx-xxxx-xxx) do NOT work — only real API-created
 * codes or /new are valid.
 */
export function generateFallbackMeetLink(): string {
  return 'https://meet.google.com/new'
}
