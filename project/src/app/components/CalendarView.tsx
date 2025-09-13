'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, momentLocalizer, View, Views, DateLocalizer, Formats } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment)

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    type: 'google'
    googleEventId?: string
  }
}

interface GoogleCalendarEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
}

interface CalendarViewProps {
  refreshTrigger?: number
}

export default function CalendarView({ refreshTrigger }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<View>(Views.WEEK)
  const [currentDate, setCurrentDate] = useState(new Date())

  // Simplified header: using built-in toolbar, no custom range label

  const abortRef = useRef<AbortController | null>(null)
  const cacheRef = useRef<Map<string, { events: CalendarEvent[]; ts: number }>>(new Map())

  useEffect(() => {
    fetchAllEvents()
  }, [refreshTrigger, currentView, currentDate])

  // Abort any pending request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const fetchAllEvents = async () => {
    try {
      let rangeStart: Date
      let rangeEnd: Date
      if (currentView === Views.MONTH) {
        rangeStart = moment(currentDate).startOf('month').startOf('week').toDate()
        rangeEnd = moment(currentDate).endOf('month').endOf('week').toDate()
      } else if (currentView === Views.DAY) {
        rangeStart = moment(currentDate).startOf('day').toDate()
        rangeEnd = moment(currentDate).endOf('day').toDate()
      } else {
        // week
        rangeStart = moment(currentDate).startOf('week').toDate()
        rangeEnd = moment(currentDate).endOf('week').toDate()
      }
      const key = `${currentView}|${rangeStart.toISOString()}|${rangeEnd.toISOString()}`
      const cached = cacheRef.current.get(key)
      const now = Date.now()
      if (cached && now - cached.ts < 60_000) {
        setEvents(cached.events)
        return
      }

      // show loading only when actually fetching
      setLoading(true)

      // cancel any in-flight request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const googleEvents = await fetchGoogleEvents(rangeStart, rangeEnd, controller.signal)
      const combinedEvents = formatGoogleEvents(googleEvents)
      cacheRef.current.set(key, { events: combinedEvents, ts: now })
      setEvents(combinedEvents)
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Error fetching calendar events:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGoogleEvents = async (startDate: Date, endDate: Date, signal?: AbortSignal): Promise<GoogleCalendarEvent[]> => {
    try {
      const response = await fetch(`/api/calendar/events?timeMin=${encodeURIComponent(startDate.toISOString())}&timeMax=${encodeURIComponent(endDate.toISOString())}`, { signal })
      const data = await response.json()
      
      if (data.success) {
        return data.events || []
      } else {
        console.error('Error fetching Google events:', data.error)
        return []
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return []
      console.error('Error fetching Google events:', error)
      return []
    }
  }

  const formatGoogleEvents = (googleEvents: GoogleCalendarEvent[]): CalendarEvent[] => {
    return googleEvents
      .map(event => ({
        id: `google-${event.id}`,
        title: event.summary || 'Untitled Event',
        start: new Date(event.start.dateTime || event.start.date || ''),
        end: new Date(event.end.dateTime || event.end.date || ''),
        resource: {
          type: 'google' as const,
          googleEventId: event.id
        }
      }))
  }

  // Using default event styling from react-big-calendar

  const handleViewChange = (view: View) => {
    setCurrentView(view)
  }

  const handleNavigate = (date: Date) => {
    setCurrentDate(date)
  }

  const handleSelectEvent = async (event: CalendarEvent) => {
    if (event.resource?.type === 'google' && event.resource.googleEventId) {
      const ok = window.confirm(`Delete this event from Google Calendar?\n\n${event.title}`)
      if (!ok) return
      try {
        const resp = await fetch('/api/calendar/events', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: event.resource.googleEventId }),
        })
        const data = await resp.json()
        if (!resp.ok || !data.success) {
          console.error('Delete failed:', data)
          return
        }
        // Optimistically remove and invalidate cache, then refetch
        setEvents(prev => prev.filter(e => e.id !== event.id))
        cacheRef.current.clear()
        void fetchAllEvents()
      } catch (e) {
        console.error('Error deleting event:', e)
      }
    }
  }

  if (loading) {
    return (
      <div className="p-3 text-sm text-slate-400">Loading calendar…</div>
    )
  }

  return (
    <div className="w-full">
      <div className="rbc-theme-dark" style={{ height: 640 }}>
        {(() => {
          const formats: Partial<Formats> = {
            timeGutterFormat: (date: Date, culture?: string, loc?: DateLocalizer) =>
              (loc ? loc.format(date, 'h a', culture) : moment(date).format('h a')),
          }
          const minTime = moment().startOf('day').add(8, 'hours').toDate()
          const maxTime = moment().startOf('day').add(20, 'hours').toDate()
          const scrollToTime = moment().startOf('day').add(8, 'hours').toDate()
          return (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              toolbar={true}
              view={currentView}
              onView={handleViewChange}
              date={currentDate}
              onNavigate={handleNavigate}
              onSelectEvent={handleSelectEvent}
              popup
              showMultiDayTimes
              min={minTime}
              max={maxTime}
              scrollToTime={scrollToTime}
              formats={formats}
              step={30}
              timeslots={2}
            />
          )
        })()}
      </div>
    </div>
  )
}
