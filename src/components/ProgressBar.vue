<script setup>
  import { computed } from 'vue'
  import { formatDuration } from '@/utils/common'
  const props = defineProps({
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    showTime: { type: Boolean, default: true }
  })
  const emit = defineEmits(['seek'])
  const percent = computed(() =>
    props.total > 0
      ? Math.max(0, Math.min(100, (props.current / props.total) * 100))
      : 0
  )
  function seek(event) {
    if (props.total > 0)
      emit(
        'seek',
        Math.max(0, Math.min(props.total, Number(event.target.value)))
      )
  }
</script>
<template>
  <div class="progress-bar">
    <span v-if="showTime" class="time">{{ formatDuration(current) }}</span>
    <input
      class="track"
      type="range"
      min="0"
      :max="total || 1"
      step="1000"
      :value="current"
      :disabled="total <= 0"
      aria-label="播放进度"
      :aria-valuetext="`${formatDuration(current)} / ${formatDuration(total)}`"
      :style="{ '--progress': percent + '%' }"
      @input="seek"
    />
    <span v-if="showTime" class="time">{{ formatDuration(total) }}</span>
  </div>
</template>
<style scoped>
  .progress-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }
  .time {
    font-size: 11px;
    color: var(--color-text-secondary);
    min-width: 32px;
    font-variant-numeric: tabular-nums;
  }
  .track {
    appearance: none;
    flex: 1;
    min-width: 0;
    height: 4px;
    margin: 8px 0;
    border-radius: 99px;
    background: linear-gradient(
      to right,
      var(--color-primary) var(--progress),
      var(--color-border) var(--progress)
    );
    cursor: pointer;
  }
  .track:disabled {
    cursor: default;
  }
  .track::-webkit-slider-thumb {
    appearance: none;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }
  .track::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: 0;
    border-radius: 50%;
    background: var(--color-primary);
  }
  .track:focus-visible {
    outline-offset: 8px;
  }
</style>
