import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeMin = searchParams.get('timeMin')
    const timeMax = searchParams.get('timeMax')

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: 'timeMin and timeMax parameters are required' },
        { status: 400 }
      )
    }

    const events = await getCalendarEvents({
      timeMin,
      timeMax
    })

    return NextResponse.json({
      success: true,
      events: events || []
    })

  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const summary: unknown = body?.summary
    const startDateTime: unknown = body?.startDateTime
    const durationMin: unknown = body?.durationMin
    const timeZone: unknown = body?.timeZone

    if (!summary || typeof summary !== 'string' || !summary.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid "summary"' },
        { status: 400 }
      )
    }

    const cleanSummary = summary.trim()
    const dur = (typeof durationMin === 'number' && isFinite(durationMin) && durationMin > 0)
      ? durationMin
      : 60

    let startStr: string
    let includeTimeZone = false

    if (typeof startDateTime === 'string' && startDateTime.length > 0) {
      startStr = startDateTime
      includeTimeZone = !(/[zZ]|[+\-]\d{2}:?\d{2}$/.test(startStr))
    } else {
      startStr = new Date().toISOString()
      includeTimeZone = false
    }

    const startForCalc = new Date(startStr)
    const endISO = new Date(startForCalc.getTime() + dur * 60000).toISOString()

    const event = await createCalendarEvent({
      summary: cleanSummary,
      start: includeTimeZone && typeof timeZone === 'string' && timeZone
        ? { dateTime: startStr, timeZone }
        : { dateTime: startStr },
      end: includeTimeZone && typeof timeZone === 'string' && timeZone
        ? { dateTime: endISO, timeZone }
        : { dateTime: endISO },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Failed to create calendar event' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, event })

  } catch (error) {
    console.error('Error creating calendar event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const eventId: unknown = body?.eventId
    const calendarId: unknown = body?.calendarId || 'primary'

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "eventId"' }, { status: 400 })
    }

    const ok = await deleteCalendarEvent({ eventId, calendarId: typeof calendarId === 'string' ? calendarId : 'primary' })
    if (!ok) {
      return NextResponse.json({ error: 'Failed to delete calendar event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting calendar event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
