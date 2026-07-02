import { describe, it, expect } from 'vitest'
import { fileTypeFromName, mimeTypeFromName, formatFileSize } from '@/contexts/files/domain/FileType'
import { FILE_SOURCES, isFileSource } from '@/contexts/files/domain/FileSource'

describe('fileTypeFromName', () => {
  it('returns the lowercased extension', () => {
    expect(fileTypeFromName('Report.PDF')).toBe('pdf')
    expect(fileTypeFromName('archive.tar.gz')).toBe('gz')
  })

  it('returns "file" when there is no extension', () => {
    expect(fileTypeFromName('README')).toBe('file')
  })

  it('treats a dotfile as having no extension', () => {
    expect(fileTypeFromName('.bashrc')).toBe('file')
  })

  it('ignores dots in directory segments', () => {
    expect(fileTypeFromName('my.dir/file')).toBe('file')
  })
})

describe('mimeTypeFromName', () => {
  it('maps known extensions', () => {
    expect(mimeTypeFromName('a.pdf')).toBe('application/pdf')
    expect(mimeTypeFromName('a.png')).toBe('image/png')
    expect(mimeTypeFromName('a.jpeg')).toBe('image/jpeg')
    expect(mimeTypeFromName('a.csv')).toBe('text/csv')
  })

  it('falls back to application/octet-stream for unknown or missing extensions', () => {
    expect(mimeTypeFromName('a.unknownext')).toBe('application/octet-stream')
    expect(mimeTypeFromName('noext')).toBe('application/octet-stream')
    expect(mimeTypeFromName('.bashrc')).toBe('application/octet-stream')
  })
})

describe('formatFileSize', () => {
  it('formats zero and non-positive as 0 B', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(-5)).toBe('0 B')
  })

  it('formats bytes, KB and MB with the rounding rule (one decimal below 10)', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(15 * 1024)).toBe('15 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
  })
})

describe('FileSource enum', () => {
  it('lists the five sources', () => {
    expect(FILE_SOURCES).toEqual(['email', 'chat', 'generated', 'upload', 'workflow'])
  })

  it('isFileSource is a correct type guard', () => {
    expect(isFileSource('email')).toBe(true)
    expect(isFileSource('workflow')).toBe(true)
    expect(isFileSource('nope')).toBe(false)
  })
})
