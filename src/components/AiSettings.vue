<script setup>
  import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
  import {
    getAiSettings,
    saveAiSettings,
    testAiConnection,
    deleteAiKey
  } from '@/api/ai'
  import { useAiStore } from '@/stores/ai'

  const ai = useAiStore()
  const form = reactive({
    baseUrl: '',
    model: '',
    protocol: 'chat-completions',
    apiKey: ''
  })
  const settings = ref(null),
    busy = ref(false),
    error = ref(''),
    notice = ref('')
  let controller = null
  function accept(data) {
    settings.value = data
    form.baseUrl = data.baseUrl
    form.model = data.model
    form.protocol = data.protocol
  }
  async function load() {
    controller?.abort()
    controller = new AbortController()
    error.value = ''
    busy.value = true
    try {
      accept(await getAiSettings(controller.signal))
    } catch (cause) {
      if (!controller.signal.aborted) error.value = cause.message
    } finally {
      busy.value = false
    }
  }
  async function perform(action) {
    if (busy.value) return
    ai.stop()
    controller = new AbortController()
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      if (action === 'delete') {
        accept(await deleteAiKey(controller.signal))
        notice.value = '已删除本机保存的 Key，对话记录保留。'
      } else {
        accept(await saveAiSettings({ ...form }, controller.signal))
        form.apiKey = ''
        if (action === 'test') {
          notice.value = '正在测试文本和工具调用，最多发送两次小请求…'
          accept(await testAiConnection(controller.signal))
          notice.value = settings.value.capabilities.tools
            ? '连接正常，文本与工具调用均可用。'
            : '文本连接正常；模型未通过工具测试。歌词与评论分析可用，点歌请换支持工具调用的模型。'
        } else
          notice.value =
            '配置已保存，Key 已在本机加密。保存不会调用模型，请测试连接。'
      }
    } catch (cause) {
      if (!controller.signal.aborted) error.value = cause.message
      else notice.value = '已停止测试。'
    } finally {
      form.apiKey = ''
      busy.value = false
    }
  }
  onMounted(load)
  onBeforeUnmount(() => {
    controller?.abort()
    form.apiKey = ''
  })
</script>

<template>
  <form class="ai-settings" :aria-busy="busy" @submit.prevent="perform('save')">
    <h2>连接你的 AI 服务</h2>
    <p class="ai-settings-help">
      仅本机浏览器使用。Key
      由本机后台加密保存，音乐数据只在你发送请求时提供给所选服务。
    </p>
    <p v-if="settings" class="ai-key-status">
      {{ settings.configured ? '已加密保存 Key' : '尚未保存 Key' }} ·
      {{
        settings.capabilities?.tools
          ? '工具调用已验证'
          : settings.capabilities?.text
            ? '文本已验证，工具不可用'
            : '尚未测试连接'
      }}
    </p>
    <fieldset :disabled="busy">
      <label for="ai-base-url">接口地址（Base URL）</label>
      <input
        id="ai-base-url"
        v-model="form.baseUrl"
        type="url"
        placeholder="https://你的服务地址/v1"
        required
        autocomplete="off"
      />
      <span class="ai-settings-help">
        填写 API 根地址；远程接口使用 HTTPS，本机服务可使用 HTTP。
      </span>
      <label for="ai-protocol">接口协议</label>
      <select id="ai-protocol" v-model="form.protocol">
        <option value="chat-completions">Chat Completions</option>
        <option value="responses">Responses</option>
      </select>
      <label for="ai-model">模型名称</label>
      <input
        id="ai-model"
        v-model="form.model"
        placeholder="填写服务商提供的模型名称"
        required
        maxlength="200"
        autocomplete="off"
      />
      <label for="ai-key">API Key</label>
      <input
        id="ai-key"
        v-model="form.apiKey"
        type="password"
        :placeholder="
          settings?.configured
            ? '留空保留已保存的 Key'
            : '在此填写 Key，无需发送到聊天中'
        "
        maxlength="8192"
        autocomplete="new-password"
        spellcheck="false"
      />
      <div class="ai-settings-actions">
        <button type="submit" class="ai-primary">保存配置</button>
        <button type="button" @click="perform('test')">保存并测试连接</button>
        <button
          type="button"
          :disabled="!settings?.configured"
          @click="perform('delete')"
        >
          删除 Key
        </button>
      </div>
    </fieldset>
    <button v-if="busy" type="button" @click="controller?.abort()">
      停止等待
    </button>
    <p v-if="notice" role="status" class="ai-settings-help">{{ notice }}</p>
    <div v-if="error" role="alert" class="ai-settings-error">
      <p>{{ error }}</p>
      <button type="button" :disabled="busy" @click="load">重新读取配置</button>
    </div>
    <p class="ai-settings-help">
      测试连接会使用少量
      Token。自定义接口价格未知，实际费用以服务商账单为准。更换接口地址、模型或协议后需重新测试。
    </p>
  </form>
</template>

<style scoped>
  .ai-settings {
    max-width: 680px;
    color: var(--color-text);
  }
  h2 {
    font-size: 20px;
    margin-bottom: 12px;
  }
  .ai-settings-help {
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.7;
    margin: 8px 0 16px;
  }
  .ai-key-status {
    font-size: 13px;
    margin: 16px 0;
    color: var(--color-accent-ink);
  }
  fieldset {
    border: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  label {
    font-size: 14px;
    font-weight: 600;
    margin-top: 10px;
  }
  input,
  select {
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--surface-content);
    color: var(--color-text);
    font: inherit;
  }
  .ai-settings-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }
  button {
    padding: 10px 16px;
    border-radius: var(--radius-full);
    background: var(--color-primary-bg);
    color: var(--color-accent-ink);
  }
  .ai-primary {
    background: var(--color-action-bg);
    color: var(--color-action-text, #f8fafc);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ai-settings-error {
    margin-top: 16px;
    line-height: 1.6;
  }
</style>
