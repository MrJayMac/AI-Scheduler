import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSchedule, saveScheduledTasks, ScheduleResult } from '@/lib/scheduler/scheduler'

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

    const scheduleResult = await generateSchedule(user.id)
    
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