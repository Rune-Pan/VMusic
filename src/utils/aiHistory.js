import Dexie from 'dexie'

const db = new Dexie('tingchao-ai-conversations')
db.version(1).stores({ conversations: 'id,uid,updatedAt' })

export const aiHistory = {
  async load(uid) {
    const records = await db.conversations
      .where('uid')
      .equals(uid)
      .sortBy('updatedAt')
    return records.reverse().slice(0, 20)
  },
  async save(conversation) {
    const snapshot = JSON.parse(JSON.stringify(conversation))
    snapshot.messages = snapshot.messages.slice(-40)
    await db.transaction('rw', db.conversations, async () => {
      await db.conversations.put(snapshot)
      const records = await db.conversations
        .where('uid')
        .equals(snapshot.uid)
        .sortBy('updatedAt')
      if (records.length > 20)
        await db.conversations.bulkDelete(
          records.slice(0, -20).map(record => record.id)
        )
    })
  },
  async remove(id, uid) {
    await db.transaction('rw', db.conversations, async () => {
      if ((await db.conversations.get(id))?.uid === uid)
        await db.conversations.delete(id)
    })
  },
  clear: uid => db.conversations.where('uid').equals(uid).delete()
}
