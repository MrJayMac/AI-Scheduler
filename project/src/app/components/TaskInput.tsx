'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TaskInputProps {
  onTaskAdded?: () => void
}

export default function TaskInput({ onTaskAdded }: TaskInputProps) {
  const supabase = createClient()
  const [taskInput, setTaskInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!taskInput.trim()) {
      setError('Please enter a task')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setError('You must be logged in to add tasks')
        return
      }

      // Minimal flow: create a Google Calendar event now with default 60 min duration
      // Nudge start time to next 5-minute boundary for nicer placement
      const now = new Date()
      const minutes = now.getMinutes()
      const rounded = minutes % 5 === 0 ? minutes : minutes + (5 - (minutes % 5))
      now.setMinutes(rounded, 0, 0)
      const startISO = now.toISOString()
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: taskInput.trim(),
          startDateTime: startISO,
          durationMin: 60,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const detail = typeof result?.error === 'string' ? result.error : response.statusText
        throw new Error(`(${response.status}) ${detail}`)
      }

      setTaskInput('')
      setSuccess('Event added to your calendar')
      onTaskAdded?.()

    } catch (error) {

      setError(error instanceof Error ? error.message : 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="p-0">
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="text"
          value={taskInput}
          onChange={(e) => {
            setTaskInput(e.target.value)
            clearMessages()
          }}
          placeholder="Add a task and press Enter"
          disabled={loading}
          className="flex-1 rounded-md border border-slate-400/30 bg-slate-800/60 placeholder-slate-400 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !taskInput.trim()}
          className={`${(loading || !taskInput.trim()) ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500 text-white'} inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition`}
        >
          {loading ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && (
        <div className="mt-2 p-2 rounded-md border border-red-400/30 bg-red-500/10 text-red-200 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-2 p-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs">
          {success}
        </div>
      )}
    </div>
  )
}