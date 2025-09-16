import { getCalendarEvents } from '@/lib/google/calendar-server'
import type { Preferences } from '@/lib/preferences/types'

function addMinutes(d: Date, min: number) {
  return new Date(d.getTime() + min * 60000)
}

function clampToWorkHours(d: Date, workStartHour: number, workEndHour: number) {
  const res = new Date(d)
  const start = new Date(d)
  start.setHours(workStartHour, 0, 0, 0)
  const end = new Date(d)
  end.setHours(workEndHour, 0, 0, 0)
  if (res < start) return start
  if (res > end) return end
  return res
}

function isWeekend(d: Date) {
  const day = d.getDay()
  return day === 0 || day === 6
}

export async function suggestNextSlot(opts: {
  now: Date
  durationMin: number
  prefs: Preferences
}): Promise<string | null> {
  const { now, durationMin, prefs } = opts
  const horizonDays = 14

  const timeMin = now.toISOString()
  const timeMax = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString()
  const events = await getCalendarEvents({ timeMin, timeMax })
  const busy: Array<{ start: Date; end: Date }> = []
  for (const ev of events || []) {
    const s = ev.start.dateTime || ev.start.date
    const e = ev.end.dateTime || ev.end.date
    if (!s || !e) continue
    const start = new Date(s)
    const end = new Date(e)
    // Expand by buffer
    const startBuf = addMinutes(start, -prefs.bufferMinutes)
    const endBuf = addMinutes(end, prefs.bufferMinutes)
    busy.push({ start: startBuf, end: endBuf })
  }
  busy.sort((a, b) => a.start.getTime() - b.start.getTime())

  // Iterate days and find first gap that fits
  for (let d = 0; d < horizonDays; d++) {
    const day = new Date(now)
    day.setDate(now.getDate() + d)
    const dayStart = new Date(day)
    dayStart.setHours(prefs.workStartHour, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(prefs.workEndHour, 0, 0, 0)

    if (!prefs.allowWeekend && isWeekend(day)) continue

    const morningEnd = new Date(day)
    morningEnd.setHours(Math.min(12, prefs.workEndHour), 0, 0, 0)

    const tryFindGap = (windowStart: Date, windowEnd: Date): string | null => {
      let cursor = d === 0 ? clampToWorkHours(now, prefs.workStartHour, prefs.workEndHour) : windowStart
      if (cursor < windowStart) cursor = windowStart
      if (cursor > windowEnd) return null

      for (let i = 0; i <= busy.length; i++) {
        const block = busy[i]
        const nextBlockStart = block ? new Date(Math.max(block.start.getTime(), windowStart.getTime())) : windowEnd

        if (block && block.end <= cursor) continue

        if (nextBlockStart.getTime() - cursor.getTime() >= durationMin * 60000) {
          return cursor.toISOString()
        }

        if (block) {
          const blockEndClamped = new Date(Math.min(block.end.getTime(), windowEnd.getTime()))
          if (blockEndClamped > cursor) cursor = blockEndClamped
          if (cursor >= windowEnd) break
        }
      }
      return null
    }

    // If preferMorning, first try morning window across days
    if (prefs.preferMorning && morningEnd > dayStart) {
      const found = tryFindGap(dayStart, morningEnd)
      if (found) return found
    }

    // Fallback to full day
    const foundFull = tryFindGap(dayStart, dayEnd)
    if (foundFull) return foundFull
  }

  return null
}
