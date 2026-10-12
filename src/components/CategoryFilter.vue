<script setup>
  defineProps({
    categories: { type: Array, default: () => [] },
    activeCategory: { type: String, default: '全部' }
  })

  const emit = defineEmits(['change'])

  function selectCategory(cat) {
    emit('change', cat)
  }
</script>

<template>
  <div class="category-filter">
    <button
      v-for="cat in categories"
      :key="cat"
      class="tag"
      :class="{ active: cat === activeCategory }"
      @click="selectCategory(cat)"
    >
      {{ cat }}
    </button>
  </div>
</template>

<style scoped>
  .category-filter {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    padding: var(--spacing-md) 0;
  }

  .tag {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-full);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    border: 1px solid var(--color-border);
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .tag:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }

  .tag.active {
    background: var(--color-primary);
    color: #ffffff;
    border-color: var(--color-primary);
  }

  .tag.active:hover {
    background: var(--color-primary-hover);
  }
</style>
