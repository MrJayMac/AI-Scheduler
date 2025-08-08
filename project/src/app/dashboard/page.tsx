'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GoogleCalendarConnect from '../components/GoogleCalendarConnect'
import CalendarEvents from '../components/CalendarEvents'
import TaskInput from '../components/TaskInput'
import TaskList from '../components/TaskList'
import ScheduleView from '../components/ScheduleView'
import CalendarView from '../components/CalendarView'


export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0)
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
    setTaskRefreshTrigger(prev => prev + 1)
    setTaskAddedTrigger(prev => prev + 1)
  }

  const handleTaskDeleted = () => {
    setTaskRefreshTrigger(prev => prev + 1)
    setScheduleRefreshTrigger(prev => prev + 1)
    setCalendarRefreshTrigger(prev => prev + 1)
  }

  const handleScheduleGenerated = () => {
    setScheduleRefreshTrigger(prev => prev + 1)
    setCalendarRefreshTrigger(prev => prev + 1)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome {userEmail}</h1>
      <GoogleCalendarConnect />
      <CalendarEvents />
      <TaskInput onTaskAdded={handleTaskAdded} />
      <TaskList 
        refreshTrigger={taskRefreshTrigger} 
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
