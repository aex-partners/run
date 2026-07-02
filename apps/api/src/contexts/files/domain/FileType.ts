// Pure file-naming helpers. Ported 1:1 from AEX files/storage.ts but kept free of
// node:path so domain stays framework-agnostic: the extension is extracted with
// plain string ops. No IO, no npm — safe to call from the aggregate.

// Last extension of a filename, lowercased, without the dot. "" when there is
// none (matches node's extname for dotfiles like ".bashrc").
const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  if (dot <= slash + 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export const fileTypeFromName = (name: string): string => extensionOf(name) || 'file'

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
}

export const mimeTypeFromName = (name: string): string =>
  MIME_BY_EXT[extensionOf(name)] ?? 'application/octet-stream'

// Human-readable size. Presentation-shaped but pure, so the read-side adapters
// reuse it without duplicating the rounding rules.
export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / Math.pow(1024, i)
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[i] ?? 'B'}`
}
