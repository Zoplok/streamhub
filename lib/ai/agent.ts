import type OpenAI from 'openai'
import { tools } from './tools'
import { executeTool } from './handlers'
import type { Role } from '@/types'
import { getAIModel, getOpenAI, hasOpenAIKey } from './openai'

export interface AgentResult {
  reply: string | null
  toolCalls: { name: string; args: unknown; result: unknown }[]
}

export async function runAgent(userMessage: string, userId: string, role: Role): Promise<AgentResult> {
  if (!hasOpenAIKey()) {
    return {
      reply: 'AI is not configured. Set OPENAI_API_KEY to enable assistant features.',
      toolCalls: []
    }
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        `You are StreamHub's AI assistant. The requesting user's id is ${userId} and role is ${role}. ` +
        `Use tools to answer questions about videos, recommendations, trending, tag suggestions, and moderation. ` +
        `Never invent data — only rely on tool outputs. Never perform moderator-only actions unless role is admin or moderator. ` +
        `Keep replies short and factual.`
    },
    { role: 'user', content: userMessage }
  ]

  const toolCalls: AgentResult['toolCalls'] = []
  const MAX_TURNS = 5

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await getOpenAI().chat.completions.create({
      model: getAIModel(),
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 800,
      temperature: 0.2
    })

    const choice = response.choices[0]
    const msg = choice.message
    messages.push(msg)

    if (choice.finish_reason === 'tool_calls' && msg.tool_calls?.length) {
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          args = {}
        }
        const result = await executeTool(call.function.name, args, { userId, role })
        toolCalls.push({ name: call.function.name, args, result })
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result)
        })
      }
      continue
    }

    return { reply: msg.content ?? null, toolCalls }
  }

  return { reply: 'Max tool-call turns exceeded.', toolCalls }
}
