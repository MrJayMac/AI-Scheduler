'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { defaultPreferences, PREFS_STORAGE_KEY } from '@/lib/preferences/types'

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

      
      
      let prefs = defaultPreferences
      try {
        const raw = localStorage.getItem(PREFS_STORAGE_KEY)
        if (raw) prefs = { ...defaultPreferences, ...JSON.parse(raw) }
      } catch {}

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: taskInput.trim(),
          preferences: prefs,
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
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={loading || !taskInput.trim()}
          className="btn btn-primary"
        >
          {loading ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && (
        <div className="alert alert-error mt-2">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mt-2">
          {success}
        </div>
      )}
    </div>
  )
}

