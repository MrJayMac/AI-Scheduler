import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export type ParsedTask = {
  summary: string
  startDateTime: string
  durationMin: number
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export async function parseTaskWithAI(input: {
  text: string
  nowISO?: string
  timeZone?: string
}): Promise<ParsedTask | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const client = new OpenAI({ apiKey })
  const nowISO = input.nowISO || new Date().toISOString()

  const schema = {
    name: 'TaskEvent',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'startDateTime', 'durationMin'],
      properties: {
        summary: { type: 'string', minLength: 1 },
        startDateTime: { type: 'string', description: 'RFC3339/ISO 8601 date-time in the user time zone' },
        durationMin: { type: 'integer', minimum: 5, maximum: 1440 },
      },
    },
    strict: true,
  } as const

  const prompt: ChatCompletionMessageParam[] = [
    { role: 'system', content: 'Extract a calendar event from the user text. Use the provided now and timeZone for interpreting relative dates. Output strictly the JSON matching the schema.' },
    { role: 'user', content: JSON.stringify({ text: input.text, nowISO, timeZone: input.timeZone || 'local' }) },
  ]

  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages: prompt,
      response_format: { type: 'json_schema', json_schema: schema },
      temperature: 0.2,
    })

    const content = resp.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content) as ParsedTask

    if (!parsed.summary || !parsed.startDateTime || !parsed.durationMin) return null
    return parsed
  } catch {
    return null
  }
}
