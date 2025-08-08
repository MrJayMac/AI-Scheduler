'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Preferences {
  workday_start: string
  workday_end: string
  buffer_minutes: number
  break_duration_minutes: number
  lunch_break_start: string
  lunch_break_end: string
  focus_window_start: string
  focus_window_end: string
  enable_focus_window: boolean
  default_task_duration_minutes: number
  prefer_morning: boolean
  allow_weekend_scheduling: boolean
}

const defaultPreferences: Preferences = {
  workday_start: '09:00',
  workday_end: '17:00',
  buffer_minutes: 15,
  break_duration_minutes: 30,
  lunch_break_start: '12:00',
  lunch_break_end: '13:00',
  focus_window_start: '09:00',
  focus_window_end: '11:00',
  enable_focus_window: false,
  default_task_duration_minutes: 60,
  prefer_morning: true,
  allow_weekend_scheduling: false
}

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    loadPreferences()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    }
  }

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error)
        return
      }

      if (data) {
        setPreferences({
          workday_start: data.workday_start.slice(0, 5), // Remove seconds
          workday_end: data.workday_end.slice(0, 5),
          buffer_minutes: data.buffer_minutes,
          break_duration_minutes: data.break_duration_minutes,
          lunch_break_start: data.lunch_break_start.slice(0, 5),
          lunch_break_end: data.lunch_break_end.slice(0, 5),
          focus_window_start: data.focus_window_start.slice(0, 5),
          focus_window_end: data.focus_window_end.slice(0, 5),
          enable_focus_window: data.enable_focus_window,
          default_task_duration_minutes: data.default_task_duration_minutes,
          prefer_morning: data.prefer_morning,
          allow_weekend_scheduling: data.allow_weekend_scheduling
        })
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    setSaving(true)
    setMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }

      setMessage('Preferences saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving preferences:', error)
      setMessage('Error saving preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof Preferences, value: string | number | boolean) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Loading preferences...</h1>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
        <h1 style={{ margin: 0 }}>Scheduling Preferences</h1>
      </div>

      <div style={{ display: 'grid', gap: '30px' }}>
        {/* Workday Hours */}
        <section style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>Workday Hours</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Start Time:
              </label>
              <input
                type="time"
                value={preferences.workday_start}
                onChange={(e) => handleInputChange('workday_start', e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                End Time:
              </label>
              <input
                type="time"
                value={preferences.workday_end}
                onChange={(e) => handleInputChange('workday_end', e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </div>
        </section>

        {/* Buffer and Breaks */}
        <section style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>Buffer Times & Breaks</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Buffer Between Tasks (minutes):
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={preferences.buffer_minutes}
                onChange={(e) => handleInputChange('buffer_minutes', parseInt(e.target.value))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Break Duration (minutes):
              </label>
              <input
                type="number"
                min="15"
                max="120"
                value={preferences.break_duration_minutes}
                onChange={(e) => handleInputChange('break_duration_minutes', parseInt(e.target.value))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Lunch Break Start:
              </label>
              <input
                type="time"
                value={preferences.lunch_break_start}
                onChange={(e) => handleInputChange('lunch_break_start', e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Lunch Break End:
              </label>
              <input
                type="time"
                value={preferences.lunch_break_end}
                onChange={(e) => handleInputChange('lunch_break_end', e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </div>
        </section>

        {/* Focus Window */}
        <section style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>Focus Window</h2>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={preferences.enable_focus_window}
                onChange={(e) => handleInputChange('enable_focus_window', e.target.checked)}
              />
              <span style={{ fontWeight: 'bold' }}>Enable Focus Window (no meetings during this time)</span>
            </label>
          </div>
          {preferences.enable_focus_window && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Focus Start:
                </label>
                <input
                  type="time"
                  value={preferences.focus_window_start}
                  onChange={(e) => handleInputChange('focus_window_start', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Focus End:
                </label>
                <input
                  type="time"
                  value={preferences.focus_window_end}
                  onChange={(e) => handleInputChange('focus_window_end', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Task Defaults */}
        <section style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>Task Defaults</h2>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Task Duration (minutes):
            </label>
            <input
              type="number"
              min="15"
              max="480"
              step="15"
              value={preferences.default_task_duration_minutes}
              onChange={(e) => handleInputChange('default_task_duration_minutes', parseInt(e.target.value))}
              style={{ width: '200px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
        </section>

        {/* Scheduling Preferences */}
        <section style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>Scheduling Preferences</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={preferences.prefer_morning}
                onChange={(e) => handleInputChange('prefer_morning', e.target.checked)}
              />
              <span>Prefer morning scheduling when possible</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={preferences.allow_weekend_scheduling}
                onChange={(e) => handleInputChange('allow_weekend_scheduling', e.target.checked)}
              />
              <span>Allow weekend scheduling</span>
            </label>
          </div>
        </section>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button
          onClick={savePreferences}
          disabled={saving}
          style={{
            padding: '12px 30px',
            backgroundColor: saving ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        
        {message && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: message.includes('Error') ? '#f8d7da' : '#d4edda',
            color: message.includes('Error') ? '#721c24' : '#155724',
            borderRadius: '4px'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
