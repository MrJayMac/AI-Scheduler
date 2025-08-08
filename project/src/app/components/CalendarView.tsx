'use client'

import { useState, useEffect } from 'react'
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { createClient } from '@/lib/supabase/client'


const localizer = momentLocalizer(moment)
const DragAndDropCalendar = withDragAndDrop<CalendarEvent>(Calendar)

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: {
    type: 'google' | 'ai-task'
    priority?: string
    googleEventId?: string
    taskId?: string
    locked?: boolean
  }
}

interface TimeBlock {
  id: string
  task_id: string
  title: string
  start_time: string
  end_time: string
  duration_min: number
  priority: string
  status: string
  locked?: boolean
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
  const supabase = createClient()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<View>(Views.WEEK)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    fetchAllEvents()
  }, [refreshTrigger || 0])

  const fetchAllEvents = async () => {
    try {
      setLoading(true)
      
      // Get date range for current view
      const startOfWeek = moment(currentDate).startOf('week').toDate()
      const endOfWeek = moment(currentDate).endOf('week').toDate()
      
      // Fetch Google Calendar events and AI scheduled tasks in parallel
      const [googleEvents, timeBlocks] = await Promise.all([
        fetchGoogleEvents(startOfWeek, endOfWeek),
        fetchTimeBlocks()
      ])
      
      // Combine and format events
      const combinedEvents = [
        ...formatGoogleEvents(googleEvents),
        ...formatTimeBlocks(timeBlocks)
      ]
      
      setEvents(combinedEvents)
    } catch (error) {
      console.error('Error fetching calendar events:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGoogleEvents = async (startDate: Date, endDate: Date): Promise<GoogleCalendarEvent[]> => {
    try {
      const response = await fetch(`/api/calendar/events?timeMin=${startDate.toISOString()}&timeMax=${endDate.toISOString()}`)
      const data = await response.json()
      
      if (data.success) {
        return data.events || []
      } else {
        console.error('Error fetching Google events:', data.error)
        return []
      }
    } catch (error) {
      console.error('Error fetching Google events:', error)
      return []
    }
  }

  const fetchTimeBlocks = async (): Promise<TimeBlock[]> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return []
      }

      const { data: timeBlocks, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error fetching time blocks:', error)
        return []
      }

      return timeBlocks || []
    } catch (error) {
      console.error('Error fetching time blocks:', error)
      return []
    }
  }

  const formatGoogleEvents = (googleEvents: GoogleCalendarEvent[]): CalendarEvent[] => {
    return googleEvents.map(event => ({
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

  const formatTimeBlocks = (timeBlocks: TimeBlock[]): CalendarEvent[] => {
    return timeBlocks.map(block => ({
      id: `ai-${block.id}`,
      title: `${block.locked ? '🔒 ' : ''}AI: ${block.title}`,
      start: new Date(block.start_time),
      end: new Date(block.end_time),
      resource: {
        type: 'ai-task' as const,
        priority: block.priority,
        taskId: block.id,
        locked: block.locked || false
      }
    }))
  }

  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#007bff' // Default blue for Google events
    let color = 'white'
    let border = 'none'
    
    if (event.resource.type === 'ai-task') {
      // Color code by priority for AI tasks
      switch (event.resource.priority) {
        case 'high':
          backgroundColor = '#dc3545' // Red
          break
        case 'medium':
          backgroundColor = '#ffc107' // Yellow
          color = 'black'
          break
        case 'low':
          backgroundColor = '#28a745' // Green
          break
        default:
          backgroundColor = '#6c757d' // Gray
      }
      
      // Add special styling for locked blocks
      if (event.resource.locked) {
        border = '3px solid #000'
        backgroundColor = backgroundColor + 'CC' // Add transparency
      }
    }
    
    return {
      style: {
        backgroundColor,
        color,
        border,
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: event.resource.locked ? 'bold' : 'normal'
      }
    }
  }

  const handleViewChange = (view: View) => {
    setCurrentView(view)
  }

  const handleNavigate = (date: Date) => {
    setCurrentDate(date)
    // Refetch events when navigating to ensure we have data for the new date range
    setTimeout(() => fetchAllEvents(), 100)
  }

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.resource.type === 'ai-task') {
      alert(`AI Scheduled Task: ${event.title.replace('AI: ', '')}\nPriority: ${event.resource.priority}\nDuration: ${moment(event.end).diff(moment(event.start), 'minutes')} minutes`)
    } else {
      alert(`Google Calendar Event: ${event.title}`)
    }
  }

  const isDraggable = (event: CalendarEvent) => {
    // Only AI scheduled tasks can be dragged/resized
    return event.resource.type === 'ai-task'
  }

  const handleEventDrop = async (args: any) => {
    const { event, start, end } = args
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    if (event.resource.type !== 'ai-task' || !event.resource.taskId) {
      return
    }

    try {
      const response = await fetch(`/api/time-blocks/${event.resource.taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          duration_min: moment(endDate).diff(moment(startDate), 'minutes')
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh events to show updated state
        fetchAllEvents()
      } else {
        alert('Failed to update time block: ' + data.error)
      }
    } catch (error) {
      console.error('Error updating time block:', error)
      alert('Failed to update time block')
    }
  }

  const handleEventResize = async (args: any) => {
    const { event, start, end } = args
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    if (event.resource.type !== 'ai-task' || !event.resource.taskId) {
      return
    }

    try {
      const response = await fetch(`/api/time-blocks/${event.resource.taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          duration_min: moment(endDate).diff(moment(startDate), 'minutes')
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh events to show updated state
        fetchAllEvents()
      } else {
        alert('Failed to resize time block: ' + data.error)
      }
    } catch (error) {
      console.error('Error resizing time block:', error)
      alert('Failed to resize time block')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
        <h3>Calendar View</h3>
        <p>Loading calendar events...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Calendar View</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleViewChange(Views.WEEK)}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === Views.WEEK ? '#007bff' : '#f8f9fa',
              color: currentView === Views.WEEK ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Week
          </button>
          <button
            onClick={() => handleViewChange(Views.MONTH)}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === Views.MONTH ? '#007bff' : '#f8f9fa',
              color: currentView === Views.MONTH ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Month
          </button>
          <button
            onClick={fetchAllEvents}
            style={{
              padding: '8px 16px',
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
      </div>
      
      {/* Legend */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#4285f4', borderRadius: '2px' }}></div>
          <span>Google Calendar</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#dc3545', borderRadius: '2px' }}></div>
          <span>AI High Priority</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#ffc107', borderRadius: '2px' }}></div>
          <span>AI Medium Priority</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#28a745', borderRadius: '2px' }}></div>
          <span>AI Low Priority</span>
        </div>
      </div>

      <div style={{ height: '600px' }}>
        <DragAndDropCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          view={currentView}
          onView={handleViewChange}
          date={currentDate}
          onNavigate={handleNavigate}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          resizable
          draggableAccessor={isDraggable}
          popup
          showMultiDayTimes
          step={30}
          timeslots={2}
        />
      </div>
      
      <div style={{ marginTop: '15px', color: '#666', fontSize: '14px' }}>
        <p>Showing {events.filter(e => e.resource.type === 'google').length} Google Calendar events and {events.filter(e => e.resource.type === 'ai-task').length} AI scheduled tasks</p>
        <p>Click on any event to view details</p>
      </div>
    </div>
  )
}