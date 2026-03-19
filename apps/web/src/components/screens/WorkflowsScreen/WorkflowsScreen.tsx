import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import { GitBranch, Clock, Pause, Play, MoreHorizontal } from 'lucide-react'
import { WorkflowSidebar, type Workflow } from '../../organisms/WorkflowSidebar/WorkflowSidebar'
import { WorkflowCanvas } from '../../organisms/WorkflowCanvas/WorkflowCanvas'
import { HistoryEntry, type HistoryEntryProps } from '../../molecules/HistoryEntry/HistoryEntry'
import { AIChatBar } from '../../molecules/AIChatBar/AIChatBar'
import * as ScrollArea from '@radix-ui/react-scroll-area'

export interface WorkflowGraph {
  nodes: Node[]
  edges: Edge[]
}

export interface WorkflowsScreenProps {
  workflows: Workflow[]
  workflowGraphs: Record<string, WorkflowGraph>
  historyEntries?: HistoryEntryProps[]
  activeWorkflowId?: string
  onWorkflowSelect?: (id: string) => void
  onNewWorkflow?: () => void
  onToggleStatus?: (id: string) => void
  onAISend?: (value: string) => void
  onDeleteWorkflow?: (id: string) => void
  onDuplicateWorkflow?: (id: string) => void
  onGraphChange?: (workflowId: string, graph: WorkflowGraph) => void
}

export function WorkflowsScreen({
  workflows: workflowsProp,
  workflowGraphs,
  historyEntries = [],
  activeWorkflowId: controlledId,
  onWorkflowSelect,
  onNewWorkflow,
  onToggleStatus,
  onAISend,
  onDeleteWorkflow,
  onDuplicateWorkflow,
  onGraphChange,
}: WorkflowsScreenProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>(workflowsProp)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | undefined>(
    controlledId ?? workflowsProp[0]?.id
  )
  const [showHistory, setShowHistory] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Keep internal list in sync when prop changes
  useEffect(() => {
    setWorkflows(workflowsProp)
  }, [workflowsProp])

  const selectedWf = workflows.find((w) => w.id === activeWorkflowId) || workflows[0]
  const graph =
    (activeWorkflowId && workflowGraphs[activeWorkflowId]) ||
    workflowGraphs[workflows[0]?.id] ||
    { nodes: [], edges: [] }

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  // Sync internal state when the controlled prop changes (e.g. from Storybook controls)
  useEffect(() => {
    if (controlledId !== undefined) {
      setActiveWorkflowId(controlledId)
      const g = workflowGraphs[controlledId]
      if (g) {
        setNodes(g.nodes)
        setEdges(g.edges)
      }
    }
  }, [controlledId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!moreOpen) return
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [moreOpen])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  // Debounced graph save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!activeWorkflowId || !onGraphChange) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onGraphChange(activeWorkflowId, { nodes, edges });
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, activeWorkflowId, onGraphChange]);

  const handleWorkflowSelect = (id: string) => {
    setActiveWorkflowId(id)
    const g = workflowGraphs[id]
    if (g) {
      setNodes(g.nodes)
      setEdges(g.edges)
    }
    onWorkflowSelect?.(id)
  }

  const handleAISend = () => {
    if (aiInput.trim() && onAISend) {
      onAISend(aiInput)
      setAiInput('')
    }
  }

  const handleDelete = () => {
    if (!selectedWf) return
    setMoreOpen(false)
    const id = selectedWf.id
    onDeleteWorkflow?.(id)
    setWorkflows((prev) => {
      const next = prev.filter((w) => w.id !== id)
      const currentIndex = prev.findIndex((w) => w.id === id)
      const nextId = next[currentIndex]?.id ?? next[currentIndex - 1]?.id ?? next[0]?.id
      setActiveWorkflowId(nextId)
      return next
    })
  }

  const handleDuplicate = () => {
    if (!selectedWf) return
    setMoreOpen(false)
    const newId = `${selectedWf.id}_copy_${Date.now()}`
    const copy: Workflow = { ...selectedWf, id: newId, name: `${selectedWf.name} (copy)` }
    setWorkflows((prev) => [...prev, copy])
    onDuplicateWorkflow?.(selectedWf.id)
    handleWorkflowSelect(newId)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          minWidth: 240,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <WorkflowSidebar
          workflows={workflows}
          activeId={activeWorkflowId}
          onSelect={handleWorkflowSelect}
          onNew={onNewWorkflow}
        />
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        {selectedWf && (
          <div
            style={{
              padding: '0 16px',
              height: 52,
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <GitBranch size={15} color="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{selectedWf.name}</span>

            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                background: selectedWf.status === 'active' ? 'var(--success-light)' : 'var(--warning-light)',
                color: selectedWf.status === 'active' ? 'var(--success)' : 'var(--warning)',
                border: `1px solid ${selectedWf.status === 'active' ? '#bbf7d0' : '#fde68a'}`,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: selectedWf.status === 'active' ? 'var(--success)' : 'var(--warning)',
                }}
              />
              {selectedWf.status === 'active' ? 'Active' : 'Paused'}
            </span>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                background: showHistory ? 'var(--surface-2)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >
              <Clock size={13} /> History
            </button>

            <button
              onClick={() => onToggleStatus?.(selectedWf.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                background: selectedWf.status === 'active' ? 'var(--warning-light)' : 'var(--success-light)',
                border: `1px solid ${selectedWf.status === 'active' ? '#fde68a' : '#bbf7d0'}`,
                borderRadius: 6,
                color: selectedWf.status === 'active' ? 'var(--warning)' : 'var(--success)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {selectedWf.status === 'active' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Activate</>}
            </button>

            {/* More options */}
            <div ref={moreRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMoreOpen((prev) => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                }}
                aria-label="Workflow options"
              >
                <MoreHorizontal size={16} />
              </button>

              {moreOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    width: 180,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  {[
                    { label: 'Duplicate workflow', action: handleDuplicate, danger: false },
                    { label: 'Delete workflow', action: handleDelete, danger: true },
                  ].map(({ label, action, danger }) => (
                    <button
                      key={label}
                      onClick={action}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: danger ? 'var(--danger, #dc2626)' : 'var(--text)',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas + History */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
            />
          </div>

          {showHistory && (
            <div
              style={{
                width: 300,
                borderLeft: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>History</span>
              </div>
              <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
                <ScrollArea.Viewport style={{ height: '100%' }}>
                  {historyEntries.map((entry, i) => (
                    <HistoryEntry key={i} {...entry} />
                  ))}
                  {historyEntries.length === 0 && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      No executions recorded
                    </div>
                  )}
                </ScrollArea.Viewport>
              </ScrollArea.Root>
            </div>
          )}
        </div>

        {/* AI chat bar */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <AIChatBar
            placeholder="Ask the AI or describe a new workflow..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onSend={handleAISend}
          />
        </div>
      </div>
    </div>
  )
}

export default WorkflowsScreen
