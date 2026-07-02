// Wiring for the `files` context (drive-style storage + sharing). Its two ACL
// bridges resolve share grantees/names through identity in-ports. The file-indexing
// worker consumer bridges to knowledge.IndexFile (file RAG), so this builder takes
// the knowledge indexing handles. Exposes the FileStorage (email AttachmentStore
// reads attachments through it), uploadFile (raw HTTP) and the indexing consumer.
import { Infra } from '@/main/wiring/infra'
import { AclProviders } from '@/main/wiring/aclProviders'
import { KnowledgeWiring } from '@/main/wiring/knowledge'

import { DrizzleFileRepository } from '@/contexts/files/adapters/out/persistence/DrizzleFileRepository'
import { UserDirectory as FilesUserDirectory } from '@/contexts/files/application/ports/out/UserDirectory'
import { UserNames } from '@/contexts/files/application/ports/out/UserNames'
import { DrizzleListFiles } from '@/contexts/files/adapters/out/persistence/DrizzleListFiles'
import { DrizzleGetFile } from '@/contexts/files/adapters/out/persistence/DrizzleGetFile'
import { DrizzleShareData } from '@/contexts/files/adapters/out/persistence/DrizzleShareData'
import { DrizzleCategoryCounts } from '@/contexts/files/adapters/out/persistence/DrizzleCategoryCounts'
import { FilesystemFileStorage } from '@/contexts/files/adapters/out/storage/FilesystemFileStorage'
import { BullMqFileIndexingQueue } from '@/contexts/files/adapters/out/queue/BullMqFileIndexingQueue'
import { UploadFileService } from '@/contexts/files/application/use-cases/UploadFileService'
import { CreateFolderService } from '@/contexts/files/application/use-cases/CreateFolderService'
import { RenameFileService } from '@/contexts/files/application/use-cases/RenameFileService'
import { MoveFileService } from '@/contexts/files/application/use-cases/MoveFileService'
import { StarFileService } from '@/contexts/files/application/use-cases/StarFileService'
import { TrashFileService } from '@/contexts/files/application/use-cases/TrashFileService'
import { RestoreFileService } from '@/contexts/files/application/use-cases/RestoreFileService'
import { PermanentDeleteFileService } from '@/contexts/files/application/use-cases/PermanentDeleteFileService'
import { EmptyTrashService } from '@/contexts/files/application/use-cases/EmptyTrashService'
import { ToggleAiIndexService } from '@/contexts/files/application/use-cases/ToggleAiIndexService'
import { GeneratePublicLinkService } from '@/contexts/files/application/use-cases/GeneratePublicLinkService'
import { ShareFileService } from '@/contexts/files/application/use-cases/ShareFileService'
import { UnshareFileService } from '@/contexts/files/application/use-cases/UnshareFileService'
import { ChangeShareAccessService } from '@/contexts/files/application/use-cases/ChangeShareAccessService'
import { fileController } from '@/contexts/files/adapters/in/http/FileController'
import { FileId } from '@/contexts/files/domain/ids'
import { IndexFileService } from '@/contexts/knowledge/application/use-cases/IndexFileService'

type FilesDeps = Pick<AclProviders, 'findUserByEmail' | 'getUsers' | 'fileShareRepo'> & {
  knowledgeIndexing: KnowledgeWiring['indexing']
}

export function wireFiles(infra: Infra, deps: FilesDeps) {
  const { db, events, clock, bullConnection } = infra
  const { findUserByEmail, getUsers, fileShareRepo, knowledgeIndexing } = deps
  const { knowledgeRepo, embeddings, vectorStore } = knowledgeIndexing

  const fileRepo = new DrizzleFileRepository(db)
  // fileShareRepo + grantFileAccess are built in the early ACL-providers block.
  // ACL bridge: files UserDirectory -> identity.FindUserByEmail (resolve a share
  // grantee by email).
  const filesUserDirectory: FilesUserDirectory = {
    findUserIdByEmail: (email) => findUserByEmail.execute(email),
  }
  const fileStorage = new FilesystemFileStorage(process.env.FILE_STORAGE_PATH ?? './uploads')
  const fileIndexingQueue = new BullMqFileIndexingQueue(bullConnection)
  // Consumer for the file-indexing queue: load the file, extract its text, and
  // hand it to knowledge.IndexFile (the cross-context bridge for file RAG).
  const indexFile = new IndexFileService(knowledgeRepo, embeddings, vectorStore, events, clock)
  const extractFileText = async (bytes: Uint8Array, mimeType: string | null): Promise<string> => {
    if (mimeType === 'application/pdf') {
      const mod = (await import('pdf-parse')) as unknown as { default: (b: Buffer) => Promise<{ text: string }> }
      return (await mod.default(Buffer.from(bytes))).text
    }
    return Buffer.from(bytes).toString('utf8')
  }
  const runFileIndexing = async (fileId: string): Promise<void> => {
    const file = await fileRepo.findById(FileId.of(fileId))
    if (!file || file.isFolder || !file.path) return
    const bytes = await fileStorage.read(file.path)
    const text = await extractFileText(bytes, file.mimeType)
    if (text.trim().length === 0) return
    await indexFile.execute({ fileId, fileName: file.name, mimeType: file.mimeType ?? '', text })
  }
  const listFiles = new DrizzleListFiles(db)
  const getFile = new DrizzleGetFile(db)
  // ACL bridge: files UserNames -> identity.GetUsers (share view names, no users join).
  const shareNames: UserNames = {
    names: async (ids) => {
      const us = await getUsers.execute(ids)
      return new Map(us.map((u) => [u.id, { name: u.name, email: u.email }]))
    },
  }
  const shareData = new DrizzleShareData(db, shareNames)
  const categoryCounts = new DrizzleCategoryCounts(db)
  const uploadFile = new UploadFileService(fileRepo, fileStorage, events, clock)
  const createFolder = new CreateFolderService(fileRepo, events, clock)
  const renameFile = new RenameFileService(fileRepo, events, clock)
  const moveFile = new MoveFileService(fileRepo, events, clock)
  const starFile = new StarFileService(fileRepo, events, clock)
  const trashFile = new TrashFileService(fileRepo, events, clock)
  const restoreFile = new RestoreFileService(fileRepo, events, clock)
  const permanentDeleteFile = new PermanentDeleteFileService(fileRepo, fileStorage, events, clock)
  const emptyTrash = new EmptyTrashService(fileRepo, fileStorage, events, clock)
  const toggleAiIndex = new ToggleAiIndexService(fileRepo, fileIndexingQueue, events, clock)
  const generatePublicLink = new GeneratePublicLinkService(fileRepo, events, clock)
  const shareFile = new ShareFileService(fileShareRepo, filesUserDirectory, events, clock)
  const unshareFile = new UnshareFileService(fileShareRepo, events, clock)
  const changeShareAccess = new ChangeShareAccessService(fileShareRepo, events, clock)
  const filesCtl = fileController({
    uploadFile, createFolder, renameFile, moveFile, starFile, trashFile, restoreFile,
    permanentDeleteFile, emptyTrash, toggleAiIndex, generatePublicLink, shareFile, unshareFile,
    changeShareAccess, listFiles, getFile, categoryCounts, shareData,
  })

  return {
    controller: filesCtl,
    ports: { fileStorage, uploadFile, runFileIndexing },
  }
}

export type FilesWiring = ReturnType<typeof wireFiles>
