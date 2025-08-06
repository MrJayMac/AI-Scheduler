import { createClient } from '@/lib/supabase/client'

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  status: string
  htmlLink: string
}

export interface CalendarListResponse {
  items: CalendarEvent[]
  nextPageToken?: string
  nextSyncToken?: string
}

// Get valid access token for API calls
async function getAccessToken(): Promise<string | null> {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: tokens } = await supabase
    .from('oauth_tokens')
    .select('access_token, expires_at')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single()

  if (!tokens?.access_token) return null

  // Check if token is expired (with 5 minute buffer)
  const now = Date.now()
  const expiresAt = tokens.expires_at
  const buffer = 5 * 60 * 1000 // 5 minutes

  if (now >= (expiresAt - buffer)) {
    console.warn('Access token expired, user needs to reconnect')
    return null
  }

  return tokens.access_token
}

// Fetch calendar events for a date range
export async function getCalendarEvents({
  timeMin,
  timeMax,
  calendarId = 'primary',
  maxResults = 250
}: {
  timeMin: string // ISO string
  timeMax: string // ISO string
  calendarId?: string
  maxResults?: number
}): Promise<CalendarEvent[] | null> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    console.error('No valid access token available')
    return null
  }

  try {
    const url = new URL(`${CALENDAR_API_BASE}/calendars/${calendarId}/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('maxResults', maxResults.toString())
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`)
    }

    const data: CalendarListResponse = await response.json()
    return data.items || []
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return null
  }
}

// Get events for current week
export async function getThisWeekEvents(): Promise<CalendarEvent[] | null> {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)
  endOfWeek.setHours(23, 59, 59, 999)

  return getCalendarEvents({
    timeMin: startOfWeek.toISOString(),
    timeMax: endOfWeek.toISOString()
  })
}

// Get events for a specific date
export async function getDayEvents(date: Date): Promise<CalendarEvent[] | null> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  return getCalendarEvents({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString()
  })
}

// Create a new calendar event
export async function createCalendarEvent({
  summary,
  description,
  start,
  end,
  calendarId = 'primary'
}: {
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  calendarId?: string
}): Promise<CalendarEvent | null> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    console.error('No valid access token available')
    return null
  }

  try {
    const response = await fetch(`${CALENDAR_API_BASE}/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        description,
        start,
        end,
      }),
    })

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating calendar event:', error)
    return null
  }
}

// Check if calendar is connected and accessible
export async function testCalendarConnection(): Promise<boolean> {
  const accessToken = await getAccessToken()
  if (!accessToken) return false

  try {
    const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    return response.ok
  } catch (error) {
    console.error('Calendar connection test failed:', error)
    return false
  }
}