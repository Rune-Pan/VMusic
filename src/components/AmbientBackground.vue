<script setup>
  import { useAmbientCover } from '@/composables/useAmbientCover'
  const props = defineProps({ coverUrl: { type: String, default: '' } })
  const displayedCover = useAmbientCover(() => props.coverUrl)
</script>

<template>
  <div
    class="ambient-background"
    :class="{ 'has-cover': displayedCover }"
    aria-hidden="true"
  >
    <Transition name="ambient-cover">
      <img
        v-if="displayedCover"
        :key="displayedCover"
        :src="displayedCover"
        alt=""
        class="ambient-cover"
      />
    </Transition>
    <div class="ambient-veil"></div>
  </div>
</template>

<style>
  .ambient-background {
    position: fixed;
    inset: 0;
    z-index: var(--z-background);
    overflow: hidden;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 8% 12%, var(--ambient-blue), transparent 55%),
      radial-gradient(
        ellipse at 90% 85%,
        var(--ambient-silver),
        transparent 60%
      ),
      var(--color-body-bg);
  }
  .ambient-cover {
    position: absolute;
    inset: -10%;
    width: 120%;
    height: 120%;
    max-width: none;
    object-fit: cover;
    filter: blur(36px) saturate(85%);
    opacity: var(--ambient-cover-opacity);
  }
  .ambient-veil {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        120deg,
        var(--ambient-veil),
        transparent 65%,
        var(--ambient-veil)
      ),
      var(--ambient-scrim);
  }
  .ambient-cover-enter-active,
  .ambient-cover-leave-active {
    transition: opacity 800ms ease;
  }
  .ambient-cover-enter-from,
  .ambient-cover-leave-to {
    opacity: 0;
  }
  @media (prefers-reduced-transparency: reduce) {
    .ambient-cover {
      display: none;
    }
  }
</style>
