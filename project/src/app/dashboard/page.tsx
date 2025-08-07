'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GoogleCalendarConnect from '../components/GoogleCalendarConnect'
import CalendarEvents from '../components/CalendarEvents'
import TaskInput from '../components/TaskInput'
import ScheduleView from '../components/ScheduleView'


export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

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

  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome {userEmail}</h1>
      <GoogleCalendarConnect />
      <CalendarEvents />
      <TaskInput />
      <ScheduleView />
    </div>
  )
}
