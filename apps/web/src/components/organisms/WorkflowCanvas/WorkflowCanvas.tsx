import React, { useCallback, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BackgroundVariant,
  type NodeProps,
  type Connection,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react'
import { Zap, Database, Bell, Filter, X } from 'lucide-react'

// ─── Shared Node Shell ─────────────────────────────────────────────────────────

interface NodeShellCallbacks {
  onNodeDelete?: (nodeId: string) => void
  onNodeEdit?: (nodeId: string, data: Record<string, unknown>) => void
  readOnly?: boolean
}

function useEditableLabel(
  nodeId: string,
  initialLabel: string,
  onNodeEdit?: (nodeId: string, data: Record<string, unknown>) => void,
  readOnly?: boolean,
  extraData?: Record<string, unknown>
) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function handleDoubleClick() {
    if (readOnly) return
    setDraft(initialLabel)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (onNodeEdit && draft !== initialLabel) {
      onNodeEdit(nodeId, { ...extraData, label: draft })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  return { editing, draft, setDraft, inputRef, handleDoubleClick, commit, handleKeyDown }
}

function DeleteButton({ nodeId, onNodeDelete, deleteLabel }: { nodeId: string; onNodeDelete: (id: string) => void; deleteLabel: string }) {
  return (
    <button
      type="button"
      className="node-delete-btn"
      onClick={(e) => {
        e.stopPropagation()
        onNodeDelete(nodeId)
      }}
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'var(--danger, #ef4444)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        padding: 0,
        zIndex: 10,
      }}
      aria-label={deleteLabel}
    >
      <X size={10} />
    </button>
  )
}

function EditableLabel({
  editing,
  draft,
  setDraft,
  inputRef,
  commit,
  handleKeyDown,
  handleDoubleClick,
  label,
  editLabel,
  doubleClickTitle,
  style,
}: {
  editing: boolean
  draft: string
  setDraft: (v: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  commit: () => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleDoubleClick: () => void
  label: string
  editLabel: string
  doubleClickTitle: string
  style?: React.CSSProperties
}) {
  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={editLabel}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          padding: '1px 4px',
          width: '100%',
          fontFamily: 'inherit',
          outline: 'none',
          ...style,
        }}
      />
    )
  }
  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'text', ...style }}
      title={doubleClickTitle}
    >
      {label}
    </div>
  )
}

// ─── Node Types ────────────────────────────────────────────────────────────────

function TriggerNode({ id, data }: NodeProps) {
  const { t } = useTranslation()
  const cb = data as NodeShellCallbacks & Record<string, unknown>
  const [hovered, setHovered] = useState(false)
  const label = String(cb.label ?? '')
  const { editing, draft, setDraft, inputRef, handleDoubleClick, commit, handleKeyDown } = useEditableLabel(
    id, label, cb.onNodeEdit, cb.readOnly, { description: cb.description }
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {!cb.readOnly && hovered && cb.onNodeDelete && (
        <DeleteButton nodeId={id} onNodeDelete={cb.onNodeDelete} deleteLabel={t('workflows.deleteNode')} />
      )}
      <div
        style={{
          background: 'var(--surface)',
          border: '2px solid var(--accent)',
          borderRadius: 12,
          padding: '12px 16px',
          minWidth: 200,
          boxShadow: '0 2px 8px rgba(234,88,12,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--accent-light)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <Zap size={14} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Trigger
          </span>
        </div>
        <EditableLabel
          editing={editing}
          draft={draft}
          setDraft={setDraft}
          inputRef={inputRef}
          commit={commit}
          handleKeyDown={handleKeyDown}
          handleDoubleClick={handleDoubleClick}
          label={label}
          editLabel={t('workflows.editNodeLabel')}
          doubleClickTitle={t('workflows.doubleClickToEdit')}
        />
        {cb.description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{String(cb.description)}</div>
        )}
        <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent)', border: '2px solid var(--surface)', width: 10, height: 10 }} />
      </div>
    </div>
  )
}

