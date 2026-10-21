<script setup>
  import { ref, reactive, watch } from 'vue'
  import GlassSurface from '@/components/GlassSurface.vue'
  import { X } from '@/components/icons'
  import { useMusicStore } from '@/stores/music'
  import { useUserStore } from '@/stores/user'
  import { useUiStore } from '@/stores/ui'
  import { useEscClose } from '@/composables/useEscClose'

  const props = defineProps({ visible: Boolean, playlist: { type: Object, default: null } })
  const emit = defineEmits(['close', 'saved'])
  const music = useMusicStore()
  const user = useUserStore()
  const ui = useUiStore()
  const form = reactive({ name: '', description: '' })
  const currentId = ref(null)
  const saving = ref(false)
  const error = ref('')
  watch(() => props.visible, visible => {
    if (!visible) return
    currentId.value = props.playlist?.id ?? null
    form.name = props.playlist?.name || ''
    form.description = props.playlist?.description || ''
    error.value = ''
  }, { immediate: true })
  function close() { if (!saving.value) emit('close') }
  useEscClose(() => props.visible, close)
  async function submit() {
    if (saving.value) return
    if (!form.name.trim()) { error.value = '请输入歌单名称'; return }
    const uid = user.userInfo.id
    saving.value = true
    error.value = ''
    try {
      let result
      if (currentId.value) {
        await music.updatePlaylist(currentId.value, { name: form.name.trim(), description: form.description })
        result = { id: currentId.value }
      } else result = await music.createPlaylist(form.name.trim(), form.description)
      if (uid !== user.userInfo.id) return
      ui.showToast('歌单已保存到网易云', 'success')
      emit('saved', result)
      emit('close')
    } catch (cause) {
      if (uid !== user.userInfo.id) return
      if (cause.playlistId) currentId.value = cause.playlistId
      error.value = cause.message || '保存失败，请重试'
    } finally { saving.value = false }
  }
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay" @click.self="close">
      <GlassSurface class="modal-card" modal label="歌单表单">
        <form @submit.prevent="submit">
          <div class="modal-header">
            <h3>{{ currentId ? '编辑歌单' : '新建私密歌单' }}</h3>
            <button type="button" class="close-btn" aria-label="关闭歌单表单" :disabled="saving" @click="close"><X :size="20" /></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="playlist-name">歌单名称</label>
              <input id="playlist-name" v-model="form.name" class="form-input" required :disabled="saving" />
            </div>
            <div class="form-group">
              <label class="form-label" for="playlist-description">歌单简介</label>
              <textarea id="playlist-description" v-model="form.description" class="form-textarea" rows="3" :disabled="saving"></textarea>
            </div>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel" :disabled="saving" @click="close">取消</button>
            <button type="submit" class="btn-confirm" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
          </div>
        </form>
      </GlassSurface>
    </div>
  </transition>
</template>

<style scoped>
  .form-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-secondary-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 14px;
    color: var(--color-text);
    font-family: inherit;
    outline: none;
  }

  .form-textarea {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-secondary-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 14px;
    color: var(--color-text);
    font-family: inherit;
    resize: vertical;
    outline: none;
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    backdrop-filter: blur(4px);
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
  }
  .modal-card {
    width: 100%;
    max-width: 440px;
    background: var(--color-modal-bg);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg) var(--spacing-xl);
    border-bottom: 1px solid var(--color-border-light);
  }
  .modal-header h3 {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
  }
  .close-btn {
    color: var(--color-text-muted);
    padding: 4px;
  }
  .close-btn:hover {
    color: var(--color-text);
  }
  .modal-body {
    padding: var(--spacing-xl);
  }
  .modal-footer {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: flex-end;
    padding: var(--spacing-lg) var(--spacing-xl);
    border-top: 1px solid var(--color-border-light);
  }
  .btn-cancel {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .btn-cancel:hover {
    background: var(--color-secondary-bg-hover);
  }
  .btn-confirm {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-action-bg);
    color: var(--color-action-text);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .btn-confirm:hover {
    background: var(--color-action-hover);
  }

  .form-group { margin-bottom: var(--spacing-lg); }
  .form-label { display: block; margin-bottom: var(--spacing-sm); }
  .form-error { color: var(--color-error); overflow-wrap: anywhere; }
  .form-input:focus-visible, .form-textarea:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  button:disabled { opacity: 0.6; cursor: wait; }
</style>
