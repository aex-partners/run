import { useState } from 'react'
import {
  File, FileText, FileSpreadsheet, Image, Film, Music, Archive,
  FileCode, Presentation, Star, MoreVertical, Download, FolderOpen,
} from 'lucide-react'

export type FileSource = 'email' | 'chat' | 'generated' | 'upload' | 'workflow'

export interface FileItemData {
  id: string
  name: string
  type: string
  size: string
  modifiedAt: string
  modifiedBy?: string
  source: FileSource
  sourceRef?: string
  starred?: boolean
  shared?: boolean
  thumbnailUrl?: string
  isFolder?: boolean
  parentId?: string | null
  aiIndexed?: boolean
}

export interface FileItemProps extends FileItemData {
  selected?: boolean
  view?: 'grid' | 'list'
  onClick?: (id: string) => void
  onDoubleClick?: (id: string) => void
  onStar?: (id: string) => void
  onSelect?: (id: string, selected: boolean) => void
  onContextMenu?: (id: string, e: React.MouseEvent) => void
}

const SOURCE_COLORS: Record<FileSource, string> = {
  email: '#2563eb',
  chat: '#7c3aed',
  generated: '#EA580C',
  upload: '#6b7280',
  workflow: '#059669',
}

const SOURCE_LABELS: Record<FileSource, string> = {
  email: 'Email',
  chat: 'Chat',
  generated: 'AI Generated',
  upload: 'Upload',
  workflow: 'Workflow',
}

function getFileIcon(type: string, isFolder?: boolean) {
  if (isFolder) return <FolderOpen size={20} color="#f59e0b" />
  const ext = type.toLowerCase()
  if (['pdf'].includes(ext)) return <FileText size={20} color="#dc2626" />
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return <FileText size={20} color="#2563eb" />
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return <FileSpreadsheet size={20} color="#059669" />
  if (['ppt', 'pptx', 'odp'].includes(ext)) return <Presentation size={20} color="#d97706" />
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return <Image size={20} color="#7c3aed" />
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return <Film size={20} color="#dc2626" />
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return <Music size={20} color="#ea580c" />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <Archive size={20} color="#6b7280" />
  if (['js', 'ts', 'py', 'json', 'html', 'css', 'xml', 'yaml'].includes(ext)) return <FileCode size={20} color="#0ea5e9" />
  return <File size={20} color="var(--text-muted)" />
}

export function FileItem(props: FileItemProps) {
  const {
    id, name, type, size, modifiedAt, source, starred = false,
    selected = false, isFolder = false, view = 'list',
    onClick, onDoubleClick, onStar, onSelect, onContextMenu,
  } = props
  const [hovered, setHovered] = useState(false)

  if (view === 'grid') {
    return (
      <div
        onClick={() => onClick?.(id)}
        onDoubleClick={() => onDoubleClick?.(id)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(id, e) }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 180,
          padding: 12,
          borderRadius: 10,
          border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
          background: selected ? 'var(--accent-light)' : hovered ? 'var(--surface-2)' : 'var(--surface)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          position: 'relative',
        }}
      >
        {/* Top actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => { e.stopPropagation(); onSelect?.(id, e.target.checked) }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 14, height: 14, accentColor: 'var(--accent)',
              opacity: selected || hovered ? 1 : 0, transition: 'opacity 0.1s',
            }}
          />
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onStar?.(id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <Star size={13} fill={starred ? '#f59e0b' : 'none'} color={starred ? '#f59e0b' : 'var(--text-muted)'} />
            </button>
          </div>
        </div>

        {/* Icon / Thumbnail */}
        <div style={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          background: 'var(--surface-2)',
        }}>
          {getFileIcon(type, isFolder)}
        </div>

        {/* Name */}
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </span>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '1px 5px',
            borderRadius: 6,
            background: SOURCE_COLORS[source] + '15',
            color: SOURCE_COLORS[source],
            textTransform: 'uppercase',
          }}>
            {SOURCE_LABELS[source]}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{size}</span>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div
      role="row"
      aria-selected={selected}
      onClick={() => onClick?.(id)}
      onDoubleClick={() => onDoubleClick?.(id)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(id, e) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        background: selected ? 'var(--accent-light)' : hovered ? 'var(--surface-2)' : 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => { e.stopPropagation(); onSelect?.(id, e.target.checked) }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 14, height: 14, accentColor: 'var(--accent)', flexShrink: 0 }}
      />

      <button
        onClick={(e) => { e.stopPropagation(); onStar?.(id) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
      >
        <Star size={13} fill={starred ? '#f59e0b' : 'none'} color={starred ? '#f59e0b' : 'var(--text-muted)'} />
      </button>

      <span style={{ flexShrink: 0, display: 'flex' }}>
        {getFileIcon(type, isFolder)}
      </span>

      <span style={{
        flex: 1,
        fontSize: 13,
        fontWeight: isFolder ? 600 : 400,
        color: 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {name}
      </span>

      <span style={{
        fontSize: 9,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 6,
        background: SOURCE_COLORS[source] + '15',
        color: SOURCE_COLORS[source],
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {SOURCE_LABELS[source]}
      </span>

      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 80, flexShrink: 0, textAlign: 'right' }}>
        {isFolder ? '--' : size}
      </span>

      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 100, flexShrink: 0, textAlign: 'right' }}>
        {modifiedAt}
      </span>

      <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.1s' }}>
        <button
          onClick={(e) => { e.stopPropagation() }}
          title="Download"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
        >
          <Download size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onContextMenu?.(id, e) }}
          title="More"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  )
}

export default FileItem
