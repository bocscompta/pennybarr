import { useState, useEffect } from 'react'
import {
  getFiscalYears,
  validateFiscalYearBalance,
  validatePreClosure,
  getRegularizationSummary,
  previewClosingEntries,
  previewOpeningEntries,
  closeFiscalYear,
  openNewFiscalYear,
  createFiscalYear,
  lockFiscalYear,
  reopenFiscalYear
} from '../services/clotureService'
import type {
  FiscalYearValidation,
  PreClosureValidation,
  RegularizationSummary,
  ClosingEntry,
  CreateFiscalYearData
} from '../services/clotureService'
import type { FiscalYear } from '../types/database'

// Format number
const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

// Format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

// Workflow step type - enhanced with 5 steps
type WorkflowStep = 'selection' | 'validation' | 'regularization' | 'preview' | 'confirmation' | 'opening' | 'complete'

// Step metadata for stepper display
const WORKFLOW_STEPS = [
  { key: 'selection', label: 'Selection', description: 'Choix de l\'exercice' },
  { key: 'validation', label: 'Verifications', description: 'Controles pre-cloture' },
  { key: 'regularization', label: 'Regularisations', description: 'CCA, FNP, PCA' },
  { key: 'preview', label: 'Preview', description: 'Ecritures de cloture' },
  { key: 'confirmation', label: 'Confirmation', description: 'Cloture definitive' },
  { key: 'opening', label: 'A-Nouveaux', description: 'Ouverture N+1' },
] as const

interface ClotureExercicePageProps {
  onNavigate?: (page: string) => void
}

