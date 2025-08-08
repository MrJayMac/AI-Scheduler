import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: preferences, error } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    // Return default preferences if none exist
    if (!preferences) {
      const defaultPreferences = {
        workday_start: '09:00:00',
        workday_end: '17:00:00',
        buffer_minutes: 15,
        break_duration_minutes: 30,
        lunch_break_start: '12:00:00',
        lunch_break_end: '13:00:00',
        focus_window_start: '09:00:00',
        focus_window_end: '11:00:00',
        enable_focus_window: false,
        default_task_duration_minutes: 60,
        prefer_morning: true,
        allow_weekend_scheduling: false
      }
      
      return NextResponse.json({ preferences: defaultPreferences })
    }

    return NextResponse.json({ preferences })

  } catch (error) {
    console.error('Error in preferences GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate required fields
    const requiredFields = [
      'workday_start', 'workday_end', 'buffer_minutes', 'break_duration_minutes',
      'lunch_break_start', 'lunch_break_end', 'focus_window_start', 'focus_window_end',
      'enable_focus_window', 'default_task_duration_minutes', 'prefer_morning', 'allow_weekend_scheduling'
    ]
    
    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
      }
    }

    // Ensure time fields have proper format (add seconds if missing)
    const timeFields = ['workday_start', 'workday_end', 'lunch_break_start', 'lunch_break_end', 'focus_window_start', 'focus_window_end']
    timeFields.forEach(field => {
      if (body[field] && body[field].length === 5) {
        body[field] += ':00' // Add seconds
      }
    })

    const { error } = await supabase
      .from('preferences')
      .upsert({
        user_id: user.id,
        ...body,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving preferences:', error)
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Preferences saved successfully' })

  } catch (error) {
    console.error('Error in preferences POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
