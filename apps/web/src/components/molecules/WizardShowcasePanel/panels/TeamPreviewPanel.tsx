import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '../../../atoms/Avatar/Avatar'
import { t } from '../../../../locales/en'

export interface TeamPreviewPanelProps {
  adminName?: string
  adminEmail?: string
  invites?: string[]
}

export function TeamPreviewPanel({ adminName, adminEmail, invites = [] }: TeamPreviewPanelProps) {
  const validInvites = invites.filter((e) => e.trim().length > 0)
  const maxSlots = 5
  const emptySlots = Math.max(0, maxSlots - validInvites.length)

  return (
    <div
      data-testid="team-preview-panel"
      style={{
        flex: 1,
        background: 'var(--accent-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        minHeight: 0,
      }}
    >
      <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Admin card */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={adminName || 'Admin'} size="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {adminName || 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {adminEmail || 'admin@company.com'}
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--accent-border)' }}>
            {t.setup.showcase.team.admin}
          </span>
        </div>

        {/* Invited members */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
            {t.setup.showcase.team.invitedMembers}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AnimatePresence mode="popLayout">
              {validInvites.map((email, i) => (
                <motion.div
                  key={email + i}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}
                >
                  <Avatar name={email} size="sm" />
                  <span style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px dashed var(--border)' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.setup.showcase.team.emptySlot}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamPreviewPanel
