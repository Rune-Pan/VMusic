// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { runTask } from '../server/ai/runner.js'

let music, events, signal
const song = {
  id: 1,
  name: '真实歌曲',
  artists: [],
  album: {},
  duration: 180000,
  playable: false,
  permission: '无版权'
}
const call = (name, args) => ({
  type: 'toolCall',
  id: 'call-' + name,
  name,
  arguments: args
})
const response = content => ({
  role: 'assistant',
  content,
  usage: { input: 10, output: 5, totalTokens: 15 },
  stopReason: content.some(item => item.type === 'toolCall')
    ? 'toolUse'
    : 'stop'
})
const input = mode => ({
  uid: '1',
  mode,
  target: mode === 'recommend' ? null : { type: 'track', id: 1 },
  messages: [{ role: 'user', content: '请帮助我' }]
})
const config = {
  capabilities: { tools: true },
  protocol: 'chat-completions',
  model: 'test'
}
beforeEach(() => {
  events = []
  signal = new AbortController().signal
  music = {
    account: vi.fn(async () => '1'),
    search: vi.fn(async () => [song]),
    details: vi.fn(async () => [song]),
    personal: vi.fn(async () => ({ tracks: [song], missing: [] })),
    lyrics: vi.fn(async () => ({ lyric: '实际歌词' })),
    comments: vi.fn(async () => ({
      comments: [{ content: '实际评论' }],
      counts: [{ count: 20 }, { count: 20 }],
      uniqueCount: 35
    }))
  }
})
async function run(mode, answers, options = {}) {
  const complete = vi.fn()
  answers.forEach(answer => complete.mockResolvedValueOnce(response(answer)))
  const task = await runTask({
    input: input(mode),
    config,
    music,
    signal,
    emit: (event, data) => events.push({ event, data }),
    clientFactory: () => ({ complete }),
    ...options
  })
  return { task, complete }
}

it('只有思考且输出耗尽时明确失败，不把空分析当成功', async () => {
  await expect(
    run('comments', [], {
      clientFactory: () => ({
        complete: async () => ({
          ...response([{ type: 'thinking', thinking: '未完成的思考' }]),
          stopReason: 'length'
        })
      })
    })
  ).rejects.toThrow('未返回可显示的正文')
  expect(events.some(event => event.event === 'usage')).toBe(true)
})

it('只读搜索后重新核验ID、保留权限标记并显示真实卡片，不传云端UID到模型', async () => {
  const { complete } = await run('recommend', [
    [call('search_songs', { query: '通勤' })],
    [
      call('show_recommendations', {
        title: '通勤推荐',
        tracks: [{ id: 1, reason: '适合通勤' }]
      })
    ],
    [{ type: 'text', text: '已展示清单' }]
  ])
  expect(
    events.find(item => item.event === 'recommendations').data.tracks
  ).toEqual([{ ...song, reason: '适合通勤' }])
  expect(music.details).toHaveBeenCalledWith([1])
  expect(complete.mock.calls[0][0].systemPrompt).toContain('不操作播放器')
  expect(events.filter(item => item.event === 'usage').at(-1).data).toEqual({
    input: 30,
    output: 15,
    total: 45
  })
})

it('猜测ID、未知或写入工具不会被执行，错误回给模型纠正', async () => {
  const { complete } = await run('recommend', [
    [
      call('show_recommendations', {
        title: '伪造',
        tracks: [{ id: 999, reason: '猜测' }]
      }),
      call('play_song', { id: 1 })
    ],
    [{ type: 'text', text: '未能检索到' }]
  ])
  expect(events.some(item => item.event === 'recommendations')).toBe(false)
  expect(music.details).not.toHaveBeenCalled()
  expect(
    complete.mock.calls[1][0].messages
      .filter(item => item.role === 'toolResult')
      .every(item => item.isError)
  ).toBe(true)
})

it.each(['lyrics', 'comments'])(
  '纯分析无需工具能力，且只读取对应数据：%s',
  async mode => {
    const { complete } = await run(
      mode,
      [[{ type: 'text', text: '分析结果' }]],
      { config: { ...config, capabilities: { tools: false } } }
    )
    expect(complete.mock.calls[0][0].tools).toEqual([])
    expect(music[mode]).toHaveBeenCalled()
    expect(music.personal).not.toHaveBeenCalled()
    expect(music.search).not.toHaveBeenCalled()
    expect(events.find(item => item.event === 'scope').data.kind).toBe(mode)
  }
)

it('点歌在能力未通过时停止；旧账号请求也不调用模型', async () => {
  await expect(
    run('recommend', [], { config: { capabilities: { tools: false } } })
  ).rejects.toThrow('工具调用')
  music.account.mockResolvedValue('2')
  await expect(run('lyrics', [])).rejects.toThrow('账号已变化')
})

it('工具执行遵守12次上限；模型循环遵守6轮上限', async () => {
  const complete = vi.fn(async () =>
    response([call('search_songs', { query: 'test' })])
  )
  await expect(
    run('recommend', [], { clientFactory: () => ({ complete }) })
  ).rejects.toThrow('6轮')
  expect(complete).toHaveBeenCalledTimes(6)
  const excessive = vi.fn(async () =>
    response(
      Array.from({ length: 13 }, () => call('search_songs', { query: 'test' }))
    )
  )
  await expect(
    run('recommend', [], { clientFactory: () => ({ complete: excessive }) })
  ).rejects.toThrow('工具调用上限')
})

it('已取消的任务不进入模型循环', async () => {
  const controller = new AbortController()
  controller.abort()
  const complete = vi.fn()
  await expect(
    run('lyrics', [], {
      signal: controller.signal,
      clientFactory: () => ({ complete })
    })
  ).rejects.toThrow()
  expect(complete).not.toHaveBeenCalled()
})
