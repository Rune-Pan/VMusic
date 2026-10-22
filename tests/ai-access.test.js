// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { localAiOnly } from '../server/ai/access.js'

it.each([
  ['127.0.0.1', '127.0.0.1:5173', true],
  ['::1', 'localhost:4173', true],
  ['::ffff:127.0.0.1', '[::1]:5173', true],
  ['192.168.1.2', '127.0.0.1:5173', false],
  ['127.0.0.1', 'evil.test:5173', false],
  ['127.0.0.1', '[broken', false]
])('代理仅允许本机来源：%s %s', (address, host, allowed) => {
  const next = vi.fn(),
    res = { writeHead: vi.fn(), end: vi.fn() }
  localAiOnly(
    { socket: { remoteAddress: address }, headers: { host } },
    res,
    next
  )
  expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0)
  if (!allowed)
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object))
})
