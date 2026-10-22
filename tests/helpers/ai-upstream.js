import http from 'node:http'

export async function mockAiUpstream(reply) {
  const requests = []
  const server = http.createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = JSON.parse(raw || '{}')
    requests.push({
      path: req.url,
      body,
      authorization: req.headers.authorization
    })
    const answer = await reply(body, req.url)
    if (answer.delay)
      await new Promise(resolve => setTimeout(resolve, answer.delay))
    if (res.destroyed) return
    if (answer.status) {
      res.writeHead(answer.status, { 'Content-Type': 'application/json' })
      return res.end(
        JSON.stringify({ error: { message: answer.error || '测试错误' } })
      )
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    if (req.url.endsWith('/responses')) {
      const item = answer.call
        ? {
            type: 'function_call',
            id: 'fc_1',
            call_id: 'call_1',
            name: answer.call.name,
            arguments: JSON.stringify(answer.call.arguments),
            status: 'completed'
          }
        : {
            type: 'message',
            id: 'msg_1',
            role: 'assistant',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: answer.text || '连接正常',
                annotations: []
              }
            ]
          }
      const response = {
        id: 'resp_1',
        object: 'response',
        model: body.model,
        status: 'completed',
        output: [item],
        usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13 }
      }
      const event = data =>
        res.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`)
      event({
        type: 'response.created',
        response: {
          ...response,
          status: 'in_progress',
          output: [],
          usage: null
        }
      })
      event({
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          ...item,
          status: 'in_progress',
          arguments: answer.call ? '' : undefined,
          content: answer.call ? undefined : []
        }
      })
      if (answer.call) {
        event({
          type: 'response.function_call_arguments.delta',
          item_id: item.id,
          output_index: 0,
          delta: item.arguments
        })
        event({
          type: 'response.function_call_arguments.done',
          item_id: item.id,
          output_index: 0,
          arguments: item.arguments
        })
      } else {
        event({
          type: 'response.content_part.added',
          item_id: item.id,
          output_index: 0,
          content_index: 0,
          part: { type: 'output_text', text: '', annotations: [] }
        })
        event({
          type: 'response.output_text.delta',
          item_id: item.id,
          output_index: 0,
          content_index: 0,
          delta: item.content[0].text
        })
        event({
          type: 'response.output_text.done',
          item_id: item.id,
          output_index: 0,
          content_index: 0,
          text: item.content[0].text
        })
      }
      event({ type: 'response.output_item.done', output_index: 0, item })
      event({ type: 'response.completed', response })
    } else {
      const chunk = (delta, finish_reason = null, usage) =>
        res.write(
          `data: ${JSON.stringify({ id: 'chat_1', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta, finish_reason }], ...(usage ? { usage } : {}) })}\n\n`
        )
      if (answer.call)
        chunk({
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: {
                name: answer.call.name,
                arguments: JSON.stringify(answer.call.arguments)
              }
            }
          ]
        })
      else chunk({ role: 'assistant', content: answer.text || '连接正常' })
      chunk({}, answer.call ? 'tool_calls' : 'stop', {
        prompt_tokens: 10,
        completion_tokens: 3,
        total_tokens: 13
      })
      res.write('data: [DONE]\n\n')
    }
    res.end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    requests,
    close: () =>
      new Promise(resolve => {
        server.close(resolve)
        server.closeAllConnections()
      })
  }
}
