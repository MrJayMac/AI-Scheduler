"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GoogleCalendarConnect from '../components/GoogleCalendarConnect'
import TaskInput from '../components/TaskInput'
import CalendarView from '../components/CalendarView'
import AgendaList from '../components/AgendaList'
import PreferencesDrawer from '../components/PreferencesDrawer'
import BurgerMenu from '../components/BurgerMenu'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [connected, setConnected] = useState<boolean>(false)
  const [connectRefreshKey, setConnectRefreshKey] = useState(0)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/login')
    }
    getUser()
  }, [supabase, router])


  const handleTaskAdded = () => setCalendarRefreshTrigger(prev => prev + 1)
  const handleDisconnected = () => {
    setConnected(false)
    setMenuOpen(false)
    setCalendarRefreshTrigger(prev => prev + 1)
    setConnectRefreshKey(prev => prev + 1)
  }

  return (
    <main className="min-h-screen bg-[#0b0f17] text-slate-200 p-4">
      <button
        aria-label="Open menu"
        className="fixed top-4 left-4 z-50 btn btn-neutral"
        onClick={() => setMenuOpen(true)}
      >
        ☰
      </button>
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <GoogleCalendarConnect
                onStatusChange={setConnected}
                refreshKey={connectRefreshKey}
                connectedOverride={connected}
              />
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
      <BurgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenPreferences={() => setPrefsOpen(true)}
        connected={connected}
        onDisconnected={handleDisconnected}
      />
      <PreferencesDrawer open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </main>
  )
}
