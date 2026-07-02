import { Result } from '@/shared/kernel/Result'

// Driving port. Edits the transcription of an audio message. Author-only.
export interface EditTranscriptionCommand {
  messageId: string
  userId: string
  transcription: string
}

export interface EditTranscription {
  execute(cmd: EditTranscriptionCommand): Promise<Result<{ success: true }>>
}
