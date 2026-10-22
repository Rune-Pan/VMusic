import {
  createModels,
  createProvider,
  Type,
  validateToolCall
} from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'

export { Type, validateToolCall }

export function createModelClient(config) {
  const api =
    config.protocol === 'responses' ? 'openai-responses' : 'openai-completions'
  const model = {
    id: config.model,
    name: config.model,
    provider: 'tingchao-custom',
    api,
    baseUrl: config.baseUrl,
    reasoning: false,
    input: ['text'],
    contextWindow: 32768,
    maxTokens: 2048,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      maxTokensField: 'max_tokens'
    }
  }
  const models = createModels()
  models.setProvider(
    createProvider({
      id: model.provider,
      auth: {
        apiKey: { name: '听潮自定义接口', resolve: async () => ({ auth: {} }) }
      },
      models: [model],
      api:
        api === 'openai-responses'
          ? openAIResponsesApi()
          : openAICompletionsApi()
    })
  )
  return {
    async complete(context, signal, onText = () => {}) {
      const stream = models.streamSimple(model, context, {
        apiKey: config.apiKey,
        signal,
        maxTokens: 2048,
        maxRetries: 0,
        // DeepSeek defaults to thinking, which can consume the entire answer budget.
        ...(config.protocol === 'chat-completions' &&
        new URL(config.baseUrl).hostname === 'api.deepseek.com'
          ? {
              onPayload: payload => ({
                ...payload,
                thinking: { type: 'disabled' }
              })
            }
          : {}),
        fetch: (input, init) => fetch(input, { ...init, redirect: 'error' })
      })
      for await (const event of stream) {
        if (event.type === 'text_delta') onText(event.delta)
      }
      const message = await stream.result()
      if (signal.aborted || message.stopReason === 'aborted')
        throw new Error('已停止生成')
      if (message.stopReason === 'error')
        throw new Error(message.errorMessage || '模型请求失败')
      return message
    }
  }
}

export async function testModel(
  config,
  signal,
  clientFactory = createModelClient
) {
  const client = clientFactory(config)
  const tools = [
    {
      name: 'connection_probe',
      description: '测试工具调用，请调用一次。',
      parameters: Type.Object({ ok: Type.Literal(true) })
    }
  ]
  const textMessage = await client.complete(
    {
      messages: [
        { role: 'user', content: '请只回复连接正常。', timestamp: Date.now() }
      ]
    },
    signal
  )
  if (
    !textMessage.content.some(
      block => block.type === 'text' && block.text.trim()
    )
  )
    throw new Error(
      '模型未返回可显示的正文，请关闭模型思考模式或更换模型后重试'
    )
  try {
    const message = await client.complete(
      {
        messages: [
          {
            role: 'user',
            content:
              '请调用 connection_probe 工具，参数 ok=true；不要用文字代替工具调用。',
            timestamp: Date.now()
          }
        ],
        tools
      },
      signal
    )
    const call = message.content.find(block => block.type === 'toolCall')
    if (!call) return { text: true, tools: false }
    validateToolCall(tools, call)
    return { text: true, tools: true }
  } catch (error) {
    if (signal.aborted) throw error
    return { text: true, tools: false }
  }
}
