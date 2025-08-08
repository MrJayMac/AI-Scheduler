import { createClient } from '@/lib/supabase/server'
import { CalendarEvent } from '@/lib/google/calendar-server'

export interface Task {
  id: string
  title: string
  duration_min: number
  deadline: string | null
  priority: 'low' | 'medium' | 'high'
  status: string
}

export interface TimeWindow {
  start: Date
  end: Date
  duration: number
}

export interface ScheduledTask {
  task: Task
  startTime: Date
  endTime: Date
  scheduled: boolean
}

export interface ScheduleResult {
  success: boolean
  scheduledTasks: ScheduledTask[]
  unscheduledTasks: Task[]
  error?: string
}

const PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1
}

const WORKING_HOURS = {
  start: 9,
  end: 17
}

export async function generateSchedule(userId: string, calendarEvents: CalendarEvent[]): Promise<ScheduleResult> {
  try {
    const tasks = await getPendingTasks(userId)
    
    if (!tasks.length) {
      return {
        success: true,
        scheduledTasks: [],
        unscheduledTasks: []
      }
    }

    // Get locked time blocks to preserve them during scheduling
    const lockedBlocks = await getLockedTimeBlocks(userId)
    
    const sortedTasks = sortTasksByPriority(tasks)
    const freeWindows = findFreeTimeWindows(calendarEvents, lockedBlocks)
    const scheduledTasks = scheduleTasksInWindows(sortedTasks, freeWindows)
    
    const scheduled = scheduledTasks.filter(st => st.scheduled)
    const unscheduled = scheduledTasks.filter(st => !st.scheduled).map(st => st.task)

    return {
      success: true,
      scheduledTasks: scheduled,
      unscheduledTasks: unscheduled
    }

  } catch (error) {
    return {
      success: false,
      scheduledTasks: [],
      unscheduledTasks: [],
      error: error instanceof Error ? error.message : 'Scheduling failed'
    }
  }
}

async function getPendingTasks(userId: string): Promise<Task[]> {
  const supabase = await createClient()
  
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error('Failed to fetch tasks')
  }

  return tasks || []
}

async function getLockedTimeBlocks(userId: string): Promise<{ start: Date; end: Date }[]> {
  const supabase = await createClient()
  
  const { data: lockedBlocks, error } = await supabase
    .from('time_blocks')
    .select('start_time, end_time')
    .eq('user_id', userId)
    .eq('locked', true)
    .eq('status', 'scheduled')

  if (error) {
    console.error('Error fetching locked blocks:', error)
    return []
  }

  return (lockedBlocks || []).map(block => ({
    start: new Date(block.start_time),
    end: new Date(block.end_time)
  }))
}



function sortTasksByPriority(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    }
    if (a.deadline) return -1
    if (b.deadline) return 1
    
    return 0
  })
}

function findFreeTimeWindows(events: CalendarEvent[], lockedBlocks: { start: Date; end: Date }[] = []): TimeWindow[] {
  const windows: TimeWindow[] = []
  const now = new Date()
  const endOfWeek = new Date(now)
  endOfWeek.setDate(now.getDate() + 7)
  
  // Combine Google Calendar events and locked time blocks as busy times
  const busyTimes = [
    ...events
      .filter(event => event.start.dateTime && event.end.dateTime)
      .map(event => ({
        start: new Date(event.start.dateTime!),
        end: new Date(event.end.dateTime!)
      })),
    ...lockedBlocks
  ].sort((a, b) => a.start.getTime() - b.start.getTime())

  for (let day = 0; day < 7; day++) {
    const currentDay = new Date(now)
    currentDay.setDate(now.getDate() + day)
    
    if (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
      continue
    }
    
    const dayStart = new Date(currentDay)
    dayStart.setHours(WORKING_HOURS.start, 0, 0, 0)
    
    const dayEnd = new Date(currentDay)
    dayEnd.setHours(WORKING_HOURS.end, 0, 0, 0)
    
    const dayBusyTimes = busyTimes.filter(busy => 
      busy.start.toDateString() === currentDay.toDateString()
    )
    
    if (dayBusyTimes.length === 0) {
      const duration = dayEnd.getTime() - dayStart.getTime()
      windows.push({
        start: dayStart,
        end: dayEnd,
        duration: duration / (1000 * 60)
      })
      continue
    }
    
    let currentTime = dayStart
    
    for (const busyTime of dayBusyTimes) {
      if (currentTime < busyTime.start) {
        const duration = busyTime.start.getTime() - currentTime.getTime()
        if (duration >= 30 * 60 * 1000) {
          windows.push({
            start: new Date(currentTime),
            end: new Date(busyTime.start),
            duration: duration / (1000 * 60)
          })
        }
      }
      currentTime = new Date(Math.max(currentTime.getTime(), busyTime.end.getTime()))
    }
    
    if (currentTime < dayEnd) {
      const duration = dayEnd.getTime() - currentTime.getTime()
      if (duration >= 30 * 60 * 1000) {
        windows.push({
          start: new Date(currentTime),
          end: new Date(dayEnd),
          duration: duration / (1000 * 60)
        })
      }
    }
  }
  
  return windows.sort((a, b) => a.start.getTime() - b.start.getTime())
}

function scheduleTasksInWindows(tasks: Task[], windows: TimeWindow[]): ScheduledTask[] {
  const scheduledTasks: ScheduledTask[] = []
  const availableWindows = [...windows]
  
  for (const task of tasks) {
    let scheduled = false
    
    for (let i = 0; i < availableWindows.length; i++) {
      const window = availableWindows[i]
      
      if (window.duration >= task.duration_min) {
        const startTime = new Date(window.start)
        const endTime = new Date(startTime.getTime() + task.duration_min * 60 * 1000)
        
        if (task.deadline) {
          const deadline = new Date(task.deadline)
          deadline.setHours(23, 59, 59, 999)
          if (endTime > deadline) {
            continue
          }
        }
        
        scheduledTasks.push({
          task,
          startTime,
          endTime,
          scheduled: true
        })
        
        const remainingDuration = window.duration - task.duration_min
        if (remainingDuration >= 30) {
          availableWindows[i] = {
            start: endTime,
            end: window.end,
            duration: remainingDuration
          }
        } else {
          availableWindows.splice(i, 1)
        }
        
        scheduled = true
        break
      }
    }
    
    if (!scheduled) {
      scheduledTasks.push({
        task,
        startTime: new Date(),
        endTime: new Date(),
        scheduled: false
      })
    }
  }
  
  return scheduledTasks
}

export async function saveScheduledTasks(userId: string, scheduledTasks: ScheduledTask[]): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    // Only delete unlocked time_blocks to preserve manually edited ones
    await supabase
      .from('time_blocks')
      .delete()
      .eq('user_id', userId)
      .eq('locked', false)
    
    const scheduledTasksFiltered = scheduledTasks.filter(st => st.scheduled)
    
    if (scheduledTasksFiltered.length === 0) {
      return true
    }
    
    const timeBlocks = scheduledTasksFiltered.map(st => ({
      user_id: userId,
      task_id: st.task.id,
      title: st.task.title,
      start_time: st.startTime.toISOString(),
      end_time: st.endTime.toISOString(),
      duration_min: st.task.duration_min,
      priority: st.task.priority,
      status: 'scheduled',
      created_at: new Date().toISOString()
    }))
    
    const { error } = await supabase
      .from('time_blocks')
      .insert(timeBlocks)
    
    if (error) {
      throw error
    }
    
    return true
  } catch (error) {
    console.error('Error saving scheduled tasks:', error)
    return false
  }
}