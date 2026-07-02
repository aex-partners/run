import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { files, fileShares } from '@/platform/db/schema'
import { GetShareData, ShareData } from '@/contexts/files/application/queries/GetShareData'
import { UserNames } from '@/contexts/files/application/ports/out/UserNames'
import { FileAccess } from '@/contexts/files/domain/FileShare'

// Read-side adapter (CQRS) for `files.share.getData`: the public link plus the
// share list. Owns only the `files`/`fileShares` tables; the member display info
// (name + email) is resolved from the grantee userIds through the UserNames ACL
// out-port — never by reading the `users` table here.
export class DrizzleShareData implements GetShareData {
  constructor(
    private readonly db: Database,
    private readonly names: UserNames,
  ) {}

  async execute(input: { id: string }): Promise<ShareData> {
    const [file] = await this.db
      .select({ publicToken: files.publicToken })
      .from(files)
      .where(eq(files.id, input.id))
      .limit(1)

    if (!file) return { publicLink: null, publicEnabled: false, sharedWith: [] }

    const shares = await this.db
      .select({
        userId: fileShares.userId,
        access: fileShares.access,
      })
      .from(fileShares)
      .where(eq(fileShares.fileId, input.id))

    const infoById = await this.names.names([...new Set(shares.map((s) => s.userId))])

    return {
      publicLink: file.publicToken ? `/api/files/public/${file.publicToken}` : null,
      publicEnabled: file.publicToken !== null,
      // Mirror the previous inner join: a share whose user no longer resolves is
      // omitted from the list.
      sharedWith: shares.flatMap((s) => {
        const info = infoById.get(s.userId)
        if (!info) return []
        return [
          {
            id: s.userId,
            name: info.name || info.email || 'Unknown',
            email: info.email || '',
            access: (s.access === 'editor' ? 'editor' : 'viewer') as FileAccess,
          },
        ]
      }),
    }
  }
}
