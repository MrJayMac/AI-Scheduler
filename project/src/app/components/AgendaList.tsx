"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type GEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

interface AgendaListProps {
  refreshTrigger?: number
}

export default function AgendaList({ refreshTrigger }: AgendaListProps) {
  const [events, setEvents] = useState<GEvent[]>([])
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const fetchUpcoming = async () => {
      setLoading(true)
      try {
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller

        const now = new Date()
        const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        const res = await fetch(
          `/api/calendar/events?timeMin=${encodeURIComponent(
            now.toISOString()
          )}&timeMax=${encodeURIComponent(inTwoWeeks.toISOString())}`,
          { signal: controller.signal }
        )
        const data = await res.json()
        if (data?.success && Array.isArray(data.events)) {
          setEvents(data.events as GEvent[])
        } else {
          setEvents([])
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchUpcoming()
    return () => abortRef.current?.abort()
  }, [refreshTrigger])

  const byDay = useMemo(() => {
    const map = new Map<string, GEvent[]>()
    for (const ev of events) {
      const start = new Date(ev.start.dateTime || ev.start.date || "")
      const key = start.toDateString()
      const arr = map.get(key) || []
      arr.push(ev)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    )
  }, [events])

  const formatTime = (iso?: string) => {
    if (!iso) return "All day"
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading…</div>
  }

  return (
    <div className="space-y-3">
      {byDay.length === 0 && (
        <div className="text-sm text-slate-400">No upcoming events</div>
      )}
      {byDay.map(([day, items]) => (
        <div key={day} className="">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            {new Date(day).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="space-y-2">
            {items.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start justify-between rounded-md border border-slate-500/30 bg-slate-900/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-200">
                    {ev.summary || "Untitled"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatTime(ev.start.dateTime)}
                  </div>
                </div>
                <div className="ml-3 h-5 w-1 rounded bg-cyan-400" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