function ActionNode({ id, data }: NodeProps) {
  const { t } = useTranslation()
  const cb = data as NodeShellCallbacks & Record<string, unknown>
  const [hovered, setHovered] = useState(false)
  const label = String(cb.label ?? '')
  const { editing, draft, setDraft, inputRef, handleDoubleClick, commit, handleKeyDown } = useEditableLabel(
    id, label, cb.onNodeEdit, cb.readOnly, { description: cb.description }
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {!cb.readOnly && hovered && cb.onNodeDelete && (
        <DeleteButton nodeId={id} onNodeDelete={cb.onNodeDelete} deleteLabel={t('workflows.deleteNode')} />
      )}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          padding: '12px 16px',
          minWidth: 200,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: '#6366f1', border: '2px solid var(--surface)', width: 10, height: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: '#eef2ff',
              border: '1px solid #c7d2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}
          >
            <Database size={14} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Action
          </span>
        </div>
        <EditableLabel
          editing={editing}
          draft={draft}
          setDraft={setDraft}
          inputRef={inputRef}
          commit={commit}
          handleKeyDown={handleKeyDown}
          handleDoubleClick={handleDoubleClick}
          label={label}
          editLabel={t('workflows.editNodeLabel')}
          doubleClickTitle={t('workflows.doubleClickToEdit')}
        />
        {cb.description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{String(cb.description)}</div>
        )}
        {(cb.taskType || cb.toolName) && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {cb.taskType && (
              <span style={{
                padding: '1px 6px', fontSize: 9, fontWeight: 600, borderRadius: 8,
                background: cb.taskType === 'structured' ? '#eef2ff' : 'var(--accent-light)',
                color: cb.taskType === 'structured' ? '#6366f1' : 'var(--accent)',
                border: `1px solid ${cb.taskType === 'structured' ? '#c7d2fe' : 'var(--accent-border)'}`,
              }}>
                {cb.taskType === 'structured' ? 'Structured' : 'Inference'}
              </span>
            )}
            {cb.toolName && (
              <span style={{
                padding: '1px 6px', fontSize: 9, fontWeight: 500, borderRadius: 8,
                background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }}>
                {String(cb.toolName)}
              </span>
            )}
          </div>
        )}
        <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1', border: '2px solid var(--surface)', width: 10, height: 10 }} />
      </div>
    </div>
  )
}

function ConditionNode({ id, data }: NodeProps) {
  const { t } = useTranslation()
  const cb = data as NodeShellCallbacks & Record<string, unknown>
  const [hovered, setHovered] = useState(false)
  const label = String(cb.label ?? '')
  const yesLabel = cb.yesLabel != null ? String(cb.yesLabel) : 'Yes'
  const noLabel = cb.noLabel != null ? String(cb.noLabel) : 'No'
  const { editing, draft, setDraft, inputRef, handleDoubleClick, commit, handleKeyDown } = useEditableLabel(
    id, label, cb.onNodeEdit, cb.readOnly, { description: cb.description, yesLabel: cb.yesLabel, noLabel: cb.noLabel }
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {!cb.readOnly && hovered && cb.onNodeDelete && (
        <DeleteButton nodeId={id} onNodeDelete={cb.onNodeDelete} deleteLabel={t('workflows.deleteNode')} />
      )}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          padding: '12px 16px',
          minWidth: 200,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: '#8b5cf6', border: '2px solid var(--surface)', width: 10, height: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8b5cf6',
            }}
          >
            <Filter size={14} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Condition
          </span>
        </div>
        <EditableLabel
          editing={editing}
          draft={draft}
          setDraft={setDraft}
          inputRef={inputRef}
          commit={commit}
          handleKeyDown={handleKeyDown}
          handleDoubleClick={handleDoubleClick}
          label={label}
          editLabel={t('workflows.editNodeLabel')}
          doubleClickTitle={t('workflows.doubleClickToEdit')}
        />
        {cb.description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{String(cb.description)}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>{yesLabel}</span>
          <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>{noLabel}</span>
        </div>
        <Handle type="source" position={Position.Bottom} id="yes" style={{ background: 'var(--success)', border: '2px solid var(--surface)', width: 10, height: 10, left: '30%' }} />
        <Handle type="source" position={Position.Bottom} id="no" style={{ background: 'var(--danger)', border: '2px solid var(--surface)', width: 10, height: 10, left: '70%' }} />
      </div>
    </div>
  )
}

function NotificationNode({ id, data }: NodeProps) {
  const { t } = useTranslation()
  const cb = data as NodeShellCallbacks & Record<string, unknown>
  const [hovered, setHovered] = useState(false)
  const label = String(cb.label ?? '')
  const { editing, draft, setDraft, inputRef, handleDoubleClick, commit, handleKeyDown } = useEditableLabel(
    id, label, cb.onNodeEdit, cb.readOnly, { description: cb.description }
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {!cb.readOnly && hovered && cb.onNodeDelete && (
        <DeleteButton nodeId={id} onNodeDelete={cb.onNodeDelete} deleteLabel={t('workflows.deleteNode')} />
      )}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          padding: '12px 16px',
          minWidth: 200,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: 'var(--success)', border: '2px solid var(--surface)', width: 10, height: 10 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--success-light)',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)',
            }}
          >
            <Bell size={14} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Notification
          </span>
        </div>
        <EditableLabel
          editing={editing}
          draft={draft}
          setDraft={setDraft}
          inputRef={inputRef}
          commit={commit}
          handleKeyDown={handleKeyDown}
          handleDoubleClick={handleDoubleClick}
          label={label}
          editLabel={t('workflows.editNodeLabel')}
          doubleClickTitle={t('workflows.doubleClickToEdit')}
        />
        {cb.description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{String(cb.description)}</div>
        )}
      </div>
    </div>
  )
}

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  notification: NotificationNode,
}

