<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { Play, Loader2 } from '@/components/icons'
  import { useMusicStore } from '@/stores/music'
  import { usePlayerStore } from '@/stores/player'
  import { getPlaylistDetail } from '@/api/playlist'

  const router = useRouter()
  const musicStore = useMusicStore()
  const playerStore = usePlayerStore()

  const loading = ref(false)
  const error = ref('')
  const activeCategory = ref('全部')

  // 排行榜分类：从 API 数据中提取，或使用默认分类
  const CATEGORIES = ['全部', '官方榜', '精选榜', '全球榜']

  // 根据榜单名称判断分类
  function getCategoryName(name) {
    if (/飙升|新歌|热歌|原创|飙升榜|新歌榜|热歌榜/.test(name)) return '官方榜'
    if (/全球|欧美|韩国|日本|UK|Billboard|美国/.test(name)) return '全球榜'
    return '精选榜'
  }

  // 分类后的榜单数据
  const categorizedToplists = computed(() => {
    const list = musicStore.toplistData
    if (activeCategory.value === '全部') return list
    return list.filter(
      item => getCategoryName(item.name) === activeCategory.value
    )
  })

  // 异步加载每个榜单的前三首歌曲（结果缓存在 musicStore.toplistCache 中）
  async function loadTopTracks(id) {
    await musicStore.fetchToplistDetail(id)
  }

  // 切换分类
  function switchCategory(cat) {
    activeCategory.value = cat
  }

  // 跳转到歌单详情
  function goToPlaylist(id) {
    router.push({ name: 'playlist', params: { id } })
  }

  // 播放榜单（获取完整曲目列表）
  async function playToplist(id) {
    try {
      const data = await getPlaylistDetail(id)
      const tracks = data.playlist?.tracks || []
      if (tracks.length > 0) {
        playerStore.play(tracks[0], tracks)
      }
    } catch (e) {
      console.error('Failed to play toplist:', e)
    }
  }

  onMounted(async () => {
    loading.value = true
    error.value = ''
    try {
      await musicStore.fetchToplists()
      // 异步加载所有榜单的前三首歌曲
      for (const item of musicStore.toplistData) {
        loadTopTracks(item.id)
      }
    } catch (e) {
      console.error('Failed to load toplists:', e)
      error.value = '加载失败，请稍后重试'
    } finally {
      loading.value = false
    }
  })
</script>

<template>
  <div class="toplist-view">
    <!-- 标题区 -->
    <div class="tl-header">
      <div class="tl-header-content">
        <h1 class="tl-title">排行榜</h1>
        <p class="tl-subtitle">发现最受欢迎的音乐榜单</p>
      </div>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="tl-loading">
      <Loader2 class="spin" :size="32" />
      <span>加载中...</span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="tl-error">
      {{ error }}
    </div>

    <!-- 内容区 -->
    <template v-else>
      <!-- 分类Tab -->
      <div class="tl-tabs">
        <button
          v-for="cat in CATEGORIES"
          :key="cat"
          class="tl-tab"
          :class="{ active: activeCategory === cat }"
          @click="switchCategory(cat)"
        >
          {{ cat }}
        </button>
      </div>

      <!-- 榜单网格 -->
      <div v-if="categorizedToplists.length > 0" class="tl-grid">
        <div
          v-for="item in categorizedToplists"
          :key="item.id"
          class="tl-card"
          role="link"
          tabindex="0"
          @keydown.enter.self="goToPlaylist(item.id)"
          @click="goToPlaylist(item.id)"
        >
          <div class="tl-card-cover">
            <img
              :src="item.coverImgUrl"
              :alt="item.name"
              class="tl-card-img"
              loading="lazy"
              decoding="async"
            />
            <div class="tl-card-overlay">
              <button
                class="tl-play-btn"
                :aria-label="`播放${item.name}`"
                @click.stop="playToplist(item.id)"
              >
                <Play :size="20" color="#ffffff" fill="#ffffff" />
              </button>
            </div>
            <span v-if="item.updateFrequency" class="tl-update-freq">
              {{ item.updateFrequency }}
            </span>
          </div>
          <div class="tl-card-info">
            <div class="tl-card-name text-ellipsis">{{ item.name }}</div>
            <!-- 前三首歌曲预览 -->
            <div class="tl-tracks-preview">
              <div
                v-if="
                  musicStore.toplistCache[item.id] &&
                  musicStore.toplistCache[item.id].length > 0
                "
              >
                <div
                  v-for="(track, idx) in musicStore.toplistCache[item.id]"
                  :key="track.id"
                  class="tl-track-item"
                >
                  <span class="tl-track-idx">{{ idx + 1 }}</span>
                  <span class="tl-track-name text-ellipsis">
                    {{ track.name }}
                  </span>
                  <span class="tl-track-artist text-ellipsis">
                    - {{ track.ar?.map(a => a.name).join(', ') || '未知歌手' }}
                  </span>
                </div>
              </div>
              <div v-else class="tl-tracks-loading">
                <Loader2 class="spin-sm" :size="14" />
                <span>加载歌曲中...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="tl-empty">暂无排行榜数据</div>
    </template>
  </div>
</template>

<style scoped>
  .toplist-view {
    padding: var(--spacing-xl) var(--spacing-2xl);
    max-width: 1200px;
    margin: 0 auto;
  }

  /* 标题区 */
  .tl-header {
    margin-bottom: var(--spacing-xl);
  }

  .tl-header-content {
    display: flex;
    flex-direction: column;
  }

  .tl-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  .tl-subtitle {
    font-size: 14px;
    color: var(--color-text-muted);
    margin: 4px 0 0;
  }

  /* 加载态 */
  .tl-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--spacing-2xl);
    color: var(--color-text-muted);
  }

  /* 错误态 */
  .tl-error {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-error);
  }

  /* 分类Tab */
  .tl-tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
    padding-bottom: var(--spacing-sm);
  }

  .tl-tab {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text-secondary);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    transition: all var(--transition-fast);
  }

  .tl-tab:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }

  .tl-tab.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  /* 榜单网格 */
  .tl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--spacing-lg);
  }

  /* 榜单卡片 */
  .tl-card {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-card-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-light);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .tl-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  /* 封面 */
  .tl-card-cover {
    position: relative;
    width: 120px;
    height: 120px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex-shrink: 0;
  }

  .tl-card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tl-card-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity var(--transition-base);
  }

  .tl-card-cover:hover .tl-card-overlay {
    opacity: 1;
  }

  .tl-play-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-md);
  }

  .tl-play-btn:hover {
    background: var(--color-primary-hover);
  }

  .tl-update-freq {
    position: absolute;
    bottom: 4px;
    left: 4px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.65);
    border-radius: var(--radius-sm);
    font-size: 10px;
    color: #ffffff;
  }

  /* 信息区 */
  .tl-card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .tl-card-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  /* 前三首歌曲预览 */
  .tl-tracks-preview {
    margin-top: var(--spacing-xs);
  }

  .tl-track-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 2px 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .tl-track-idx {
    width: 16px;
    text-align: center;
    font-weight: 600;
    color: var(--color-primary);
    flex-shrink: 0;
  }

  .tl-track-name {
    max-width: 100px;
    color: var(--color-text);
    font-weight: 500;
  }

  .tl-track-artist {
    max-width: 100px;
    color: var(--color-text-muted);
  }

  .tl-tracks-loading {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: 12px;
    color: var(--color-text-muted);
    padding: var(--spacing-xs) 0;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  .spin-sm {
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

  /* 空态 */
  .tl-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-muted);
    font-size: 14px;
  }

  /* 响应式 */
</style>
