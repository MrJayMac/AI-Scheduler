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

// Weighted scheduler: evaluates multiple candidate gaps and chooses the best
export async function suggestBestSlot(opts: {
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
    const start = addMinutes(new Date(s), -prefs.bufferMinutes)
    const end = addMinutes(new Date(e), prefs.bufferMinutes)
    busy.push({ start, end })
  }
  busy.sort((a, b) => a.start.getTime() - b.start.getTime())

  const isWeekend = (d: Date) => {
    const day = d.getDay()
    return day === 0 || day === 6
  }

  type Cand = { start: Date; end: Date; windowStart: Date; windowEnd: Date }
  const cands: Cand[] = []

  // Collect candidate starts (first-fit per gap) across horizon
  for (let d = 0; d < horizonDays; d++) {
    const day = new Date(now)
    day.setDate(now.getDate() + d)
    const dayStart = new Date(day)
    dayStart.setHours(prefs.workStartHour, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(prefs.workEndHour, 0, 0, 0)
    if (!prefs.allowWeekend && isWeekend(day)) continue

    const windows: Array<[Date, Date]> = prefs.preferMorning
      ? [
          [dayStart, new Date(new Date(dayStart).setHours(Math.min(12, prefs.workEndHour), 0, 0, 0))],
          [dayStart, dayEnd],
        ]
      : [[dayStart, dayEnd]]

    for (const [winStart, winEnd] of windows) {
      // Set initial cursor
      let cursor = d === 0 ? clampToWorkHours(now, prefs.workStartHour, prefs.workEndHour) : winStart
      if (cursor < winStart) cursor = winStart
      if (cursor > winEnd) continue

      for (let i = 0; i <= busy.length; i++) {
        const block = busy[i]
        const nextBlockStart = block ? new Date(Math.max(block.start.getTime(), winStart.getTime())) : winEnd
        if (block && block.end <= cursor) continue
        if (nextBlockStart.getTime() - cursor.getTime() >= durationMin * 60000) {
          const end = addMinutes(cursor, durationMin)
          if (end <= winEnd) cands.push({ start: new Date(cursor), end, windowStart: winStart, windowEnd: winEnd })
          break // only take the first feasible slot in this window for scoring
        }
        if (block) {
          const blockEndClamped = new Date(Math.min(block.end.getTime(), winEnd.getTime()))
          if (blockEndClamped > cursor) cursor = blockEndClamped
          if (cursor >= winEnd) break
        }
      }
    }
  }

  if (cands.length === 0) return null

  // Scoring: lower is better
  const score = (c: Cand) => {
    const hoursFromNow = (c.start.getTime() - now.getTime()) / 3_600_000
    let s = hoursFromNow // sooner is better
    const hr = c.start.getHours()
    if (prefs.preferMorning && hr < 12) s -= 6 // boost morning picks
    // Prefer tighter fit (less leftover before next block/window end)
    const leftover = (c.windowEnd.getTime() - c.end.getTime()) / 3_600_000
    s += Math.max(0, Math.min(leftover, 8)) * 0.05
    return s
  }

  cands.sort((a, b) => score(a) - score(b))
  return cands[0].start.toISOString()
}
