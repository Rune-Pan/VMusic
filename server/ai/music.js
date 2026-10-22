const text = (value, size = 200) => String(value || '').slice(0, size)
export function cleanTrack(track) {
  const privilege = track.privilege || {}
  const artists = track.ar || track.artists || []
  const album = track.al || track.album || {}
  return {
    id: Number(track.id),
    name: text(track.name),
    artists: artists.slice(0, 5).map(artist => ({
      id: Number(artist.id) || null,
      name: text(artist.name)
    })),
    album: { id: Number(album.id) || null, name: text(album.name) },
    duration: Number(track.dt || track.duration) || 0,
    playable: !(privilege.cs || privilege.fee === 4),
    permission: privilege.cs
      ? '无版权'
      : privilege.fee === 4
        ? '需购买'
        : privilege.fee === 1 || privilege.pl === 0
          ? 'VIP／可能仅试听'
          : ''
  }
}

export function createMusicReader({
  baseUrl = 'http://127.0.0.1:3000',
  cookie = '',
  signal,
  fetcher = fetch
}) {
  async function get(path, params = {}) {
    const url = new URL(path, baseUrl)
    url.search = new URLSearchParams({
      ...params,
      timestamp: Date.now()
    }).toString()
    const response = await fetcher(url, {
      signal,
      headers: { cookie },
      redirect: 'error'
    })
    if (!response.ok) throw new Error('音乐数据暂时不可用')
    let body = await response.json().catch(() => {
      throw new Error('音乐数据格式无效')
    })
    while (body?.body && typeof body.body === 'object') {
      if (body.code != null && Number(body.code) !== 200)
        throw new Error('音乐接口未成功返回')
      body = body.body
    }
    if (Number(body?.code) !== 200)
      throw new Error(
        Number(body?.code) === 301
          ? '音乐会话已失效，请重新登录'
          : '音乐数据暂时不可用'
      )
    return body
  }
  async function details(ids) {
    const body = await get('/song/detail', { ids: ids.slice(0, 20).join(',') })
    if (!Array.isArray(body.songs)) throw new Error('歌曲详情暂时不可用')
    return body.songs
      .map(track =>
        cleanTrack({
          ...track,
          privilege:
            body.privileges?.find(p => Number(p.id) === Number(track.id)) ||
            track.privilege
        })
      )
      .filter(track => Number.isSafeInteger(track.id) && track.id > 0)
  }
  async function personal(uid) {
    const tracks = [],
      missing = []
    async function sample(label, run) {
      try {
        for (const track of await run())
          tracks.push({ ...track, source: label })
      } catch (error) {
        if (signal.aborted) throw error
        missing.push(label + '暂不可用')
      }
    }
    await sample('喜欢歌曲样本（无序）', async () => {
      const body = await get('/likelist', { uid })
      return body.ids?.length ? details(body.ids.slice(0, 20)) : []
    })
    const lists = await get('/user/playlist', { uid, limit: 5 }).catch(
      error => {
        if (signal.aborted) throw error
        missing.push('个人歌单暂不可用')
        return {}
      }
    )
    for (const playlist of (lists.playlist || []).slice(0, 5)) {
      await sample(
        `${Number(playlist.creator?.userId) === Number(uid) ? '本人创建歌单' : '收藏歌单'}：${text(playlist.name)}`,
        async () => {
          const body = await get('/playlist/detail', { id: playlist.id })
          return (body.playlist?.tracks || []).slice(0, 5).map(cleanTrack)
        }
      )
    }
    await sample('云端近期播放', async () => {
      const body = await get('/record/recent/song', { limit: 20 })
      if (!Array.isArray(body.data?.list)) throw new Error('近期播放不可用')
      return body.data.list
        .slice(0, 20)
        .map(item => cleanTrack(item.data || item.song || {}))
        .filter(track => track.id > 0)
    })
    return {
      tracks: [
        ...new Map(tracks.map(track => [track.id, track])).values()
      ].slice(0, 65),
      missing
    }
  }
  return {
    async account() {
      const data = await get('/user/account')
      const id = data.profile?.userId || data.account?.id
      if (!id) throw new Error('请先登录音乐账号')
      return String(id)
    },
    async search(query) {
      const data = await get('/search', {
        keywords: text(query, 120),
        type: 1,
        limit: 10
      })
      return (data.result?.songs || data.result?.song?.songs || [])
        .slice(0, 10)
        .map(cleanTrack)
        .filter(track => track.id > 0)
    },
    details,
    personal,
    async lyrics(id) {
      const data = await get('/lyric', { id })
      const lyric = text(data.lrc?.lyric, 10000)
      if (!lyric.trim()) throw new Error('这首歌曲暂时没有可解读的歌词')
      return { lyric, truncated: String(data.lrc?.lyric || '').length > 10000 }
    },
    async comments(type, id) {
      const rows = [],
        counts = []
      for (const sortType of [2, 3]) {
        const body = await get('/comment/new', {
          type: type === 'playlist' ? 2 : 0,
          id,
          sortType,
          pageNo: 1,
          pageSize: 20
        })
        if (!Array.isArray(body.data?.comments))
          throw new Error('评论样本暂不可用')
        const sample = body.data.comments.slice(0, 20)
        counts.push({
          label: sortType === 2 ? '最热' : '最新',
          count: sample.length
        })
        rows.push(
          ...sample.map(row => ({
            id: row.commentId,
            content: text(row.content, 300),
            likedCount: Number(row.likedCount) || 0,
            time: Number(row.time) || null
          }))
        )
      }
      const comments = [
        ...new Map(rows.map(row => [String(row.id), row])).values()
      ]
      if (!comments.length) throw new Error('当前没有可总结的评论')
      return {
        comments,
        counts,
        uniqueCount: comments.length,
        note: '仅代表最热与最新的已获取样本，每条最多300字，并非全部评论。'
      }
    }
  }
}
