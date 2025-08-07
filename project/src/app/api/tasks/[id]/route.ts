import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteCalendarEvent } from '@/lib/google/calendar-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const taskId = params.id

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // First, find and delete related time_blocks and Google Calendar events
    const { data: timeBlocks, error: fetchError } = await supabase
      .from('time_blocks')
      .select('google_event_id')
      .eq('task_id', taskId)
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('Error fetching time blocks:', fetchError)
    }

    // Delete Google Calendar events
    if (timeBlocks && timeBlocks.length > 0) {
      for (const timeBlock of timeBlocks) {
        if (timeBlock.google_event_id) {
          try {
            await deleteCalendarEvent({ eventId: timeBlock.google_event_id })
          } catch (error) {
            console.error('Error deleting Google Calendar event:', error)
            // Continue with deletion even if Google Calendar deletion fails
          }
        }
      }
    }

    // Delete time_blocks
    const { error: timeBlocksDeleteError } = await supabase
      .from('time_blocks')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', user.id)

    if (timeBlocksDeleteError) {
      console.error('Error deleting time blocks:', timeBlocksDeleteError)
      // Continue with task deletion even if time_blocks deletion fails
    }

    // Finally, delete the task
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete task' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
