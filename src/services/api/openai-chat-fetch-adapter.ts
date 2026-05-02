/**
 * OpenAI Chat Completions Fetch Adapter
 *
 * Intercepts fetch calls from the Anthropic SDK and routes them to any
 * OpenAI-compatible Chat Completions endpoint (/v1/chat/completions),
 * translating between Anthropic Messages API and OpenAI Chat Completions.
 *
 * Works with: Fireworks AI, Together AI, Groq, Mistral, local Ollama, etc.
 *
 * Flow:
 *   Anthropic SDK  ──fetch──►  this adapter  ──POST──►  /chat/completions
 *                  ◄─Anthropic SSE──         ◄─OpenAI SSE──
 */

// ── Types ─────────────────────────────────────────────────────────────

interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string | ContentBlock[]
  source?: { type: string; media_type: string; data: string }
}

interface AnthropicMessage {
  role: string
  content: string | ContentBlock[]
}

interface AnthropicTool {
  name: string
  description?: string
  input_schema?: Record<string, unknown>
}

// ── Message translation: Anthropic → OpenAI Chat Completions ──────────

function translateMessages(
  anthropicMessages: AnthropicMessage[],
  systemPrompt: unknown,
  stripImages: boolean,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []

  // System prompt (string or array of {type:"text", text:"..."})
  if (systemPrompt) {
    if (typeof systemPrompt === 'string') {
      out.push({ role: 'system', content: systemPrompt })
    } else if (Array.isArray(systemPrompt)) {
      const text = (systemPrompt as Array<{ type: string; text?: string }>)
        .filter(b => b.type === 'text' && b.text)
        .map(b => b.text)
        .join('\n')
      if (text) out.push({ role: 'system', content: text })
    }
  }

  for (const msg of anthropicMessages) {
    if (typeof msg.content === 'string') {
      out.push({ role: msg.role, content: msg.content })
      continue
    }
    if (!Array.isArray(msg.content)) continue

    if (msg.role === 'user') {
      // Split tool_results from regular content — they become role:"tool"
      const toolResults: ContentBlock[] = []
      const regular: ContentBlock[] = []
      for (const b of msg.content) {
        if (b.type === 'tool_result') toolResults.push(b)
        else if (b.type !== 'thinking') regular.push(b) // skip thinking
      }

      for (const tr of toolResults) {
        let text = ''
        if (typeof tr.content === 'string') {
          text = tr.content
        } else if (Array.isArray(tr.content)) {
          text = (tr.content as ContentBlock[])
            .map(c => (c.type === 'text' ? c.text || '' : '[Attached data]'))
            .join('\n')
        }
        out.push({ role: 'tool', tool_call_id: tr.tool_use_id || '', content: text || '' })
      }

      if (regular.length > 0) {
        const parts: Array<Record<string, unknown>> = []
        for (const b of regular) {
          if (b.type === 'text' && b.text) {
            parts.push({ type: 'text', text: b.text })
          } else if (b.type === 'image' && b.source) {
            if (stripImages) {
              parts.push({ type: 'text', text: '[Image stripped — model does not support vision]' })
            } else {
              const s = b.source
              if (s.type === 'base64') {
                parts.push({
                  type: 'image_url',
                  image_url: { url: `data:${s.media_type};base64,${s.data}` },
                })
              }
            }
          }
        }
        if (parts.length === 1 && parts[0].type === 'text') {
          out.push({ role: 'user', content: parts[0].text as string })
        } else if (parts.length > 0) {
          out.push({ role: 'user', content: parts })
        }
      }
    } else if (msg.role === 'assistant') {
      let text = ''
      const toolCalls: Array<Record<string, unknown>> = []
      for (const b of msg.content) {
        if (b.type === 'text' && b.text) text += b.text
        else if (b.type === 'tool_use') {
          toolCalls.push({
            id: b.id || `call_${toolCalls.length}`,
            type: 'function',
            function: { name: b.name || '', arguments: JSON.stringify(b.input || {}) },
          })
        }
        // Skip thinking blocks — OpenAI doesn't understand them
      }
      const m: Record<string, unknown> = { role: 'assistant', content: text || null }
      if (toolCalls.length > 0) m.tool_calls = toolCalls
      out.push(m)
    }
  }

  return out
}

// ── Tool translation ──────────────────────────────────────────────────

