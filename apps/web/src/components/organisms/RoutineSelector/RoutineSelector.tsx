import React, { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Input } from '../../atoms/Input/Input'
import { RoutineCard } from '../../molecules/RoutineCard/RoutineCard'
import { useTranslation } from 'react-i18next'
import { ROUTINE_CATEGORY_IDS, type RoutineTemplate, type RoutineCategory } from '../../../data/routine-templates'

export interface RoutineSelectorProps {
  routines: RoutineTemplate[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function RoutineSelector({
  routines,
  selectedIds,
  onToggle,
}: RoutineSelectorProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<RoutineCategory | 'all'>('all')

  const filtered = useMemo(() => {
    let result = routines
    if (activeCategory !== 'all') {
      result = result.filter((r) => r.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          t(`routines.${r.i18nKey}.name`).toLowerCase().includes(q) ||
          t(`routines.${r.i18nKey}.description`).toLowerCase().includes(q)
      )
    }
    return result
  }, [routines, activeCategory, search, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header: search + counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder={t('onboarding.routines.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={search ? () => setSearch('') : undefined}
            leftIcon={<Search size={14} />}
          />
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
          }}
          aria-live="polite"
        >
          {t('onboarding.routines.selected', { count: selectedIds.length })}
        </span>
      </div>

      {/* Category tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 16,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
            background: activeCategory === 'all' ? 'var(--accent)' : 'var(--surface-2)',
            color: activeCategory === 'all' ? '#fff' : 'var(--text-muted)',
          }}
        >
          {t('onboarding.routines.allCategories')}
        </button>
        {ROUTINE_CATEGORY_IDS.map((catId) => (
          <button
            type="button"
            role="tab"
            key={catId}
            aria-selected={activeCategory === catId}
            onClick={() => setActiveCategory(catId)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              background: activeCategory === catId ? 'var(--accent)' : 'var(--surface-2)',
              color: activeCategory === catId ? '#fff' : 'var(--text-muted)',
            }}
          >
            {t(`routineCategories.${catId}`)}
          </button>
        ))}
      </div>

      {/* Routine grid */}
      <ScrollArea.Root style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea.Viewport style={{ width: '100%', maxHeight: 'calc(100vh - 420px)' }}>
          <div
            role="listbox"
            aria-label="Routine templates"
            aria-multiselectable="true"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {filtered.map((routine) => (
              <RoutineCard
                key={routine.id}
                name={t(`routines.${routine.i18nKey}.name`)}
                description={t(`routines.${routine.i18nKey}.description`)}
                icon={routine.icon}
                selected={selectedIds.includes(routine.id)}
                onClick={() => onToggle(routine.id)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
              No routines found.
            </p>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 6, padding: 1 }}>
          <ScrollArea.Thumb
            style={{ background: 'var(--border)', borderRadius: 3 }}
          />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

export default RoutineSelector
