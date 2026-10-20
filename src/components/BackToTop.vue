<script setup>
  import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { ArrowUp } from '@/components/icons'
  import { usePlayerStore } from '@/stores/player'
  import { useUserStore } from '@/stores/user'
  import { getPageScrollContainer, scrollPageTo } from '@/utils/pageScroll'

  const route = useRoute()
  const playerStore = usePlayerStore()
  const userStore = useUserStore()

  const visible = ref(false)

  // 滚动超过一屏才显示，避免短页面误触
  function updateVisibility() {
    const container = getPageScrollContainer()
    visible.value = container
      ? container.scrollTop > container.clientHeight
      : window.scrollY > window.innerHeight
  }
  function onScroll(event) {
    const container = getPageScrollContainer()
    if (container) {
      if (event.target !== container) return
    } else if (
      event.target !== window &&
      event.target !== document &&
      event.target !== document.scrollingElement
    ) {
      return
    }
    updateVisibility()
  }
  function toTop() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollPageTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  watch(
    () => route.fullPath,
    () => nextTick(updateVisibility),
    { flush: 'post' }
  )

  onMounted(() => {
    updateVisibility()
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', updateVisibility)
  })
  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', updateVisibility)
  })

  // PlayerBar 在登录且有曲目时显示，按钮需向上避让
  const withPlayer = computed(
    () => userStore.isLoggedIn && playerStore.hasTrack
  )
</script>

<template>
  <Transition name="btt">
    <button
      v-if="visible"
      class="back-to-top"
      :class="{ 'with-player': withPlayer }"
      aria-label="返回顶部"
      @click="toTop"
    >
      <ArrowUp :size="22" />
    </button>
  </Transition>
</template>

<style scoped>
  .back-to-top {
    position: fixed;
    right: 24px;
    bottom: 16px;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-full);
    background: var(--color-secondary-bg);
    color: var(--color-text);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    /* 低于 modal(1000)，模态遮罩覆盖之；高于 navbar 与内容 */
    z-index: 900;
    transition:
      background var(--transition-fast),
      transform var(--transition-fast);
  }
  .back-to-top.with-player {
    bottom: calc(var(--player-height) + 16px);
  }
  .back-to-top:hover {
    background: var(--color-secondary-bg-hover);
    transform: translateY(-2px);
  }
  .back-to-top:active {
    transform: translateY(0);
  }

  .btt-enter-active,
  .btt-leave-active {
    transition:
      opacity var(--transition-fast),
      transform var(--transition-fast);
  }
  .btt-enter-from,
  .btt-leave-to {
    opacity: 0;
    transform: translateY(8px) scale(0.8);
  }
</style>
