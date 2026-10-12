<script setup>
  import { ref, watch, computed, onBeforeUnmount, nextTick } from 'vue'
  import { X, ThumbsUp, Loader2 } from '@lucide/vue'
  import { getSongComments } from '@/api/track'
  import { getPlaylistComments } from '@/api/playlist'
  import { resizeImage, formatRelativeTime } from '@/utils/common'
  import { IMAGE_SIZE_AVATAR } from '@/constants'
  import { useEscClose } from '@/composables/useEscClose'

  const props = defineProps({
    visible: {
      type: Boolean,
      default: false
    },
    // 'track' | 'playlist'
    type: {
      type: String,
      default: 'track'
    },
    id: {
      type: Number,
      default: null
    },
    title: {
      type: String,
      default: ''
    }
  })

  const titleMain = computed(() =>
    props.type === 'playlist' ? '歌单评论' : '歌曲评论'
  )

  const emit = defineEmits(['close'])

  const comments = ref([])
  const loading = ref(false)
  const error = ref('')
  const hasMore = ref(false)
  const offset = ref(0)
  const LIMIT = 20

  // 滚动触底自动加载哨兵
  const sentinel = ref(null)
  const scrollContainer = ref(null)
  let observer = null

  function setupObserver() {
    if (observer || !sentinel.value || !scrollContainer.value) return
    observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore.value && !loading.value) {
          loadComments()
        }
      },
      // root 必须指向滚动容器，否则相对视口判断，内部滚动不触发
      { root: scrollContainer.value, rootMargin: '100px' }
    )
    observer.observe(sentinel.value)
  }

  function teardownObserver() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  // formatTime 已移除，使用 formatRelativeTime（来自 @/utils/common）

  async function loadComments(reset = false) {
    if (!props.id) return
    if (reset) {
      offset.value = 0
      comments.value = []
    }
    if (loading.value) return

    loading.value = true
    error.value = ''
    try {
      const params = { id: props.id, limit: LIMIT, offset: offset.value }
      const data =
        props.type === 'playlist'
          ? await getPlaylistComments(params)
          : await getSongComments(params)
      const list = data.comments || []
      comments.value.push(...list)
      hasMore.value = list.length === LIMIT && data.more !== false
      offset.value += list.length
      // 首屏数据回来后哨兵才渲染，此时补建 observer
      if (!observer && comments.value.length > 0) {
        nextTick(setupObserver)
      }
    } catch (e) {
      error.value = '评论加载失败，请稍后重试'
      console.error('Failed to load comments:', e)
    } finally {
      loading.value = false
    }
  }

  function close() {
    emit('close')
  }

  useEscClose(() => props.visible, close)

  watch(
    () => props.visible,
    visible => {
      if (visible) {
        loadComments(true)
        nextTick(setupObserver)
      } else {
        teardownObserver()
      }
    }
  )

  watch(
    () => props.id,
    () => {
      if (props.visible) {
        loadComments(true)
      }
    }
  )

  onBeforeUnmount(teardownObserver)
</script>

<template>
  <transition name="comment-modal">
    <div v-if="visible" class="comment-modal-overlay" @click="close">
      <div class="comment-modal" @click.stop>
        <div class="comment-modal-header">
          <div class="comment-modal-title">
            <div class="title-main">{{ titleMain }}</div>
            <div class="title-sub">{{ title }}</div>
          </div>
          <button class="close-btn" aria-label="关闭" @click="close">
            <X :size="20" />
          </button>
        </div>

        <div ref="scrollContainer" class="comment-modal-body">
          <div v-if="comments.length > 0" class="comment-list">
            <div
              v-for="comment in comments"
              :key="comment.commentId"
              class="comment-item"
            >
              <img
                :src="resizeImage(comment.user?.avatarUrl, IMAGE_SIZE_AVATAR)"
                :alt="comment.user?.nickname"
                class="comment-avatar"
              />
              <div class="comment-content">
                <div class="comment-meta">
                  <span class="comment-nickname">
                    {{ comment.user?.nickname || '网易云用户' }}
                  </span>
                  <span class="comment-time">
                    {{ formatRelativeTime(comment.time) }}
                  </span>
                </div>
                <div class="comment-text">{{ comment.content }}</div>
                <div class="comment-likes">
                  <ThumbsUp :size="12" />
                  <span>{{ comment.likedCount || 0 }}</span>
                </div>
              </div>
            </div>

            <!-- 滚动触底哨兵：进入视口自动 loadMore -->
            <div ref="sentinel" class="sentinel" aria-hidden="true"></div>
            <div v-if="loading" class="load-more">
              <Loader2 class="spin" :size="16" />
              <span>加载中...</span>
            </div>
            <div v-else-if="!hasMore" class="no-more">没有更多评论了</div>
          </div>

          <div
            v-else-if="loading && comments.length === 0"
            class="comment-empty"
          >
            <Loader2 class="spin" :size="24" />
            <span>正在加载评论...</span>
          </div>

          <div v-else-if="error" class="comment-empty error">
            {{ error }}
          </div>

          <div v-else class="comment-empty">暂无评论</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
  .comment-modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    backdrop-filter: blur(4px);
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
  }

  .comment-modal {
    width: 100%;
    max-width: 520px;
    max-height: 70vh;
    background: var(--color-modal-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .comment-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
  }

  .comment-modal-title {
    min-width: 0;
  }

  .title-main {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  .title-sub {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 50%;
    color: var(--color-text-muted);
    transition:
      color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .close-btn:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }

  .comment-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm) var(--spacing-lg);
  }

  .comment-list {
    display: flex;
    flex-direction: column;
  }

  .comment-item {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  .comment-item:last-child {
    border-bottom: none;
  }

  .comment-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .comment-content {
    flex: 1;
    min-width: 0;
  }

  .comment-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    margin-bottom: 4px;
  }

  .comment-nickname {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .comment-time {
    font-size: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .comment-text {
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.6;
    word-break: break-word;
  }

  .comment-likes {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-md) 0;
    font-size: 13px;
    color: var(--color-text-muted);
  }

  /* 哨兵：滚动触底检测用，不可见但有高度避免塌陷 */
  .sentinel {
    height: 1px;
  }

  .no-more {
    text-align: center;
    padding: var(--spacing-md) 0;
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .comment-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-3xl) 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .comment-empty.error {
    color: var(--color-error);
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* A: 弹窗进出场——overlay fade，modal scale 联动 */
  .comment-modal-enter-active,
  .comment-modal-leave-active {
    transition: opacity var(--transition-base);
  }
  .comment-modal-enter-active .comment-modal,
  .comment-modal-leave-active .comment-modal {
    transition:
      transform var(--transition-base),
      opacity var(--transition-base);
  }
  .comment-modal-enter-from,
  .comment-modal-leave-to {
    opacity: 0;
  }
  .comment-modal-enter-from .comment-modal,
  .comment-modal-leave-to .comment-modal {
    opacity: 0;
    transform: scale(0.94) translateY(8px);
  }

  /* B: 评论列表 stagger 淡入（缓存命中或网络到达时逐条出现） */
  .comment-item {
    animation: comment-fade-in var(--transition-slow) ease-out both;
  }
  @keyframes comment-fade-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
