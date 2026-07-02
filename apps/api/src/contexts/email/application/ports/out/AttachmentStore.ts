// ACL / driven port toward the files context. Outgoing attachments reference
// files that live in the files context's storage; reading their bytes is an
// anti-corruption boundary, not something the email context does directly. Main
// wires this to the files context (AEX read straight from files/storage). Bytes
// are a Uint8Array to keep the port free of node types.
export interface AttachmentStore {
  read(relativePath: string): Promise<Uint8Array>
}
