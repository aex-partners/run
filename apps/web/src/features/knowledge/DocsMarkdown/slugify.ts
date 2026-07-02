import React from 'react'

/** GitHub-style heading slug: lowercase, keep unicode letters/digits, spaces to hyphens. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

/** Plain-text content of a React node, for deriving heading ids. */
export function nodeText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('')
}
