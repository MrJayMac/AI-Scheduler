import { createClient } from '@/lib/supabase/server'

export interface UserPreferences {
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

const defaultPreferences: UserPreferences = {
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

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const supabase = await createClient()
    
    const { data: preferences, error } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences:', error)
      return defaultPreferences
    }

    if (!preferences) {
      return defaultPreferences
    }

    return {
      workday_start: preferences.workday_start,
      workday_end: preferences.workday_end,
      buffer_minutes: preferences.buffer_minutes,
      break_duration_minutes: preferences.break_duration_minutes,
      lunch_break_start: preferences.lunch_break_start,
      lunch_break_end: preferences.lunch_break_end,
      focus_window_start: preferences.focus_window_start,
      focus_window_end: preferences.focus_window_end,
      enable_focus_window: preferences.enable_focus_window,
      default_task_duration_minutes: preferences.default_task_duration_minutes,
      prefer_morning: preferences.prefer_morning,
      allow_weekend_scheduling: preferences.allow_weekend_scheduling
    }

  } catch (error) {
    console.error('Error getting user preferences:', error)
    return defaultPreferences
  }
}

export function isWithinWorkingHours(date: Date, preferences: UserPreferences): boolean {
  const timeStr = date.toTimeString().slice(0, 8) // HH:MM:SS format
  return timeStr >= preferences.workday_start && timeStr <= preferences.workday_end
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday = 0, Saturday = 6
}

export function isWithinFocusWindow(date: Date, preferences: UserPreferences): boolean {
  if (!preferences.enable_focus_window) return false
  
  const timeStr = date.toTimeString().slice(0, 8)
  return timeStr >= preferences.focus_window_start && timeStr <= preferences.focus_window_end
}

export function isWithinLunchBreak(date: Date, preferences: UserPreferences): boolean {
  const timeStr = date.toTimeString().slice(0, 8)
  return timeStr >= preferences.lunch_break_start && timeStr <= preferences.lunch_break_end
}

export function getWorkdayStart(date: Date, preferences: UserPreferences): Date {
  const [hours, minutes] = preferences.workday_start.split(':').map(Number)
  const workdayStart = new Date(date)
  workdayStart.setHours(hours, minutes, 0, 0)
  return workdayStart
}

export function getWorkdayEnd(date: Date, preferences: UserPreferences): Date {
  const [hours, minutes] = preferences.workday_end.split(':').map(Number)
  const workdayEnd = new Date(date)
  workdayEnd.setHours(hours, minutes, 0, 0)
  return workdayEnd
}
