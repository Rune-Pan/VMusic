import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { streamAiTask } from '@/api/ai'
import { aiHistory } from '@/utils/aiHistory'

export const useAiStore = defineStore('ai', () => {
  const uid = ref(null),
    conversations = ref([]),
    activeId = ref(null)
  const busy = ref(false),
    status = ref(''),
    storageError = ref('')
  const pending = ref(null)
  const active = computed(() =>
    conversations.value.find(item => item.id === activeId.value)
  )
  let generation = 0,
    accountGeneration = 0,
    controller = null
  async function persist(item) {
    if (!item) return
    try {
      await aiHistory.save(item)
    } catch {
      storageError.value = '对话暂时无法保存到本机，当前页面仍可查看。'
    }
  }
  function stop(save = true) {
    generation++
    controller?.abort()
    controller = null
    if (busy.value && active.value) {
      const message = active.value.messages.at(-1)
      if (message?.role === 'assistant') message.state = 'stopped'
      if (save) persist(active.value)
    }
    busy.value = false
    status.value = ''
  }
  async function setAccount(value) {
    const next = value == null ? null : String(value)
    if (uid.value === next) return
    stop()
    const token = ++accountGeneration
    uid.value = next
    activeId.value = null
    conversations.value = []
    storageError.value = ''
    pending.value = null
    if (!next) return
    try {
      const records = await aiHistory.load(next)
      if (token !== accountGeneration) return
      const restored = records.map(record => ({
        ...record,
        messages: record.messages.map(message => ({
          ...message,
          state: message.state === 'loading' ? 'stopped' : message.state
        }))
      }))
      conversations.value = [
        ...conversations.value,
        ...restored.filter(
          record =>
            !conversations.value.some(current => current.id === record.id)
        )
      ]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20)
    } catch {
      if (token === accountGeneration)
        storageError.value = '本机对话记录暂时无法读取，可开始新对话。'
    }
  }
  function create(mode = 'recommend', target = null) {
    stop()
    const item = {
      id: crypto.randomUUID(),
      uid: uid.value,
      mode,
      target,
      title:
        mode === 'lyrics'
          ? '歌词解读'
          : mode === 'comments'
            ? '评论总结'
            : '音乐推荐',
      messages: [],
      updatedAt: Date.now()
    }
    conversations.value.unshift(item)
    conversations.value = conversations.value.slice(0, 20)
    activeId.value = item.id
    return active.value
  }
  function select(id) {
    stop()
    activeId.value = id
  }
  function queue(mode, target) {
    pending.value = { uid: uid.value, mode, target }
  }
  function takePending() {
    const value = pending.value
    pending.value = null
    return value
  }
  async function remove(id) {
    if (activeId.value === id) {
      stop(false)
      activeId.value = null
    }
    conversations.value = conversations.value.filter(item => item.id !== id)
    await aiHistory.remove(id, uid.value)
  }
  async function clear() {
    stop(false)
    const account = uid.value
    conversations.value = []
    activeId.value = null
    await aiHistory.clear(account)
  }
  async function send(content) {
    if (busy.value || !uid.value || !content.trim()) return
    const item = active.value || create()
    const prompt = content.trim().slice(0, 4000)
    const context = item.messages
      .filter(
        message =>
          (message.content || message.recommendations?.tracks?.length) &&
          message.state !== 'error' &&
          message.state !== 'stopped'
      )
      .map(({ role, content, recommendations }) => ({
        role,
        content: [
          (content || '').slice(0, 8000),
          ...(recommendations?.tracks || [])
            .slice(0, 20)
            .map(
              track =>
                `已核验推荐：${track.id} ${String(track.name).slice(0, 80)}`
            )
        ].join('\n')
      }))
      .slice(-38)
    while (
      context.reduce((sum, message) => sum + message.content.length, 0) > 16000
    )
      context.shift()
    context.push({ role: 'user', content: prompt })
    item.messages.push(
      { role: 'user', content: prompt },
      {
        role: 'assistant',
        content: '',
        state: 'loading',
        scopes: [],
        recommendations: null,
        usage: null
      }
    )
    item.messages = item.messages.slice(-40)
    item.title =
      item.messages
        .find(message => message.role === 'user')
        ?.content.slice(0, 32) || item.title
    item.updatedAt = Date.now()
    const reply = item.messages.at(-1),
      token = ++generation
    const currentController = new AbortController()
    controller = currentController
    busy.value = true
    status.value = '正在连接本机 AI 服务…'
    await persist(item)
    try {
      if (token !== generation) return
      await streamAiTask(
        {
          uid: item.uid,
          mode: item.mode,
          target: item.target,
          messages: context
        },
        currentController.signal,
        (event, data) => {
          if (token !== generation) return
          if (event === 'text')
            reply.content = (reply.content + data.text).slice(0, 16000)
          if (event === 'status') status.value = data.text
          if (
            event === 'scope' &&
            !reply.scopes.some(scope => scope.note === data.note)
          )
            reply.scopes.push(data)
          if (event === 'recommendations') reply.recommendations = data
          if (event === 'usage') reply.usage = data
          if (event === 'done') {
            reply.state = 'done'
            if (data.truncated)
              reply.scopes.push({ note: '已达到本轮输出上限，可继续追问。' })
          }
        }
      )
    } catch (error) {
      if (token === generation) {
        reply.state = 'error'
        reply.error = error.message
      }
    } finally {
      if (token === generation) {
        busy.value = false
        status.value = ''
        controller = null
        await persist(item)
      }
    }
  }
  function retry() {
    const item = active.value
    if (!item || busy.value) return
    const previous = item.messages.at(-2)
    if (previous?.role !== 'user') return
    item.messages.splice(-2)
    return send(previous.content)
  }
  return {
    uid,
    conversations,
    activeId,
    active,
    busy,
    status,
    storageError,
    pending,
    queue,
    takePending,
    setAccount,
    create,
    select,
    send,
    retry,
    stop,
    remove,
    clear
  }
})
