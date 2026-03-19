import { useState, useEffect, useCallback } from 'react'
import {
  HardDrive, Star, Clock, Trash2, Share2, Upload, FolderPlus,
  Search, Menu, Sparkles, Mail, MessageSquare, Zap, FileUp,
} from 'lucide-react'
import { MailFolderItem } from '../../molecules/MailFolderItem/MailFolderItem'
import { FileGrid } from '../../organisms/FileGrid/FileGrid'
import { FilePreview } from '../../organisms/FilePreview/FilePreview'
import { FileShareDialog, type SharedUser, type ShareAccess } from '../../organisms/FileShareDialog/FileShareDialog'
import { FileDeleteDialog } from '../../organisms/FileDeleteDialog/FileDeleteDialog'
import { Button } from '../../atoms/Button/Button'
import type { FileItemData, FileSource } from '../../molecules/FileItem/FileItem'

export type FilesCategory = 'all' | 'starred' | 'recent' | 'shared' | 'trash'
export type SourceFilter = 'all' | FileSource

export interface FilesScreenProps {
  files: FileItemData[]
  activeCategory?: FilesCategory
  activeFileId?: string
  categoryCounts?: Partial<Record<FilesCategory, number>>
  onCategoryChange?: (category: FilesCategory) => void
  onFileClick?: (id: string) => void
  onFileDoubleClick?: (id: string) => void
  onFileStar?: (id: string) => void
  onUpload?: () => void
  onNewFolder?: () => void
  onDelete?: (ids: string[]) => void
  onDownload?: (ids: string[]) => void
  onRefresh?: () => void
  onAiAction?: (prompt: string) => void
  onToggleAiIndex?: (id: string, enabled: boolean) => void
  // Share
  onShare?: (ids: string[]) => void
  onTogglePublicLink?: (id: string, enabled: boolean) => void
  onCopyShareLink?: (id: string) => void
  onAddShareUser?: (id: string, email: string, access: ShareAccess) => void
  onRemoveShareUser?: (id: string, userId: string) => void
  onChangeShareAccess?: (id: string, userId: string, access: ShareAccess) => void
  getShareData?: (id: string) => { publicLink?: string | null; publicEnabled?: boolean; sharedWith?: SharedUser[] }
  // Permission
  canDelete?: (ids: string[]) => boolean
  loading?: boolean
}

const CATEGORIES: { id: FilesCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'My Files', icon: <HardDrive size={16} /> },
  { id: 'recent', label: 'Recent', icon: <Clock size={16} /> },
  { id: 'starred', label: 'Starred', icon: <Star size={16} /> },
  { id: 'shared', label: 'Shared', icon: <Share2 size={16} /> },
  { id: 'trash', label: 'Trash', icon: <Trash2 size={16} /> },
]

