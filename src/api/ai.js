async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch('/ai-api/' + path, {
      method,
      credentials: 'same-origin',
      signal,
      headers: {
        'X-Tingchao-AI': '1',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('无法连接本机 AI 服务，请运行 npm run ai 或使用启动脚本', {
      cause: error
    })
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'AI 服务暂时不可用')
  }
  return response
}

export const getAiSettings = signal =>
  request('settings', { signal }).then(response => response.json())
export const saveAiSettings = (body, signal) =>
  request('settings', { method: 'PUT', body, signal }).then(response =>
    response.json()
  )
export const deleteAiKey = signal =>
  request('key', { method: 'DELETE', signal }).then(response => response.json())
export const testAiConnection = signal =>
  request('test', { method: 'POST', body: {}, signal }).then(response =>
    response.json()
  )

export async function streamAiTask(body, signal, onEvent) {
  const response = await request('chat', { method: 'POST', body, signal })
  if (
    !response.headers.get('content-type')?.includes('text/event-stream') ||
    !response.body
  )
    throw new Error('AI 服务没有返回有效的流式响应')
  const reader = response.body.getReader(),
    decoder = new TextDecoder()
  let buffer = '',
    finished = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (signal.aborted) throw new Error('已停止生成')
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      if (buffer.length > 200000) throw new Error('AI 响应超出限制')
      let end
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const event = frame
          .split('\n')
          .find(line => line.startsWith('event:'))
          ?.slice(6)
          .trim()
        const payload = frame
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n')
        if (!event || !payload) continue
        const data = JSON.parse(payload)
        if (event === 'error') throw new Error(data.message || 'AI 分析失败')
        if (event === 'done') finished = true
        onEvent(event, data)
      }
    }
    if (!finished) throw new Error('生成中断，请重试；已显示的内容可能不完整')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