function translateTools(tools: AnthropicTool[]): Array<Record<string, unknown>> {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.input_schema || { type: 'object', properties: {} },
    },
  }))
}

// ── Full request translation ──────────────────────────────────────────

function translateRequest(
  anthropicBody: Record<string, unknown>,
  model: string,
  stripImages: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: translateMessages(
      (anthropicBody.messages as AnthropicMessage[]) || [],
      anthropicBody.system,
      stripImages,
    ),
    stream: true,
    stream_options: { include_usage: true },
  }

  if (anthropicBody.max_tokens) body.max_tokens = anthropicBody.max_tokens
  if (anthropicBody.temperature !== undefined) body.temperature = anthropicBody.temperature
  if (anthropicBody.top_p !== undefined) body.top_p = anthropicBody.top_p
  if (anthropicBody.stop_sequences) body.stop = anthropicBody.stop_sequences

  const tools = anthropicBody.tools as AnthropicTool[] | undefined
  if (tools && tools.length > 0) body.tools = translateTools(tools)

  return body
}

// ── SSE helpers ───────────────────────────────────────────────────────

function sse(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}

// ── Stream translation: OpenAI SSE → Anthropic SSE ────────────────────

async function translateStream(
  openaiResponse: Response,
  model: string,
): Promise<Response> {
  const msgId = `msg_oaic_${Date.now()}`

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      let blockIdx = 0
      let outTok = 0
      let inTok = 0

      // ── Anthropic message_start + ping ──
      controller.enqueue(enc.encode(sse('message_start', JSON.stringify({
        type: 'message_start',
        message: {
          id: msgId, type: 'message', role: 'assistant', content: [],
          model, stop_reason: null, stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }))))
      controller.enqueue(enc.encode(sse('ping', JSON.stringify({ type: 'ping' }))))

      // ── State ──
      let textOpen = false
      const toolCalls = new Map<number, { id: string; name: string; blockIdx: number }>()
      let finishReason: string | null = null

      function openText() {
        if (!textOpen) {
          textOpen = true
          controller.enqueue(enc.encode(sse('content_block_start', JSON.stringify({
            type: 'content_block_start', index: blockIdx,
            content_block: { type: 'text', text: '' },
          }))))
        }
      }

      function closeText() {
        if (textOpen) {
          controller.enqueue(enc.encode(sse('content_block_stop', JSON.stringify({
            type: 'content_block_stop', index: blockIdx,
          }))))
          blockIdx++
          textOpen = false
        }
      }

      function closeTool(tcIdx: number) {
        const tc = toolCalls.get(tcIdx)
        if (tc) {
          controller.enqueue(enc.encode(sse('content_block_stop', JSON.stringify({
            type: 'content_block_stop', index: tc.blockIdx,
          }))))
          blockIdx++
          toolCalls.delete(tcIdx)
        }
      }

      function finish() {
        closeText()
        for (const [idx] of toolCalls) closeTool(idx)

        let stop = 'end_turn'
        if (finishReason === 'tool_calls') stop = 'tool_use'
        else if (finishReason === 'length') stop = 'max_tokens'

        controller.enqueue(enc.encode(sse('message_delta', JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: stop, stop_sequence: null },
          usage: { output_tokens: outTok },
        }))))
        controller.enqueue(enc.encode(sse('message_stop', JSON.stringify({ type: 'message_stop' }))))
        controller.close()
      }

      try {
        const reader = openaiResponse.body?.getReader()
        if (!reader) {
          openText()
          controller.enqueue(enc.encode(sse('content_block_delta', JSON.stringify({
            type: 'content_block_delta', index: 0,
            delta: { type: 'text_delta', text: 'Error: empty response body' },
          }))))
          finish()
          return
        }

        const dec = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''

          for (const raw of lines) {
            const line = raw.trim()
            if (!line || line.startsWith(':')) continue
            if (!line.startsWith('data: ')) continue

            const data = line.slice(6)
            if (data === '[DONE]') { finish(); return }

            let chunk: Record<string, unknown>
            try { chunk = JSON.parse(data) } catch { continue }

            // Usage (may come in a final chunk or alongside choices)
            if (chunk.usage) {
              const u = chunk.usage as Record<string, number>
              inTok = u.prompt_tokens || inTok
              outTok = u.completion_tokens || outTok
            }

            const choices = chunk.choices as Array<Record<string, unknown>> | undefined
            if (!choices?.length) continue

            const ch = choices[0]
            const delta = ch.delta as Record<string, unknown> | undefined

            if (ch.finish_reason) finishReason = ch.finish_reason as string
            if (!delta) continue

            // ── Text content ──
            if (typeof delta.content === 'string' && delta.content) {
              openText()
              controller.enqueue(enc.encode(sse('content_block_delta', JSON.stringify({
                type: 'content_block_delta', index: blockIdx,
                delta: { type: 'text_delta', text: delta.content },
              }))))
            }

            // ── Reasoning content (DeepSeek-style) ──
            if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
              openText()
              controller.enqueue(enc.encode(sse('content_block_delta', JSON.stringify({
                type: 'content_block_delta', index: blockIdx,
                delta: { type: 'text_delta', text: delta.reasoning_content },
              }))))
            }

            // ── Tool calls ──
            const tcs = delta.tool_calls as Array<Record<string, unknown>> | undefined
            if (tcs) {
              for (const tc of tcs) {
                const idx = (tc.index as number) ?? 0
                const fn = tc.function as Record<string, unknown> | undefined
                const tcId = tc.id as string | undefined

                if (tcId && fn?.name) {
                  // New tool call — close text and previous tool calls
                  closeText()
                  for (const [prevIdx] of toolCalls) closeTool(prevIdx)

                  toolCalls.set(idx, { id: tcId, name: fn.name as string, blockIdx })
                  controller.enqueue(enc.encode(sse('content_block_start', JSON.stringify({
                    type: 'content_block_start', index: blockIdx,
                    content_block: { type: 'tool_use', id: tcId, name: fn.name, input: {} },
                  }))))

                  if (fn.arguments && typeof fn.arguments === 'string') {
                    controller.enqueue(enc.encode(sse('content_block_delta', JSON.stringify({
                      type: 'content_block_delta', index: blockIdx,
                      delta: { type: 'input_json_delta', partial_json: fn.arguments },
                    }))))
                  }
                } else if (fn?.arguments && typeof fn.arguments === 'string') {
                  // Continuing arguments for existing tool call
                  const existing = toolCalls.get(idx)
                  if (existing) {
                    controller.enqueue(enc.encode(sse('content_block_delta', JSON.stringify({
                      type: 'content_block_delta', index: existing.blockIdx,
                      delta: { type: 'input_json_delta', partial_json: fn.arguments },
                    }))))
                  }
                }
              }
            }
          }
        }

        // Stream ended without [DONE] — finish gracefully
        finish()
      } catch (err) {
        openText()
        controller.enqueue(enc.encode(sse('content_block_delta', JSON.stringify({
          type: 'content_block_delta', index: blockIdx,
          delta: { type: 'text_delta', text: `\n[Stream error: ${String(err)}]` },
        }))))
        finish()
      }
    },
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ── Main fetch interceptor ────────────────────────────────────────────

