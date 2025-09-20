import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/lib/google/calendar-server'
import { defaultPreferences, type Preferences } from '@/lib/preferences/types'

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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const incomingPrefs: Preferences = { ...defaultPreferences, ...(body?.preferences || {}) }
    const timeZone: string | undefined = typeof body?.timeZone === 'string' ? body.timeZone : incomingPrefs.timeZone
    const horizonDays: number = (typeof body?.horizonDays === 'number' && isFinite(body.horizonDays) && body.horizonDays > 0) ? body.horizonDays : 14

    // Compute now in user's timezone (best-effort)
    let now = new Date()
    if (timeZone) {
      try {
        const zoned = new Date(new Date().toLocaleString('en-US', { timeZone }))
        if (!isNaN(zoned.getTime())) now = zoned
      } catch {}
    }

    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString()
    const events = await getCalendarEvents({ timeMin, timeMax })
    if (!events) return NextResponse.json({ success: true, updated: 0 })

    const AI_PREFIX = 'AI-SCHEDULER '
    const aiEvents = events.filter(ev => typeof ev.description === 'string' && ev.description.startsWith(AI_PREFIX))
    const others = events.filter(ev => !(typeof ev.description === 'string' && ev.description.startsWith(AI_PREFIX)))

    type Block = { start: Date; end: Date }
    const busy: Block[] = []
    const addMinutes = (d: Date, min: number) => new Date(d.getTime() + min * 60000)

    for (const ev of others) {
      const s = ev.start.dateTime || ev.start.date
      const e = ev.end.dateTime || ev.end.date
      if (!s || !e) continue
      const start = addMinutes(new Date(s), -incomingPrefs.bufferMinutes)
      const end = addMinutes(new Date(e), incomingPrefs.bufferMinutes)
      busy.push({ start, end })
    }
    busy.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Helpers
    const isWeekend = (d: Date) => {
      const day = d.getDay()
      return day === 0 || day === 6
    }

    const clampToWorkHours = (d: Date) => {
      const res = new Date(d)
      const start = new Date(d)
      start.setHours(incomingPrefs.workStartHour, 0, 0, 0)
      const end = new Date(d)
      end.setHours(incomingPrefs.workEndHour, 0, 0, 0)
      if (res < start) return start
      if (res > end) return end
      return res
    }

    // Sort ai events deterministically by their current start
    aiEvents.sort((a, b) => {
      const as = new Date(a.start.dateTime || a.start.date || now.toISOString()).getTime()
      const bs = new Date(b.start.dateTime || b.start.date || now.toISOString()).getTime()
      return as - bs
    })

    const updates: string[] = []

    for (const ev of aiEvents) {
      // Determine duration
      let durMin = defaultPreferences.defaultDurationMin
      try {
        const metaStr = (ev.description || '').slice(AI_PREFIX.length)
        const meta = JSON.parse(metaStr)
        if (typeof meta?.durationMin === 'number' && isFinite(meta.durationMin)) {
          durMin = Math.max(5, Math.min(1440, meta.durationMin))
        }
      } catch {}
      const s0 = ev.start.dateTime || ev.start.date
      const e0 = ev.end.dateTime || ev.end.date
      if (s0 && e0) {
        const diff = Math.round((new Date(e0).getTime() - new Date(s0).getTime()) / 60000)
        if (diff > 0) durMin = diff
      }

      let placedISO: string | null = null

      dayLoop: for (let d = 0; d < horizonDays; d++) {
        const day = new Date(now)
        day.setDate(now.getDate() + d)
        const dayStart = new Date(day)
        dayStart.setHours(incomingPrefs.workStartHour, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(incomingPrefs.workEndHour, 0, 0, 0)

        if (!incomingPrefs.allowWeekend && isWeekend(day)) continue

        const morningEnd = new Date(day)
        morningEnd.setHours(Math.min(12, incomingPrefs.workEndHour), 0, 0, 0)

        const windows: Array<[Date, Date]> = incomingPrefs.preferMorning
          ? [[dayStart, morningEnd], [dayStart, dayEnd]]
          : [[dayStart, dayEnd]]

        for (const [winStart, winEnd] of windows) {
          let cursor = d === 0 ? clampToWorkHours(now) : winStart
          if (cursor < winStart) cursor = winStart
          if (cursor > winEnd) continue

          for (let i = 0; i <= busy.length; i++) {
            const block = busy[i]
            const nextBlockStart = block ? new Date(Math.max(block.start.getTime(), winStart.getTime())) : winEnd
            if (block && block.end <= cursor) continue
            if (nextBlockStart.getTime() - cursor.getTime() >= durMin * 60000) {
              placedISO = cursor.toISOString()
              break
            }
            if (block) {
              const blockEndClamped = new Date(Math.min(block.end.getTime(), winEnd.getTime()))
              if (blockEndClamped > cursor) cursor = blockEndClamped
              if (cursor >= winEnd) break
            }
          }
          if (placedISO) break
        }
        if (placedISO) break dayLoop
      }

      if (!placedISO) continue
      const endISO = new Date(new Date(placedISO).getTime() + durMin * 60000).toISOString()

      const updated = await updateCalendarEvent(
        ev.id,
        {
          summary: ev.summary,
          description: ev.description,
          start: timeZone ? { dateTime: placedISO, timeZone } : { dateTime: placedISO },
          end: timeZone ? { dateTime: endISO, timeZone } : { dateTime: endISO },
        },
        'primary'
      )

      if (updated) {
        updates.push(updated.id)
        busy.push({ start: new Date(placedISO), end: new Date(endISO) })
        busy.sort((a, b) => a.start.getTime() - b.start.getTime())
      }
    }

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    console.error('Error reshuffling events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
