import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseTask } from '@/lib/openai/taskParser'

export async function POST(request: NextRequest) {
  try {
    const { taskInput } = await request.json()

    if (!taskInput || typeof taskInput !== 'string') {
      return NextResponse.json(
        { error: 'Task input is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const parseResult = await parseTask(taskInput)
    
    if (!parseResult.success || !parseResult.task) {
      return NextResponse.json(
        { error: parseResult.error || 'Failed to parse task' },
        { status: 400 }
      )
    }

    const { task } = parseResult
    
    const { data: savedTask, error: dbError } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: task.title,
        duration_min: task.duration_min,
        deadline: task.deadline,
        priority: task.priority,
        description: task.description || null,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save task to database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      task: savedTask
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}