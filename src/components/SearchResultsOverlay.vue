<script setup>
  import { computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { X, Search } from '@lucide/vue'
  import { useMusicStore } from '@/stores/music'
  import { useUiStore } from '@/stores/ui'
  import { resizeImage } from '@/utils/common'
  import { useEscClose } from '@/composables/useEscClose'
  import TrackList from '@/components/TrackList.vue'
  import MusicCard from '@/components/MusicCard.vue'

  const route = useRoute()
  const router = useRouter()
  const musicStore = useMusicStore()
  const uiStore = useUiStore()

  function showAlbumTip() {
    uiStore.showToast('暂不支持查看专辑详情', 'warning')
  }

  function goArtist(id) {
    musicStore.clearSearch()
    router.push({ name: 'artist', params: { id } })
  }

  import { PLACEHOLDER_COVER_300, IMAGE_SIZE_CARD } from '@/constants'
  const PLACEHOLDER_IMG = PLACEHOLDER_COVER_300

  function getSearchCover(item) {
    const url = item.picUrl || item.coverImgUrl || item.img1v1Url || ''
    return url ? resizeImage(url, IMAGE_SIZE_CARD) : PLACEHOLDER_IMG
  }

  // 路由变化时自动关闭搜索覆盖层
  watch(
    () => route.path,
    () => {
      if (visible.value) {
        musicStore.clearSearch()
      }
    }
  )

  const visible = computed(() => musicStore.searchKeyword.trim().length > 0)

  const SEARCH_TABS = [
    { key: 'tracks', label: '单曲' },
    { key: 'playlists', label: '歌单' },
    { key: 'artists', label: '歌手' },
    { key: 'albums', label: '专辑' }
  ]

  const displayList = computed(() => {
    return musicStore.searchResultsByType[musicStore.searchType] || []
  })

  const currentTabCount = computed(() => {
    return (musicStore.searchResultsByType[musicStore.searchType] || []).length
  })

  function handleSearchTypeChange(type) {
    musicStore.setSearchType(type)
  }

  function close() {
    musicStore.clearSearch()
  }

  useEscClose(() => visible.value, close)

  // 点击播放后关闭搜索覆盖层
  function onPlay() {
    close()
  }
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="overlay" @click.self="close">
      <div class="panel">
        <div class="panel-header">
          <div class="header-info">
            <h2 class="title">搜索结果</h2>
            <p class="subtitle">
              找到 {{ currentTabCount }} 条与 "{{ musicStore.searchKeyword }}"
              相关的结果
            </p>
          </div>
          <button class="close-btn" aria-label="关闭" @click="close">
            <X :size="20" />
          </button>
        </div>

        <!-- 搜索类型 Tab -->
        <div class="search-tabs">
          <button
            v-for="tab in SEARCH_TABS"
            :key="tab.key"
            class="search-tab"
            :class="{ active: musicStore.searchType === tab.key }"
            @click="handleSearchTypeChange(tab.key)"
          >
            {{ tab.label }}
            <span class="tab-count">
              {{ (musicStore.searchResultsByType[tab.key] || []).length }}
            </span>
          </button>
        </div>

        <!-- 加载态：单曲用行式骨架匹配 TrackList，其他用网格卡片 -->
        <div
          v-if="musicStore.searchLoading"
          class="loading-state"
          :class="{ 'loading-list': musicStore.searchType === 'tracks' }"
        >
          <div v-for="i in 6" :key="i" class="skeleton-card">
            <div class="skeleton-cover"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>

        <!-- 空态 -->
        <div v-else-if="displayList.length === 0" class="empty-state">
          <Search :size="48" color="var(--color-text-muted)" />
          <p class="empty-text">没有找到相关结果</p>
        </div>

        <!-- 单曲列表 -->
        <div
          v-else-if="musicStore.searchType === 'tracks'"
          class="results-content"
        >
          <TrackList :tracks="displayList" @play="onPlay" />
        </div>

        <!-- 歌手列表（点击跳转歌手详情页） -->
        <div
          v-else-if="musicStore.searchType === 'artists'"
          class="results-content music-grid"
        >
          <div
            v-for="item in displayList"
            :key="item.id"
            class="artist-card"
            @click="goArtist(item.id)"
          >
            <div class="artist-cover-wrapper">
              <img
                :src="getSearchCover(item)"
                :alt="item.name"
                class="artist-cover"
                loading="lazy"
              />
            </div>
            <div class="artist-name text-ellipsis">{{ item.name }}</div>
          </div>
        </div>

        <!-- 歌单卡片（可跳转详情页） -->
        <div
          v-else-if="musicStore.searchType === 'playlists'"
          class="results-content music-grid"
        >
          <MusicCard
            v-for="item in displayList"
            :key="item.id"
            :item="item"
            type="playlist"
          />
        </div>

        <!-- 专辑卡片（无独立专辑页，仅展示） -->
        <div
          v-else-if="musicStore.searchType === 'albums'"
          class="results-content music-grid"
        >
          <div
            v-for="item in displayList"
            :key="item.id"
            class="album-card"
            @click="showAlbumTip"
          >
            <div class="album-cover-wrapper">
              <img
                :src="getSearchCover(item)"
                :alt="item.name"
                class="album-cover"
                loading="lazy"
              />
            </div>
            <div class="album-name text-ellipsis">{{ item.name }}</div>
            <div class="album-artist text-ellipsis">
              {{ item.artist?.name || '' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
  }

  .panel {
    width: 100%;
    max-width: var(--content-max-width, 1200px);
    max-height: calc(100vh - var(--spacing-xl) * 2);
    background: var(--color-card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    padding: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--spacing-lg);
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--spacing-xs);
  }

  .subtitle {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--color-text-secondary);
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: var(--color-secondary-bg-hover);
    color: var(--color-text);
  }

  /* 搜索类型 Tab */
  .search-tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
    padding-bottom: var(--spacing-sm);
  }

  .search-tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text-secondary);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    transition: all var(--transition-fast);
  }

  .search-tab:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }

  .search-tab.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .tab-count {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--color-secondary-bg);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .search-tab.active .tab-count {
    background: var(--color-primary-bg-transparent, rgba(59, 130, 246, 0.1));
    color: var(--color-primary);
  }

  .results-content {
    flex: 1;
  }

  .music-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--spacing-lg);
  }

  .music-grid > * {
    min-width: 0;
  }

  /* 加载态 */
  .loading-state {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--spacing-lg);
  }

  /* 单曲加载态：行式匹配 TrackList（小封面 + 歌名/歌手行横排） */
  .loading-state.loading-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .loading-list .skeleton-card {
    flex-direction: row;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .loading-list .skeleton-cover {
    width: 40px;
    height: 40px;
    aspect-ratio: auto;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }
  .loading-list .skeleton-line {
    flex: 1;
  }
  .loading-list .skeleton-line.short {
    flex: 0 0 40%;
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
    background: linear-gradient(
      90deg,
      var(--color-secondary-bg) 25%,
      var(--color-secondary-bg-hover) 50%,
      var(--color-secondary-bg) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .skeleton-line {
    height: 14px;
    border-radius: var(--radius-sm);
    background: linear-gradient(
      90deg,
      var(--color-secondary-bg) 25%,
      var(--color-secondary-bg-hover) 50%,
      var(--color-secondary-bg) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .skeleton-line.short {
    width: 60%;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* 空态 */
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

  /* 歌手卡片 */
  .artist-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    min-width: 0;
    cursor: pointer;
    transition: transform var(--transition-base);
  }

  .artist-card:hover {
    transform: translateY(-4px);
  }

  .artist-cover-wrapper {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }

  .artist-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .artist-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    text-align: center;
    max-width: 100%;
  }

  /* 专辑卡片 */
  .album-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    min-width: 0;
    cursor: pointer;
    transition: transform var(--transition-base);
  }

  .album-card:hover {
    transform: translateY(-4px);
  }

  .album-cover-wrapper {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }

  .album-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .album-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    max-width: 100%;
  }

  .album-artist {
    font-size: 12px;
    color: var(--color-text-secondary);
    max-width: 100%;
  }
</style>
