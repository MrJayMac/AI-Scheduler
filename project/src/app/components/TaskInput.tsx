'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TaskInput() {
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

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskInput: taskInput.trim()
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create task')
      }

      setSuccess(`Task created: "${result.task.title}"`)
      setTaskInput('')
      
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
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
      <h3>Add New Task</h3>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            value={taskInput}
            onChange={(e) => {
              setTaskInput(e.target.value)
              clearMessages()
            }}
            placeholder="Add task... (e.g., 'Finish presentation by Friday', 'Call John tomorrow')"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <button 
          type="submit"
          disabled={loading || !taskInput.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: loading || !taskInput.trim() ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !taskInput.trim() ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Creating Task...' : 'Add Task'}
        </button>
      </form>

      {error && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '4px'
        }}>
          {success}
        </div>
      )}

      <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
        <p><strong>Examples:</strong></p>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>"Finish the presentation by Friday"</li>
          <li>"Quick call with John tomorrow"</li>
          <li>"URGENT: Review contract by end of week"</li>
          <li>"Schedule dentist appointment"</li>
        </ul>
      </div>
    </div>
  )
}