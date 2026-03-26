import type { GridColumnType, AggregationType } from './types'

export interface ColumnTypeMeta {
  defaultWidth: number
  editable: boolean
  supportsAggregation: boolean
  supportedAggregations: AggregationType[]
}

export const COLUMN_TYPE_REGISTRY: Record<GridColumnType, ColumnTypeMeta> = {
  text: { defaultWidth: 200, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  long_text: { defaultWidth: 240, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  rich_text: { defaultWidth: 240, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  number: { defaultWidth: 120, editable: true, supportsAggregation: true, supportedAggregations: ['sum', 'avg', 'count', 'min', 'max'] },
  decimal: { defaultWidth: 120, editable: true, supportsAggregation: true, supportedAggregations: ['sum', 'avg', 'count', 'min', 'max'] },
  currency: { defaultWidth: 130, editable: true, supportsAggregation: true, supportedAggregations: ['sum', 'avg', 'count', 'min', 'max'] },
  percent: { defaultWidth: 100, editable: true, supportsAggregation: true, supportedAggregations: ['sum', 'avg', 'count', 'min', 'max'] },
  badge: { defaultWidth: 120, editable: false, supportsAggregation: false, supportedAggregations: ['count'] },
  date: { defaultWidth: 140, editable: true, supportsAggregation: false, supportedAggregations: ['count', 'min', 'max'] },
  datetime: { defaultWidth: 180, editable: true, supportsAggregation: false, supportedAggregations: ['count', 'min', 'max'] },
  duration: { defaultWidth: 120, editable: true, supportsAggregation: true, supportedAggregations: ['sum', 'avg', 'count', 'min', 'max'] },
  status: { defaultWidth: 140, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  person: { defaultWidth: 120, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  timeline: { defaultWidth: 180, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  priority: { defaultWidth: 120, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  rating: { defaultWidth: 120, editable: true, supportsAggregation: true, supportedAggregations: ['avg', 'count', 'min', 'max'] },
  checkbox: { defaultWidth: 60, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  select: { defaultWidth: 140, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  multiselect: { defaultWidth: 200, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  email: { defaultWidth: 200, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  url: { defaultWidth: 200, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  phone: { defaultWidth: 140, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  relationship: { defaultWidth: 160, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  lookup: { defaultWidth: 160, editable: false, supportsAggregation: false, supportedAggregations: ['count'] },
  rollup: { defaultWidth: 120, editable: false, supportsAggregation: true, supportedAggregations: ['count'] },
  formula: { defaultWidth: 140, editable: false, supportsAggregation: true, supportedAggregations: ['sum', 'avg', 'count', 'min', 'max'] },
  autonumber: { defaultWidth: 80, editable: false, supportsAggregation: false, supportedAggregations: ['count'] },
  attachment: { defaultWidth: 160, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  json: { defaultWidth: 200, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  barcode: { defaultWidth: 140, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  ai: { defaultWidth: 200, editable: true, supportsAggregation: false, supportedAggregations: ['count'] },
  created_at: { defaultWidth: 160, editable: false, supportsAggregation: false, supportedAggregations: ['count'] },
  updated_at: { defaultWidth: 160, editable: false, supportsAggregation: false, supportedAggregations: ['count'] },
  created_by: { defaultWidth: 120, editable: false, supportsAggregation: false, supportedAggregations: ['count'] },
  updated_by: { defaultWidth: 120, editable: false, supportsAggregation: false, supportedAggregations: ['count'] },
}

export const STATUS_BADGE_MAP: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  Active: 'success',
  Inactive: 'danger',
  Pending: 'warning',
}

export const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#d97706',
  Low: '#2563eb',
}

export const MIN_COLUMN_WIDTH = 60

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
