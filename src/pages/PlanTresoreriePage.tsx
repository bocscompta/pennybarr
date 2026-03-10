import { useState, useEffect, useMemo, useCallback, ReactElement, FormEvent } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  getCurrentCashPosition,
  generateCashFlowForecast,
  getForecastedInflows,
  getForecastedOutflows,
  getCashAlerts,
  getBudget,
  saveBudgetLine,
  compareBudgetVsActual,
  type CashPosition,
  type CashFlowForecast,
  type CashFlow,
  type CashAlert,
  type BudgetLine,
  type BudgetComparison,
} from '../services/tresorerieService'

// ============ Utilitaires ============

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

const formatMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

const formatMonthShort = (monthStr: string): string => {
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

const getAlertIcon = (type: CashAlert['type']): ReactElement => {
  switch (type) {
    case 'negative_balance':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      )
    case 'large_payment':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      )
    case 'budget_variance':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      )
  }
}

// ============ Composants ============

// Position de tresorerie actuelle
function CashPositionCard({ position }: { position: CashPosition | null }) {
  if (!position) {
    return (
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E4E5E7' }}>
        <div className="animate-pulse">
          <div className="h-4 bg-stone-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-stone-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E4E5E7' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
          Position de tresorerie
        </h2>
        <span className="text-sm" style={{ color: '#6C767F' }}>
          Au {formatDate(position.asOfDate)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Comptes bancaires */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium" style={{ color: '#6C767F' }}>
            Comptes bancaires
          </h3>
          {position.bankAccounts.length === 0 ? (
            <p className="text-sm" style={{ color: '#a8a29e' }}>Aucun compte bancaire</p>
          ) : (
            position.bankAccounts.map(account => (
              <div key={account.id} className="flex justify-between items-center py-1">
                <span className="text-sm" style={{ color: '#141A1F' }}>{account.name}</span>
                <span
                  className="text-sm font-medium font-mono"
                  style={{ color: account.balance >= 0 ? '#57534e' : '#b91c1c' }}
                >
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Comptes caisse */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium" style={{ color: '#6C767F' }}>
            Caisse
          </h3>
          {position.cashAccounts.length === 0 ? (
            <p className="text-sm" style={{ color: '#a8a29e' }}>Aucun compte caisse</p>
          ) : (
            position.cashAccounts.map(account => (
              <div key={account.id} className="flex justify-between items-center py-1">
                <span className="text-sm" style={{ color: '#141A1F' }}>{account.name}</span>
                <span
                  className="text-sm font-medium font-mono"
                  style={{ color: account.balance >= 0 ? '#57534e' : '#b91c1c' }}
                >
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Total */}
        <div className="flex flex-col justify-center items-center p-4 rounded-lg" style={{ backgroundColor: '#f5f5f4' }}>
          <span className="text-sm font-medium mb-1" style={{ color: '#6C767F' }}>
            Total disponible
          </span>
          <span
            className="text-2xl font-bold"
            style={{ color: position.totalAvailable >= 0 ? '#57534e' : '#b91c1c' }}
          >
            {formatCurrency(position.totalAvailable)}
          </span>
        </div>
      </div>
    </div>
  )
}

// Alertes de tresorerie
function AlertsBanner({ alerts }: { alerts: CashAlert[] }) {
  if (alerts.length === 0) return null

  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')

  return (
    <div className="space-y-2">
      {criticalAlerts.map(alert => (
        <div
          key={alert.id}
          className="flex items-start gap-3 p-4 rounded-lg border"
          style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}
        >
          <div className="text-red-600 flex-shrink-0 mt-0.5">
            {getAlertIcon(alert.type)}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-red-800">{alert.title}</h4>
            <p className="text-sm text-red-700">{alert.message}</p>
          </div>
        </div>
      ))}
      {warningAlerts.slice(0, 3).map(alert => (
        <div
          key={alert.id}
          className="flex items-start gap-3 p-4 rounded-lg border"
          style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}
        >
          <div className="text-amber-700 flex-shrink-0 mt-0.5">
            {getAlertIcon(alert.type)}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-amber-800">{alert.title}</h4>
            <p className="text-sm text-amber-700">{alert.message}</p>
          </div>
        </div>
      ))}
      {warningAlerts.length > 3 && (
        <p className="text-sm text-center" style={{ color: '#78716c' }}>
          + {warningAlerts.length - 3} autre{warningAlerts.length - 3 > 1 ? 's' : ''} alerte{warningAlerts.length - 3 > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// Modal detail par mois
function MonthDetailModal({
  isOpen,
  onClose,
  month,
  inflows,
  outflows,
}: {
  isOpen: boolean
  onClose: () => void
  month: string
  inflows: CashFlow[]
  outflows: CashFlow[]
}) {
  if (!isOpen) return null

  const totalInflows = inflows.reduce((sum, f) => sum + f.amount, 0)
  const totalOutflows = outflows.reduce((sum, f) => sum + f.amount, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
              Detail tresorerie - {formatMonth(month)}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Entrees */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold" style={{ color: '#57534e' }}>
                  Entrees prevues
                </h3>
                <span className="font-medium" style={{ color: '#57534e' }}>
                  {formatCurrency(totalInflows)}
                </span>
              </div>
              {inflows.length === 0 ? (
                <p className="text-sm" style={{ color: '#a8a29e' }}>Aucune entree prevue</p>
              ) : (
                <div className="space-y-2">
                  {inflows.map(flow => (
                    <div
                      key={flow.id}
                      className="p-3 rounded-lg border"
                      style={{ borderColor: '#e7e5e4' }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            {flow.label}
                          </p>
                          <p className="text-xs" style={{ color: '#78716c' }}>
                            {formatDate(flow.date)} - Probabilite: {flow.probability}%
                          </p>
                        </div>
                        <span className="font-medium font-mono" style={{ color: '#57534e' }}>
                          {formatCurrency(flow.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sorties */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold" style={{ color: '#b91c1c' }}>
                  Sorties prevues
                </h3>
                <span className="font-medium" style={{ color: '#b91c1c' }}>
                  {formatCurrency(totalOutflows)}
                </span>
              </div>
              {outflows.length === 0 ? (
                <p className="text-sm" style={{ color: '#a8a29e' }}>Aucune sortie prevue</p>
              ) : (
                <div className="space-y-2">
                  {outflows.map(flow => (
                    <div
                      key={flow.id}
                      className="p-3 rounded-lg border"
                      style={{ borderColor: '#e7e5e4' }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            {flow.label}
                          </p>
                          <p className="text-xs" style={{ color: '#78716c' }}>
                            {formatDate(flow.date)} - {flow.source === 'invoice' ? 'Facture' : flow.source === 'loan' ? 'Emprunt' : flow.source === 'salary' ? 'Salaire' : flow.source === 'tax' ? 'Taxe' : 'Autre'}
                          </p>
                        </div>
                        <span className="font-medium font-mono" style={{ color: '#b91c1c' }}>
                          {formatCurrency(flow.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Modal budget
function BudgetModal({
  isOpen,
  onClose,
  budgetLines,
  onSave,
  isSaving,
}: {
  isOpen: boolean
  onClose: () => void
  budgetLines: BudgetLine[]
  onSave: (month: string, category: string, amount: number, type: 'inflow' | 'outflow') => Promise<void>
  isSaving: boolean
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'inflow' | 'outflow'>('outflow')

  const monthBudget = useMemo(() => {
    return budgetLines.filter(b => b.month === selectedMonth)
  }, [budgetLines, selectedMonth])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!category || !amount) return
    await onSave(selectedMonth, category, parseFloat(amount), type)
    setCategory('')
    setAmount('')
  }

  if (!isOpen) return null

  // Generate 12 months options
  const monthOptions: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
              Budget de tresorerie
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Month selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
              Mois
            </label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              style={{ borderColor: '#D6D9DB' }}
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </div>

          {/* Current budget lines */}
          {monthBudget.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3" style={{ color: '#6C767F' }}>
                Budget existant
              </h3>
              <div className="space-y-2">
                {monthBudget.map(line => (
                  <div
                    key={line.id}
                    className="flex justify-between items-center p-3 rounded-lg"
                    style={{ backgroundColor: '#f5f5f4' }}
                  >
                    <div>
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {line.category}
                      </span>
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: line.type === 'inflow' ? '#dcfce7' : '#fee2e2',
                          color: line.type === 'inflow' ? '#166534' : '#991b1b',
                        }}
                      >
                        {line.type === 'inflow' ? 'Entree' : 'Sortie'}
                      </span>
                    </div>
                    <span className="font-medium font-mono" style={{ color: '#141A1F' }}>
                      {formatCurrency(line.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add budget line form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-sm font-medium" style={{ color: '#6C767F' }}>
              Ajouter une ligne
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                  Categorie
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                  placeholder="Salaires, Loyer, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                  Type
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as 'inflow' | 'outflow')}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  style={{ borderColor: '#D6D9DB' }}
                >
                  <option value="outflow">Sortie (depense)</option>
                  <option value="inflow">Entree (recette)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Montant
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="0.00"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Fermer
              </button>
              <button
                type="submit"
                disabled={isSaving || !category || !amount}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#57534e' }}
              >
                {isSaving ? 'Enregistrement...' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============ Composant principal ============

interface PlanTresoreriePageProps {
  onNavigate?: (page: string) => void
}

export default function PlanTresoreriePage({ onNavigate: _onNavigate }: PlanTresoreriePageProps) {
  // Etats
  const [position, setPosition] = useState<CashPosition | null>(null)
  const [forecasts, setForecasts] = useState<CashFlowForecast[]>([])
  const [alerts, setAlerts] = useState<CashAlert[]>([])
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([])
  const [budgetComparisons, setBudgetComparisons] = useState<BudgetComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [monthInflows, setMonthInflows] = useState<CashFlow[]>([])
  const [monthOutflows, setMonthOutflows] = useState<CashFlow[]>([])
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Export
  const [exporting, setExporting] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState<'forecast' | 'budget' | 'comparison'>('forecast')

  // Chargement des donnees
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const today = new Date().toISOString().split('T')[0]
      const currentYear = new Date().getFullYear()

      const [positionData, forecastData, alertsData, budgetData, comparisonData] = await Promise.all([
        getCurrentCashPosition(),
        generateCashFlowForecast(today, 12),
        getCashAlerts(),
        getBudget(currentYear),
        compareBudgetVsActual(currentYear),
      ])

      setPosition(positionData)
      setForecasts(forecastData)
      setAlerts(alertsData)
      setBudgetLines(budgetData)
      setBudgetComparisons(comparisonData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error loading treasury data:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Ouvrir detail d'un mois
  const handleMonthClick = async (month: string) => {
    try {
      const monthStart = `${month}-01`
      const monthNum = parseInt(month.slice(5, 7))
      const year = parseInt(month.slice(0, 4))
      const lastDay = new Date(year, monthNum, 0).getDate()
      const monthEnd = `${month}-${lastDay}`

      const [inflows, outflows] = await Promise.all([
        getForecastedInflows(monthStart, monthEnd),
        getForecastedOutflows(monthStart, monthEnd),
      ])

      setMonthInflows(inflows)
      setMonthOutflows(outflows)
      setSelectedMonth(month)
    } catch (err) {
      console.error('Error loading month details:', err)
    }
  }

  // Sauvegarder une ligne de budget
  const handleSaveBudget = async (month: string, category: string, amount: number, type: 'inflow' | 'outflow') => {
    try {
      setIsSaving(true)
      await saveBudgetLine(month, category, amount, type)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur sauvegarde budget'
      console.error('Error saving budget:', message)
      throw new Error(message)
    } finally {
      setIsSaving(false)
    }
  }

  // Export CSV
  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const headers = ['Mois', 'Solde debut', 'Entrees', 'Sorties', 'Solde fin', 'Ecart budget entrees', 'Ecart budget sorties']
      const rows = forecasts.map(f => [
        formatMonth(f.month),
        formatNumber(f.openingBalance),
        formatNumber(f.totalInflows),
        formatNumber(f.totalOutflows),
        formatNumber(f.closingBalance),
        f.varianceInflows !== undefined ? formatNumber(f.varianceInflows) : '-',
        f.varianceOutflows !== undefined ? formatNumber(f.varianceOutflows) : '-',
      ])

      const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n')

      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `plan_tresorerie_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export CSV error:', err)
    } finally {
      setExporting(false)
    }
  }

  // Export PDF (utilise la fonction du service d'export existant)
  const handleExportPDF = async () => {
    setExporting(true)
    try {
      // Pour l'instant, on genere un CSV car le PDF n'est pas configure pour la tresorerie
      await handleExportCSV()
    } finally {
      setExporting(false)
    }
  }

  // Donnees pour le graphique
  const chartData = useMemo(() => {
    return forecasts.map(f => ({
      month: formatMonthShort(f.month),
      solde: f.closingBalance,
      entrees: f.totalInflows,
      sorties: -f.totalOutflows,
    }))
  }, [forecasts])

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement du plan de tresorerie...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="bg-white rounded-xl p-8 border text-center max-w-md" style={{ borderColor: '#E4E5E7' }}>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Erreur de chargement</h3>
          <p className="text-sm mb-4" style={{ color: '#6C767F' }}>{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 rounded-lg text-white font-medium text-sm"
            style={{ backgroundColor: '#57534e' }}
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
              Plan de tresorerie
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBudgetModal(true)}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#78716c', color: '#78716c' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Budget
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
              style={{ borderColor: '#78716c', color: '#78716c' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
              style={{ borderColor: '#78716c', color: '#78716c' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              PDF
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Alertes */}
        <AlertsBanner alerts={alerts} />

        {/* Position de tresorerie */}
        <CashPositionCard position={position} />

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'forecast' ? 'border-current' : 'border-transparent'
            }`}
            style={{ color: activeTab === 'forecast' ? '#57534e' : '#6C767F' }}
          >
            Previsionnel 12 mois
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'comparison' ? 'border-current' : 'border-transparent'
            }`}
            style={{ color: activeTab === 'comparison' ? '#57534e' : '#6C767F' }}
          >
            Budget vs Realise
          </button>
        </div>

        {activeTab === 'forecast' && (
          <>
            {/* Graphique d'evolution */}
            <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
                Evolution de la tresorerie
              </h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => formatNumber(value as number)} />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #E4E5E7', borderRadius: '8px' }}
                    />
                    <Legend />
                    <ReferenceLine y={0} stroke="#e7e5e4" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="solde"
                      name="Solde"
                      stroke="#57534e"
                      strokeWidth={2}
                      dot={{ fill: '#57534e', strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="entrees"
                      name="Entrees"
                      stroke="#78716c"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="sorties"
                      name="Sorties"
                      stroke="#a8a29e"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center" style={{ color: '#6C767F' }}>
                  Aucune donnee previsionnelle
                </div>
              )}
            </div>

            {/* Tableau previsionnel */}
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
              <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                <h3 className="font-semibold" style={{ color: '#141A1F' }}>
                  Plan de tresorerie sur 12 mois
                </h3>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Cliquez sur un mois pour voir le detail des flux
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#f9fafb' }}>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Mois
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Solde debut
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Entrees prevues
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Sorties prevues
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Solde fin
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Ecart budget
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecasts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#6C767F' }}>
                          Aucune donnee previsionnelle
                        </td>
                      </tr>
                    ) : (
                      forecasts.map(forecast => {
                        const hasNegativeBalance = forecast.closingBalance < 0
                        const variance = (forecast.varianceInflows || 0) - (forecast.varianceOutflows || 0)
                        const hasLargeVariance = Math.abs(variance) > 0 && forecast.budgetedInflows && Math.abs(variance / forecast.budgetedInflows) > 0.2

                        return (
                          <tr
                            key={forecast.month}
                            className="border-b hover:bg-stone-50 cursor-pointer"
                            style={{
                              borderColor: '#F2F2F3',
                              backgroundColor: hasNegativeBalance ? '#fef2f2' : undefined,
                            }}
                            onClick={() => handleMonthClick(forecast.month)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium" style={{ color: '#141A1F' }}>
                                {formatMonth(forecast.month)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono" style={{ color: '#78716c' }}>
                              {formatCurrency(forecast.openingBalance)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono" style={{ color: '#57534e' }}>
                              {formatCurrency(forecast.totalInflows)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono" style={{ color: '#b91c1c' }}>
                              {formatCurrency(forecast.totalOutflows)}
                            </td>
                            <td
                              className="px-4 py-3 text-right font-mono font-semibold"
                              style={{ color: hasNegativeBalance ? '#b91c1c' : '#57534e' }}
                            >
                              {formatCurrency(forecast.closingBalance)}
                              {hasNegativeBalance && (
                                <span className="ml-2 text-red-600">
                                  <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {forecast.budgetedInflows !== undefined ? (
                                <span
                                  className={`font-mono ${hasLargeVariance ? 'font-semibold' : ''}`}
                                  style={{ color: hasLargeVariance ? '#b91c1c' : '#78716c' }}
                                >
                                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                                </span>
                              ) : (
                                <span style={{ color: '#a8a29e' }}>-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'comparison' && (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
            <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="font-semibold" style={{ color: '#141A1F' }}>
                Comparaison Budget vs Realise
              </h3>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Analyse des ecarts entre le budget previsionnel et le realise
              </p>
            </div>
            {budgetComparisons.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#d6d3d1' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <p style={{ color: '#6C767F' }}>Aucune donnee budgetaire</p>
                <p className="text-sm mt-1" style={{ color: '#a8a29e' }}>
                  Configurez votre budget pour activer la comparaison
                </p>
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="mt-4 px-4 py-2 rounded-lg text-white font-medium text-sm"
                  style={{ backgroundColor: '#57534e' }}
                >
                  Configurer le budget
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#f9fafb' }}>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Mois
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Categorie
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Budget
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Realise
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Ecart
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                        Ecart %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetComparisons.map((comp, index) => {
                      const hasLargeVariance = Math.abs(comp.variancePercent) > 20
                      return (
                        <tr
                          key={`${comp.month}-${comp.category}-${index}`}
                          className="border-b"
                          style={{
                            borderColor: '#F2F2F3',
                            backgroundColor: hasLargeVariance ? '#fffbeb' : undefined,
                          }}
                        >
                          <td className="px-4 py-3 font-medium" style={{ color: '#141A1F' }}>
                            {formatMonth(comp.month)}
                          </td>
                          <td className="px-4 py-3" style={{ color: '#141A1F' }}>
                            {comp.category}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: comp.type === 'inflow' ? '#dcfce7' : '#fee2e2',
                                color: comp.type === 'inflow' ? '#166534' : '#991b1b',
                              }}
                            >
                              {comp.type === 'inflow' ? 'Entree' : 'Sortie'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: '#78716c' }}>
                            {formatCurrency(comp.budgeted)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: '#141A1F' }}>
                            {formatCurrency(comp.actual)}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-mono"
                            style={{ color: comp.variance >= 0 ? '#57534e' : '#b91c1c' }}
                          >
                            {comp.variance >= 0 ? '+' : ''}{formatCurrency(comp.variance)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono ${hasLargeVariance ? 'font-semibold' : ''}`}
                            style={{ color: hasLargeVariance ? '#b91c1c' : '#78716c' }}
                          >
                            {comp.variancePercent >= 0 ? '+' : ''}{comp.variancePercent.toFixed(1)}%
                            {hasLargeVariance && (
                              <span className="ml-1 text-amber-600">
                                <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <MonthDetailModal
        isOpen={selectedMonth !== null}
        onClose={() => setSelectedMonth(null)}
        month={selectedMonth || ''}
        inflows={monthInflows}
        outflows={monthOutflows}
      />

      <BudgetModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        budgetLines={budgetLines}
        onSave={handleSaveBudget}
        isSaving={isSaving}
      />
    </div>
  )
}
