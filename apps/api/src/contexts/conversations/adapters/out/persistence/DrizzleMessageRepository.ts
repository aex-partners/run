import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { messages } from '@/platform/db/schema'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { Message } from '@/contexts/conversations/domain/Message'
import { MessageId } from '@/contexts/conversations/domain/ids'
import { MessageMapper } from '@/contexts/conversations/application/mappers/MessageMapper'

// Driven adapter. Stores the message aggregate in the `messages` table. `save`
// upserts (create + every transition lands here).
export class DrizzleMessageRepository implements MessageRepository {
  constructor(private readonly db: Database) {}

  nextId(): MessageId {
    return MessageId.of(randomUUID())
  }

  async findById(id: MessageId): Promise<Message | null> {
    const [row] = await this.db.select().from(messages).where(eq(messages.id, id.value)).limit(1)
    return row ? MessageMapper.toDomain(row) : null
  }

  async save(message: Message): Promise<void> {
    const row = MessageMapper.toPersistence(message)
    await this.db
      .insert(messages)
      .values(row)
      .onConflictDoUpdate({
        target: messages.id,
        set: {
          content: row.content,
          metadata: row.metadata,
          pinned: row.pinned,
          starred: row.starred,
          deletedAt: row.deletedAt,
          deletedFor: row.deletedFor,
          reactions: row.reactions,
          audioTranscription: row.audioTranscription,
          audioTranscriptionEdited: row.audioTranscriptionEdited,
        },
      })
  }

  async saveMany(messageList: readonly Message[]): Promise<void> {
    if (messageList.length === 0) return
    const rows = messageList.map((m) => MessageMapper.toPersistence(m))
    await this.db.insert(messages).values(rows)
  }
}
