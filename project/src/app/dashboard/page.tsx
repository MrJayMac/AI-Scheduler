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
import { defaultPreferences, PREFS_STORAGE_KEY } from '@/lib/preferences/types'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [connected, setConnected] = useState<boolean>(false)
  const [connectRefreshKey, setConnectRefreshKey] = useState(0)
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null)

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

  const handleRecompute = async () => {
    setRecomputing(true)
    setRecomputeMsg(null)
    try {
      let prefs = defaultPreferences
      try {
        const raw = localStorage.getItem(PREFS_STORAGE_KEY)
        if (raw) prefs = { ...defaultPreferences, ...JSON.parse(raw) }
      } catch {}
      const resp = await fetch('/api/calendar/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs, timeZone: prefs.timeZone }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.success) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Reshuffle failed')
      }
      setRecomputeMsg(`Rescheduled ${data.updated} events`)
      setCalendarRefreshTrigger(prev => prev + 1)
    } catch (e) {
      setRecomputeMsg(e instanceof Error ? e.message : 'Reshuffle failed')
    } finally {
      setRecomputing(false)
    }
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
            <div className="w-full md:max-w-md flex items-center gap-2">
              <TaskInput onTaskAdded={handleTaskAdded} />
              <button className="btn btn-neutral whitespace-nowrap" onClick={handleRecompute} disabled={recomputing}>
                {recomputing ? 'Recomputing…' : 'Recompute'}
              </button>
            </div>
          </div>
          {recomputeMsg && (
            <div className="pt-2 text-sm text-slate-400">{recomputeMsg}</div>
          )}
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
