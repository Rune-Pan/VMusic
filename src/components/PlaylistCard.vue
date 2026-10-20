<script setup>
  import { useRouter } from 'vue-router'
  import { Music } from '@/components/icons'

  const props = defineProps({
    playlist: { type: Object, required: true }
  })

  const router = useRouter()

  function goToPlaylist() {
    router.push({ name: 'playlist', params: { id: props.playlist.id } })
  }
</script>

<template>
  <div
    class="playlist-card"
    role="link"
    tabindex="0"
    :aria-label="playlist.name"
    @click="goToPlaylist"
    @keydown.enter.self="goToPlaylist"
  >
    <div class="cover-wrapper">
      <img
        :src="playlist.coverUrl"
        :alt="playlist.name"
        class="cover"
        loading="lazy"
      />
      <div class="track-count">
        <Music :size="12" color="#ffffff" />
        <span>{{ playlist.trackCount ?? playlist.tracks?.length ?? 0 }}</span>
      </div>
    </div>
    <div class="info">
      <div class="name text-ellipsis">{{ playlist.name }}</div>
      <div class="desc text-ellipsis">
        {{ playlist.description || '暂无简介' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
  .playlist-card {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-card-bg);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid var(--color-border-light);
    overflow: hidden;
  }

  .playlist-card:hover {
    background: var(--color-secondary-bg);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .cover-wrapper {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex-shrink: 0;
  }

  .cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .track-count {
    position: absolute;
    bottom: 4px;
    right: 4px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: var(--radius-full);
    font-size: 11px;
    color: #ffffff;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 2px;
  }

  .desc {
    font-size: 12px;
    color: var(--color-text-secondary);
    flex: 1;
  }
</style>
