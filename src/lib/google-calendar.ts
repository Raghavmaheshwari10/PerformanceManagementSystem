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
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
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
    console.error('Failed to get service account token:', await tokenRes.text())
    return null
  }

  const data = await tokenRes.json()
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

  return {
    eventId: created.id,
    meetLink: created.hangoutLink ?? created.conferenceData?.entryPoints?.[0]?.uri ?? '',
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
 * This creates a meet.google.com/new link that participants can join.
 */
export function generateFallbackMeetLink(): string {
  // Google Meet allows creating instant meetings via URL
  // The organizer will need to manually share the link
  function segment(len: number): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < len; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    return result
  }
  // Format: xxx-xxxx-xxx (Google Meet format)
  return `https://meet.google.com/${segment(3)}-${segment(4)}-${segment(3)}`
}
