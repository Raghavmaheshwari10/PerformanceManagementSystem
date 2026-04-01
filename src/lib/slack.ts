/**
 * Slack Bot integration — sends DMs to users via Slack Web API.
 * Requires SLACK_BOT_TOKEN env var (xoxb-... token from Slack app).
 */

const SLACK_API = 'https://slack.com/api'

function getToken(): string | null {
  return process.env.SLACK_BOT_TOKEN ?? null
}

async function slackApi(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const token = getToken()
  if (!token) throw new Error('SLACK_BOT_TOKEN not configured')

  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return res.json() as Promise<{ ok: boolean; error?: string }>
}

/** Check if Slack is configured */
export function isSlackConfigured(): boolean {
  return !!getToken()
}

/** Send a DM to a Slack user */
export async function sendSlackDM(slackUserId: string, text: string, blocks?: unknown[]): Promise<boolean> {
  try {
    const result = await slackApi('chat.postMessage', {
      channel: slackUserId,
      text,
      ...(blocks ? { blocks } : {}),
    })
    return result.ok
  } catch (err) {
    console.error('Slack DM failed:', err)
    return false
  }
}

/** Look up a Slack user by email (tries alternate domain if primary fails) */
export async function lookupSlackUser(email: string): Promise<string | null> {
  const ALTERNATE_DOMAINS: Record<string, string> = {
    'emb.global': 'exmyb.com',
    'exmyb.com': 'emb.global',
  }

  try {
    // Try exact email first
    const result = await slackApi('users.lookupByEmail', { email })
    if (result.ok && result.user) {
      return (result.user as { id: string }).id
    }

    // Try alternate domain
    const [username, domain] = email.split('@')
    const altDomain = ALTERNATE_DOMAINS[domain]
    if (altDomain) {
      const altResult = await slackApi('users.lookupByEmail', { email: `${username}@${altDomain}` })
      if (altResult.ok && altResult.user) {
        return (altResult.user as { id: string }).id
      }
    }

    return null
  } catch {
    return null
  }
}

/** Build a rich Slack message block for notifications */
export function buildSlackBlocks(title: string, body: string, linkUrl?: string): unknown[] {
  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: body },
    },
  ]

  if (linkUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in PMS' },
          url: linkUrl,
          style: 'primary',
        },
      ],
    })
  }

  return blocks
}
