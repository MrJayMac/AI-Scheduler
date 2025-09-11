"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GoogleCalendarConnect from '../components/GoogleCalendarConnect'
import TaskInput from '../components/TaskInput'
import CalendarView from '../components/CalendarView'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/login')
    }
    getUser()
  }, [supabase, router])

  const handleTaskAdded = () => setCalendarRefreshTrigger(prev => prev + 1)

  return (
    <main className="min-h-screen bg-[#0b0f17] text-slate-200 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
          <GoogleCalendarConnect />
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
          <TaskInput onTaskAdded={handleTaskAdded} />
        </div>
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-2">
          <CalendarView refreshTrigger={calendarRefreshTrigger} />
        </div>
      </div>
    </main>
  )
}
