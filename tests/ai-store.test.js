import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { useAiStore } from '@/stores/ai'
import { streamAiTask } from '@/api/ai'
import { aiHistory } from '@/utils/aiHistory'

vi.mock('@/api/ai', () => ({ streamAiTask: vi.fn() }))
vi.mock('@/utils/aiHistory', () => ({
  aiHistory: {
    load: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    clear: vi.fn(async () => {})
  }
}))
let pinia, store
beforeEach(async () => {
  vi.clearAllMocks()
  pinia = createPinia()
  setActivePinia(pinia)
  store = useAiStore()
  await store.setAccount('1')
})
afterEach(() => {
  store.stop(false)
  disposePinia(pinia)
})

it('保存最终展示结果，不保存Key或原始工具上下文；同账号恢复', async () => {
  streamAiTask.mockImplementation(async (_body, _signal, emit) => {
    emit('text', { text: '解读结果' })
    emit('usage', { input: 10, output: 20 })
    emit('done', {})
  })
  store.create('lyrics', { id: 1, type: 'track', title: '歌曲' })
  await store.send('解释这首歌')
  expect(store.active.messages.at(-1)).toMatchObject({
    state: 'done',
    content: '解读结果'
  })
  expect(aiHistory.save).toHaveBeenCalled()
  expect(JSON.stringify(aiHistory.save.mock.lastCall[0])).not.toContain(
    'apiKey'
  )
  const saved = JSON.parse(JSON.stringify(store.active))
  await store.setAccount(null)
  aiHistory.load.mockResolvedValueOnce([saved])
  await store.setAccount('1')
  store.select(saved.id)
  expect(store.active.messages.at(-1).content).toBe('解读结果')
})

it('换账号或停止后丢弃迟到片段；对话不串账号', async () => {
  let release, late
  streamAiTask.mockImplementation(async (_body, signal, emit) => {
    late = emit
    await new Promise(resolve => {
      release = resolve
    })
    expect(signal.aborted).toBe(true)
  })
  const pending = store.send('点歌')
  await vi.waitFor(() => expect(release).toBeDefined())
  await store.setAccount('2')
  late('text', { text: '旧账号内容' })
  release()
  await pending
  expect(store.conversations).toEqual([])
  expect(store.uid).toBe('2')
})

it('失败可重试，不重复用户消息；删除对话先停止任务', async () => {
  streamAiTask
    .mockRejectedValueOnce(new Error('网络失败'))
    .mockImplementationOnce(async (_body, _signal, emit) => {
      emit('text', { text: '成功' })
      emit('done', {})
    })
  await store.send('点歌')
  expect(store.active.messages.at(-1).error).toBe('网络失败')
  await store.retry()
  expect(store.active.messages).toHaveLength(2)
  expect(store.active.messages.at(-1).content).toBe('成功')
  const id = store.activeId
  await store.remove(id)
  expect(aiHistory.remove).toHaveBeenCalledWith(id, '1')
})

it('快捷入口只排队，未进入助手时不请求AI；新账号会作废入口', async () => {
  store.queue('lyrics', { type: 'track', id: 1 })
  expect(streamAiTask).not.toHaveBeenCalled()
  expect(store.pending).toMatchObject({ uid: '1', mode: 'lyrics' })
  await store.setAccount('2')
  expect(store.pending).toBeNull()
})

it('追问包含此前已核验的推荐清单，不需要保存原始工具数据', async () => {
  streamAiTask.mockImplementation(async (_body, _signal, emit) => {
    emit('recommendations', {
      title: '清单',
      tracks: [{ id: 123, name: '旧推荐' }]
    })
    emit('done', {})
  })
  await store.send('推荐一些歌')
  await store.send('避开刚才推荐过的歌')
  expect(streamAiTask.mock.lastCall[0].messages).toContainEqual({
    role: 'assistant',
    content: '\n已核验推荐：123 旧推荐'
  })
})
