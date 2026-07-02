// VO. Where a file came from. Mirrors the AEX `files.source` enum and drives the
// list-screen source filter. A file is born from exactly one origin.
export type FileSource = 'email' | 'chat' | 'generated' | 'upload' | 'workflow'

export const FILE_SOURCES: readonly FileSource[] = [
  'email',
  'chat',
  'generated',
  'upload',
  'workflow',
]

export const isFileSource = (v: string): v is FileSource =>
  (FILE_SOURCES as readonly string[]).includes(v)
