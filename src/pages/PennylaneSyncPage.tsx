import { useState, useCallback } from 'react'
import { testConnection, clearApiKeyCache } from '../services/pennylaneApiService'
import { runPennylaneSync, type SyncProgress } from '../services/pennylaneSyncService'

interface PennylaneSyncPageProps {
  onNavigate?: (page: string) => void
}

export default function PennylaneSyncPage({ onNavigate: _onNavigate }: PennylaneSyncPageProps) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [dateFrom, setDateFrom] = useState('')

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing')
    setConnectionError(null)
    clearApiKeyCache()
    try {
      const result = await testConnection()
      if (result.ok) {
        setConnectionStatus('ok')
        setCompanyName(result.company || null)
      } else {
        setConnectionStatus('error')
        setConnectionError(result.error || 'Erreur inconnue')
      }
    } catch (err) {
      setConnectionStatus('error')
      setConnectionError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }, [])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setProgress(null)
    try {
      await runPennylaneSync(
        (p) => setProgress({ ...p }),
        dateFrom || undefined
      )
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setSyncing(false)
    }
  }, [dateFrom])

  const phaseLabels: Record<string, string> = {
    idle: 'En attente',
    fetching_invoices: 'Récupération des factures...',
    fetching_suppliers: 'Récupération des fournisseurs...',
    detecting_duplicates: 'Détection des doublons...',
    creating_invoices: 'Création des factures...',
    reconciling: 'Rapprochement automatique...',
    done: 'Terminé',
    error: 'Erreur',
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#141A1F' }}>
          Synchronisation Pennylane
        </h1>
        <p className="text-sm" style={{ color: '#6C767F' }}>
          Importez automatiquement vos factures fournisseurs depuis Pennylane et rapprochez-les avec vos transactions bancaires.
        </p>
      </div>

      {/* Connection Card */}
      <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: '#E4E5E7' }}>
        <h2 className="font-semibold mb-4" style={{ color: '#141A1F' }}>Connexion API</h2>

        <div className="flex items-center gap-4">
          <button
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#006666' }}
          >
            {connectionStatus === 'testing' ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Test en cours...
              </span>
            ) : 'Tester la connexion'}
          </button>

          {connectionStatus === 'ok' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#F0F5F4' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#006666' }} />
              <span className="text-sm font-medium" style={{ color: '#006666' }}>
                Connecté{companyName ? ` — ${companyName}` : ''}
              </span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-700">{connectionError}</span>
            </div>
          )}
        </div>

        <p className="text-xs mt-3" style={{ color: '#6C767F' }}>
          La clé API est stockée de manière sécurisée dans le vault Supabase.
        </p>
      </div>

      {/* Sync Card */}
      <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: '#E4E5E7' }}>
        <h2 className="font-semibold mb-4" style={{ color: '#141A1F' }}>Synchronisation</h2>

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
            />
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#006666' }}
          >
            {syncing ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Synchronisation...
              </span>
            ) : 'Lancer la synchronisation'}
          </button>
        </div>

        {/* Progress Stats */}
        {progress && (
          <div>
            {/* Phase label */}
            <div className="flex items-center gap-2 mb-4">
              {progress.phase !== 'done' && progress.phase !== 'error' && progress.phase !== 'idle' && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: '#006666' }} />
              )}
              {progress.phase === 'done' && (
                <svg className="w-5 h-5" style={{ color: '#006666' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {progress.phase === 'error' && (
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm font-medium" style={{ color: progress.phase === 'error' ? '#DC2626' : '#141A1F' }}>
                {phaseLabels[progress.phase]}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-xs mb-1" style={{ color: '#6C767F' }}>Factures Pennylane</div>
                <div className="text-xl font-semibold" style={{ color: '#141A1F' }}>{progress.totalFetched}</div>
              </div>
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-xs mb-1" style={{ color: '#6C767F' }}>Doublons ignorés</div>
                <div className="text-xl font-semibold" style={{ color: '#6C767F' }}>{progress.duplicatesSkipped}</div>
              </div>
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-xs mb-1" style={{ color: '#6C767F' }}>Factures créées</div>
                <div className="text-xl font-semibold" style={{ color: '#006666' }}>{progress.invoicesCreated}</div>
              </div>
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-xs mb-1" style={{ color: '#6C767F' }}>Rapprochements</div>
                <div className="text-xl font-semibold" style={{ color: '#006666' }}>{progress.reconciliationsMatched}</div>
              </div>
            </div>

            {/* Errors */}
            {progress.errors.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-sm font-medium text-red-700 mb-1">
                  {progress.errors.length} erreur{progress.errors.length > 1 ? 's' : ''}
                </div>
                <div className="max-h-32 overflow-auto">
                  {progress.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-600">{err}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Logs */}
            <div>
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

      {/* Info Card */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E4E5E7' }}>
        <h2 className="font-semibold mb-3" style={{ color: '#141A1F' }}>Comment fonctionne la synchronisation</h2>
        <div className="space-y-2 text-sm" style={{ color: '#6C767F' }}>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>1.</span>
            <span>Récupération de toutes les factures fournisseurs depuis l'API Pennylane V2</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>2.</span>
            <span>Détection des doublons par numéro de facture + montant + fournisseur</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>3.</span>
            <span>Création des factures manquantes dans votre base comptable</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium" style={{ color: '#006666' }}>4.</span>
            <span>Rapprochement automatique avec les transactions bancaires (montant + nom + date)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
