import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent } from '@/lib/google/calendar-server'
import { parseTaskWithAI } from '@/lib/ai/parse'
import { suggestNextSlot } from '@/lib/scheduler/suggest'
import { defaultPreferences, type Preferences } from '@/lib/preferences/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const text: unknown = body?.text
    const incomingPrefs: Preferences = { ...defaultPreferences, ...(body?.preferences || {}) }
    const timeZone: unknown = body?.timeZone || incomingPrefs.timeZone

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Missing task text' }, { status: 400 })
    }

    const now = new Date()
    const nowISO = now.toISOString()
    const ai = await parseTaskWithAI({ text: text.trim(), nowISO, timeZone: typeof timeZone === 'string' ? timeZone : undefined })

    let summary: string
    let startStr: string
    let dur = Math.max(5, Math.min(1440, Number(incomingPrefs.defaultDurationMin) || 60))
    let includeTimeZone = false

    if (ai) {
      summary = ai.summary.trim()
      startStr = ai.startDateTime
      dur = Math.max(5, Math.min(1440, Number(ai.durationMin) || dur))
      includeTimeZone = !(/[zZ]|[+\-]\d{2}:?\d{2}$/.test(startStr))
    } else if (incomingPrefs.suggestTime) {
      summary = (text as string).trim()
      const suggestedISO = await suggestNextSlot({ now, durationMin: dur, prefs: incomingPrefs })
      if (suggestedISO) {
        startStr = suggestedISO
        includeTimeZone = !(/[zZ]|[+\-]\d{2}:?\d{2}$/.test(startStr))
      } else {
        const m = now.getMinutes()
        const rounded = m % 5 === 0 ? m : m + (5 - (m % 5))
        now.setMinutes(rounded, 0, 0)
        startStr = now.toISOString()
        includeTimeZone = false
      }
    } else {
      summary = (text as string).trim()
      const m = now.getMinutes()
      const rounded = m % 5 === 0 ? m : m + (5 - (m % 5))
      now.setMinutes(rounded, 0, 0)
      startStr = now.toISOString()
      includeTimeZone = false
    }

    const startForCalc = new Date(startStr)
    const endISO = new Date(startForCalc.getTime() + dur * 60000).toISOString()

    const event = await createCalendarEvent({
      summary,
      start: includeTimeZone && typeof timeZone === 'string' && timeZone
        ? { dateTime: startStr, timeZone }
        : { dateTime: startStr },
      end: includeTimeZone && typeof timeZone === 'string' && timeZone
        ? { dateTime: endISO, timeZone }
        : { dateTime: endISO },
    })

    if (!event) {
      return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
    }

    return NextResponse.json({ success: true, event, parsed: !!ai, suggested: !ai })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