const SOURCE_FILTERS: { id: SourceFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Sources', icon: <HardDrive size={14} /> },
  { id: 'email', label: 'Email', icon: <Mail size={14} /> },
  { id: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
  { id: 'generated', label: 'AI Generated', icon: <Sparkles size={14} /> },
  { id: 'upload', label: 'Uploaded', icon: <Upload size={14} /> },
  { id: 'workflow', label: 'Workflow', icon: <Zap size={14} /> },
]

const SIDEBAR_EXPANDED = 220
const SIDEBAR_COLLAPSED = 56

export function FilesScreen({
  files,
  activeCategory: controlledCategory,
  activeFileId: controlledFileId,
  categoryCounts = {},
  onCategoryChange,
  onFileClick,
  onFileDoubleClick,
  onFileStar,
  onUpload,
  onNewFolder,
  onDelete,
  onDownload,
  onRefresh,
  onAiAction,
  onToggleAiIndex,
  onShare,
  onTogglePublicLink,
  onCopyShareLink,
  onAddShareUser,
  onRemoveShareUser,
  onChangeShareAccess,
  getShareData,
  canDelete,
  loading = false,
}: FilesScreenProps) {
  const [internalCategory, setInternalCategory] = useState<FilesCategory>('all')
  const [internalFileId, setInternalFileId] = useState<string | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([])
  const [shareDialogId, setShareDialogId] = useState<string | null>(null)
  const [deleteDialogIds, setDeleteDialogIds] = useState<string[] | null>(null)
  const [internalFiles, setInternalFiles] = useState<FileItemData[]>(files)

  // Sync internal files when prop changes
  useEffect(() => {
    setInternalFiles(files)
  }, [files])

  const activeCategory = controlledCategory ?? internalCategory
  const activeFileId = controlledFileId ?? internalFileId
  const showingPreview = !!activeFileId && !internalFiles.find((f) => f.id === activeFileId)?.isFolder

  // Build breadcrumb path from folder history
  const currentPath = folderHistory.map((h) => h.name)

  const handleCategoryChange = (category: FilesCategory) => {
    setInternalCategory(category)
    setInternalFileId(undefined)
    setSelectedIds(new Set())
    setCurrentFolderId(null)
    setFolderHistory([])
    onCategoryChange?.(category)
  }

  const handleFileClick = (id: string) => {
    const file = internalFiles.find((f) => f.id === id)
    if (file?.isFolder) {
      // Enter folder on single click
      enterFolder(id)
    } else {
      setInternalFileId(id)
      onFileClick?.(id)
    }
  }

  const enterFolder = (folderId: string) => {
    const folder = internalFiles.find((f) => f.id === folderId)
    if (!folder?.isFolder) return
    setFolderHistory((prev) => [...prev, { id: currentFolderId, name: folder.name }])
    setCurrentFolderId(folderId)
    setInternalFileId(undefined)
    setSelectedIds(new Set())
  }

  const handleFileDoubleClick = (id: string) => {
    const file = internalFiles.find((f) => f.id === id)
    if (file?.isFolder) {
      enterFolder(id)
    } else {
      setInternalFileId(id)
    }
    onFileDoubleClick?.(id)
  }

  const handleBack = () => {
    setInternalFileId(undefined)
  }

  const handleNavigateUp = () => {
    if (folderHistory.length === 0) return
    const prev = folderHistory[folderHistory.length - 1]
    setFolderHistory((h) => h.slice(0, -1))
    setCurrentFolderId(prev.id)
    setSelectedIds(new Set())
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      // Root
      setCurrentFolderId(null)
      setFolderHistory([])
    } else {
      const target = folderHistory[index]
      setCurrentFolderId(target.id)
      setFolderHistory((h) => h.slice(0, index))
    }
    setSelectedIds(new Set())
    setInternalFileId(undefined)
  }

  const handleToggleStar = useCallback((id: string) => {
    setInternalFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f))
    )
    onFileStar?.(id)
  }, [onFileStar])

  const handleToggleAiIndex = useCallback((id: string, enabled: boolean) => {
    setInternalFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, aiIndexed: enabled } : f))
    )
    onToggleAiIndex?.(id, enabled)
  }, [onToggleAiIndex])

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  // Filter files by current folder (parentId), category, source, and search
  const filteredFiles = internalFiles.filter((f) => {
    // Folder navigation: only show children of current folder
    if (searchQuery) {
      // When searching, search across all files (ignore folder hierarchy)
      const q = searchQuery.toLowerCase()
      if (!f.name.toLowerCase().includes(q)) return false
    } else {
      // Normal navigation: filter by parentId
      const fileParent = f.parentId ?? null
      if (fileParent !== currentFolderId) return false
    }

    if (activeCategory === 'starred' && !f.starred) return false
    if (activeCategory === 'trash') return false
    if (sourceFilter !== 'all' && f.source !== sourceFilter) return false
    return true
  })

  // Sort: folders first, then files
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1
    return a.name.localeCompare(b.name)
  })

  const activeFile = internalFiles.find((f) => f.id === activeFileId)

  // Share dialog helpers
  const handleOpenShare = (ids: string[]) => {
    if (ids.length === 1) {
      setShareDialogId(ids[0])
    }
    onShare?.(ids)
  }

  // Delete dialog helpers
  const handleRequestDelete = (ids: string[]) => {
    setDeleteDialogIds(ids)
  }

  const handleConfirmDelete = () => {
    if (deleteDialogIds) {
      onDelete?.(deleteDialogIds)
      setDeleteDialogIds(null)
      setSelectedIds(new Set())
      if (deleteDialogIds.includes(activeFileId ?? '')) {
        setInternalFileId(undefined)
      }
    }
  }

  const deleteFileNames = (deleteDialogIds ?? []).map((id) => internalFiles.find((f) => f.id === id)?.name ?? id)
  const deleteHasFolder = (deleteDialogIds ?? []).some((id) => internalFiles.find((f) => f.id === id)?.isFolder)
  const deleteHasPermission = canDelete ? canDelete(deleteDialogIds ?? []) : true

  const shareFile = shareDialogId ? internalFiles.find((f) => f.id === shareDialogId) : null
  const shareData = shareDialogId && getShareData ? getShareData(shareDialogId) : { publicLink: null, publicEnabled: false, sharedWith: [] }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        minWidth: sidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s, min-width 0.2s',
        overflow: 'hidden',
      }}>
        {/* Hamburger + Upload */}
        <div style={{
          padding: sidebarExpanded ? '10px 12px' : '10px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 8, borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', flexShrink: 0,
            }}
          >
            <Menu size={18} />
          </button>
          {sidebarExpanded && (
            <Button variant="primary" onClick={onUpload} leftIcon={<FileUp size={14} />}>
              Upload
            </Button>
          )}
        </div>

        {/* Collapsed upload button */}
        {!sidebarExpanded && (
          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={onUpload}
              aria-label="Upload"
              style={{
                width: 40, height: 40, borderRadius: 16,
                background: 'var(--accent)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <FileUp size={18} />
            </button>
          </div>
        )}

        {/* Categories */}
        <div style={{ padding: '4px 0' }}>
          {CATEGORIES.map((cat) => (
            sidebarExpanded ? (
              <MailFolderItem
                key={cat.id}
                icon={cat.icon}
                label={cat.label}
                count={categoryCounts[cat.id]}
                active={activeCategory === cat.id}
                onClick={() => handleCategoryChange(cat.id)}
              />
            ) : (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                title={cat.label}
                style={{
                  width: '100%', padding: '10px 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: activeCategory === cat.id ? 'var(--accent-light)' : 'transparent',
                  border: 'none',
                  borderLeft: activeCategory === cat.id ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  color: activeCategory === cat.id ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {cat.icon}
              </button>
            )
          ))}
        </div>

        {/* Source filters - only when expanded */}
        {sidebarExpanded && (
          <>
            <div style={{
              padding: '16px 14px 6px',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              Sources
            </div>
            {SOURCE_FILTERS.map((sf) => (
              <MailFolderItem
                key={sf.id}
                icon={sf.icon}
                label={sf.label}
                active={sourceFilter === sf.id}
                onClick={() => setSourceFilter(sf.id)}
              />
            ))}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* New folder button */}
        {sidebarExpanded && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <Button variant="ghost" size="sm" leftIcon={<FolderPlus size={14} />} onClick={onNewFolder}>
              New Folder
            </Button>
          </div>
        )}

        {/* AI bar at bottom - only when expanded */}
        {sidebarExpanded && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Sparkles size={12} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>AI Assistant</span>
            </div>
            <input
              placeholder="Ask AI about files..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  onAiAction?.(e.currentTarget.value)
                  e.currentTarget.value = ''
                }
              }}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search bar */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 12, color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Content: file grid or preview */}
        {showingPreview && activeFile ? (
          <FilePreview
            id={activeFile.id}
            name={activeFile.name}
            type={activeFile.type}
            size={activeFile.size}
            modifiedAt={activeFile.modifiedAt}
            modifiedBy={activeFile.modifiedBy}
            source={activeFile.source}
            sourceRef={activeFile.sourceRef}
            starred={activeFile.starred}
            aiIndexed={activeFile.aiIndexed}
            isFolder={activeFile.isFolder}
            onClose={handleBack}
            onDownload={() => onDownload?.([activeFile.id])}
            onShare={() => handleOpenShare([activeFile.id])}
            onDelete={() => handleRequestDelete([activeFile.id])}
            onStar={() => handleToggleStar(activeFile.id)}
            onToggleAiIndex={(enabled) => handleToggleAiIndex(activeFile.id, enabled)}
          />
        ) : (
          <FileGrid
            files={sortedFiles}
            view={viewMode}
            selectedIds={selectedIds}
            currentPath={currentPath}
            onFileClick={handleFileClick}
            onFileDoubleClick={handleFileDoubleClick}
            onFileStar={handleToggleStar}
            onFileSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onDelete={handleRequestDelete}
            onDownload={onDownload}
            onRefresh={onRefresh}
            onViewChange={setViewMode}
            onNavigateUp={handleNavigateUp}
            onBreadcrumbClick={handleBreadcrumbClick}
            loading={loading}
          />
        )}
      </div>

      {/* Share dialog */}
      <FileShareDialog
        open={!!shareDialogId}
        fileName={shareFile?.name ?? ''}
        isFolder={shareFile?.isFolder}
        publicLink={shareData?.publicLink}
        publicEnabled={shareData?.publicEnabled}
        sharedWith={shareData?.sharedWith}
        onClose={() => setShareDialogId(null)}
        onTogglePublic={(enabled) => shareDialogId && onTogglePublicLink?.(shareDialogId, enabled)}
        onCopyLink={() => shareDialogId && onCopyShareLink?.(shareDialogId)}
        onAddUser={(email, access) => shareDialogId && onAddShareUser?.(shareDialogId, email, access)}
        onRemoveUser={(userId) => shareDialogId && onRemoveShareUser?.(shareDialogId, userId)}
        onChangeAccess={(userId, access) => shareDialogId && onChangeShareAccess?.(shareDialogId, userId, access)}
      />

      {/* Delete confirmation dialog */}
      <FileDeleteDialog
        open={!!deleteDialogIds}
        fileNames={deleteFileNames}
        isFolder={deleteHasFolder}
        hasPermission={deleteHasPermission}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogIds(null)}
      />
    </div>
  )
}

export default FilesScreen
