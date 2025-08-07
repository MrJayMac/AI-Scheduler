'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TimeBlock {
  id: string
  title: string
  start_time: string
  end_time: string
  duration_min: number
  priority: 'low' | 'medium' | 'high'
  status: string
}

interface ScheduleResult {
  success: boolean
  scheduledCount: number
  unscheduledCount: number
  scheduledTasks: Array<{
    id: string
    title: string
    startTime: string
    endTime: string
    duration: number
    priority: string
  }>
  unscheduledTasks: Array<{
    id: string
    title: string
    duration: number
    priority: string
    deadline: string | null
  }>
}

export default function ScheduleView() {
  const supabase = createClient()
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lastResult, setLastResult] = useState<ScheduleResult | null>(null)

  useEffect(() => {
    fetchSchedule()
  }, [])

  const fetchSchedule = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/schedule')
      const data = await response.json()
      
      if (data.success) {
        setTimeBlocks(data.timeBlocks)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSchedule = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/schedule', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setLastResult(data)
        await fetchSchedule()
      } else {
        alert('Failed to generate schedule: ' + data.error)
      }
    } catch (error) {
      console.error('Error generating schedule:', error)
      alert('Failed to generate schedule')
    } finally {
      setGenerating(false)
    }
  }

  const clearSchedule = async () => {
    if (!confirm('Are you sure you want to clear your current schedule?')) {
      return
    }

    try {
      const response = await fetch('/api/schedule', {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setTimeBlocks([])
        setLastResult(null)
      } else {
        alert('Failed to clear schedule: ' + data.error)
      }
    } catch (error) {
      console.error('Error clearing schedule:', error)
      alert('Failed to clear schedule')
    }
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (timeString: string) => {
    return new Date(timeString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#dc3545'
      case 'medium': return '#ffc107'
      case 'low': return '#28a745'
      default: return '#6c757d'
    }
  }

  const groupByDate = (blocks: TimeBlock[]) => {
    const groups: { [date: string]: TimeBlock[] } = {}
    blocks.forEach(block => {
      const date = formatDate(block.start_time)
      if (!groups[date]) groups[date] = []
      groups[date].push(block)
    })
    return groups
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
        <p>Loading schedule...</p>
      </div>
    )
  }

  const groupedBlocks = groupByDate(timeBlocks)

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>AI Generated Schedule</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={generateSchedule}
            disabled={generating}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: generating ? '#ccc' : '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: generating ? 'not-allowed' : 'pointer'
            }}
          >
            {generating ? 'Generating...' : 'Generate Schedule'}
          </button>
          {timeBlocks.length > 0 && (
            <button 
              onClick={clearSchedule}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Schedule
            </button>
          )}
        </div>
      </div>

      {lastResult && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px', 
          marginBottom: '20px',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Last Generation Results</h4>
          <p style={{ margin: '5px 0', color: '#28a745' }}>
            ✅ {lastResult.scheduledCount} tasks scheduled successfully
          </p>
          {lastResult.unscheduledCount > 0 && (
            <p style={{ margin: '5px 0', color: '#dc3545' }}>
              ⚠️ {lastResult.unscheduledCount} tasks couldn't be scheduled
            </p>
          )}
        </div>
      )}

      {timeBlocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          <p>No scheduled tasks yet.</p>
          <p>Add some tasks and click "Generate Schedule" to get started!</p>
        </div>
      ) : (
        <div>
          {Object.entries(groupedBlocks).map(([date, blocks]) => (
            <div key={date} style={{ marginBottom: '30px' }}>
              <h4 style={{ 
                margin: '0 0 15px 0', 
                padding: '10px', 
                backgroundColor: '#e9ecef', 
                borderRadius: '4px',
                color: '#495057'
              }}>
                {date}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {blocks
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map(block => (
                    <div 
                      key={block.id}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '15px', 
                        backgroundColor: 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        borderLeft: `4px solid ${getPriorityColor(block.priority)}`
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                          {block.title}
                        </div>
                        <div style={{ color: '#6c757d', fontSize: '14px' }}>
                          {formatTime(block.start_time)} - {formatTime(block.end_time)} 
                          ({block.duration_min} min)
                        </div>
                      </div>
                      <div style={{ 
                        padding: '4px 8px', 
                        backgroundColor: getPriorityColor(block.priority),
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        textTransform: 'uppercase'
                      }}>
                        {block.priority}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