// ─── Component ─────────────────────────────────────────────────────────────────

export interface WorkflowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange?: OnNodesChange
  onEdgesChange?: OnEdgesChange
  onConnect?: (connection: Connection) => void
  readOnly?: boolean
  onNodeDelete?: (nodeId: string) => void
  onNodeEdit?: (nodeId: string, data: Record<string, unknown>) => void
  onNodeAdd?: (node: Node) => void
  onNodeClick?: (event: React.MouseEvent, node: Node) => void
}

export function WorkflowCanvas({
  nodes: nodesProp,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  readOnly = false,
  onNodeDelete,
  onNodeEdit,
  onNodeAdd,
  onNodeClick,
}: WorkflowCanvasProps) {
  const { t } = useTranslation()
  const [localNodes, setLocalNodes] = useState<Node[]>(nodesProp)

  // Sync with prop changes
  useEffect(() => {
    setLocalNodes(nodesProp)
  }, [nodesProp])

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setLocalNodes((prev) => prev.filter((n) => n.id !== nodeId))
      if (onNodeDelete) onNodeDelete(nodeId)
    },
    [onNodeDelete]
  )

  const handleNodeEdit = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setLocalNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      )
      if (onNodeEdit) onNodeEdit(nodeId, data)
    },
    [onNodeEdit]
  )

  // Inject callbacks and readOnly flag into each node's data
  const augmentedNodes: Node[] = localNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onNodeDelete: readOnly ? undefined : handleNodeDelete,
      onNodeEdit: readOnly ? undefined : handleNodeEdit,
      readOnly,
    },
  }))

  const handleConnect = useCallback(
    (params: Connection) => {
      if (onConnect) onConnect(params)
    },
    [onConnect]
  )

  // ─── Pane context menu ──────────────────────────────────────────────────────

  type PaneMenu = { screenX: number; screenY: number; canvasX: number; canvasY: number } | null
  const [paneMenu, setPaneMenu] = useState<PaneMenu>(null)
  const paneMenuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paneMenu) return
    const handler = (e: MouseEvent) => {
      if (paneMenuRef.current && !paneMenuRef.current.contains(e.target as Node)) {
        setPaneMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [paneMenu])

  const handlePaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPaneMenu({
      screenX: e.clientX,
      screenY: e.clientY,
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
    })
  }, [])

  const handleAddNode = useCallback((type: 'trigger' | 'action' | 'condition' | 'notification') => {
    if (!paneMenu) return
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: paneMenu.canvasX - 80, y: paneMenu.canvasY - 40 },
      data: { label: type.charAt(0).toUpperCase() + type.slice(1), description: '' },
    }
    setLocalNodes((prev) => [...prev, newNode])
    onNodeAdd?.(newNode)
    setPaneMenu(null)
  }, [paneMenu, onNodeAdd])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={t('workflows.workflowDiagram')}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <ReactFlow
        nodes={augmentedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : handleConnect}
        nodeTypes={nodeTypes}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        onNodeClick={onNodeClick}
        onPaneContextMenu={readOnly ? undefined : handlePaneContextMenu}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'trigger') return '#EA580C'
            if (node.type === 'action') return '#6366f1'
            if (node.type === 'condition') return '#8b5cf6'
            return '#16a34a'
          }}
          maskColor="rgba(249,250,251,0.7)"
        />
      </ReactFlow>

      {paneMenu && !readOnly && (
        <div
          ref={paneMenuRef}
          style={{
            position: 'fixed',
            left: paneMenu.screenX,
            top: paneMenu.screenY,
            zIndex: 1000,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            minWidth: 160,
          }}
        >
          <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
            Add node
          </div>
          {([
            { type: 'trigger', label: 'Trigger', color: '#EA580C' },
            { type: 'action', label: 'Action', color: '#6366f1' },
            { type: 'condition', label: 'Condition', color: '#8b5cf6' },
            { type: 'notification', label: 'Notification', color: '#16a34a' },
          ] as const).map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => handleAddNode(type)}
              style={{
                width: '100%',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div
        role="list"
        aria-label={t('workflows.nodeTypeLegend')}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          zIndex: 10,
        }}
      >
        {[
          { color: 'var(--accent)', label: 'Trigger' },
          { color: '#6366f1', label: 'Action' },
          { color: '#8b5cf6', label: 'Condition' },
          { color: 'var(--success)', label: 'Notification' },
        ].map(({ color, label }) => (
          <div key={label} role="listitem" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WorkflowCanvas
