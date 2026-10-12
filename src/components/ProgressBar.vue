<script setup>
  import { computed } from 'vue'

  const props = defineProps({
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    showTime: { type: Boolean, default: true }
  })

  const emit = defineEmits(['seek'])

  const percent = computed(() => {
    if (!props.total) return 0
    return Math.min(100, (props.current / props.total) * 100)
  })

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const min = Math.floor(seconds / 60)
    const sec = Math.floor(seconds % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    emit('seek', ratio * props.total)
  }

  function handleDrag(e) {
    if (e.buttons !== 1) return
    handleClick(e)
  }
</script>

<template>
  <div class="progress-bar">
    <span v-if="showTime" class="time current">
      {{ formatTime(current / 1000) }}
    </span>
    <div class="track" @click="handleClick" @mousemove="handleDrag">
      <div class="fill" :style="{ width: percent + '%' }">
        <div class="thumb"></div>
      </div>
    </div>
    <span v-if="showTime" class="time total">
      {{ formatTime(total / 1000) }}
    </span>
  </div>
</template>

<style scoped>
  .progress-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
  }

  .time {
    font-size: 12px;
    color: var(--color-text-secondary);
    min-width: 36px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .track {
    flex: 1;
    height: 4px;
    background: var(--color-secondary-bg-hover);
    border-radius: var(--radius-full);
    cursor: pointer;
    position: relative;
    transition: height var(--transition-fast);
  }

  .track:hover {
    height: 6px;
  }

  .fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    position: relative;
    transition: width 100ms linear;
  }

  .thumb {
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background: var(--color-primary);
    border-radius: 50%;
    opacity: 0;
    transition: opacity var(--transition-fast);
    box-shadow: var(--shadow-md);
  }

  .track:hover .thumb {
    opacity: 1;
  }
</style>
