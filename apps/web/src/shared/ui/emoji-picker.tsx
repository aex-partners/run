import { EmojiPicker as Frimousse } from 'frimousse'

export interface EmojiPickerProps {
  /** Called with the chosen emoji character. */
  onSelect: (emoji: string) => void
  /** Emojibase locale, e.g. "en" | "pt". Defaults to "en". */
  locale?: string
  /** Localized strings. */
  labels?: {
    search?: string
    loading?: string
    empty?: string
  }
}

/**
 * Styled emoji picker built on frimousse (full native emoji set, real search,
 * categories, keyboard nav). Root uses fit-content width so the grid never
 * leaves a gutter, and the scrollbar sits flush at the content edge.
 *
 * Positioning is the caller's responsibility, render it inside a popover/portal.
 */
export function EmojiPicker({ onSelect, locale = 'en', labels }: EmojiPickerProps) {
  return (
    <Frimousse.Root
      locale={locale as React.ComponentProps<typeof Frimousse.Root>['locale']}
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 360,
        // 9 columns (frimousse default) x 32px emoji cells + 2x6px row padding.
        // Fixed so the grid fills the width with no right-side gutter.
        width: 300,
        background: 'var(--surface)',
        isolation: 'isolate',
      }}
    >
      <Frimousse.Search
        placeholder={labels?.search ?? 'Search emoji...'}
        style={{
          boxSizing: 'border-box',
          width: 'calc(100% - 16px)',
          margin: 8,
          padding: '8px 10px',
          fontSize: 13,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: '#fff',
          color: 'var(--text)',
          outline: 'none',
        }}
      />
      <Frimousse.Viewport style={{ position: 'relative', flex: 1, outline: 'none' }}>
        <Frimousse.Loading
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}
        >
          {labels?.loading ?? 'Loading...'}
        </Frimousse.Loading>
        <Frimousse.Empty
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}
        >
          {labels?.empty ?? 'No emoji found.'}
        </Frimousse.Empty>
        <Frimousse.List
          style={{ paddingBottom: 6, userSelect: 'none' }}
          components={{
            // Spread frimousse's props FIRST, then merge its style under ours,
            // otherwise {...props}.style (frimousse's layout/sizing) clobbers
            // ours and the emoji cells collapse to ~20px.
            CategoryHeader: ({ category, ...props }) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  padding: '10px 12px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'var(--surface)',
                }}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} style={{ ...props.style, padding: '0 6px' }}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                type="button"
                {...props}
                style={{
                  ...props.style,
                  display: 'flex',
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  border: 'none',
                  background: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </Frimousse.Viewport>
    </Frimousse.Root>
  )
}

export default EmojiPicker
