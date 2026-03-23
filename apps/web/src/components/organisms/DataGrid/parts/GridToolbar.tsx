import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Filter, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import type { GridColumn, SortConfig as SortConfigType, FilterCondition } from '../types'
import { SortConfigPanel } from './SortConfig'
import { GroupByPicker } from './GroupByPicker'

export interface GridToolbarProps {
  title: string
  recordCount: number
  filterActive: boolean
  filterText: string
  onFilterToggle: () => void
  onFilterTextChange: (text: string) => void
  columns: GridColumn[]
  hiddenColumns: Set<string>
  columnsOpen: boolean
  onColumnsToggle: () => void
  onColumnVisibilityToggle: (colId: string) => void
  columnsPopoverRef: React.RefObject<HTMLDivElement | null>
  onAddColumn?: () => void
  onAddRow?: () => void
  sortConfig?: SortConfigType[]
  onRemoveSort?: (columnId: string) => void
  onClearSort?: () => void
  groupByColumn?: string | null
  onGroupByChange?: (colId: string | null) => void
  filterConditions?: FilterCondition[]
  onFilterConditionsChange?: (conditions: FilterCondition[]) => void
  /** Optional slot rendered at the start of the toolbar (e.g. ViewSwitcher) */
  leftSlot?: React.ReactNode
}

const filterSelectStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border)',
  borderRadius: 5,
  fontSize: 12,
  color: 'var(--text)',
  background: 'var(--surface-2)',
  fontFamily: 'inherit',
  outline: 'none',
}

const toolbarButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-muted)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  position: 'relative',
}

export function GridToolbar({
  recordCount,
  filterActive,
  filterText,
  onFilterToggle,
  onFilterTextChange,
  columns,
  hiddenColumns,
  columnsOpen,
  onColumnsToggle,
  onColumnVisibilityToggle,
  columnsPopoverRef,
  onAddColumn,
  onAddRow,
  sortConfig = [],
  onRemoveSort,
  onClearSort,
  groupByColumn,
  onGroupByChange,
  filterConditions = [],
  onFilterConditionsChange,
  leftSlot,
}: GridToolbarProps) {
  const { t } = useTranslation()
  const hasActiveFilters = filterText.length > 0 || filterConditions.length > 0

  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      {/* Single unified row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Left: optional slot (ViewSwitcher) + record count */}
        {leftSlot}

        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--surface-2)',
            padding: '1px 8px',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}
        >
          {recordCount}
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Tools: Filter, Sort, Group, Columns */}
        <button
          onClick={onFilterToggle}
          aria-label={t('database.filter')}
          aria-pressed={filterActive}
          style={{
            ...toolbarButtonStyle,
            color: (filterActive || hasActiveFilters) ? 'var(--accent)' : 'var(--text-muted)',
            borderColor: (filterActive || hasActiveFilters) ? 'var(--accent-border)' : 'var(--border)',
            background: (filterActive || hasActiveFilters) ? 'var(--accent-light)' : 'var(--surface-2)',
          }}
        >
          <Filter size={13} />
          {hasActiveFilters && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'inline-block',
              }}
            />
          )}
        </button>

        {/* Sort indicator */}
        {sortConfig.length > 0 && (
          <div style={{
            ...toolbarButtonStyle,
            color: 'var(--accent)',
            borderColor: 'var(--accent-border)',
            background: 'var(--accent-light)',
            cursor: 'default',
            padding: '5px 8px',
          }}>
            <ArrowUpDown size={13} />
            <span style={{ fontSize: 11 }}>{sortConfig.length}</span>
          </div>
        )}

        {/* Group by */}
        {onGroupByChange && (
          <GroupByPicker
            columns={columns}
            activeGroupBy={groupByColumn ?? null}
            onGroupByChange={onGroupByChange}
          />
        )}

        <div style={{ position: 'relative' }} ref={columnsPopoverRef}>
          <button
            onClick={onColumnsToggle}
            aria-label="Columns"
            style={{
              ...toolbarButtonStyle,
              color: hiddenColumns.size > 0 ? 'var(--accent)' : 'var(--text-muted)',
              borderColor: hiddenColumns.size > 0 ? 'var(--accent-border)' : 'var(--border)',
              background: hiddenColumns.size > 0 ? 'var(--accent-light)' : 'var(--surface-2)',
            }}
          >
            <SlidersHorizontal size={13} />
            {hiddenColumns.size > 0 && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'inline-block',
                }}
              />
            )}
          </button>
          {columnsOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                zIndex: 100,
                minWidth: 160,
                padding: '6px 0',
              }}
            >
              {columns.map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    fontSize: 13,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col.id)}
                    onChange={() => onColumnVisibilityToggle(col.id)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Primary action: + New record */}
        <button
          onClick={onAddRow}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={13} /> New
        </button>
      </div>

      {/* Expanded filter panel */}
      {filterActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Global text search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              autoFocus
              placeholder={t('database.searchAllColumns')}
              value={filterText}
              onChange={(e) => onFilterTextChange(e.target.value)}
              aria-label="Search or filter"
              style={{
                flex: 1,
                maxWidth: 300,
                padding: '4px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--text)',
                background: 'var(--surface-2)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {(filterText || filterConditions.length > 0) && (
              <button
                onClick={() => {
                  onFilterTextChange('')
                  onFilterConditionsChange?.([])
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Per-field conditions */}
          {filterConditions.map((cond, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={cond.columnId}
                onChange={(e) => {
                  const next = [...filterConditions]
                  next[i] = { ...next[i], columnId: e.target.value }
                  onFilterConditionsChange?.(next)
                }}
                style={filterSelectStyle}
              >
                {columns.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={(e) => {
                  const next = [...filterConditions]
                  next[i] = { ...next[i], operator: e.target.value as FilterCondition['operator'] }
                  onFilterConditionsChange?.(next)
                }}
                style={filterSelectStyle}
              >
                <option value="contains">contains</option>
                <option value="equals">equals</option>
                <option value="gt">greater than</option>
                <option value="lt">less than</option>
                <option value="gte">greater or equal</option>
                <option value="lte">less or equal</option>
                <option value="isEmpty">is empty</option>
                <option value="isNotEmpty">is not empty</option>
              </select>
              {cond.operator !== 'isEmpty' && cond.operator !== 'isNotEmpty' && (
                <input
                  value={cond.value}
                  onChange={(e) => {
                    const next = [...filterConditions]
                    next[i] = { ...next[i], value: e.target.value }
                    onFilterConditionsChange?.(next)
                  }}
                  placeholder="Value..."
                  style={{
                    flex: 1,
                    maxWidth: 160,
                    padding: '3px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    fontSize: 12,
                    color: 'var(--text)',
                    background: 'var(--surface-2)',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              )}
              <button
                onClick={() => {
                  const next = filterConditions.filter((_, j) => j !== i)
                  onFilterConditionsChange?.(next)
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Add condition button */}
          <button
            onClick={() => {
              const firstCol = columns[0]?.id ?? ''
              onFilterConditionsChange?.([...filterConditions, { columnId: firstCol, operator: 'contains', value: '' }])
            }}
            style={{
              alignSelf: 'flex-start',
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '2px 0',
            }}
          >
            + Add condition
          </button>
        </div>
      )}

      {sortConfig.length > 0 && onRemoveSort && onClearSort && (
        <SortConfigPanel
          sortConfig={sortConfig}
          columns={columns}
          onRemove={onRemoveSort}
          onClear={onClearSort}
        />
      )}
    </div>
  )
}
