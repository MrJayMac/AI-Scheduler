import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ParsedTask {
  title: string
  duration_min: number
  deadline: string | null
  priority: 'low' | 'medium' | 'high'
  description?: string
}

export interface TaskParseResult {
  success: boolean
  task?: ParsedTask
  error?: string
}
export async function parseTask(taskInput: string): Promise<TaskParseResult> {
  try {
    if (!taskInput.trim()) {
      return {
        success: false,
        error: 'Task input cannot be empty'
      }
    }

    const input = taskInput.toLowerCase().trim()
    let parsedTask: ParsedTask

    if (input.includes('urgent') || input.includes('asap')) {
      parsedTask = {
        title: taskInput.replace(/urgent:?\s*/i, '').replace(/asap:?\s*/i, '').trim(),
        duration_min: 60,
        deadline: getTomorrowDate(),
        priority: 'high'
      }
    } else if (input.includes('tomorrow')) {
      parsedTask = {
        title: taskInput.replace(/\s*tomorrow\s*/i, '').replace(/\s*by\s*/i, '').trim(),
        duration_min: 60,
        deadline: getTomorrowDate(),
        priority: 'medium'
      }
    } else if (input.includes('friday')) {
      const friday = new Date()
      friday.setDate(friday.getDate() + (5 - friday.getDay()))
      parsedTask = {
        title: taskInput.replace(/\s*by friday\s*/i, '').replace(/\s*friday\s*/i, '').trim(),
        duration_min: 90,
        deadline: friday.toISOString().split('T')[0],
        priority: 'medium'
      }
    } else if (input.includes('call') || input.includes('phone')) {
      parsedTask = {
        title: taskInput,
        duration_min: 30,
        deadline: null,
        priority: 'medium'
      }
    } else if (input.includes('quick') || input.includes('short')) {
      parsedTask = {
        title: taskInput.replace(/quick\s*/i, '').replace(/short\s*/i, '').trim(),
        duration_min: 30,
        deadline: null,
        priority: 'low'
      }
    } else {
      parsedTask = {
        title: taskInput,
        duration_min: 60,
        deadline: null,
        priority: 'medium'
      }
    }

    return {
      success: true,
      task: parsedTask
    }

  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse task'
    }
  }
}


export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]
}


export function getTomorrowDate(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}