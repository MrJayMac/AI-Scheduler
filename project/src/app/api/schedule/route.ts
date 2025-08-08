import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSchedule, saveScheduledTasks } from '@/lib/scheduler/scheduler'
import { getCalendarEvents, deleteCalendarEvent } from '@/lib/google/calendar-server'
import type { Task } from '@/lib/scheduler/scheduler'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const calendarEvents = await getCalendarEvents({
      timeMin: startOfWeek.toISOString(),
      timeMax: endOfWeek.toISOString()
    }) || []

    // Optional: single-task scheduling via JSON body { taskId }
    interface ScheduleBody { taskId?: string }
    let body: ScheduleBody | null = null
    try { body = await request.json() as ScheduleBody } catch { /* no body provided */ }
    const taskId: string | undefined = body?.taskId

    let tasksOverride: Task[] | undefined = undefined
    if (taskId) {
      const { data: singleTask, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', taskId)
        .eq('status', 'pending')
        .single()

      if (!taskError && singleTask) {
        tasksOverride = [singleTask]
      } else {
        // If task not found or not pending, return no-op success
        return NextResponse.json({
          success: true,
          scheduledCount: 0,
          unscheduledCount: 0,
          scheduledTasks: [],
          unscheduledTasks: []
        })
      }
    }

    const scheduleResult = await generateSchedule(user.id, calendarEvents, tasksOverride)
    
    if (!scheduleResult.success) {
      return NextResponse.json(
        { error: scheduleResult.error || 'Failed to generate schedule' },
        { status: 500 }
      )
    }

    // Save scheduled tasks if any exist
    if (scheduleResult.scheduledTasks.length > 0) {
      const saved = await saveScheduledTasks(
        user.id,
        scheduleResult.scheduledTasks,
        tasksOverride ? 'tasks' : 'all'
      )
      
      if (!saved) {
        return NextResponse.json(
          { error: 'Failed to save scheduled tasks' },
          { status: 500 }
        )
      }
    }

    // Update ALL tasks (both scheduled and unscheduled) to remove them from "Tasks to Add"
    const allTaskIds = [
      ...scheduleResult.scheduledTasks.map(st => st.task.id),
      ...scheduleResult.unscheduledTasks.map(task => task.id)
    ]
    
    if (allTaskIds.length > 0) {
      // Mark scheduled tasks as 'scheduled'
      const scheduledTaskIds = scheduleResult.scheduledTasks.map(st => st.task.id)
      if (scheduledTaskIds.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'scheduled' })
          .eq('user_id', user.id)
          .in('id', scheduledTaskIds)
      }
      
      // Mark unscheduled tasks as 'unscheduled' to remove them from "Tasks to Add"
      const unscheduledTaskIds = scheduleResult.unscheduledTasks.map(task => task.id)
      if (unscheduledTaskIds.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'unscheduled' })
          .eq('user_id', user.id)
          .in('id', unscheduledTaskIds)
      }
    }

    return NextResponse.json({
      success: true,
      scheduledCount: scheduleResult.scheduledTasks.length,
      unscheduledCount: scheduleResult.unscheduledTasks.length,
      scheduledTasks: scheduleResult.scheduledTasks.map(st => ({
        id: st.task.id,
        title: st.task.title,
        startTime: st.startTime.toISOString(),
        endTime: st.endTime.toISOString(),
        duration: st.task.duration_min,
        priority: st.task.priority
      })),
      unscheduledTasks: scheduleResult.unscheduledTasks.map(task => ({
        id: task.id,
        title: task.title,
        duration: task.duration_min,
        priority: task.priority,
        deadline: task.deadline
      }))
    })

  } catch (error) {
    console.error('Error in POST /api/schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: timeBlocks, error: dbError } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true })

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to fetch schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      timeBlocks: timeBlocks || []
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all scheduled time_blocks to find their Google Calendar event IDs
    const { data: timeBlocks, error: fetchError } = await supabase
      .from('time_blocks')
      .select('google_event_id, task_id')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')

    if (fetchError) {
      console.error('Error fetching time blocks for deletion:', fetchError)
    }

    // Delete Google Calendar events if they exist
    if (timeBlocks && timeBlocks.length > 0) {
      for (const block of timeBlocks) {
        if (block.google_event_id) {
          try {
            await deleteCalendarEvent({ eventId: block.google_event_id })
          } catch (error) {
            console.error('Failed to delete Google Calendar event:', error)
            // Continue with other deletions even if one fails
          }
        }
      }

      // Reset task status back to 'pending' for all scheduled tasks
      const taskIds = timeBlocks.map(block => block.task_id).filter(Boolean)
      if (taskIds.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'pending' })
          .eq('user_id', user.id)
          .in('id', taskIds)
      }
    }

    // Delete all time_blocks for this user
    const { error: deleteError } = await supabase
      .from('time_blocks')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to clear schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule cleared successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}