<script setup>
  import {
    ref,
    computed,
    watch,
    onMounted,
    onBeforeUnmount,
    nextTick
  } from 'vue'
  import { useAiStore } from '@/stores/ai'
  import { usePlayerStore } from '@/stores/player'
  import { useUiStore } from '@/stores/ui'
  import { getAiSettings } from '@/api/ai'
  import { formatDuration } from '@/utils/common'

  const ai = useAiStore(),
    player = usePlayerStore(),
    ui = useUiStore()
  const settings = ref(null),
    connectionError = ref(''),
    draft = ref(''),
    log = ref(null)
  const loadingSettings = ref(true)
  const modes = [
    { key: 'recommend', label: '点歌与歌单' },
    { key: 'lyrics', label: '歌词解读' },
    { key: 'comments', label: '评论总结' }
  ]
  const mode = computed(() => ai.active?.mode || 'recommend')
  const label = computed(
    () => modes.find(item => item.key === mode.value)?.label
  )
  const target = computed(() => ai.active?.target)
  const canSend = computed(
    () =>
      settings.value?.configured &&
      !ai.busy &&
      draft.value.trim() &&
      (mode.value === 'recommend'
        ? settings.value.capabilities?.tools
        : target.value)
  )
  const controller = new AbortController()
  function newTask(value = 'recommend') {
    const current = player.currentTrack
    ai.create(
      value,
      value !== 'recommend' && current
        ? { type: 'track', id: Number(current.id), title: current.name }
        : null
    )
    draft.value =
      value === 'lyrics'
        ? '请解读这首歌的主题、意象与情绪，区分歌词原文和你的理解。'
        : value === 'comments'
          ? '请总结样本中的主要观点、分歧和近期反馈。'
          : ''
  }
  async function send() {
    if (canSend.value) {
      const text = draft.value
      draft.value = ''
      await ai.send(text)
    }
  }
  async function clearHistory() {
    if (
      await ui.showConfirm({
        title: '清空 AI 对话',
        message: '删除当前账号保存在本机的全部 AI 对话？',
        confirmText: '清空'
      })
    )
      await ai.clear().catch(() => {
        connectionError.value = '本机记录删除失败，请重试'
      })
  }
  async function remove(id) {
    await ai.remove(id).catch(() => {
      connectionError.value = '本机记录删除失败，请重试'
    })
  }
  async function consumePending() {
    if (loadingSettings.value || !ai.pending) return
    const pending = ai.takePending()
    if (pending.uid !== ai.uid) return
    ai.create(pending.mode, pending.target)
    draft.value =
      pending.mode === 'lyrics'
        ? '请解读这首歌的主题、意象与情绪，区分歌词原文和你的理解。'
        : '请总结最热与最新评论样本中的主要观点和分歧。'
    if (canSend.value) await send()
  }
  watch(() => ai.pending, consumePending)
  watch(
    () => ai.active?.messages.at(-1)?.content,
    async () => {
      const element = log.value
      const nearBottom =
        element &&
        element.scrollHeight - element.scrollTop - element.clientHeight < 120
      if (nearBottom) {
        await nextTick()
        element.scrollTop = element.scrollHeight
      }
    }
  )
  onMounted(async () => {
    try {
      settings.value = await getAiSettings(controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) connectionError.value = error.message
    } finally {
      loadingSettings.value = false
      if (!controller.signal.aborted) consumePending()
    }
  })
  onBeforeUnmount(() => {
    controller.abort()
    ai.stop()
  })
</script>

