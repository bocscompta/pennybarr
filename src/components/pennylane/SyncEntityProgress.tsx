// Individual entity sync progress line

import type { EntitySyncProgress, SyncEntityType } from '../../services/pennylane/syncTypes'
import { ENTITY_LABELS } from '../../services/pennylane/syncTypes'

interface SyncEntityProgressProps {
  entity: SyncEntityType
  progress: EntitySyncProgress
}

export default function SyncEntityProgressLine({ entity, progress }: SyncEntityProgressProps) {
  const label = ENTITY_LABELS[entity]
  const { status, created, updated, skipped, errors, total } = progress

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{
      backgroundColor: status === 'running' ? '#F8F9FA' : 'transparent',
    }}>
      {/* Status icon */}
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
        {status === 'pending' && (
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#D6D9DB' }} />
        )}
        {status === 'running' && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: '#006666' }} />
        )}
        {status === 'done' && (
          <svg className="w-5 h-5" style={{ color: '#006666' }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        {status === 'error' && (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Label */}
      <span className="text-sm font-medium flex-1" style={{
        color: status === 'running' ? '#141A1F' : status === 'pending' ? '#9CA3AF' : '#141A1F',
      }}>
        {label}
      </span>

      {/* Stats */}
      {(status === 'done' || status === 'running') && (
        <span className="text-xs tabular-nums" style={{ color: '#6C767F' }}>
          {status === 'running' && total > 0
            ? `${created + updated + skipped}/${total}`
            : `${created + updated} sync`}
          {errors.length > 0 && (
            <span className="text-red-500 ml-1">({errors.length} err)</span>
          )}
        </span>
      )}
    </div>
  )
}
