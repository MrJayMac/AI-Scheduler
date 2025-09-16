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
            <label className="block text-sm text-slate-300 mb-1">Time Zone (optional IANA)</label>
            <input className="input" placeholder="e.g. America/Los_Angeles" value={prefs.timeZone || ""} onChange={e => setPrefs({ ...prefs, timeZone: e.target.value || undefined })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Work start hour</label>
              <input className="input" type="number" min={0} max={23} value={prefs.workStartHour} onChange={e => setPrefs({ ...prefs, workStartHour: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Work end hour</label>
              <input className="input" type="number" min={0} max={23} value={prefs.workEndHour} onChange={e => setPrefs({ ...prefs, workEndHour: Number(e.target.value) })} />
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
