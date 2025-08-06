'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCalendarEvents } from '@/lib/google/calendar'

interface CalendarEvent {
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
  description?: string
}

export default function CalendarEvents() {
  const supabase = createClient()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setError('User not authenticated')
        return
      }

      // Get this week's date range
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
      startOfWeek.setHours(0, 0, 0, 0)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday
      endOfWeek.setHours(23, 59, 59, 999)

      console.log('Fetching events from', startOfWeek.toISOString(), 'to', endOfWeek.toISOString())

      // Fetch events from Google Calendar
      const calendarEvents = await getCalendarEvents({
        timeMin: startOfWeek.toISOString(),
        timeMax: endOfWeek.toISOString()
      })

      setEvents(calendarEvents || [])
      console.log('Fetched', (calendarEvents || []).length, 'events')

    } catch (error) {
      console.error('Error fetching calendar events:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch calendar events')
    } finally {
      setLoading(false)
    }
  }

  const formatEventTime = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date
    const end = event.end.dateTime || event.end.date
    
    if (!start) return 'No time specified'

    const startDate = new Date(start)
    const endDate = new Date(end || start)

    // All-day event
    if (event.start.date && !event.start.dateTime) {
      return `All day - ${startDate.toLocaleDateString()}`
    }

    // Same day event
    if (startDate.toDateString() === endDate.toDateString()) {
      return `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })} - ${endDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`
    }

    // Multi-day event
    return `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })} - ${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
        <h3>This Week's Calendar Events</h3>
        <p>Loading events...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
        <h3>This Week's Calendar Events</h3>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <button 
          onClick={fetchEvents}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>This Week's Calendar Events</h3>
        <button 
          onClick={fetchEvents}
          style={{ 
            padding: '6px 12px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Refresh
        </button>
      </div>
      
      {events.length === 0 ? (
        <p>No events found for this week.</p>
      ) : (
        <div>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Found {events.length} event{events.length !== 1 ? 's' : ''} this week
          </p>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {events.map((event) => (
              <div 
                key={event.id} 
                style={{ 
                  padding: '12px', 
                  border: '1px solid #e0e0e0', 
                  borderRadius: '6px', 
                  marginBottom: '10px',
                  backgroundColor: '#f9f9f9'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {event.summary || 'Untitled Event'}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                  {formatEventTime(event)}
                </div>
                {event.description && (
                  <div style={{ fontSize: '14px', color: '#555' }}>
                    {event.description.length > 100 
                      ? `${event.description.substring(0, 100)}...` 
                      : event.description
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
