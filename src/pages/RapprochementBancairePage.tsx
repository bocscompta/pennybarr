/**
 * Page de Rapprochement Bancaire (Dolibarr-style)
 *
 * Fonctionnalites:
 * - Import de releves bancaires (OFX, QIF, CSV)
 * - Interface 2 colonnes: releve vs ecritures comptables
 * - Matching automatique intelligent
 * - Pointage en un clic
 * - Gestion des ecarts
 * - Historique des rapprochements
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useBankAccounts } from '../hooks/useSupabase'
import {
  createReconciliation,
  getReconciliationSession,
  getUnmatchedAccountingEntries,
  matchTransaction,
  unmatchTransaction,
  matchAllTransactions,
  completeReconciliation,
  cancelReconciliation,
  getAllReconciliations,
  getInProgressReconciliation,
  suggestReconciliationParams,
  createAdjustmentEntry,
  type ReconciliationSession,
  type ReconciliationSummary,
  type MatchSuggestion,
  type MatchedPair,
} from '../services/rapprochementService'
import type { BankAccount, AccountingEntry } from '../types/database'
import ImportStatementModal from '../components/rapprochement/ImportStatementModal'
import ReconciliationTwoColumns from '../components/rapprochement/ReconciliationTwoColumns'
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  Plus,
  RefreshCw,
  X,
  AlertTriangle,
  Upload,
  FileCheck,
  Hash,
  Calculator,
} from 'lucide-react'

// ============ Helpers ============

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ============ Sub-Components ============

// Bank Account Selector
function BankAccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: BankAccount[]
  selectedAccountId: string | null
  onSelect: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = accounts.find((a) => a.id === selectedAccountId)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors min-w-[280px]"
      >
        <Building2 className="w-4 h-4 text-gray-400" />
        <span className="flex-1 text-left text-sm">
          {selected ? selected.name : 'Selectionner un compte'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                onSelect(account.id)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                account.id === selectedAccountId ? 'bg-stone-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{account.name}</div>
                  <div className="text-xs text-gray-500">{account.bank_name || 'Compte bancaire'}</div>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {formatCurrency(account.current_balance)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Session Creation Form with Statement Number
function CreateSessionForm({
  bankAccountId,
  onCreated,
  onCancel,
}: {
  bankAccountId: string
  onCreated: (reconciliationId: string) => void
  onCancel: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statementDate, setStatementDate] = useState('')
  const [statementNumber, setStatementNumber] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [suggestedParams, setSuggestedParams] = useState<{
    suggestedOpeningBalance: number
    suggestedDate: string
    lastReconciliationDate?: string
    transactionsSinceLastReconciliation: number
  } | null>(null)

  // Load suggested parameters
  useEffect(() => {
    async function loadSuggestions() {
      try {
        const params = await suggestReconciliationParams(bankAccountId)
        setSuggestedParams(params)
        setStatementDate(params.suggestedDate)
        setOpeningBalance(params.suggestedOpeningBalance.toFixed(2))
      } catch (e) {
        console.error('Error loading suggestions:', e)
      }
    }
    loadSuggestions()
  }, [bankAccountId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const reconciliation = await createReconciliation(
        bankAccountId,
        statementDate,
        parseFloat(openingBalance),
        parseFloat(closingBalance),
        statementNumber || undefined
      )
      onCreated(reconciliation.id)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(message)
      console.error('Error creating reconciliation:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Nouveau rapprochement bancaire
      </h3>

      {suggestedParams && (
        <div className="mb-4 p-3 bg-stone-50 rounded-lg border border-stone-200">
          <div className="flex items-center gap-2 text-sm text-stone-700">
            <Clock className="w-4 h-4" />
            <span>
              {suggestedParams.lastReconciliationDate
                ? `Dernier rapprochement: ${formatDate(suggestedParams.lastReconciliationDate)}`
                : 'Aucun rapprochement anterieur'}
            </span>
          </div>
          <div className="text-xs text-stone-600 mt-1">
            {suggestedParams.transactionsSinceLastReconciliation} transactions non pointees
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date du releve
            </label>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Hash className="w-3 h-3 inline mr-1" />
              Numero de releve
            </label>
            <input
              type="text"
              value={statementNumber}
              onChange={(e) => setStatementNumber(e.target.value)}
              placeholder="Ex: 2024-01"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Solde initial
            </label>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Solde final (releve)
            </label>
            <input
              type="number"
              step="0.01"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-stone-600 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creation...' : 'Creer la session'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Reconciliation History Item
function ReconciliationHistoryItem({
  reconciliation,
  onClick,
}: {
  reconciliation: ReconciliationSummary
  onClick: () => void
}) {
  const isCompleted = reconciliation.status === 'completed'
  const hasDifference = Math.abs(reconciliation.difference) > 0.01

  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-stone-600" />
          ) : (
            <Clock className="w-4 h-4 text-amber-500" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {formatDate(reconciliation.statementDate)}
          </span>
          {reconciliation.statementNumber && (
            <span className="text-xs text-gray-400">
              #{reconciliation.statementNumber}
            </span>
          )}
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isCompleted
              ? 'bg-stone-100 text-stone-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isCompleted ? 'Termine' : 'En cours'}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-2">{reconciliation.bankAccountName}</div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{reconciliation.matchedCount} pointees</span>
        {hasDifference && (
          <span className="text-amber-600 font-medium">
            Ecart: {formatCurrency(reconciliation.difference)}
          </span>
        )}
      </div>
    </button>
  )
}

// Main Session View with 2-column interface
function ReconciliationSessionView({
  reconciliationId,
  bankAccountId,
  onClose,
  onComplete,
}: {
  reconciliationId: string
  bankAccountId: string
  onClose: () => void
  onComplete: () => void
}) {
  const [session, setSession] = useState<ReconciliationSession | null>(null)
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>([])
  const [matchedPairs, setMatchedPairs] = useState<MatchedPair[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentLabel, setAdjustmentLabel] = useState('')

  const loadSession = useCallback(async () => {
    try {
      setLoading(true)
      const [sessionData, entries] = await Promise.all([
        getReconciliationSession(reconciliationId),
        getUnmatchedAccountingEntries(bankAccountId, undefined)
      ])
      setSession(sessionData)
      setAccountingEntries(entries)

      // Build matched pairs from existing data
      const pairs: MatchedPair[] = sessionData.matchedTransactions.map((tx, idx) => ({
        id: tx.id,
        bankLineId: tx.id,
        entryId: '', // We don't have entry linking yet in DB
        matchedAt: tx.reconciled_at || new Date().toISOString(),
        colorIndex: idx % 8,
      }))
      setMatchedPairs(pairs)
      setError(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(message)
      console.error('Error loading session:', e)
    } finally {
      setLoading(false)
    }
  }, [reconciliationId, bankAccountId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const handleMatchAll = async () => {
    if (!session || session.reconciliation.status !== 'in_progress') return

    try {
      setActionLoading(true)
      await matchAllTransactions(reconciliationId)
      await loadSession()
    } catch (e) {
      console.error('Error matching all:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleComplete = async () => {
    if (!session) return

    try {
      setActionLoading(true)
      await completeReconciliation(reconciliationId)
      onComplete()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(message)
      console.error('Error completing reconciliation:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!session) return
    if (!confirm('Voulez-vous vraiment annuler ce rapprochement ?')) return

    try {
      setActionLoading(true)
      await cancelReconciliation(reconciliationId)
      onClose()
    } catch (e) {
      console.error('Error cancelling reconciliation:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateAdjustment = async () => {
    if (!adjustmentAmount || !session) return

    try {
      setActionLoading(true)
      await createAdjustmentEntry(
        reconciliationId,
        parseFloat(adjustmentAmount),
        adjustmentLabel || 'Ajustement de rapprochement'
      )
      setShowAdjustmentForm(false)
      setAdjustmentAmount('')
      setAdjustmentLabel('')
      await loadSession()
    } catch (e) {
      console.error('Error creating adjustment:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleMatch = async (bankLineId: string, _entryId: string) => {
    try {
      setActionLoading(true)
      await matchTransaction(reconciliationId, bankLineId)
      await loadSession()
    } catch (e) {
      console.error('Error matching:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnmatch = async (bankLineId: string) => {
    try {
      setActionLoading(true)
      await unmatchTransaction(reconciliationId, bankLineId)
      await loadSession()
    } catch (e) {
      console.error('Error unmatching:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAutoMatch = async (suggestions: MatchSuggestion[]) => {
    try {
      setActionLoading(true)
      for (const suggestion of suggestions) {
        await matchTransaction(reconciliationId, suggestion.bankLineId)
      }
      await loadSession()
    } catch (e) {
      console.error('Error auto-matching:', e)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="p-6 bg-red-50 rounded-xl border border-red-200">
        <p className="text-sm text-red-700">{error || 'Session non trouvee'}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50"
        >
          Retour
        </button>
      </div>
    )
  }

  const isInProgress = session.reconciliation.status === 'in_progress'
  const canComplete = Math.abs(session.difference) <= 0.01

  return (
    <div className="space-y-6">
      {/* Header with stats and import button */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Rapprochement du {formatDate(session.reconciliation.statement_date)}
              {session.reconciliation.statement_reference && (
                <span className="ml-2 text-sm text-gray-500">
                  #{session.reconciliation.statement_reference}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isInProgress ? 'En cours' : 'Termine'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isInProgress && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Upload className="w-4 h-4" />
                Importer releve
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Balance summary - 4 columns */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Solde initial</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency(Number(session.reconciliation.opening_balance))}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Solde calcule</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency(session.computedBalance)}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Solde releve</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency(session.statementBalance)}
            </div>
          </div>
          <div
            className={`p-4 rounded-lg ${
              canComplete
                ? 'bg-stone-50 border border-stone-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            <div className="text-xs text-gray-500 mb-1">Ecart</div>
            <div
              className={`text-lg font-semibold ${
                canComplete ? 'text-stone-600' : 'text-amber-600'
              }`}
            >
              {formatCurrency(session.difference)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {isInProgress && (
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleMatchAll}
              disabled={actionLoading || session.unmatchedTransactions.length === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Tout pointer
            </button>
            {!canComplete && (
              <button
                onClick={() => setShowAdjustmentForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Calculator className="w-4 h-4" />
                Creer ajustement
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleComplete}
              disabled={actionLoading || !canComplete}
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                canComplete
                  ? 'bg-stone-600 hover:bg-stone-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Valider le rapprochement
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Adjustment form */}
      {showAdjustmentForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Creer une ecriture d'ajustement
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <input
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="Montant (negatif = debit)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <input
                type="text"
                value={adjustmentLabel}
                onChange={(e) => setAdjustmentLabel(e.target.value)}
                placeholder="Libelle (ex: Frais bancaires)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateAdjustment}
                disabled={!adjustmentAmount || actionLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-stone-600 rounded-lg hover:bg-stone-700 disabled:opacity-50"
              >
                Creer
              </button>
              <button
                onClick={() => setShowAdjustmentForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-column reconciliation interface */}
      <ReconciliationTwoColumns
        bankLines={[...session.unmatchedTransactions, ...session.matchedTransactions]}
        accountingEntries={accountingEntries}
        matchedPairs={matchedPairs}
        isInProgress={isInProgress}
        onMatch={handleMatch}
        onUnmatch={handleUnmatch}
        onAutoMatch={handleAutoMatch}
      />

      {/* Warning if difference */}
      {!canComplete && isInProgress && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Ecart de rapprochement detecte
            </p>
            <p className="text-sm text-amber-700 mt-1">
              L'ecart entre le solde calcule et le solde du releve est de{' '}
              <strong>{formatCurrency(session.difference)}</strong>. Verifiez les
              transactions non pointees ou creez une ecriture d'ajustement.
            </p>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportStatementModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        bankAccountId={bankAccountId}
        reconciliationId={reconciliationId}
        onImportComplete={async (count) => {
          console.log(`Imported ${count} transactions`)
          await loadSession()
        }}
      />
    </div>
  )
}

// ============ Main Component ============

interface RapprochementBancairePageProps {
  onNavigate?: (page: string) => void
}

export default function RapprochementBancairePage({ onNavigate: _onNavigate }: RapprochementBancairePageProps) {
  const { accounts, loading: accountsLoading } = useBankAccounts()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [currentReconciliationId, setCurrentReconciliationId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [history, setHistory] = useState<ReconciliationSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Load history
  const loadHistory = async () => {
    try {
      setHistoryLoading(true)
      const data = await getAllReconciliations()
      setHistory(data)
    } catch (e) {
      console.error('Error loading history:', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Check for in-progress reconciliation when account is selected
  useEffect(() => {
    async function checkInProgress() {
      if (!selectedAccountId) return

      try {
        const inProgress = await getInProgressReconciliation(selectedAccountId)
        if (inProgress) {
          setCurrentReconciliationId(inProgress.id)
        } else {
          setCurrentReconciliationId(null)
        }
      } catch (e) {
        console.error('Error checking in-progress:', e)
      }
    }
    checkInProgress()
  }, [selectedAccountId])

  // Filter history by selected account
  const filteredHistory = useMemo(() => {
    if (!selectedAccountId) return history
    return history.filter((r) => r.bankAccountId === selectedAccountId)
  }, [history, selectedAccountId])

  const handleCreateSession = () => {
    if (!selectedAccountId) return
    setShowCreateForm(true)
  }

  const handleSessionCreated = (reconciliationId: string) => {
    setCurrentReconciliationId(reconciliationId)
    setShowCreateForm(false)
    loadHistory()
  }

  const handleSessionComplete = () => {
    setCurrentReconciliationId(null)
    loadHistory()
  }

  const handleOpenHistory = (reconciliationId: string) => {
    setCurrentReconciliationId(reconciliationId)
  }

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Rapprochement bancaire
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pointez les transactions pour verifier la concordance avec vos releves bancaires
          </p>
        </div>

        <div className="flex items-center gap-3">
          <BankAccountSelector
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelect={setSelectedAccountId}
          />

          {selectedAccountId && !currentReconciliationId && !showCreateForm && (
            <button
              onClick={handleCreateSession}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-stone-600 rounded-lg hover:bg-stone-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau rapprochement
            </button>
          )}
        </div>
      </div>

      {/* No account selected */}
      {!selectedAccountId && !currentReconciliationId && (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Selectionnez un compte bancaire
          </h3>
          <p className="text-sm text-gray-500">
            Choisissez un compte pour commencer le rapprochement
          </p>
        </div>
      )}

      {/* Create session form */}
      {showCreateForm && selectedAccountId && (
        <CreateSessionForm
          bankAccountId={selectedAccountId}
          onCreated={handleSessionCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Active session */}
      {currentReconciliationId && !showCreateForm && selectedAccountId && (
        <ReconciliationSessionView
          reconciliationId={currentReconciliationId}
          bankAccountId={selectedAccountId}
          onClose={() => setCurrentReconciliationId(null)}
          onComplete={handleSessionComplete}
        />
      )}

      {/* History */}
      {!currentReconciliationId && !showCreateForm && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">
              Historique des rapprochements
            </h2>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <FileCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">
                {selectedAccountId
                  ? 'Aucun rapprochement pour ce compte'
                  : 'Aucun rapprochement effectue'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredHistory.map((rec) => (
                <ReconciliationHistoryItem
                  key={rec.id}
                  reconciliation={rec}
                  onClick={() => handleOpenHistory(rec.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
