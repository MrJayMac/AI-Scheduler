'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GoogleCalendarConnect from '../components/GoogleCalendarConnect'
import TaskInput from '../components/TaskInput'
import ScheduleView from '../components/ScheduleView'
import CalendarView from '../components/CalendarView'


export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  // TaskList component removed - no longer needed with auto-scheduling
  const [scheduleRefreshTrigger, setScheduleRefreshTrigger] = useState(0)
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)
  const [taskAddedTrigger, setTaskAddedTrigger] = useState(0)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email ?? null)
      } else {
        router.push('/login')
      }
    }

    getUser()
  }, [supabase, router])

  const handleTaskAdded = () => {
    setTaskAddedTrigger(prev => prev + 1)
  }

  const handleTaskDeleted = () => {
    setScheduleRefreshTrigger(prev => prev + 1)
    setCalendarRefreshTrigger(prev => prev + 1)
  }

  const handleScheduleGenerated = () => {
    setScheduleRefreshTrigger(prev => prev + 1)  // Refresh ScheduleView to show new schedule
    setCalendarRefreshTrigger(prev => prev + 1)  // Refresh CalendarView to show new events
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Welcome {userEmail}</h1>
        <button 
          onClick={() => router.push('/preferences')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ⚙️ Preferences
        </button>
      </div>
      <GoogleCalendarConnect />
      <TaskInput 
        onTaskAdded={handleTaskAdded} 
        onScheduleGenerated={handleScheduleGenerated}
      />

      <ScheduleView 
        refreshTrigger={scheduleRefreshTrigger} 
        onScheduleGenerated={handleScheduleGenerated}
        taskAddedTrigger={taskAddedTrigger}
        onTaskDeleted={handleTaskDeleted}
      />
      <CalendarView refreshTrigger={calendarRefreshTrigger} />
    </div>
  )
}
