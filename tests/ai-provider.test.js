// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { createModelClient, testModel } from '../server/ai/provider.js'
import { mockAiUpstream } from './helpers/ai-upstream.js'

let upstream
afterEach(async () => {
  vi.restoreAllMocks()
  await upstream?.close()
  upstream = null
})

it.each(['chat-completions', 'responses'])(
  'Pi真实适配器处理流式文本和工具能力探测：%s',
  async protocol => {
    upstream = await mockAiUpstream(body =>
      body.tools?.length
        ? { call: { name: 'connection_probe', arguments: { ok: true } } }
        : { text: '你好，听潮' }
    )
    const config = {
      protocol,
      model: 'test-model',
      apiKey: 'test-key-fixture',
      baseUrl: upstream.baseUrl
    }
    const signal = new AbortController().signal
    const chunks = []
    const message = await createModelClient(config).complete(
      { messages: [{ role: 'user', content: '你好', timestamp: Date.now() }] },
      signal,
      text => chunks.push(text)
    )
    expect(chunks.join('')).toBe('你好，听潮')
    expect(message.usage.input).toBe(10)
    expect(message.usage.output).toBe(3)
    expect(await testModel(config, signal)).toEqual({ text: true, tools: true })
    expect(
      upstream.requests.every(
        request => request.authorization === 'Bearer test-key-fixture'
      )
    ).toBe(true)
    expect(upstream.requests[0].body.stream).toBe(true)
    expect(upstream.requests[0].body.thinking).toBeUndefined()
    expect(
      upstream.requests[0].body[
        protocol === 'responses' ? 'max_output_tokens' : 'max_tokens'
      ]
    ).toBe(2048)
    expect(upstream.requests[0].path).toBe(
      protocol === 'responses' ? '/v1/responses' : '/v1/chat/completions'
    )
  }
)

it('官方DeepSeek的Chat Completions关闭默认思考，保留2048输出上限', async () => {
  upstream = await mockAiUpstream(() => ({ text: '已生成总结正文' }))
  const originalFetch = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
    originalFetch(upstream.baseUrl + '/chat/completions', init)
  )
  const answer = await createModelClient({
    protocol: 'chat-completions',
    model: 'deepseek-flash',
    apiKey: 'fixture',
    baseUrl: 'https://api.deepseek.com'
  }).complete(
    { messages: [{ role: 'user', content: '总结', timestamp: Date.now() }] },
    new AbortController().signal
  )
  expect(answer.content).toContainEqual(
    expect.objectContaining({ type: 'text', text: '已生成总结正文' })
  )
  expect(upstream.requests[0].body).toMatchObject({
    thinking: { type: 'disabled' },
    max_tokens: 2048
  })
})

it('连接测试不把只有思考但没有正文的响应视为文本可用', async () => {
  await expect(
    testModel({}, new AbortController().signal, () => ({
      complete: async () => ({
        content: [{ type: 'thinking', thinking: '未完成' }]
      })
    }))
  ).rejects.toThrow('未返回可显示的正文')
})

it('文本可用但没有真实工具调用时不误报点歌可用', async () => {
  upstream = await mockAiUpstream(() => ({ text: '我会调用工具' }))
  expect(
    await testModel(
      {
        protocol: 'chat-completions',
        model: 'test-model',
        apiKey: 'fixture',
        baseUrl: upstream.baseUrl
      },
      new AbortController().signal
    )
  ).toEqual({ text: true, tools: false })
})

it.each([401, 429, 500])(
  '真实适配器正确传递HTTP失败，不无限重试：%s',
  async status => {
    upstream = await mockAiUpstream(() => ({ status, error: '模型测试失败' }))
    await expect(
      createModelClient({
        protocol: 'chat-completions',
        model: 'test-model',
        apiKey: 'fixture',
        baseUrl: upstream.baseUrl
      }).complete(
        {
          messages: [{ role: 'user', content: '你好', timestamp: Date.now() }]
        },
        new AbortController().signal
      )
    ).rejects.toThrow('模型测试失败')
    expect(upstream.requests).toHaveLength(1)
  }
)
