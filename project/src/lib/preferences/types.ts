export interface Preferences {
  workStartHour: number
  workEndHour: number
  bufferMinutes: number
  preferMorning: boolean
  allowWeekend: boolean
  defaultDurationMin: number
  timeZone?: string
  suggestTime: boolean
}

export const defaultPreferences: Preferences = {
  workStartHour: 8,
  workEndHour: 20,
  bufferMinutes: 15,
  preferMorning: false,
  allowWeekend: true,
  defaultDurationMin: 60,
  timeZone: undefined,
  suggestTime: true,
}

export const PREFS_STORAGE_KEY = 'ai-scheduler:preferences:v1'
