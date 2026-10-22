// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { streamAiTask, getAiSettings } from '@/api/ai'

afterEach(() => vi.unstubAllGlobals())

it('逐块解析SSE，包含分开的中文UTF-8字符，直至明确完成', async () => {
  const bytes = new TextEncoder().encode(
    'event: text\ndata: {"text":"听潮"}\n\nevent: done\ndata: {}\n\n'
  )
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i++)
        controller.enqueue(bytes.slice(i, i + 1))
      controller.close()
    }
  })
  const fetcher = vi.fn(
    async () =>
      new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
  )
  vi.stubGlobal('fetch', fetcher)
  const onEvent = vi.fn()
  await streamAiTask({ mode: 'lyrics' }, new AbortController().signal, onEvent)
  expect(onEvent).toHaveBeenCalledWith('text', { text: '听潮' })
  expect(fetcher.mock.lastCall[1].headers['X-Tingchao-AI']).toBe('1')
})

it.each([
  'event: text\ndata: {"text":"不完整回答"}\n\n',
  'event: error\ndata: {"message":"额度不足"}\n\n'
])('没有完成或业务失败不伪报成功', async data => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(data, { headers: { 'content-type': 'text/event-stream' } })
    )
  )
  await expect(
    streamAiTask({}, new AbortController().signal, vi.fn())
  ).rejects.toThrow()
})

it('本机服务未启动给出可恢复说明', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Network error')
    })
  )
  await expect(getAiSettings()).rejects.toThrow('无法连接本机 AI 服务')
})
