import { useState, useRef, useEffect } from 'react'
import {
  LayoutGrid, LayoutList, ArrowUpDown, Trash2, Download,
  Star, RefreshCw, FolderUp, ChevronRight, HardDrive, FolderOpen,
  Folder,
} from 'lucide-react'
import { FileItem, type FileItemData } from '../FileItem/FileItem'
import { Button } from '../../../shared/ui/Button/Button'
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState'
import { useTranslation } from 'react-i18next'

export type SortField = 'name' | 'modifiedAt' | 'size' | 'type'
export type SortDir = 'asc' | 'desc'

export interface FileGridProps {
  files: FileItemData[]
  view?: 'grid' | 'list'
  selectedIds?: Set<string>
  currentPath?: string[]
  onFileClick?: (id: string) => void
  onFileDoubleClick?: (id: string) => void
  onFileStar?: (id: string) => void
  onFileSelect?: (id: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  onDelete?: (ids: string[]) => void
  onDownload?: (ids: string[]) => void
  onRefresh?: () => void
  onViewChange?: (view: 'grid' | 'list') => void
  onNavigateUp?: () => void
  onBreadcrumbClick?: (index: number) => void
  onSort?: (field: SortField, dir: SortDir) => void
  onContextMenu?: (id: string, e: React.MouseEvent) => void
  onFileDownload?: (id: string) => void
  onFileShare?: (id: string) => void
  onFileDelete?: (id: string) => void
  onFileRename?: (id: string) => void
  onFileMove?: (id: string) => void
  creatingFolder?: boolean
  onCreateFolder?: (name: string) => void
  onCancelCreateFolder?: () => void
  loading?: boolean
}

function InlineFolderRow({
  view,
  onCreate,
  onCancel,
}: {
  view: 'grid' | 'list'
  onCreate: (name: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (trimmed) onCreate(trimmed)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  if (view === 'grid') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 8,
        border: '1.5px solid var(--accent)',
        background: 'var(--surface)',
        width: 180,
      }}>
        <Folder size={18} color="#f59e0b" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            const trimmed = value.trim()
            if (trimmed) onCreate(trimmed)
            else onCancel()
          }}
          placeholder={t('fileGrid.folderNamePlaceholder')}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            fontFamily: 'inherit',
            color: 'var(--text)',
            outline: 'none',
          }}
        />
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <span style={{ width: 14 }} />
      <span style={{ width: 13 }} />
      <Folder size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          const trimmed = value.trim()
          if (trimmed) onCreate(trimmed)
          else onCancel()
        }}
        placeholder={t('fileGrid.folderNamePlaceholder')}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          fontSize: 13,
          fontFamily: 'inherit',
          color: 'var(--text)',
          outline: 'none',
        }}
      />
      <span style={{ width: 60 }} />
      <span style={{ width: 80 }} />
      <span style={{ width: 100 }} />
      <span style={{ width: 52 }} />
    </div>
  )
}

