<script setup>
  defineProps({ size: { type: [Number, String], default: 32 } })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    data-brand="tide"
  >
    <path
      d="m5 5.5 3 2.7m-4 6.5 3 2.6m-3 10 4-4.1M14 8c5-5.5 8 5 14-1M13 17c6-6.5 9 6 15-1M12 26c6-6.5 10 5 16-2"
    />
  </svg>
</template>
