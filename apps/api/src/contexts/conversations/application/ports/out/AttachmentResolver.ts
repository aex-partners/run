// ACL (anti-corruption) out-port -> the files context. When a message carries file
// attachments, AppendMessage asks the files context to grant the other conversation
// members read access to each file. Whether/how the grant happens (e.g. only for
// files the sender owns) is the files context's decision: it owns the file ACL. The
// conversations context MUST NOT import files; main bridges this to files' share
// in-port.
export interface AttachmentResolver {
  grant(fileIds: string[], userIds: string[]): Promise<void>
}
