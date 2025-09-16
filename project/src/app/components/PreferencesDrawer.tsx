"use client"

import { useEffect, useState } from "react"
import { defaultPreferences, PREFS_STORAGE_KEY, type Preferences } from "@/lib/preferences/types"

interface PreferencesDrawerProps {
  open: boolean
  onClose: () => void
}

export default function PreferencesDrawer({ open, onClose }: PreferencesDrawerProps) {
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setPrefs({ ...defaultPreferences, ...parsed })
      }
    } catch {}
  }, [open])

  const save = () => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
      onClose()
    } catch {}
  }

  

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-700/50 p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Preferences</h2>
          <button className="btn btn-neutral" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Time Zone</label>
              <select
                className="input"
                value={prefs.timeZone || 'America/New_York'}
                onChange={e => setPrefs({ ...prefs, timeZone: e.target.value })}
              >
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Work start time</label>
              <div className="flex gap-2">
                <select
                  className="input"
                  value={(prefs.workStartHour % 12) === 0 ? 12 : (prefs.workStartHour % 12)}
                  onChange={e => {
                    const hr12 = Number(e.target.value)
                    const mer = prefs.workStartHour >= 12 ? 'PM' : 'AM'
                    const hr24 = (hr12 % 12) + (mer === 'PM' ? 12 : 0)
                    setPrefs({ ...prefs, workStartHour: hr24 })
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <select
                  className="input"
                  value={prefs.workStartHour >= 12 ? 'PM' : 'AM'}
                  onChange={e => {
                    const mer = e.target.value as 'AM' | 'PM'
                    const hr12 = (prefs.workStartHour % 12) === 0 ? 12 : (prefs.workStartHour % 12)
                    const hr24 = (hr12 % 12) + (mer === 'PM' ? 12 : 0)
                    setPrefs({ ...prefs, workStartHour: hr24 })
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Work end time</label>
              <div className="flex gap-2">
                <select
                  className="input"
                  value={(prefs.workEndHour % 12) === 0 ? 12 : (prefs.workEndHour % 12)}
                  onChange={e => {
                    const hr12 = Number(e.target.value)
                    const mer = prefs.workEndHour >= 12 ? 'PM' : 'AM'
                    const hr24 = (hr12 % 12) + (mer === 'PM' ? 12 : 0)
                    setPrefs({ ...prefs, workEndHour: hr24 })
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <select
                  className="input"
                  value={prefs.workEndHour >= 12 ? 'PM' : 'AM'}
                  onChange={e => {
                    const mer = e.target.value as 'AM' | 'PM'
                    const hr12 = (prefs.workEndHour % 12) === 0 ? 12 : (prefs.workEndHour % 12)
                    const hr24 = (hr12 % 12) + (mer === 'PM' ? 12 : 0)
                    setPrefs({ ...prefs, workEndHour: hr24 })
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Default duration (min)</label>
              <input className="input" type="number" min={5} max={240} value={prefs.defaultDurationMin} onChange={e => setPrefs({ ...prefs, defaultDurationMin: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Buffer (min)</label>
              <input className="input" type="number" min={0} max={60} value={prefs.bufferMinutes} onChange={e => setPrefs({ ...prefs, bufferMinutes: Number(e.target.value) })} />
            </div>
            </div>

            <div className="flex items-center gap-3">
            <label className="text-sm text-slate-300">Prefer morning</label>
            <input type="checkbox" checked={prefs.preferMorning} onChange={e => setPrefs({ ...prefs, preferMorning: e.target.checked })} />
            </div>

            <div className="flex items-center gap-3">
            <label className="text-sm text-slate-300">Allow weekends</label>
            <input type="checkbox" checked={prefs.allowWeekend} onChange={e => setPrefs({ ...prefs, allowWeekend: e.target.checked })} />
            </div>

            <div className="flex items-center gap-3">
            <label className="text-sm text-slate-300">Suggest time automatically</label>
            <input type="checkbox" checked={prefs.suggestTime} onChange={e => setPrefs({ ...prefs, suggestTime: e.target.checked })} />
            </div>

            <div className="pt-2">
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
        </div>
      </div>
    </div>
)
}