export function FileGrid({
  files,
  view = 'list',
  selectedIds = new Set(),
  currentPath = [],
  onFileClick,
  onFileDoubleClick,
  onFileStar,
  onFileSelect,
  onSelectAll,
  onDelete,
  onDownload,
  onRefresh,
  onViewChange,
  onNavigateUp,
  onBreadcrumbClick,
  onSort: _onSort,
  onContextMenu,
  onFileDownload,
  onFileShare,
  onFileDelete,
  onFileRename,
  onFileMove,
  creatingFolder,
  onCreateFolder,
  onCancelCreateFolder,
  loading = false,
}: FileGridProps) {
  const { t } = useTranslation()
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc'
    setSortField(field)
    setSortDir(newDir)
    // Local sort is handled by React state; no server callback needed
  }

  const folders = files.filter((f) => f.isFolder)
  const regularFiles = files.filter((f) => !f.isFolder)
  const hasSelection = selectedIds.size > 0
  const allSelected = files.length > 0 && selectedIds.size === files.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '6px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = hasSelection && !allSelected }}
          onChange={(e) => onSelectAll?.(e.target.checked)}
          aria-label={t('files.selectAll')}
          style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
        />

        {hasSelection ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
              {t('files.selected', { count: selectedIds.size })}
            </span>
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
            <Button variant="ghost" size="sm" leftIcon={<Download size={13} />} onClick={() => onDownload?.([...selectedIds])}>
              {t('download')}
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<Star size={13} />} onClick={() => { selectedIds.forEach((id) => onFileStar?.(id)) }}>
              {t('fileGrid.star')}
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} onClick={() => onDelete?.([...selectedIds])}>
              {t('delete')}
            </Button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {currentPath.length > 0 && (
              <button
                onClick={onNavigateUp}
                title={t('files.goUp')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)', marginRight: 4 }}
              >
                <FolderUp size={16} />
              </button>
            )}
            {/* Breadcrumb */}
            <button
              onClick={() => onBreadcrumbClick?.(-1)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontWeight: currentPath.length === 0 ? 600 : 400,
                color: currentPath.length === 0 ? 'var(--text)' : 'var(--accent)',
                fontFamily: 'inherit',
              }}
            >
              <HardDrive size={14} />
              {t('files.myFiles')}
            </button>
            {currentPath.map((segment, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ChevronRight size={12} color="var(--text-muted)" />
                <button
                  onClick={() => onBreadcrumbClick?.(i)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 13, fontFamily: 'inherit',
                    fontWeight: i === currentPath.length - 1 ? 600 : 400,
                    color: i === currentPath.length - 1 ? 'var(--text)' : 'var(--accent)',
                  }}
                >
                  <FolderOpen size={14} color="#f59e0b" />
                  {segment}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => handleSort(sortField)}
          title={t('sort')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
        >
          <ArrowUpDown size={14} />
        </button>

        <button
          onClick={onRefresh}
          title={t('refresh')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => onViewChange?.('list')}
            title={t('files.listView')}
            style={{
              background: view === 'list' ? 'var(--surface-2)' : 'none',
              border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex',
              color: view === 'list' ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => onViewChange?.('grid')}
            title={t('files.gridView')}
            style={{
              background: view === 'grid' ? 'var(--surface-2)' : 'none',
              border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex',
              color: view === 'grid' ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Column headers (list view only) */}
      {view === 'list' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          <span style={{ width: 14 }} />
          <span style={{ width: 13 }} />
          <span style={{ width: 20 }} />
          <span
            onClick={() => handleSort('name')}
            style={{ flex: 1, cursor: 'pointer', userSelect: 'none' }}
          >
            {t('name')} {sortField === 'name' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
          </span>
          <span style={{ width: 60, textAlign: 'center' }}>{t('files.source')}</span>
          <span
            onClick={() => handleSort('size')}
            style={{ width: 80, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
          >
            {t('fileGrid.size')} {sortField === 'size' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
          </span>
          <span
            onClick={() => handleSort('modifiedAt')}
            style={{ width: 100, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
          >
            {t('fileGrid.modified')} {sortField === 'modifiedAt' && (sortDir === 'asc' ? '\u2191' : '\u2193')}
          </span>
          <span style={{ width: 52 }} />
        </div>
      )}

      {/* File list / grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {files.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <EmptyState
              icon={<FolderOpen size={22} />}
              title={t('files.noFiles')}
              description={t('files.noFilesDescription', { defaultValue: 'Envie arquivos ou deixe que e-mails, chats e agentes os tragam para cá.' })}
            />
          </div>
        ) : (
          <>
            {/* Folders section */}
            {(folders.length > 0 || creatingFolder) && (
              <>
                <div style={{
                  padding: '8px 16px 4px',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t('fileGrid.foldersCount', { count: folders.length })}
                </div>
                <div style={view === 'grid' ? {
                  display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 16px 12px',
                } : {}}>
                  {creatingFolder && (
                    <InlineFolderRow
                      view={view}
                      onCreate={(name) => onCreateFolder?.(name)}
                      onCancel={() => onCancelCreateFolder?.()}
                    />
                  )}
                  {folders.map((file) => (
                    <FileItem
                      key={file.id}
                      {...file}
                      view={view}
                      selected={selectedIds.has(file.id)}
                      onClick={onFileClick}
                      onDoubleClick={onFileDoubleClick}
                      onStar={onFileStar}
                      onSelect={onFileSelect}
                      onContextMenu={onContextMenu}
                      onDownload={onFileDownload}
                      onShare={onFileShare}
                      onDelete={(id) => onFileDelete?.(id)}
                      onRename={onFileRename}
                      onMove={onFileMove}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Files section */}
            {regularFiles.length > 0 && (
              <>
                <div style={{
                  padding: '8px 16px 4px',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t('fileGrid.filesCount', { count: regularFiles.length })}
                </div>
                <div style={view === 'grid' ? {
                  display: 'flex', flexWrap: 'wrap', gap: 12, padding: '4px 16px 12px',
                } : {}}>
                  {regularFiles.map((file) => (
                    <FileItem
                      key={file.id}
                      {...file}
                      view={view}
                      selected={selectedIds.has(file.id)}
                      onClick={onFileClick}
                      onDoubleClick={onFileDoubleClick}
                      onStar={onFileStar}
                      onSelect={onFileSelect}
                      onContextMenu={onContextMenu}
                      onDownload={onFileDownload}
                      onShare={onFileShare}
                      onDelete={(id) => onFileDelete?.(id)}
                      onRename={onFileRename}
                      onMove={onFileMove}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        padding: '4px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        fontSize: 11,
        color: 'var(--text-muted)',
        display: 'flex',
        gap: 12,
        flexShrink: 0,
      }}>
        <span>{t('files.items', { count: files.length })}</span>
        {hasSelection && <span>{t('files.selected', { count: selectedIds.size })}</span>}
      </div>
    </div>
  )
}

export default FileGrid
