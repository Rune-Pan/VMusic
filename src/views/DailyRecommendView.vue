<script setup>
  import { ref, onMounted } from 'vue'
  import { Play, Loader2 } from '@/components/icons'
  import { useMusicStore } from '@/stores/music'
  import { usePlayerStore } from '@/stores/player'
  import TrackList from '@/components/TrackList.vue'
  import PlaylistCard from '@/components/PlaylistCard.vue'

  const musicStore = useMusicStore()
  const playerStore = usePlayerStore()

  const dailySongs = ref([])
  const recommendPlaylists = ref([])
  const loading = ref(false)
  const error = ref('')
  const activeTab = ref('songs')

  async function fetchData() {
    loading.value = true
    error.value = ''
    try {
      const data = await musicStore.fetchDailyRecommend()
      dailySongs.value = data.songs
      recommendPlaylists.value = data.playlists
    } catch (e) {
      console.error('Failed to load daily recommend:', e)
      error.value = '加载失败，请稍后重试'
    } finally {
      loading.value = false
    }
  }

  function playAll() {
    if (dailySongs.value.length === 0) return
    playerStore.play(dailySongs.value[0], dailySongs.value)
  }

  onMounted(fetchData)
</script>

<template>
  <div class="daily-recommend-view">
    <div class="dr-header">
      <div class="dr-header-content">
        <h1 class="dr-title">每日推荐</h1>
        <p class="dr-subtitle">根据你的音乐口味生成，每天更新</p>
      </div>
      <button
        v-if="dailySongs.length > 0 && activeTab === 'songs'"
        class="play-all-btn"
        @click="playAll"
      >
        <Play :size="18" />
        <span>播放全部</span>
      </button>
    </div>

    <div v-if="loading" class="dr-loading">
      <Loader2 class="spin" :size="32" />
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="dr-error">
      {{ error }}
    </div>

    <template v-else>
      <div class="dr-tabs">
        <button
          class="dr-tab"
          :class="{ active: activeTab === 'songs' }"
          @click="activeTab = 'songs'"
        >
          推荐歌曲
          <span v-if="dailySongs.length > 0" class="dr-tab-count">
            {{ dailySongs.length }}
          </span>
        </button>
        <button
          class="dr-tab"
          :class="{ active: activeTab === 'playlists' }"
          @click="activeTab = 'playlists'"
        >
          推荐歌单
          <span v-if="recommendPlaylists.length > 0" class="dr-tab-count">
            {{ recommendPlaylists.length }}
          </span>
        </button>
      </div>

      <div class="dr-content">
        <div v-if="activeTab === 'songs'">
          <TrackList v-if="dailySongs.length > 0" :tracks="dailySongs" />
          <div v-else class="dr-empty">暂无推荐歌曲</div>
        </div>

        <div v-if="activeTab === 'playlists'">
          <div v-if="recommendPlaylists.length > 0" class="dr-playlists">
            <PlaylistCard
              v-for="playlist in recommendPlaylists"
              :key="playlist.id"
              :playlist="{
                id: playlist.id,
                name: playlist.name,
                coverUrl: playlist.coverImgUrl || playlist.picUrl,
                description:
                  playlist.description ||
                  playlist.copywriter ||
                  (playlist.creator ? 'by ' + playlist.creator.nickname : ''),
                tracks: [],
                trackCount: playlist.trackCount || 0
              }"
            />
          </div>
          <div v-else class="dr-empty">暂无推荐歌单</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
  .daily-recommend-view {
    padding: var(--spacing-xl) var(--spacing-2xl);
    max-width: 1200px;
    margin: 0 auto;
  }

  .dr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-xl);
  }

  .dr-header-content {
    display: flex;
    flex-direction: column;
  }

  .dr-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }

  .dr-subtitle {
    font-size: 14px;
    color: var(--color-text-muted);
    margin: 4px 0 0;
  }

  .play-all-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-full);
    font-size: 14px;
    font-weight: 600;
    transition: all var(--transition-fast);
  }

  .play-all-btn:hover {
    background: var(--color-primary-light);
    transform: scale(1.02);
  }

  .dr-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--spacing-2xl);
    color: var(--color-text-muted);
  }

  .dr-error {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--color-error);
  }

  .dr-tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
    padding-bottom: var(--spacing-sm);
  }

  .dr-tab {
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

  .dr-tab:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }

  .dr-tab.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .dr-tab-count {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--color-secondary-bg);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .dr-tab.active .dr-tab-count {
    background: var(--color-primary-bg-transparent);
    color: var(--color-primary);
  }

  .dr-content {
    min-height: 300px;
  }

  .dr-playlists {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-md);
  }

  .dr-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    color: var(--color-text-muted);
    font-size: 14px;
  }
</style>
