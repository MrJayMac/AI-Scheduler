import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSchedule, saveScheduledTasks } from '@/lib/scheduler/scheduler'
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar-server'

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

    // Get this week's calendar events
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

    const scheduleResult = await generateSchedule(user.id, calendarEvents)
    
    if (!scheduleResult.success) {
      return NextResponse.json(
        { error: scheduleResult.error || 'Failed to generate schedule' },
        { status: 500 }
      )
    }

    if (scheduleResult.scheduledTasks.length > 0) {
      const saved = await saveScheduledTasks(user.id, scheduleResult.scheduledTasks)
      
      if (!saved) {
        return NextResponse.json(
          { error: 'Failed to save scheduled tasks' },
          { status: 500 }
        )
      }

      // Create Google Calendar events and update time_blocks with google_event_id
      const scheduledTaskIds: string[] = []
      for (const st of scheduleResult.scheduledTasks) {
        try {
          const googleEvent = await createCalendarEvent({
            summary: st.task.title,
            description: `Priority: ${st.task.priority}\nDuration: ${st.task.duration_min} minutes`,
            start: {
              dateTime: st.startTime.toISOString(),
              timeZone: 'America/New_York'
            },
            end: {
              dateTime: st.endTime.toISOString(),
              timeZone: 'America/New_York'
            }
          })

          if (googleEvent) {
            // Update the time_block with the Google event ID
            await supabase
              .from('time_blocks')
              .update({ google_event_id: googleEvent.id })
              .eq('user_id', user.id)
              .eq('task_id', st.task.id)
              .eq('start_time', st.startTime.toISOString())
            
            // Track successfully scheduled tasks
            scheduledTaskIds.push(st.task.id)
          }
        } catch (error) {
          console.error('Failed to create Google Calendar event:', error)
          // Continue with other events even if one fails
        }
      }

      // Mark successfully scheduled tasks as 'scheduled' status
      if (scheduledTaskIds.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'scheduled' })
          .eq('user_id', user.id)
          .in('id', scheduledTaskIds)
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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

export async function DELETE(request: NextRequest) {
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
            await deleteCalendarEvent(block.google_event_id)
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