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
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single()

  if (!tokens?.access_token) return null

  const now = Date.now()
  const expiresAt = tokens.expires_at
  const buffer = 5 * 60 * 1000

  if (now >= (expiresAt - buffer)) {
    console.log('Access token expired, attempting refresh...')
    
    if (!tokens.refresh_token) {
      console.error('No refresh token available')
      return null
    }

    const refreshedToken = await refreshAccessToken(tokens.refresh_token, user.id)
    return refreshedToken
  }

  return tokens.access_token
}

async function refreshAccessToken(refreshToken: string, userId: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('❌ Failed to refresh token:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    
    if (!data.access_token) {
      console.error('❌ No access token in refresh response')
      return null
    }

    const newExpiresAt = Date.now() + (data.expires_in * 1000)
    
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('oauth_tokens')
      .update({
        access_token: data.access_token,
        expires_at: newExpiresAt,
        refresh_token: data.refresh_token || refreshToken
      })
      .eq('user_id', userId)
      .eq('provider', 'google')

    if (updateError) {
      console.error('❌ Failed to update refreshed token:', updateError)
      return null
    }

    console.log('✅ Token refreshed successfully')
    return data.access_token

  } catch (error) {
    console.error('❌ Error refreshing token:', error)
    return null
  }
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
  console.log('🔍 Starting getCalendarEvents...')
  
  const accessToken = await getAccessToken()
  if (!accessToken) {
    console.error('No valid access token available')
    return null
  }
  
  console.log('Access token found:', accessToken.substring(0, 20) + '...')

  try {
    const url = new URL(`${CALENDAR_API_BASE}/calendars/${calendarId}/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('maxResults', maxResults.toString())
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')

    console.log('🌐 API URL:', url.toString())
    console.log('📅 Date range:', timeMin, 'to', timeMax)

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('📡 Response status:', response.status, response.statusText)

    if (!response.ok) {
      // Get more details about the error
      const errorText = await response.text()
      console.error('API Error Details:', errorText)
      throw new Error(`Calendar API error: ${response.status} ${response.statusText} - ${errorText}`)
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