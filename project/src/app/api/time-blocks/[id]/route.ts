import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateCalendarEvent } from '@/lib/google/calendar-server'

export async function PATCH(
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

    const timeBlockId = params.id
    const { start_time, end_time, duration_min } = await request.json()

    if (!timeBlockId || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the existing time block to check ownership and get Google event ID
    const { data: existingBlock, error: fetchError } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('id', timeBlockId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingBlock) {
      return NextResponse.json(
        { error: 'Time block not found' },
        { status: 404 }
      )
    }

    // Update the time block in database and mark as locked
    const { data: updatedBlock, error: updateError } = await supabase
      .from('time_blocks')
      .update({
        start_time,
        end_time,
        duration_min,
        locked: true, // Mark as locked when manually edited
        updated_at: new Date().toISOString()
      })
      .eq('id', timeBlockId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update time block' },
        { status: 500 }
      )
    }

    // Update corresponding Google Calendar event if it exists
    if (existingBlock.google_event_id) {
      try {
        await updateCalendarEvent(existingBlock.google_event_id, {
          summary: `AI: ${existingBlock.title}`,
          description: `Priority: ${existingBlock.priority} (Manually Edited)`,
          start: {
            dateTime: start_time,
            timeZone: 'America/New_York'
          },
          end: {
            dateTime: end_time,
            timeZone: 'America/New_York'
          }
        })
      } catch (error) {
        console.error('Failed to update Google Calendar event:', error)
        // Continue even if Google Calendar update fails
      }
    }

    return NextResponse.json({
      success: true,
      timeBlock: updatedBlock
    })

  } catch (error) {
    console.error('Error updating time block:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
