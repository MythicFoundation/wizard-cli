import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ContentBlockParam, ToolUseBlock, ToolResultBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages'
import { getConfig } from '../config/settings.js'
import { MAX_TOKENS, TEMPERATURE } from '../config/constants.js'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, any>
}

export interface StreamCallbacks {
  onText: (text: string) => void
  onToolCall: (toolCall: ToolCall) => Promise<string>
  onComplete: () => void
  onError: (error: Error) => void
  onUsage?: (inputTokens: number, outputTokens: number) => void
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const cfg = getConfig()
    if (!cfg.anthropicApiKey) {
      throw new Error(
        'No API key found. Set ANTHROPIC_API_KEY env var or run: mythic config set apiKey <key>'
      )
    }
    client = new Anthropic({ apiKey: cfg.anthropicApiKey })
  }
  return client
}

export async function streamConversation(
  messages: MessageParam[],
  systemPrompt: string,
  tools: Tool[],
  callbacks: StreamCallbacks,
): Promise<MessageParam[]> {
  const cfg = getConfig()
  const anthropic = getClient()

  const updatedMessages = [...messages]

  // Track token usage across multi-turn tool-use loops
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Loop to handle multi-turn tool use
  while (true) {
    const response = await anthropic.messages.create({
      model: cfg.model,
      max_tokens: cfg.maxTokens || MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: updatedMessages,
      tools,
      stream: true,
    })

    let currentText = ''
    const toolCalls: ToolCall[] = []
    let currentToolId = ''
    let currentToolName = ''
    let currentToolInput = ''
    let stopReason: string | null = null

    for await (const event of response) {
      if (event.type === 'message_start') {
        // message_start contains input token count for this request
        if (event.message?.usage?.input_tokens) {
          totalInputTokens += event.message.usage.input_tokens
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          // Text block starting
        } else if (event.content_block.type === 'tool_use') {
          currentToolId = event.content_block.id
          currentToolName = event.content_block.name
          currentToolInput = ''
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          currentText += event.delta.text
          callbacks.onText(event.delta.text)
        } else if (event.delta.type === 'input_json_delta') {
          currentToolInput += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolId && currentToolName) {
          let parsedInput = {}
          try {
            parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {}
          } catch {
            parsedInput = { raw: currentToolInput }
          }
          toolCalls.push({
            id: currentToolId,
            name: currentToolName,
            input: parsedInput,
          })
          currentToolId = ''
          currentToolName = ''
          currentToolInput = ''
        }
      } else if (event.type === 'message_delta') {
        stopReason = event.delta.stop_reason
        // message_delta contains output token count for this request
        if ((event as any).usage?.output_tokens) {
          totalOutputTokens += (event as any).usage.output_tokens
        }
      }
    }

    // Build the assistant message content
    const assistantContent: ContentBlockParam[] = []
    if (currentText) {
      assistantContent.push({ type: 'text', text: currentText })
    }
    for (const tc of toolCalls) {
      assistantContent.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      } as ToolUseBlock)
    }

    updatedMessages.push({ role: 'assistant', content: assistantContent })

    // If there are tool calls, execute them and continue
    if (toolCalls.length > 0 && stopReason === 'tool_use') {
      const toolResults: ToolResultBlockParam[] = []

      for (const tc of toolCalls) {
        try {
          const result = await callbacks.onToolCall(tc)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            content: result,
          })
        } catch (err: any) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tc.id,
            content: `Error: ${err.message}`,
            is_error: true,
          })
        }
      }

      updatedMessages.push({ role: 'user', content: toolResults })
      // Continue the loop to get the next response
      continue
    }

    // No more tool calls — conversation turn is complete
    if (callbacks.onUsage) {
      callbacks.onUsage(totalInputTokens, totalOutputTokens)
    }
    callbacks.onComplete()
    return updatedMessages
  }
}

export function createToolDefinition(
  name: string,
  description: string,
  properties: Record<string, any>,
  required: string[] = [],
): Tool {
  return {
    name,
    description,
    input_schema: {
      type: 'object' as const,
      properties,
      required,
    },
  }
}
