// ACL out-port to the files context. A knowledge row may carry a `sourceFileId`
// (rows auto-indexed from a file, category "file-content"). This context must
// NOT import the files context, so it declares WHAT it needs; the composition
// root fulfills HOW by routing to the files context's in-port.
//
// Wiring: bridge in main to the files context (e.g. its GetFile / read in-port).
export interface FileSource {
  id: string
  name: string
  content: string
}

export interface FileSourceGateway {
  getContent(fileId: string): Promise<FileSource | null>
}
