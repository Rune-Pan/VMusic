import { expect, it } from 'vitest'
import { aiHistory } from '@/utils/aiHistory'

it('独立本机历史按账号隔离并限制20段，每段最多20轮，可分别删除', async () => {
  const uid = 'fixture-ai-history-' + Date.now()
  const other = uid + '-other'
  try {
    await aiHistory.save({ id: other, uid: other, updatedAt: 1, messages: [] })
    for (let index = 0; index < 22; index++)
      await aiHistory.save({
        id: uid + index,
        uid,
        updatedAt: index,
        messages: Array.from({ length: 45 }, () => ({
          role: 'user',
          content: 'fixture'
        }))
      })
    const records = await aiHistory.load(uid)
    expect(records).toHaveLength(20)
    expect(records[0].messages).toHaveLength(40)
    expect(await aiHistory.load(other)).toHaveLength(1)
    await aiHistory.remove(records[0].id, other)
    expect(await aiHistory.load(uid)).toHaveLength(20)
    await aiHistory.clear(uid)
    expect(await aiHistory.load(uid)).toHaveLength(0)
    expect(await aiHistory.load(other)).toHaveLength(1)
  } finally {
    await aiHistory.clear(uid)
    await aiHistory.clear(other)
  }
})
