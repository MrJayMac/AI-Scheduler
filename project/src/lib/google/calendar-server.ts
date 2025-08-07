import { createClient } from '@/lib/supabase/server'

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

async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient()
  
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
      console.error('Failed to refresh token:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    
    if (!data.access_token) {
      console.error('No access token in refresh response')
      return null
    }

    const newExpiresAt = Date.now() + (data.expires_in * 1000)
    
    const supabase = await createClient()
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
      console.error('Failed to update refreshed token:', updateError)
      return null
    }

    console.log('Token refreshed successfully')
    return data.access_token

  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

export async function getCalendarEvents({
  timeMin,
  timeMax,
  calendarId = 'primary',
  maxResults = 250
}: {
  timeMin: string
  timeMax: string
  calendarId?: string
  maxResults?: number
}): Promise<CalendarEvent[] | null> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
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

    const data = await response.json()
    return data.items || []
  } catch (error) {
    return null
  }
}

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
    return null
  }
}
