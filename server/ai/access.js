// Keep the LAN-accessible music frontend from exposing the local credential service.
export function localAiOnly(req, res, next) {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
    req.socket.remoteAddress
  )
  let hostname
  try {
    hostname = new URL(`http://${req.headers.host}`).hostname
  } catch {
    hostname = ''
  }
  if (local && ['127.0.0.1', 'localhost', '[::1]'].includes(hostname))
    return next()
  res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: 'AI 功能仅限当前电脑访问' }))
}
