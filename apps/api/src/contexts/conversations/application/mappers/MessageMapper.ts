import { Json, JsonObject, isJsonObject } from '@/shared/domain/Json'
import { Message, AudioPayload } from '@/contexts/conversations/domain/Message'
import { MessageId } from '@/contexts/conversations/domain/ids'
import { MessageRole, isMessageRole } from '@/contexts/conversations/domain/MessageRole'
import { Reaction } from '@/contexts/conversations/domain/Reaction'

// Mirrors the `messages` table. JSON-encoded columns (metadata, reactions,
// deletedFor, audioWaveform) are strings on disk; the mapper is the only place
// that parses/serializes them. Boolean flags are integer 0/1.
export interface MessageRow {
  id: string
  conversationId: string
  authorId: string | null
  agentId: string | null
  content: string
  role: MessageRole
  metadata: string | null
  pinned: number | null
  starred: number | null
  deletedAt: Date | null
  deletedFor: string | null
  reactions: string | null
  audioUrl: string | null
  audioDuration: string | null
  audioWaveform: string | null
  audioTranscription: string | null
  audioTranscriptionEdited: number | null
  createdAt: Date
}

const parseJson = (raw: string | null): Json | undefined => {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as Json
  } catch {
    return undefined
  }
}

const parseMetadata = (raw: string | null): JsonObject | null => {
  const value = parseJson(raw)
  return value !== undefined && isJsonObject(value) ? value : null
}

const parseReactions = (raw: string | null): Reaction[] => {
  const value = parseJson(raw)
  if (!Array.isArray(value)) return []
  const out: Reaction[] = []
  for (const item of value) {
    if (isJsonObject(item) && typeof item.emoji === 'string' && typeof item.userId === 'string') {
      out.push({ emoji: item.emoji, userId: item.userId })
    }
  }
  return out
}

const parseStringList = (raw: string | null): string[] => {
  const value = parseJson(raw)
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

const parseWaveform = (raw: string | null): number[] | null => {
  const value = parseJson(raw)
  if (!Array.isArray(value)) return null
  return value.filter((v): v is number => typeof v === 'number')
}

const buildAudio = (row: MessageRow): AudioPayload | null => {
  // The source only writes audio columns for audio messages; treat the absence
  // of a url as "no audio".
  if (row.audioUrl === null && row.audioDuration === null && row.audioTranscription === null) {
    return null
  }
  return {
    url: row.audioUrl ?? '',
    duration: row.audioDuration ?? '0',
    waveform: parseWaveform(row.audioWaveform),
    transcription: row.audioTranscription,
    transcriptionEdited: row.audioTranscriptionEdited === 1,
  }
}

const asRole = (raw: string): MessageRole => (isMessageRole(raw) ? raw : 'user')

export const MessageMapper = {
  toPersistence(message: Message): MessageRow {
    const audio = message.audio
    return {
      id: message.id.value,
      conversationId: message.conversationId,
      authorId: message.authorId,
      agentId: message.agentId,
      content: message.content,
      role: message.role,
      metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      pinned: message.pinned ? 1 : 0,
      starred: message.starred ? 1 : 0,
      deletedAt: message.deletedAt,
      deletedFor: message.deletedFor.length > 0 ? JSON.stringify([...message.deletedFor]) : null,
      reactions: message.reactions.length > 0 ? JSON.stringify([...message.reactions]) : null,
      audioUrl: audio ? audio.url : null,
      audioDuration: audio ? audio.duration : null,
      audioWaveform: audio && audio.waveform ? JSON.stringify(audio.waveform) : null,
      audioTranscription: audio ? audio.transcription : null,
      audioTranscriptionEdited: audio && audio.transcriptionEdited ? 1 : 0,
      createdAt: message.createdAt,
    }
  },

  toDomain(row: MessageRow): Message {
    return Message.rehydrate({
      id: MessageId.of(row.id),
      conversationId: row.conversationId,
      authorId: row.authorId,
      agentId: row.agentId,
      content: row.content,
      role: asRole(row.role),
      metadata: parseMetadata(row.metadata),
      pinned: row.pinned === 1,
      starred: row.starred === 1,
      deletedAt: row.deletedAt,
      deletedFor: parseStringList(row.deletedFor),
      reactions: parseReactions(row.reactions),
      audio: buildAudio(row),
      createdAt: row.createdAt,
    })
  },
}