/**
 * Creates a fetch function that intercepts Anthropic SDK calls and routes
 * them to an OpenAI-compatible Chat Completions endpoint.
 *
 * @param baseUrl  - e.g. "https://api.fireworks.ai/inference/v1"
 * @param apiKey   - provider API key
 * @param options  - stripImages: remove image blocks (for non-vision models)
 */
export function createOpenAIChatFetch(
  baseUrl: string,
  apiKey: string,
  options?: { stripImages?: boolean },
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const strip = options?.stripImages ?? false

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)

    // Only intercept /v1/messages calls from the Anthropic SDK
    if (!url.includes('/v1/messages')) {
      return globalThis.fetch(input, init)
    }

    // Parse Anthropic request body
    let body: Record<string, unknown>
    try {
      const raw = init?.body instanceof ReadableStream
        ? await new Response(init.body).text()
        : typeof init?.body === 'string' ? init.body : '{}'
      body = JSON.parse(raw)
    } catch {
      body = {}
    }

    // The model comes from the Anthropic request body (set via ANTHROPIC_MODEL)
    const model = (body.model as string) || 'default'

    // Translate to OpenAI Chat Completions
    const openaiBody = translateRequest(body, model, strip)

    // POST to the actual endpoint
    const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions'
    const resp = await globalThis.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiBody),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return new Response(JSON.stringify({
        type: 'error',
        error: { type: 'api_error', message: `API error (${resp.status}): ${errText}` },
      }), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
    }

    return translateStream(resp, model)
  }
}
