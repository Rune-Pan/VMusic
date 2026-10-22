import http from 'node:http'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVault } from './vault.js'
import { testModel } from './provider.js'
import { createMusicReader } from './music.js'
import { runTask, validateTask } from './runner.js'

async function readBody(req) {
  if (!String(req.headers['content-type']).startsWith('application/json'))
    throw new Error('请使用 JSON 请求')
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 100000) throw new Error('请求内容过长')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('请求内容不是有效 JSON')
  }
}

export function createAiServer({
  vault,
  port = 3001,
  timeoutMs = 180000,
  clientFactory,
  musicFactory = createMusicReader,
  musicBaseUrl = 'http://127.0.0.1:3000',
  origins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173'
  ]
}) {
  let active = null
  function cancel() {
    active?.abort()
    active = null
  }
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      })
      res.end(JSON.stringify(data))
    }
    if (
      ![
        `127.0.0.1:${server.address()?.port || port}`,
        `localhost:${server.address()?.port || port}`
      ].includes(req.headers.host) ||
      (req.headers.origin && !origins.includes(req.headers.origin)) ||
      req.headers['sec-fetch-site'] === 'cross-site' ||
      req.headers['x-tingchao-ai'] !== '1'
    )
      return json(403, { error: '仅允许本机听潮页面访问 AI 服务' })
    let config = null,
      controller = null,
      timer = null,
      timedOut = false
    const emit = (event, data) => {
      if (!res.destroyed && !res.writableEnded)
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
    const path = new URL(req.url, 'http://localhost').pathname
    try {
      if (path === '/ai-api/settings' && req.method === 'GET')
        return json(200, await vault.publicSettings())
      if (path === '/ai-api/settings' && req.method === 'PUT') {
        const body = await readBody(req)
        cancel()
        await vault.save(body)
        return json(200, await vault.publicSettings())
      }
      if (path === '/ai-api/key' && req.method === 'DELETE') {
        cancel()
        await vault.deleteKey()
        return json(200, await vault.publicSettings())
      }
      if (
        !['/ai-api/test', '/ai-api/chat'].includes(path) ||
        req.method !== 'POST'
      )
        return json(404, { error: '接口不存在' })
      const input = await readBody(req)
      if (path.endsWith('/chat')) validateTask(input)
      if (active)
        return json(409, { error: '已有 AI 任务正在进行，请先停止或稍后重试' })
      controller = new AbortController()
      active = controller
      timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      res.on('close', () => controller.abort())
      config = await vault.credentials()
      if (path.endsWith('/test')) {
        const capabilities = await testModel(
          config,
          controller.signal,
          clientFactory
        )
        controller.signal.throwIfAborted()
        await vault.setCapabilities(capabilities, config.revision)
        return json(200, await vault.publicSettings())
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no'
      })
      res.flushHeaders()
      const music = musicFactory({
        baseUrl: musicBaseUrl,
        cookie: req.headers.cookie || '',
        signal: controller.signal
      })
      const result = await runTask({
        input,
        config,
        music,
        signal: controller.signal,
        emit,
        clientFactory
      })
      controller.signal.throwIfAborted()
      emit('done', result)
      res.end()
    } catch (error) {
      let message = timedOut
        ? '生成已超时，请缩短需求后重试'
        : controller?.signal.aborted
          ? '任务已停止或配置已变化'
          : error.message || 'AI 服务暂时不可用'
      if (config?.apiKey)
        message = message.split(config.apiKey).join('[已隐藏密钥]')
      message = message.slice(0, 600)
      if (res.headersSent) {
        emit('error', { message })
        res.end()
      } else if (!res.destroyed) json(400, { error: message })
    } finally {
      clearTimeout(timer)
      if (controller && active === controller) active = null
    }
  })
  server.requestTimeout = 190000
  server.on('close', cancel)
  return server
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const folder = process.env.LOCALAPPDATA
  if (!folder || process.platform !== 'win32')
    throw new Error('此本机密钥服务需要 Windows 当前用户环境')
  const port = Number(process.env.TINGCHAO_AI_PORT || 3001)
  const vault = createVault(join(folder, 'Tingchao', 'ai', 'settings.json'))
  createAiServer({ vault, port }).listen(port, '127.0.0.1', () =>
    console.log(`听潮 AI 本机服务已启动：127.0.0.1:${port}`)
  )
}