export default function ClotureExercicePage({ onNavigate }: ClotureExercicePageProps) {
  // State
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Selected fiscal year for closing
  const [selectedYear, setSelectedYear] = useState<FiscalYear | null>(null)

  // Workflow state
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('selection')
  const [isProcessing, setIsProcessing] = useState(false)

  // Validation data (basic and pre-closure)
  const [validation, setValidation] = useState<FiscalYearValidation | null>(null)
  const [preClosureValidation, setPreClosureValidation] = useState<PreClosureValidation | null>(null)
  const [regularizationSummary, setRegularizationSummary] = useState<RegularizationSummary | null>(null)

  // Preview data
  const [closingPreview, setClosingPreview] = useState<ClosingEntry[]>([])
  const [openingPreview, setOpeningPreview] = useState<ClosingEntry[]>([])

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCloseWorkflow, setShowCloseWorkflow] = useState(false)
  const [showOpeningModal, setShowOpeningModal] = useState(false)
  const [showConfirmLock, setShowConfirmLock] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)

  // New fiscal year form
  const [newYearForm, setNewYearForm] = useState<CreateFiscalYearData>({
    name: '',
    startDate: '',
    endDate: ''
  })

  // Fetch fiscal years
  useEffect(() => {
    fetchFiscalYears()
  }, [])

  const fetchFiscalYears = async () => {
    setLoading(true)
    setError(null)
    try {
      const years = await getFiscalYears()
      setFiscalYears(years)
    } catch (err) {
      console.error('Error fetching fiscal years:', err)
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // Create new fiscal year
  const handleCreateFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError(null)

    try {
      await createFiscalYear(newYearForm)
      await fetchFiscalYears()
      setShowCreateModal(false)
      setNewYearForm({ name: '', startDate: '', endDate: '' })
    } catch (err) {
      console.error('Error creating fiscal year:', err)
      setError(err instanceof Error ? err.message : 'Erreur de creation')
    } finally {
      setIsProcessing(false)
    }
  }

  // Start closing workflow - now with comprehensive pre-closure validation
  const startCloseWorkflow = async (year: FiscalYear) => {
    setSelectedYear(year)
    setWorkflowStep('selection')
    setShowCloseWorkflow(true)
    setError(null)
    setValidation(null)
    setPreClosureValidation(null)
    setRegularizationSummary(null)
    setClosingPreview([])
    setOpeningPreview([])
  }

  // Step 1 -> Step 2: Run comprehensive pre-closure validation
  const runPreClosureValidation = async () => {
    if (!selectedYear) return
    setIsProcessing(true)
    setError(null)
    setWorkflowStep('validation')

    try {
      // Run comprehensive pre-closure validation
      const preClosureResult = await validatePreClosure(selectedYear.id)
      setPreClosureValidation(preClosureResult)

      // Also get basic balance validation for display
      const validationResult = await validateFiscalYearBalance(selectedYear.id)
      setValidation(validationResult)

      // Get regularization summary
      const regSummary = await getRegularizationSummary(selectedYear.id)
      setRegularizationSummary(regSummary)

    } catch (err) {
      console.error('Error validating fiscal year:', err)
      setError(err instanceof Error ? err.message : 'Erreur de validation')
    } finally {
      setIsProcessing(false)
    }
  }

  // Step 2 -> Step 3: Go to regularization step
  const goToRegularization = () => {
    setWorkflowStep('regularization')
  }

  // Step 3 -> Step 4: Go to preview step
  const goToPreview = async () => {
    if (!selectedYear) return
    setWorkflowStep('preview')
    setIsProcessing(true)

    try {
      if (closingPreview.length === 0) {
        const preview = await previewClosingEntries(selectedYear.id)
        setClosingPreview(preview)
      }
    } catch (err) {
      console.error('Error loading preview:', err)
      setError(err instanceof Error ? err.message : 'Erreur de preview')
    } finally {
      setIsProcessing(false)
    }
  }

  // Execute closing
  const executeClosing = async () => {
    if (!selectedYear) return
    setIsProcessing(true)
    setError(null)

    try {
      await closeFiscalYear(selectedYear.id)
      setWorkflowStep('complete')
      await fetchFiscalYears()
    } catch (err) {
      console.error('Error closing fiscal year:', err)
      setError(err instanceof Error ? err.message : 'Erreur de cloture')
    } finally {
      setIsProcessing(false)
    }
  }

  // Lock fiscal year
  const handleLockFiscalYear = async () => {
    if (!selectedYear) return
    setIsProcessing(true)
    setError(null)

    try {
      await lockFiscalYear(selectedYear.id)
      await fetchFiscalYears()
      setShowConfirmLock(false)
      setSelectedYear(null)
    } catch (err) {
      console.error('Error locking fiscal year:', err)
      setError(err instanceof Error ? err.message : 'Erreur de verrouillage')
    } finally {
      setIsProcessing(false)
    }
  }

  // Start opening workflow (a-nouveaux)
  const startOpeningWorkflow = async (previousYear: FiscalYear) => {
    setSelectedYear(previousYear)
    setShowOpeningModal(true)
    setIsProcessing(true)
    setError(null)

    try {
      const preview = await previewOpeningEntries(previousYear.id)
      setOpeningPreview(preview)

      // Pre-fill new year dates
      const prevEndDate = new Date(previousYear.end_date)
      const newStartDate = new Date(prevEndDate)
      newStartDate.setDate(newStartDate.getDate() + 1)
      const newEndDate = new Date(newStartDate)
      newEndDate.setFullYear(newEndDate.getFullYear() + 1)
      newEndDate.setDate(newEndDate.getDate() - 1)

      const newYear = newStartDate.getFullYear()
      setNewYearForm({
        name: `Exercice ${newYear}`,
        startDate: newStartDate.toISOString().split('T')[0],
        endDate: newEndDate.toISOString().split('T')[0]
      })
    } catch (err) {
      console.error('Error loading opening preview:', err)
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsProcessing(false)
    }
  }

  // Execute opening
  const executeOpening = async () => {
    if (!selectedYear) return
    setIsProcessing(true)
    setError(null)

    try {
      await openNewFiscalYear(selectedYear.id, newYearForm)
      await fetchFiscalYears()
      setShowOpeningModal(false)
      setSelectedYear(null)
      setOpeningPreview([])
    } catch (err) {
      console.error('Error opening new fiscal year:', err)
      setError(err instanceof Error ? err.message : 'Erreur de creation')
    } finally {
      setIsProcessing(false)
    }
  }

  // Close workflow modal and reset state
  const closeWorkflow = () => {
    setShowCloseWorkflow(false)
    setSelectedYear(null)
    setWorkflowStep('selection')
    setValidation(null)
    setPreClosureValidation(null)
    setRegularizationSummary(null)
    setClosingPreview([])
    setOpeningPreview([])
    setError(null)
  }

  // Reopen a closed fiscal year
  const handleReopenFiscalYear = async () => {
    if (!selectedYear) return
    setIsProcessing(true)
    setError(null)

    try {
      const result = await reopenFiscalYear(selectedYear.id)
      await fetchFiscalYears()
      setShowReopenConfirm(false)
      setSelectedYear(null)
      setSuccessMessage(
        `Exercice ${result.fiscalYear.name} rouvert. ${result.deletedClosingEntries} ecritures de cloture et ${result.deletedOpeningEntries} ecritures d'a-nouveaux supprimees.`
      )
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      console.error('Error reopening fiscal year:', err)
      setError(err instanceof Error ? err.message : 'Erreur de reouverture')
    } finally {
      setIsProcessing(false)
    }
  }

  // Navigate to regularization pages (CCA, FNP, PCA)
  const navigateToRegularization = (type: 'cca' | 'fnp' | 'pca') => {
    if (onNavigate) {
      onNavigate(`regularisation-${type}`)
    }
  }

  // Calculate totals from preview
  const calculatePreviewTotals = (entries: ClosingEntry[]) => {
    return entries.reduce(
      (acc, e) => ({
        debit: acc.debit + e.debit,
        credit: acc.credit + e.credit
      }),
      { debit: 0, credit: 0 }
    )
  }

  // Render workflow step indicator - 6 steps stepper
  const renderStepIndicator = () => {
    // Filter out 'selection' step from visual display
    const displaySteps = WORKFLOW_STEPS.filter(s => s.key !== 'selection')
    const currentIndex = displaySteps.findIndex(s => s.key === workflowStep)

    return (
      <div className="flex items-center justify-center gap-1 mb-4">
        {displaySteps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  index < currentIndex
                    ? 'bg-stone-600 text-white'
                    : index === currentIndex
                    ? 'bg-stone-600 text-white ring-2 ring-stone-300'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentIndex ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`text-xs mt-1 max-w-[70px] text-center ${
                  index <= currentIndex ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < displaySteps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 mt-[-12px] ${
                  index < currentIndex ? 'bg-stone-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
              Cloture d'exercice
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvel exercice
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Success banner */}
          {successMessage && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-stone-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-stone-800">Succes</p>
                <p className="text-sm text-stone-700 mt-1">{successMessage}</p>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="ml-auto text-stone-600 hover:text-stone-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-rose-800">Erreur</p>
                <p className="text-sm text-rose-700 mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto text-rose-600 hover:text-rose-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Fiscal Years List */}
          <div className="bg-white rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Exercices comptables
              </h2>
              <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                Gerez vos exercices fiscaux et processus de cloture
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
              </div>
            ) : fiscalYears.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Aucun exercice comptable configure
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-stone-600 rounded-lg hover:bg-stone-700"
                >
                  Creer un exercice
                </button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                {fiscalYears.map((fy) => (
                  <div
                    key={fy.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Status indicator */}
                      <div
                        className={`w-3 h-3 rounded-full ${
                          fy.is_closed ? 'bg-gray-400' : 'bg-emerald-500'
                        }`}
                      />
                      <div>
                        <div className="font-medium" style={{ color: '#141A1F' }}>
                          {fy.name}
                        </div>
                        <div className="text-sm" style={{ color: '#6C767F' }}>
                          Du {formatDate(fy.start_date)} au {formatDate(fy.end_date)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status badge */}
                      {fy.is_closed ? (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                          Cloture
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700">
                          Ouvert
                        </span>
                      )}

                      {/* Actions */}
                      {fy.is_closed ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startOpeningWorkflow(fy)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 transition-colors"
                            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                            A-nouveaux
                          </button>
                          <button
                            onClick={() => {
                              setSelectedYear(fy)
                              setShowReopenConfirm(true)
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                            title="Rouvrir l'exercice (annuler la cloture)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            Rouvrir
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startCloseWorkflow(fy)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-white bg-stone-600 hover:bg-stone-700 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          Cloturer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Process card */}
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50">
                  <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium" style={{ color: '#141A1F' }}>
                    Processus de cloture
                  </h3>
                  <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                    La cloture d'exercice genere les ecritures de solde des comptes 6 et 7
                    vers le compte 12 (Resultat). Cette operation est irreversible.
                  </p>
                </div>
              </div>
            </div>

            {/* A-nouveaux card */}
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-stone-100">
                  <svg className="w-5 h-5 text-stone-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium" style={{ color: '#141A1F' }}>
                    Ecritures d'a-nouveaux
                  </h3>
                  <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                    Les a-nouveaux reprennent les soldes des comptes de bilan (classes 1-5)
                    de l'exercice precedent vers le nouvel exercice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Fiscal Year Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
              Nouvel exercice comptable
            </h3>
            <form onSubmit={handleCreateFiscalYear}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                    Nom de l'exercice
                  </label>
                  <input
                    type="text"
                    required
                    value={newYearForm.name}
                    onChange={(e) => setNewYearForm({ ...newYearForm, name: e.target.value })}
                    placeholder="Ex: Exercice 2025"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                      Date de debut
                    </label>
                    <input
                      type="date"
                      required
                      value={newYearForm.startDate}
                      onChange={(e) => setNewYearForm({ ...newYearForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                      Date de fin
                    </label>
                    <input
                      type="date"
                      required
                      value={newYearForm.endDate}
                      onChange={(e) => setNewYearForm({ ...newYearForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                  style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Creation...' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Closing Workflow Modal */}
      {showCloseWorkflow && selectedYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={closeWorkflow} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                  Cloture de {selectedYear.name}
                </h3>
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Du {formatDate(selectedYear.start_date)} au {formatDate(selectedYear.end_date)}
                </p>
              </div>
              <button onClick={closeWorkflow} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step indicator */}
            <div className="px-6 py-4 bg-gray-50 border-b" style={{ borderColor: '#E4E5E7' }}>
              {renderStepIndicator()}
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-auto p-6">
              {/* Step 0: Selection - Start validation */}
              {workflowStep === 'selection' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-stone-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium" style={{ color: '#141A1F' }}>
                      Demarrer la cloture de {selectedYear?.name}
                    </h4>
                    <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: '#6C767F' }}>
                      Nous allons verifier que l'exercice est pret pour la cloture :
                      equilibre comptable, ecritures non lettrees, transactions non rapprochees, etc.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto bg-gray-50 rounded-lg p-4">
                    <h5 className="text-sm font-medium mb-3" style={{ color: '#141A1F' }}>
                      Etapes du processus
                    </h5>
                    <ol className="space-y-2 text-sm" style={{ color: '#6C767F' }}>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-medium">1</span>
                        <span>Verifications pre-cloture (equilibre, lettrage, rapprochement)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-medium">2</span>
                        <span>Ecritures de regularisation (CCA, FNP, PCA)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-medium">3</span>
                        <span>Preview des ecritures de cloture</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-medium">4</span>
                        <span>Confirmation et generation des ecritures</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-medium">5</span>
                        <span>Generation des a-nouveaux N+1</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Step 1: Validation - Comprehensive pre-closure checks */}
              {workflowStep === 'validation' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-lg font-medium" style={{ color: '#141A1F' }}>
                      Verifications pre-cloture
                    </h4>
                    <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                      Controle de l'etat de l'exercice avant cloture
                    </p>
                  </div>

                  {isProcessing ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
                      <span className="ml-3 text-sm" style={{ color: '#6C767F' }}>Verification en cours...</span>
                    </div>
                  ) : preClosureValidation ? (
                    <div className="max-w-2xl mx-auto space-y-4">
                      {/* Balance check */}
                      <div className={`rounded-lg border p-4 ${
                        preClosureValidation.isBalanced
                          ? 'bg-stone-50 border-stone-200'
                          : 'bg-rose-50 border-rose-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          {preClosureValidation.isBalanced ? (
                            <div className="w-8 h-8 rounded-full bg-stone-600 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1">
                            <p className={`font-medium ${preClosureValidation.isBalanced ? 'text-stone-700' : 'text-rose-700'}`}>
                              Equilibre comptable
                            </p>
                            <p className="text-sm" style={{ color: '#6C767F' }}>
                              {preClosureValidation.isBalanced
                                ? 'Total debits = Total credits'
                                : `Difference de ${validation?.difference || 0} EUR`}
                            </p>
                          </div>
                          {validation && (
                            <div className="text-right text-sm font-mono" style={{ color: '#6C767F' }}>
                              {formatNumber(validation.totalDebit)} EUR
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Warnings section */}
                      {(preClosureValidation.hasUnlettered > 0 ||
                        preClosureValidation.hasUnreconciledBank > 0 ||
                        preClosureValidation.hasPendingInvoices > 0 ||
                        preClosureValidation.hasPendingExpenses > 0) && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <span className="font-medium text-amber-800">Points d'attention (non bloquants)</span>
                          </div>
                          <ul className="space-y-2 text-sm text-amber-800">
                            {preClosureValidation.hasUnlettered > 0 && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {preClosureValidation.hasUnlettered} ecriture(s) non lettree(s) sur comptes tiers
                              </li>
                            )}
                            {preClosureValidation.hasUnreconciledBank > 0 && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {preClosureValidation.hasUnreconciledBank} transaction(s) bancaire(s) non rapprochee(s)
                              </li>
                            )}
                            {preClosureValidation.hasPendingInvoices > 0 && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {preClosureValidation.hasPendingInvoices} facture(s) en brouillon
                              </li>
                            )}
                            {preClosureValidation.hasPendingExpenses > 0 && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {preClosureValidation.hasPendingExpenses} note(s) de frais non validee(s)
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Errors section */}
                      {preClosureValidation.errors.length > 0 && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            <span className="font-medium text-rose-800">Erreurs bloquantes</span>
                          </div>
                          <ul className="space-y-2 text-sm text-rose-800">
                            {preClosureValidation.errors.map((err, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {err}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* All good message */}
                      {preClosureValidation.canClose && preClosureValidation.warnings.length === 0 && (
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stone-600 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="font-medium text-stone-700">
                            L'exercice est pret pour la cloture
                          </p>
                          <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                            Toutes les verifications sont passees avec succes
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Step 2: Regularization (CCA, FNP, PCA) */}
              {workflowStep === 'regularization' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-lg font-medium" style={{ color: '#141A1F' }}>
                      Ecritures de regularisation
                    </h4>
                    <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                      Verifiez les regularisations de fin d'exercice avant la cloture
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    {/* Regularization summary cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {/* CCA */}
                      <div className="rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-stone-600">CCA</span>
                          </div>
                          <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            Charges Constatees d'Avance
                          </span>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: '#141A1F' }}>
                          {regularizationSummary?.ccaCount || 0}
                        </div>
                        <div className="text-sm" style={{ color: '#6C767F' }}>
                          {formatNumber(regularizationSummary?.ccaAmount || 0)} EUR
                        </div>
                        <button
                          onClick={() => navigateToRegularization('cca')}
                          className="mt-3 w-full px-3 py-1.5 text-xs rounded border hover:bg-gray-50"
                          style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                        >
                          Gerer les CCA
                        </button>
                      </div>

                      {/* FNP */}
                      <div className="rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-amber-700">FNP</span>
                          </div>
                          <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            Factures Non Parvenues
                          </span>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: '#141A1F' }}>
                          {regularizationSummary?.fnpCount || 0}
                        </div>
                        <div className="text-sm" style={{ color: '#6C767F' }}>
                          {formatNumber(regularizationSummary?.fnpAmount || 0)} EUR
                        </div>
                        <button
                          onClick={() => navigateToRegularization('fnp')}
                          className="mt-3 w-full px-3 py-1.5 text-xs rounded border hover:bg-gray-50"
                          style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                        >
                          Gerer les FNP
                        </button>
                      </div>

                      {/* PCA */}
                      <div className="rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-slate-600">PCA</span>
                          </div>
                          <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            Produits Constates d'Avance
                          </span>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: '#141A1F' }}>
                          {regularizationSummary?.pcaCount || 0}
                        </div>
                        <div className="text-sm" style={{ color: '#6C767F' }}>
                          {formatNumber(regularizationSummary?.pcaAmount || 0)} EUR
                        </div>
                        <button
                          onClick={() => navigateToRegularization('pca')}
                          className="mt-3 w-full px-3 py-1.5 text-xs rounded border hover:bg-gray-50"
                          style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                        >
                          Gerer les PCA
                        </button>
                      </div>
                    </div>

                    {/* Info message */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <div className="text-sm" style={{ color: '#6C767F' }}>
                          <p className="font-medium mb-1" style={{ color: '#141A1F' }}>
                            Regularisations de fin d'exercice
                          </p>
                          <p>
                            Les CCA permettent de reporter des charges payees d'avance sur l'exercice suivant.
                            Les FNP permettent de provisionner des charges dont la facture n'est pas encore arrivee.
                            Les PCA permettent de reporter des produits percus d'avance sur l'exercice suivant.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {workflowStep === 'preview' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-lg font-medium" style={{ color: '#141A1F' }}>
                      Ecritures de cloture
                    </h4>
                    <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                      Les ecritures suivantes seront generees pour solder les comptes de gestion
                    </p>
                  </div>

                  {isProcessing ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Compte
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Libelle
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Debit
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Credit
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                          {closingPreview.map((entry, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className="font-mono text-sm font-medium" style={{ color: '#006666' }}>
                                  {entry.accountCode}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm" style={{ color: '#141A1F' }}>
                                {entry.accountLabel}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-mono text-sm" style={{ color: entry.debit > 0 ? '#141A1F' : '#D6D9DB' }}>
                                  {entry.debit > 0 ? formatNumber(entry.debit) : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-mono text-sm" style={{ color: entry.credit > 0 ? '#141A1F' : '#D6D9DB' }}>
                                  {entry.credit > 0 ? formatNumber(entry.credit) : '-'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2" style={{ borderColor: '#006666' }}>
                          <tr>
                            <td colSpan={2} className="px-4 py-3 font-medium" style={{ color: '#141A1F' }}>
                              Total
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                              {formatNumber(calculatePreviewTotals(closingPreview).debit)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                              {formatNumber(calculatePreviewTotals(closingPreview).credit)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Confirmation */}
              {workflowStep === 'confirmation' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium" style={{ color: '#141A1F' }}>
                      Confirmation de cloture
                    </h4>
                    <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: '#6C767F' }}>
                      Vous etes sur le point de cloturer l'exercice <strong>{selectedYear.name}</strong>.
                      Cette action generera les ecritures de cloture et verrouillera l'exercice.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <div className="text-sm text-amber-800">
                        <p className="font-medium mb-1">Attention - Action irreversible</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>{closingPreview.length} ecritures de cloture seront generees</li>
                          <li>Les comptes 6 et 7 seront soldes vers le compte 12</li>
                          <li>L'exercice sera verrouille en ecriture</li>
                          <li>Cette operation ne peut pas etre annulee</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Complete */}
              {workflowStep === 'complete' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-stone-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium" style={{ color: '#141A1F' }}>
                    Cloture terminee
                  </h4>
                  <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                    L'exercice {selectedYear.name} a ete cloture avec succes.
                  </p>
                  <p className="text-sm mt-4" style={{ color: '#6C767F' }}>
                    Vous pouvez maintenant generer les ecritures d'a-nouveaux pour le prochain exercice.
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-between" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={closeWorkflow}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
              >
                {workflowStep === 'complete' || workflowStep === 'opening' ? 'Fermer' : 'Annuler'}
              </button>

              <div className="flex gap-3">
                {/* Step 0: Selection -> Start validation */}
                {workflowStep === 'selection' && (
                  <button
                    onClick={runPreClosureValidation}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700 disabled:opacity-50"
                  >
                    Demarrer les verifications
                  </button>
                )}

                {/* Step 1: Validation -> Regularization (if can close) */}
                {workflowStep === 'validation' && preClosureValidation?.canClose && (
                  <button
                    onClick={goToRegularization}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700 disabled:opacity-50"
                  >
                    Continuer
                  </button>
                )}

                {/* Step 2: Regularization -> Preview */}
                {workflowStep === 'regularization' && (
                  <>
                    <button
                      onClick={() => setWorkflowStep('validation')}
                      className="px-4 py-2 border rounded-lg text-sm font-medium"
                      style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                    >
                      Retour
                    </button>
                    <button
                      onClick={goToPreview}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700 disabled:opacity-50"
                    >
                      Voir les ecritures de cloture
                    </button>
                  </>
                )}

                {/* Step 3: Preview -> Confirmation */}
                {workflowStep === 'preview' && (
                  <>
                    <button
                      onClick={() => setWorkflowStep('regularization')}
                      className="px-4 py-2 border rounded-lg text-sm font-medium"
                      style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                    >
                      Retour
                    </button>
                    <button
                      onClick={() => setWorkflowStep('confirmation')}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700"
                    >
                      Continuer
                    </button>
                  </>
                )}

                {/* Step 4: Confirmation -> Execute closing */}
                {workflowStep === 'confirmation' && (
                  <>
                    <button
                      onClick={() => setWorkflowStep('preview')}
                      className="px-4 py-2 border rounded-lg text-sm font-medium"
                      style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                    >
                      Retour
                    </button>
                    <button
                      onClick={executeClosing}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                    >
                      {isProcessing ? 'Cloture en cours...' : 'Confirmer la cloture'}
                    </button>
                  </>
                )}

                {/* Step 5: Complete -> Go to opening */}
                {workflowStep === 'complete' && (
                  <button
                    onClick={() => {
                      setWorkflowStep('opening')
                      startOpeningWorkflow(selectedYear)
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700"
                  >
                    Generer les a-nouveaux
                  </button>
                )}

                {/* Step 6: Opening - done, just close */}
                {workflowStep === 'opening' && (
                  <button
                    onClick={closeWorkflow}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700"
                  >
                    Terminer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Opening (A-nouveaux) Modal */}
      {showOpeningModal && selectedYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowOpeningModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Ecritures d'a-nouveaux
              </h3>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                Reprendre les soldes de {selectedYear.name} vers un nouvel exercice
              </p>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-auto p-6">
              {isProcessing && openingPreview.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* New year form */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3" style={{ color: '#141A1F' }}>
                      Nouvel exercice
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>
                          Nom
                        </label>
                        <input
                          type="text"
                          value={newYearForm.name}
                          onChange={(e) => setNewYearForm({ ...newYearForm, name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          style={{ borderColor: '#D6D9DB' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>
                          Date de debut
                        </label>
                        <input
                          type="date"
                          value={newYearForm.startDate}
                          onChange={(e) => setNewYearForm({ ...newYearForm, startDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          style={{ borderColor: '#D6D9DB' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: '#6C767F' }}>
                          Date de fin
                        </label>
                        <input
                          type="date"
                          value={newYearForm.endDate}
                          onChange={(e) => setNewYearForm({ ...newYearForm, endDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          style={{ borderColor: '#D6D9DB' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview table */}
                  <div>
                    <h4 className="text-sm font-medium mb-3" style={{ color: '#141A1F' }}>
                      Comptes de bilan a reprendre (classes 1-5)
                    </h4>
                    <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Compte
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Libelle
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Debit
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                              Credit
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: '#E4E5E7' }}>
                          {openingPreview.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: '#6C767F' }}>
                                Aucun compte de bilan a reprendre
                              </td>
                            </tr>
                          ) : (
                            openingPreview.map((entry, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <span className="font-mono text-sm font-medium" style={{ color: '#006666' }}>
                                    {entry.accountCode}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: '#141A1F' }}>
                                  {entry.accountLabel}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="font-mono text-sm" style={{ color: entry.debit > 0 ? '#141A1F' : '#D6D9DB' }}>
                                    {entry.debit > 0 ? formatNumber(entry.debit) : '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="font-mono text-sm" style={{ color: entry.credit > 0 ? '#141A1F' : '#D6D9DB' }}>
                                    {entry.credit > 0 ? formatNumber(entry.credit) : '-'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {openingPreview.length > 0 && (
                          <tfoot className="bg-gray-50 border-t-2" style={{ borderColor: '#006666' }}>
                            <tr>
                              <td colSpan={2} className="px-4 py-3 font-medium" style={{ color: '#141A1F' }}>
                                Total
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                                {formatNumber(calculatePreviewTotals(openingPreview).debit)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                                {formatNumber(calculatePreviewTotals(openingPreview).credit)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-between" style={{ borderColor: '#E4E5E7' }}>
              <button
                onClick={() => {
                  setShowOpeningModal(false)
                  setSelectedYear(null)
                  setOpeningPreview([])
                }}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
              >
                Annuler
              </button>
              <button
                onClick={executeOpening}
                disabled={isProcessing || openingPreview.length === 0 || !newYearForm.name || !newYearForm.startDate || !newYearForm.endDate}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-600 hover:bg-stone-700 disabled:opacity-50"
              >
                {isProcessing ? 'Creation en cours...' : 'Creer l\'exercice et generer les a-nouveaux'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Lock Modal */}
      {showConfirmLock && selectedYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowConfirmLock(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Verrouiller l'exercice ?
              </h3>
              <p className="text-sm mt-2" style={{ color: '#6C767F' }}>
                Une fois verrouille, aucune ecriture ne pourra etre ajoutee ou modifiee
                sur l'exercice <strong>{selectedYear.name}</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmLock(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleLockFiscalYear}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {isProcessing ? 'Verrouillage...' : 'Verrouiller'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reopen Modal */}
      {showReopenConfirm && selectedYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowReopenConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Rouvrir l'exercice ?
              </h3>
              <p className="text-sm mt-2" style={{ color: '#6C767F' }}>
                Cette action va annuler la cloture de l'exercice <strong>{selectedYear.name}</strong>.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Actions qui seront effectuees :</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Suppression des ecritures de cloture (comptes 6, 7, 12)</li>
                    <li>Suppression des ecritures d'a-nouveaux de l'exercice suivant</li>
                    <li>Reouverture de l'exercice en ecriture</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReopenConfirm(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
                style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleReopenFiscalYear}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {isProcessing ? 'Reouverture...' : 'Confirmer la reouverture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
