// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { createAiServer } from '../server/ai/server.js'
import http from 'node:http'

let server, url
afterEach(async () => {
  if (server)
    await new Promise(resolve => {
      server.close(resolve)
      server.closeAllConnections()
    })
  server = null
})
async function start(options = {}) {
  const vault = {
    publicSettings: vi.fn(async () => ({ configured: true })),
    credentials: vi.fn(async () => ({
      apiKey: 'fixture-secret',
      capabilities: { tools: true }
    })),
    save: vi.fn(),
    deleteKey: vi.fn(),
    setCapabilities: vi.fn()
  }
  server = createAiServer({ vault, port: 3001, ...options })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
  return vault
}
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url + '/ai-api/' + path,
      {
        method: options.method || 'GET',
        signal: options.signal,
        headers: {
          'X-Tingchao-AI': '1',
          'Content-Type': 'application/json',
          ...options.headers
        }
      },
      res => {
        let body = ''
        res.on('data', chunk => {
          body += chunk
        })
        res.on('end', () =>
          resolve({ status: res.statusCode, text: async () => body })
        )
      }
    )
    req.on('error', reject)
    req.end(options.body)
  })
}

it('仅允许本机指定来源和专用请求头，不提供CORS公开代理', async () => {
  await start()
  expect((await request('settings')).status).toBe(200)
  expect(
    (await request('settings', { headers: { origin: 'https://evil.test' } }))
      .status
  ).toBe(403)
  expect(
    (await request('settings', { headers: { host: 'evil.test' } })).status
  ).toBe(403)
  expect(
    (await request('settings', { headers: { 'X-Tingchao-AI': '' } })).status
  ).toBe(403)
})

it('错误向前端脱敏，不返回上游泄漏的Key', async () => {
  await start({
    clientFactory: () => ({
      complete: async () => {
        throw new Error('Bad token: fixture-secret')
      }
    })
  })
  const response = await request('test', { method: 'POST', body: '{}' })
  const body = await response.text()
  expect(body).not.toContain('fixture-secret')
  expect(body).toContain('已隐藏密钥')
})

it('并发连接测试受限，取消请求会传递到后台模型', async () => {
  let started = false,
    aborted = false
  await start({
    clientFactory: () => ({
      complete: async (_context, signal) => {
        started = true
        await new Promise((resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => {
              aborted = true
              reject(new Error('abort'))
            },
            { once: true }
          )
        )
      }
    })
  })
  const controller = new AbortController()
  const pending = request('test', {
    method: 'POST',
    body: '{}',
    signal: controller.signal
  }).catch(() => {})
  await vi.waitFor(() => expect(started).toBe(true))
  expect((await request('test', { method: 'POST', body: '{}' })).status).toBe(
    409
  )
  controller.abort()
  await pending
  await vi.waitFor(() => expect(aborted).toBe(true))
})

it('不完整任务和过长请求在模型调用前被拒绝', async () => {
  const factory = vi.fn()
  await start({ clientFactory: factory })
  expect(
    (
      await request('chat', {
        method: 'POST',
        body: JSON.stringify({ uid: '1', mode: 'bad', messages: [] })
      })
    ).status
  ).toBe(400)
  expect(factory).not.toHaveBeenCalled()
})

it('超时终止模型并明确反馈，释放并发名额', async () => {
  const complete = vi.fn(async (_context, signal) => {
    await new Promise((resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('aborted')), {
        once: true
      })
    )
  })
  await start({ timeoutMs: 50, clientFactory: () => ({ complete }) })
  const response = await request('test', { method: 'POST', body: '{}' })
  expect(await response.text()).toContain('生成已超时')
  await request('test', { method: 'POST', body: '{}' })
  expect(complete).toHaveBeenCalledTimes(2)
})
