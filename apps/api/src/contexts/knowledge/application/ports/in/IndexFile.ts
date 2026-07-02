import { Result } from '@/shared/kernel/Result'

// Driving port. Indexes an AI-indexed file's text as a single knowledge row
// (scope "company", category "file-content", title = fileName, sourceFileId set)
// and indexes its embedding best-effort. Plain-data in/out — no domain object
// crosses the boundary.
//
// Text extraction is the CALLER's responsibility: the files context enqueues a
// `file-indexing` job, and main's consumer reads the file and extracts plain
// text (pdf-parse for PDF, utf8 for text/json/csv, mirroring AEX's
// file-indexing-worker) before invoking this port. `mimeType` travels for
// provenance/diagnostics; no extraction happens inside this context.
//
// Idempotent on `fileId`: re-indexing the same file replaces (updates in place)
// the prior file-content row rather than creating a duplicate.
export interface IndexFileCommand {
  fileId: string
  fileName: string
  mimeType: string
  text: string
}

export interface IndexFile {
  execute(cmd: IndexFileCommand): Promise<Result<{ knowledgeId: string }>>
}
