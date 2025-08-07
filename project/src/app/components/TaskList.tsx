'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Task {
  id: string
  title: string
  duration_min: number
  deadline: string | null
  priority: 'low' | 'medium' | 'high'
  status: string
  created_at: string
}

interface TaskListProps {
  refreshTrigger?: number
}

export default function TaskList({ refreshTrigger }: TaskListProps) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    fetchTasks()
  }, [refreshTrigger])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.error('User not authenticated')
        return
      }

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tasks:', error)
        return
      }

      setTasks(tasks || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }



  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#dc3545'
      case 'medium': return '#ffc107'
      case 'low': return '#28a745'
      default: return '#6c757d'
    }
  }

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return 'No deadline'
    
    const date = new Date(deadline)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
        <h3>Pending Tasks</h3>
        <p>Loading tasks...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3>Tasks to Add</h3>
        <button 
          onClick={fetchTasks}
          style={{ 
            padding: '6px 12px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Refresh
        </button>
      </div>
      
      {tasks.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          No tasks to add. Add some tasks above to get started!
        </p>
      ) : (
        <div>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} ready to add to schedule
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.map((task) => (
              <div 
                key={task.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '15px', 
                  backgroundColor: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  borderLeft: `4px solid ${getPriorityColor(task.priority)}`
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {task.title}
                  </div>
                  <div style={{ color: '#6c757d', fontSize: '14px', display: 'flex', gap: '15px' }}>
                    <span>{task.duration_min} min</span>
                    <span>{formatDeadline(task.deadline)}</span>
                    <span style={{ 
                      color: getPriorityColor(task.priority),
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
