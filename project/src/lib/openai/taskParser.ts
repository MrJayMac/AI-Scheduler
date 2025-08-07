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
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      }
    }

    if (!taskInput.trim()) {
      return {
        success: false,
        error: 'Task input cannot be empty'
      }
    }

    const prompt = `
You are a task parsing assistant. Parse the following natural language task input into structured data.

Task input: "${taskInput}"

Extract the following information:
1. title: A clear, concise task title (required)
2. duration_min: Estimated duration in minutes (default: 60 if not specified)
3. deadline: Deadline as ISO date string (YYYY-MM-DD) or null if not specified
4. priority: 'low', 'medium', or 'high' (default: 'medium' if not specified)
5. description: Any additional context or details (optional)

Rules:
- If no specific time is mentioned, assume 1 hour (60 minutes)
- If deadline mentions "today", use today's date
- If deadline mentions "tomorrow", use tomorrow's date
- If deadline mentions a day of the week, use the next occurrence of that day
- If deadline mentions "next week", "next month", estimate appropriately
- Priority should be inferred from urgency words like "urgent", "ASAP", "important", etc.
- Keep the title concise and actionable

Respond with ONLY a valid JSON object in this exact format:
{
  "title": "string",
  "duration_min": number,
  "deadline": "YYYY-MM-DD" | null,
  "priority": "low" | "medium" | "high",
  "description": "string" | null
}

Examples:
- "Finish the presentation by Friday" → {"title": "Finish the presentation", "duration_min": 120, "deadline": "2025-01-10", "priority": "medium", "description": null}
- "Quick call with John" → {"title": "Call with John", "duration_min": 30, "deadline": null, "priority": "medium", "description": null}
- "URGENT: Review contract by tomorrow" → {"title": "Review contract", "duration_min": 60, "deadline": "2025-01-08", "priority": "high", "description": null}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that parses natural language tasks into structured JSON data. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      return {
        success: false,
        error: 'No response from OpenAI'
      }
    }


    let parsedTask: ParsedTask
    try {
      parsedTask = JSON.parse(response.trim())
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response)
      return {
        success: false,
        error: 'Invalid response format from AI'
      }
    }


    if (!parsedTask.title || typeof parsedTask.title !== 'string') {
      return {
        success: false,
        error: 'Invalid task title'
      }
    }

    if (!parsedTask.duration_min || typeof parsedTask.duration_min !== 'number') {
      parsedTask.duration_min = 60
    }

    if (!['low', 'medium', 'high'].includes(parsedTask.priority)) {
      parsedTask.priority = 'medium'
    }


    if (parsedTask.deadline) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(parsedTask.deadline)) {
        console.warn('Invalid deadline format, setting to null:', parsedTask.deadline)
        parsedTask.deadline = null
      }
    }

    return {
      success: true,
      task: parsedTask
    }

  } catch (error) {
    console.error('Error parsing task with OpenAI:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
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