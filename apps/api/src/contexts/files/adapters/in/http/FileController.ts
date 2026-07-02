import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { UploadFile } from '@/contexts/files/application/ports/in/UploadFile'
import { CreateFolder } from '@/contexts/files/application/ports/in/CreateFolder'
import { RenameFile } from '@/contexts/files/application/ports/in/RenameFile'
import { MoveFile } from '@/contexts/files/application/ports/in/MoveFile'
import { StarFile } from '@/contexts/files/application/ports/in/StarFile'
import { TrashFile } from '@/contexts/files/application/ports/in/TrashFile'
import { RestoreFile } from '@/contexts/files/application/ports/in/RestoreFile'
import { PermanentDeleteFile } from '@/contexts/files/application/ports/in/PermanentDeleteFile'
import { EmptyTrash } from '@/contexts/files/application/ports/in/EmptyTrash'
import { ToggleAiIndex } from '@/contexts/files/application/ports/in/ToggleAiIndex'
import { GeneratePublicLink } from '@/contexts/files/application/ports/in/GeneratePublicLink'
import { ShareFile } from '@/contexts/files/application/ports/in/ShareFile'
import { UnshareFile } from '@/contexts/files/application/ports/in/UnshareFile'
import { ChangeShareAccess } from '@/contexts/files/application/ports/in/ChangeShareAccess'
import { ListFiles } from '@/contexts/files/application/queries/ListFiles'
import { GetFile } from '@/contexts/files/application/queries/GetFile'
import { CategoryCounts } from '@/contexts/files/application/queries/CategoryCounts'
import { GetShareData } from '@/contexts/files/application/queries/GetShareData'

export interface FileControllerDeps {
  uploadFile: UploadFile
  createFolder: CreateFolder
  renameFile: RenameFile
  moveFile: MoveFile
  starFile: StarFile
  trashFile: TrashFile
  restoreFile: RestoreFile
  permanentDeleteFile: PermanentDeleteFile
  emptyTrash: EmptyTrash
  toggleAiIndex: ToggleAiIndex
  generatePublicLink: GeneratePublicLink
  shareFile: ShareFile
  unshareFile: UnshareFile
  changeShareAccess: ChangeShareAccess
  listFiles: ListFiles
  getFile: GetFile
  categoryCounts: CategoryCounts
  shareData: GetShareData
}

// Driving adapter (tRPC). Ports the AEX filesRouter 1:1: validates input with the
// same zod shapes, calls the in-port/query, unwraps Result into a response or a
// tRPC error. Owner scoping comes from the authenticated ctx.user. Holds no
// logic of its own.
export const fileController = (deps: FileControllerDeps) =>
  router({
    list: protectedProcedure
      .input(
        z
          .object({
            parentId: z.string().nullable().optional(),
            category: z.enum(['all', 'starred', 'recent', 'shared', 'trash']).default('all'),
            source: z.enum(['all', 'email', 'chat', 'generated', 'upload', 'workflow']).default('all'),
            search: z.string().optional(),
            limit: z.number().min(1).max(200).default(100),
            offset: z.number().min(0).default(0),
          })
          .default({}),
      )
      .query(({ ctx, input }) =>
        deps.listFiles.execute({
          ownerId: ctx.user.id,
          parentId: input.parentId,
          category: input.category,
          source: input.source,
          search: input.search,
          limit: input.limit,
          offset: input.offset,
        }),
      ),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => deps.getFile.execute({ id: input.id })),

    createFolder: protectedProcedure
      .input(z.object({ name: z.string().min(1), parentId: z.string().nullable().optional() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.createFolder.execute({
            ownerId: ctx.user.id,
            name: input.name,
            parentId: input.parentId ?? null,
          }),
        ),
      ),

    rename: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .mutation(async ({ input }) => unwrap(await deps.renameFile.execute(input))),

    move: protectedProcedure
      .input(z.object({ id: z.string(), parentId: z.string().nullable() }))
      .mutation(async ({ input }) => unwrap(await deps.moveFile.execute(input))),

    star: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.starFile.execute(input))),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.trashFile.execute(input))),

    restore: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.restoreFile.execute(input))),

    permanentDelete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => unwrap(await deps.permanentDeleteFile.execute(input))),

    emptyTrash: protectedProcedure.mutation(async ({ ctx }) =>
      unwrap(await deps.emptyTrash.execute({ ownerId: ctx.user.id })),
    ),

    toggleAiIndex: protectedProcedure
      .input(z.object({ id: z.string(), enabled: z.boolean() }))
      .mutation(async ({ input }) => unwrap(await deps.toggleAiIndex.execute(input))),

    categoryCounts: protectedProcedure.query(({ ctx }) =>
      deps.categoryCounts.execute({ ownerId: ctx.user.id }),
    ),

    share: router({
      getData: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(({ input }) => deps.shareData.execute({ id: input.id })),

      togglePublic: protectedProcedure
        .input(z.object({ id: z.string(), enabled: z.boolean() }))
        .mutation(async ({ input }) => unwrap(await deps.generatePublicLink.execute(input))),

      addUser: protectedProcedure
        .input(
          z.object({
            fileId: z.string(),
            email: z.string().email(),
            access: z.enum(['viewer', 'editor']).default('viewer'),
          }),
        )
        .mutation(async ({ input }) => unwrap(await deps.shareFile.execute(input))),

      removeUser: protectedProcedure
        .input(z.object({ fileId: z.string(), userId: z.string() }))
        .mutation(async ({ input }) => unwrap(await deps.unshareFile.execute(input))),

      changeAccess: protectedProcedure
        .input(z.object({ fileId: z.string(), userId: z.string(), access: z.enum(['viewer', 'editor']) }))
        .mutation(async ({ input }) => unwrap(await deps.changeShareAccess.execute(input))),
    }),
  })