<template>
  <div class="ai-view">
    <header class="ai-heading">
      <div>
        <h1>AI 助手</h1>
        <p>找合心意的音乐，也听懂歌里的故事。</p>
      </div>
      <RouterLink :to="{ path: '/profile', query: { section: 'ai' } }">
        AI 设置
      </RouterLink>
    </header>
    <div v-if="loadingSettings" class="ai-notice" role="status">
      正在读取本机配置…
    </div>
    <div
      v-else-if="connectionError || !settings?.configured"
      class="ai-notice"
      role="status"
    >
      {{ connectionError || '先连接你的 AI 服务，再开始探索。' }}
      <RouterLink :to="{ path: '/profile', query: { section: 'ai' } }">
        前往设置
      </RouterLink>
    </div>
    <div class="ai-toolbar">
      <div class="ai-modes" role="group" aria-label="AI 功能">
        <button
          v-for="item in modes"
          :key="item.key"
          :aria-pressed="mode === item.key"
          type="button"
          @click="newTask(item.key)"
        >
          {{ item.label }}
        </button>
      </div>
      <button type="button" @click="newTask(mode)">新对话</button>
    </div>
    <details v-if="ai.conversations.length" class="ai-history">
      <summary>本机对话 · {{ ai.conversations.length }} / 20</summary>
      <div class="ai-history-list">
        <div
          v-for="item in ai.conversations"
          :key="item.id"
          class="ai-history-row"
        >
          <button
            type="button"
            :aria-current="ai.activeId === item.id ? 'true' : undefined"
            @click="ai.select(item.id)"
          >
            {{ item.title }}
          </button>
          <button
            type="button"
            :aria-label="`删除对话：${item.title}`"
            @click="remove(item.id)"
          >
            删除
          </button>
        </div>
        <button type="button" @click="clearHistory">清空当前账号的对话</button>
      </div>
    </details>
    <p v-if="ai.storageError" class="ai-notice" role="status">
      {{ ai.storageError }}
    </p>
    <div v-if="target" class="ai-context">
      <span>
        {{ target.type === 'playlist' ? '歌单' : '歌曲' }} · {{ target.title }}
      </span>
      <RouterLink
        :to="`/${target.type === 'playlist' ? 'playlist' : 'player'}/${target.id}`"
      >
        查看原内容
      </RouterLink>
    </div>
    <p v-else-if="mode !== 'recommend'" class="ai-notice">
      请先选择一首歌曲，或从播放页、评论区的 AI 入口带入要分析的内容。
    </p>
    <p
      v-if="
        settings?.configured &&
        mode === 'recommend' &&
        !settings.capabilities?.tools
      "
      class="ai-notice"
    >
      点歌需要支持工具调用的模型，请在 AI
      设置中测试连接；歌词与评论分析可独立使用。
    </p>
    <section ref="log" class="ai-log" :aria-label="label" :aria-busy="ai.busy">
      <div v-if="!ai.active?.messages.length" class="ai-welcome">
        <h2>{{ mode === 'recommend' ? '今天，想听什么？' : label }}</h2>
        <p>
          {{
            mode === 'recommend'
              ? '告诉我场景、心情或喜欢的风格，我会检索真实歌曲，再给你一份推荐清单。'
              : '基于你选择的内容分析；结果属于 AI 理解，可以继续追问。'
          }}
        </p>
        <button
          v-if="mode === 'recommend'"
          type="button"
          @click="
            draft =
              '推荐一些适合通勤的轻快中文歌，结合我的音乐偏好，总时长约30分钟。'
          "
        >
          试试：为通勤挑一份轻快歌单
        </button>
      </div>
      <article
        v-for="(message, index) in ai.active?.messages || []"
        :key="index"
        class="ai-message"
        :class="message.role"
      >
        <h2>{{ message.role === 'user' ? '你' : 'AI · ' + label }}</h2>
        <p
          v-for="(scope, scopeIndex) in message.scopes || []"
          :key="scopeIndex"
          class="ai-scope"
        >
          {{ scope.note }}
        </p>
        <p v-if="message.content" class="ai-answer">{{ message.content }}</p>
        <div v-if="message.recommendations" class="ai-recommendations">
          <h3>{{ message.recommendations.title }}</h3>
          <p class="ai-scope">
            {{ message.recommendations.tracks.length }} 首已核验歌曲 ·
            仅展示推荐
          </p>
          <div
            v-for="song in message.recommendations.tracks"
            :key="song.id"
            class="ai-song"
          >
            <div>
              <RouterLink :to="`/player/${song.id}`">
                {{ song.name }}
              </RouterLink>
              <span class="ai-duration">
                {{ formatDuration(song.duration) }}
              </span>
              <p>
                <template
                  v-for="(artist, artistIndex) in song.artists"
                  :key="artistIndex"
                >
                  <span v-if="artistIndex">/</span>
                  <RouterLink v-if="artist.id" :to="`/artist/${artist.id}`">
                    {{ artist.name }}
                  </RouterLink>
                  <span v-else>{{ artist.name }}</span>
                </template>
                <template v-if="song.album?.id">
                  ·
                  <RouterLink :to="`/album/${song.album.id}`">
                    {{ song.album.name }}
                  </RouterLink>
                </template>
              </p>
              <p v-if="song.permission" class="ai-scope">
                {{ song.permission }}
              </p>
            </div>
            <p>{{ song.reason }}</p>
          </div>
        </div>
        <p v-if="message.usage" class="ai-scope">
          Token：输入 {{ message.usage.input.toLocaleString('en-US') }} · 输出
          {{ message.usage.output.toLocaleString('en-US') }} ·
          费用以服务商账单为准
        </p>
        <p v-if="message.state === 'stopped'" class="ai-scope">
          已停止，以上内容可能不完整。
        </p>
        <div v-if="message.error" role="alert" class="ai-task-error">
          <p>{{ message.error }}</p>
          <button
            v-if="index === ai.active.messages.length - 1"
            type="button"
            :disabled="ai.busy"
            @click="ai.retry"
          >
            重试本次请求
          </button>
        </div>
      </article>
      <p v-if="ai.busy" role="status" class="ai-scope">{{ ai.status }}</p>
    </section>
    <form class="ai-composer" @submit.prevent="send">
      <label class="ai-composer-label" for="ai-prompt">
        {{ mode === 'recommend' ? '你的音乐需求' : '想进一步了解什么' }}
      </label>
      <textarea
        id="ai-prompt"
        v-model="draft"
        rows="2"
        maxlength="4000"
        :disabled="ai.busy"
        placeholder="输入你的需求，按发送后才会调用 AI"
        @keydown.ctrl.enter.prevent="send"
      ></textarea>
      <div class="ai-composer-actions">
        <span>Ctrl + Enter 发送 · 本机保存，不进行对话云同步</span>
        <button v-if="ai.busy" type="button" @click="ai.stop()">
          停止生成
        </button>
        <button v-else type="submit" :disabled="!canSend">发送</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
  .ai-view {
    width: min(100%, 980px);
    margin: 0 auto;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 0 12px;
    color: var(--color-text);
  }
  .ai-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 18px;
  }
  h1 {
    font-size: 28px;
    font-weight: 720;
    letter-spacing: -0.03em;
    margin-bottom: 8px;
  }
  .ai-heading p,
  .ai-scope,
  .ai-duration {
    color: var(--color-text-secondary);
  }
  a {
    color: var(--color-accent-ink);
  }
  button {
    color: var(--color-text-secondary);
    padding: 9px 14px;
    border-radius: var(--radius-full);
  }
  button:hover {
    background: var(--color-secondary-bg-hover);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ai-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .ai-modes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .ai-modes [aria-pressed='true'] {
    background: var(--color-primary-bg);
    color: var(--color-accent-ink);
    font-weight: 600;
  }
  .ai-notice {
    padding: 14px 0;
    line-height: 1.7;
    color: var(--color-text-secondary);
  }
  .ai-history {
    margin-bottom: 16px;
    border-bottom: 1px solid var(--color-border-light);
    font-size: 13px;
  }
  summary {
    padding: 8px 0 14px;
    cursor: pointer;
    color: var(--color-text-secondary);
  }
  .ai-history-list {
    max-height: 240px;
    overflow-y: auto;
    padding-bottom: 12px;
  }
  .ai-history-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .ai-history-row button:first-child {
    text-align: left;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .ai-history-row [aria-current='true'] {
    color: var(--color-accent-ink);
  }
  .ai-context {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    margin: 16px 0;
  }
  .ai-log {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    padding-right: 8px;
  }
  .ai-welcome {
    padding: 44px 8px;
    max-width: 640px;
    line-height: 1.8;
  }
  .ai-welcome h2 {
    font-size: 25px;
    margin-bottom: 14px;
  }
  .ai-welcome p {
    color: var(--color-text-secondary);
    margin-bottom: 20px;
  }
  .ai-welcome button {
    padding-left: 0;
    color: var(--color-accent-ink);
    text-align: left;
  }
  .ai-message {
    padding: 20px 0 24px;
    border-bottom: 1px solid var(--color-border-light);
  }
  .ai-message h2 {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
    font-weight: 600;
  }
  .ai-message.user {
    max-width: 72ch;
  }
  .ai-answer {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 15px;
    line-height: 1.85;
    max-width: 75ch;
  }
  .ai-scope {
    font-size: 12px;
    line-height: 1.7;
    margin: 8px 0;
  }
  .ai-recommendations {
    margin: 24px 0 12px;
  }
  .ai-recommendations h3 {
    font-size: 19px;
  }
  .ai-song {
    padding: 16px 0;
    border-bottom: 1px solid var(--color-border-light);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    line-height: 1.65;
  }
  .ai-song > p {
    color: var(--color-text-secondary);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .ai-song > div > p {
    font-size: 12px;
    margin-top: 5px;
  }
  .ai-duration {
    margin-left: 10px;
    font-size: 12px;
  }
  .ai-composer {
    padding-top: 12px;
  }
  .ai-heading,
  .ai-toolbar,
  .ai-composer,
  .ai-history,
  .ai-context,
  .ai-notice {
    flex-shrink: 0;
  }
  .ai-composer-label {
    display: block;
    font-size: 13px;
    margin-bottom: 10px;
    font-weight: 600;
  }
  textarea {
    resize: vertical;
    width: 100%;
    min-height: 64px;
    max-height: 96px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 14px;
    background: var(--surface-content);
    color: var(--color-text);
    font: inherit;
    line-height: 1.6;
  }
  .ai-composer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 10px;
  }
  .ai-composer-actions span {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
  .ai-composer-actions button {
    background: var(--color-action-bg);
    color: var(--color-action-text, #f8fafc);
    padding: 10px 24px;
  }
  .ai-task-error {
    line-height: 1.7;
    margin-top: 12px;
  }
  .ai-task-error button {
    color: var(--color-accent-ink);
    background: var(--color-primary-bg);
    margin-top: 10px;
  }
  @media (max-width: 1050px) {
    .ai-song {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .ai-heading {
      align-items: flex-start;
    }
    .ai-composer-actions span {
      max-width: 65%;
    }
  }
  @media (max-height: 720px) {
    .ai-heading {
      margin-bottom: 12px;
    }
    .ai-heading p {
      display: none;
    }
    .ai-history {
      margin-bottom: 8px;
    }
    .ai-context {
      margin: 8px 0;
    }
  }
</style>
