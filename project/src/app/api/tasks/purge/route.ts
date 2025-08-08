import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteCalendarEvent } from '@/lib/google/calendar-server'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all time blocks to remove related Google Calendar events
    const { data: timeBlocks, error: fetchError } = await supabase
      .from('time_blocks')
      .select('google_event_id')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('Error fetching time blocks for purge:', fetchError)
    }

    if (timeBlocks && timeBlocks.length > 0) {
      for (const block of timeBlocks) {
        if (block.google_event_id) {
          try {
            await deleteCalendarEvent({ eventId: block.google_event_id })
          } catch (err) {
            console.error('Failed to delete Google Calendar event during purge:', err)
          }
        }
      }
    }

    // Delete all time blocks for this user
    const { error: tbError } = await supabase
      .from('time_blocks')
      .delete()
      .eq('user_id', user.id)

    if (tbError) {
      console.error('Failed to delete time blocks during purge:', tbError)
    }

    // Delete all tasks for this user
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)

    if (tasksError) {
      return NextResponse.json({ error: 'Failed to delete tasks' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'All tasks and AI blocks deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
