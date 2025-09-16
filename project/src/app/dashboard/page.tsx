"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GoogleCalendarConnect from '../components/GoogleCalendarConnect'
import TaskInput from '../components/TaskInput'
import CalendarView from '../components/CalendarView'
import AgendaList from '../components/AgendaList'
import PreferencesDrawer from '../components/PreferencesDrawer'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)
  const [prefsOpen, setPrefsOpen] = useState(false)

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
      <button
        aria-label="Open preferences"
        className="fixed top-4 left-4 z-50 btn btn-neutral"
        onClick={() => setPrefsOpen(true)}
      >
        ☰
      </button>
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <GoogleCalendarConnect />
            </div>
            <div className="w-full md:max-w-md">
              <TaskInput onTaskAdded={handleTaskAdded} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 card p-2">
            <CalendarView
              refreshTrigger={calendarRefreshTrigger}
              onChange={() => setCalendarRefreshTrigger(prev => prev + 1)}
            />
          </div>
          <div className="lg:col-span-3 card">
            <AgendaList refreshTrigger={calendarRefreshTrigger} />
          </div>
        </div>
      </div>
      <PreferencesDrawer open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </main>
  )
}
