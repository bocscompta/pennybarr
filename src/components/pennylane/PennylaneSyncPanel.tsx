// Pennylane full sync panel with entity-level progress

import { useState, useCallback, useRef } from 'react'
import { runFullPennylaneSync } from '../../services/pennylane/pennylaneSyncOrchestrator'
import type { FullSyncProgress, SyncEntityType } from '../../services/pennylane/syncTypes'
import { ENTITY_LABELS } from '../../services/pennylane/syncTypes'
import SyncEntityProgressLine from './SyncEntityProgress'

const ALL_ENTITIES: SyncEntityType[] = [
  'categories', 'suppliers', 'customers', 'products',
  'supplier_invoices', 'customer_invoices', 'quotes',
  'reconciliation',
]

export default function PennylaneSyncPanel() {
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState<FullSyncProgress | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [selectedEntities, setSelectedEntities] = useState<Set<SyncEntityType>>(new Set(ALL_ENTITIES))
  const abortControllerRef = useRef<AbortController | null>(null)

  const toggleEntity = useCallback((entity: SyncEntityType) => {
    setSelectedEntities(prev => {
      const next = new Set(prev)
      if (next.has(entity)) {
        next.delete(entity)
      } else {
        next.add(entity)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedEntities(prev =>
      prev.size === ALL_ENTITIES.length ? new Set() : new Set(ALL_ENTITIES)
    )
  }, [])

  const handleSync = useCallback(async () => {
    if (selectedEntities.size === 0) return

    const controller = new AbortController()
    abortControllerRef.current = controller
    setSyncing(true)
    setProgress(null)

    try {
      await runFullPennylaneSync(
        (p) => setProgress({ ...p }),
        {
          dateFrom: dateFrom || undefined,
          entities: selectedEntities.size === ALL_ENTITIES.length
            ? undefined
            : Array.from(selectedEntities),
        },
        controller.signal
      )
    } catch (err) {
      console.error('[PennylaneSync] Error:', err)
    } finally {
      setSyncing(false)
      abortControllerRef.current = null
    }
  }, [dateFrom, selectedEntities])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const totalCreated = progress
    ? Object.values(progress.entities).reduce((sum, e) => sum + e.created, 0)
    : 0
  const totalUpdated = progress
    ? Object.values(progress.entities).reduce((sum, e) => sum + e.updated, 0)
    : 0
  const totalErrors = progress
    ? Object.values(progress.entities).reduce((sum, e) => sum + e.errors.length, 0)
    : 0

  return (
    <div className="border-t pt-6" style={{ borderColor: '#E4E5E7' }}>
      <h3 className="font-semibold mb-4" style={{ color: '#141A1F' }}>Synchronisation compl&egrave;te</h3>

      {/* Entity selection */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: '#6C767F' }}>
            Entit&eacute;s &agrave; synchroniser
          </label>
          <button
            onClick={toggleAll}
            className="text-xs hover:underline"
            style={{ color: '#006666' }}
            disabled={syncing}
          >
            {selectedEntities.size === ALL_ENTITIES.length ? 'Tout d\u00e9s\u00e9lectionner' : 'Tout s\u00e9lectionner'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_ENTITIES.map(entity => (
            <label
              key={entity}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer select-none transition-colors"
              style={{
                borderColor: selectedEntities.has(entity) ? '#006666' : '#E4E5E7',
                backgroundColor: selectedEntities.has(entity) ? '#F0F5F4' : 'white',
                color: selectedEntities.has(entity) ? '#006666' : '#6C767F',
              }}
            >
              <input
                type="checkbox"
                checked={selectedEntities.has(entity)}
                onChange={() => toggleEntity(entity)}
                disabled={syncing}
                className="sr-only"
              />
              {ENTITY_LABELS[entity]}
            </label>
          ))}
        </div>
      </div>

      {/* Date filter + buttons */}
      <div className="flex items-end gap-4 mb-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#6C767F' }}>
            Depuis (optionnel)
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
            disabled={syncing}
          />
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || selectedEntities.size === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: '#006666' }}
        >
          {syncing ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Synchronisation...
            </span>
          ) : 'Tout synchroniser'}
        </button>
        {syncing && (
          <button
            onClick={handleStop}
            className="px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#DC2626', color: '#DC2626' }}
          >
            Arr&ecirc;ter
          </button>
        )}
      </div>

      {/* Progress */}
      {progress && (
        <div>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <div className="text-xs mb-1" style={{ color: '#6C767F' }}>Cr&eacute;&eacute;s</div>
              <div className="text-xl font-semibold" style={{ color: '#006666' }}>{totalCreated}</div>
            </div>
            <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <div className="text-xs mb-1" style={{ color: '#6C767F' }}>Mis &agrave; jour</div>
              <div className="text-xl font-semibold" style={{ color: '#141A1F' }}>{totalUpdated}</div>
            </div>
            <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <div className="text-xs mb-1" style={{ color: '#6C767F' }}>Erreurs</div>
              <div className="text-xl font-semibold" style={{ color: totalErrors > 0 ? '#DC2626' : '#6C767F' }}>{totalErrors}</div>
            </div>
          </div>

          {/* Entity-by-entity progress */}
          <div className="rounded-lg border divide-y" style={{ borderColor: '#E4E5E7' }}>
            {ALL_ENTITIES
              .filter(e => !progress || selectedEntities.has(e))
              .map(entity => (
                <SyncEntityProgressLine
                  key={entity}
                  entity={entity}
                  progress={progress.entities[entity]}
                />
              ))}
          </div>

          {/* Errors detail */}
          {totalErrors > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="text-sm font-medium text-red-700 mb-1">
                {totalErrors} erreur{totalErrors > 1 ? 's' : ''}
              </div>
              <div className="max-h-32 overflow-auto">
                {Object.values(progress.entities).flatMap(e => e.errors).map((err, i) => (
                  <div key={i} className="text-xs text-red-600">{err}</div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="mt-4">
            <div className="text-xs font-medium mb-2" style={{ color: '#6C767F' }}>Journal</div>
            <div
              className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-auto font-mono text-xs"
              style={{ color: '#141A1F' }}
            >
              {progress.logs.map((log, i) => (
                <div key={i} className="py-0.5">{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
