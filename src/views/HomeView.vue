<script setup>
  import { onMounted } from 'vue'
  import { Search } from '@lucide/vue'
  import { useMusicStore } from '@/stores/music'
  import MusicCard from '@/components/MusicCard.vue'
  import CategoryFilter from '@/components/CategoryFilter.vue'

  const musicStore = useMusicStore()

  function handleCategoryChange(cat) {
    musicStore.filterByCategory(cat)
  }

  onMounted(async () => {
    await musicStore.fetchCategoryList()
    // ponytail: 已有数据就不重复请求，避免返回时重复调用触发限流导致列表为空
    if (musicStore.recommendList.length === 0) {
      musicStore.fetchRecommend()
    }
  })
</script>

<template>
  <div class="home-view">
    <div class="content-wrapper">
      <div class="page-header">
        <h1 class="page-title">推荐音乐</h1>
        <p class="page-subtitle">为你精选的好音乐</p>
      </div>

      <CategoryFilter
        :categories="musicStore.categoryList"
        :active-category="musicStore.activeCategory"
        @change="handleCategoryChange"
      />

      <!-- 推荐加载态 -->
      <div v-if="musicStore.loading" class="loading-state">
        <div v-for="i in 10" :key="i" class="skeleton-card">
          <div class="skeleton-cover"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>

      <!-- 空态 -->
      <div
        v-else-if="musicStore.recommendList.length === 0"
        class="empty-state"
      >
        <Search :size="48" color="var(--color-text-muted)" />
        <p class="empty-text">暂无推荐音乐</p>
      </div>

      <!-- 推荐卡片网格 -->
      <div v-else class="music-grid">
        <MusicCard
          v-for="item in musicStore.recommendList"
          :key="item.id"
          :item="item"
          type="track"
          v-memo="[item.id, item.al?.picUrl]"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
  .home-view {
    min-height: calc(100vh - var(--navbar-height));
  }

  .content-wrapper {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-3xl);
  }

  .page-header {
    margin-bottom: var(--spacing-lg);
  }

  .page-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--spacing-xs);
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  .music-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--spacing-lg);
  }

  .music-grid > * {
    min-width: 0;
  }

  .loading-state {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--spacing-lg);
  }

  .skeleton-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .skeleton-cover {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-lg);
    background: var(--color-secondary-bg);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-line {
    height: 14px;
    border-radius: var(--radius-sm);
    background: var(--color-secondary-bg);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-line.short {
    width: 60%;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.5;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-3xl);
    gap: var(--spacing-md);
  }

  .empty-text {
    font-size: 15px;
    color: var(--color-text-muted);
  }
</style>
