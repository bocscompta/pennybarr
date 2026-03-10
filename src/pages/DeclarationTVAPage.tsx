import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  calculateCA3Declaration,
  generateVATEntries,
  saveVATDeclaration,
  saveVATLiquidationEntries,
  getVATDeclarationHistory,
  getMonthlyPeriod,
  getQuarterlyPeriod,
  getYearlyPeriod,
  updateVATDeclarationStatus,
  generateCA3PDFData,
  type CA3Calculation,
  type VATEntry,
  type VATDeclaration,
  type VATDeclarationData,
} from '../services/tvaService'

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Period type
type PeriodType = 'monthly' | 'quarterly' | 'yearly'

// Status badge colors
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  submitted: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  paid: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  paid: 'Payee',
}

// Months names
const monthNames = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
]

// Icons
const CalculatorIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
  </svg>
)

const DocumentIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
)

const SaveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)

interface DeclarationTVAPageProps {
  onNavigate?: (page: string) => void
}

// Editable field component
interface EditableFieldProps {
  value: number
  onSave: (value: number) => void
  label: string
  disabled?: boolean
}

function EditableField({ value, onSave, label, disabled }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())

  const handleSave = () => {
    const numValue = parseFloat(editValue.replace(',', '.')) || 0
    onSave(numValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value.toString())
    setIsEditing(false)
  }

  if (isEditing && !disabled) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-28 px-2 py-1 text-sm text-right border rounded font-mono"
          style={{ borderColor: '#006666' }}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
        />
        <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
          <CheckIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className="font-mono" title={label}>{formatCurrency(value)}</span>
      {!disabled && (
        <button
          onClick={() => {
            setEditValue(value.toString())
            setIsEditing(true)
          }}
          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="Modifier"
        >
          <PencilIcon />
        </button>
      )}
    </div>
  )
}

export default function DeclarationTVAPage({ onNavigate: _onNavigate }: DeclarationTVAPageProps) {
  // Period selection state
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))

  // Calculation state
  const [calculation, setCalculation] = useState<CA3Calculation | null>(null)
  const [generatedEntries, setGeneratedEntries] = useState<VATEntry[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingEntries, setIsGeneratingEntries] = useState(false)

  // Manual adjustments
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({})

  // History state
  const [declarations, setDeclarations] = useState<VATDeclaration[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  // Error state
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Years options (last 5 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - i)
  }, [])

  // Load declaration history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const history = await getVATDeclarationHistory()
      setDeclarations(history)
    } catch (err) {
      console.error('Error loading VAT declaration history:', err)
      setError('Erreur lors du chargement de l\'historique')
    } finally {
      setLoadingHistory(false)
    }
  }

  // Get period dates based on selection
  const getPeriodDates = useCallback(() => {
    switch (periodType) {
      case 'monthly':
        return getMonthlyPeriod(selectedYear, selectedMonth)
      case 'quarterly':
        return getQuarterlyPeriod(selectedYear, selectedQuarter)
      case 'yearly':
        return getYearlyPeriod(selectedYear)
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter])

  // Calculate VAT declaration
  const handleCalculate = async () => {
    setIsCalculating(true)
    setError(null)
    setSuccessMessage(null)
    setGeneratedEntries([])
    setManualAdjustments({})

    try {
      const { start, end } = getPeriodDates()
      const result = await calculateCA3Declaration(start, end)
      setCalculation(result)
    } catch (err) {
      console.error('Error calculating VAT:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors du calcul de la TVA')
    } finally {
      setIsCalculating(false)
    }
  }

  // Handle manual adjustment
  const handleAdjustment = (field: string, value: number) => {
    setManualAdjustments(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Get adjusted value (original + adjustment)
  const getAdjustedValue = (field: string, originalValue: number): number => {
    if (manualAdjustments[field] !== undefined) {
      return manualAdjustments[field]
    }
    return originalValue
  }

  // Recalculate totals with adjustments
  const getAdjustedCalculation = useCallback((): CA3Calculation | null => {
    if (!calculation) return null

    // Apply adjustments to section values
    const adjSectionA = {
      ligne01_ventesFrance: getAdjustedValue('sectionA.ligne01', calculation.sectionA.ligne01_ventesFrance),
      ligne02_autresOperations: getAdjustedValue('sectionA.ligne02', calculation.sectionA.ligne02_autresOperations),
      ligne03_acquisitionsIntra: getAdjustedValue('sectionA.ligne03', calculation.sectionA.ligne03_acquisitionsIntra),
      ligne04_totalA: 0,
    }
    adjSectionA.ligne04_totalA = adjSectionA.ligne01_ventesFrance + adjSectionA.ligne02_autresOperations + adjSectionA.ligne03_acquisitionsIntra

    const adjSectionB = {
      ligne08_base20: getAdjustedValue('sectionB.base20', calculation.sectionB.ligne08_base20),
      ligne08_tva20: getAdjustedValue('sectionB.tva20', calculation.sectionB.ligne08_tva20),
      ligne09_base10: getAdjustedValue('sectionB.base10', calculation.sectionB.ligne09_base10),
      ligne09_tva10: getAdjustedValue('sectionB.tva10', calculation.sectionB.ligne09_tva10),
      ligne9B_base55: getAdjustedValue('sectionB.base55', calculation.sectionB.ligne9B_base55),
      ligne9B_tva55: getAdjustedValue('sectionB.tva55', calculation.sectionB.ligne9B_tva55),
      ligne10_base21: getAdjustedValue('sectionB.base21', calculation.sectionB.ligne10_base21),
      ligne10_tva21: getAdjustedValue('sectionB.tva21', calculation.sectionB.ligne10_tva21),
      ligne11_baseIntra: getAdjustedValue('sectionB.baseIntra', calculation.sectionB.ligne11_baseIntra),
      ligne11_tvaIntra: getAdjustedValue('sectionB.tvaIntra', calculation.sectionB.ligne11_tvaIntra),
      ligne14_totalB: 0,
    }
    adjSectionB.ligne14_totalB = adjSectionB.ligne08_tva20 + adjSectionB.ligne09_tva10 +
      adjSectionB.ligne9B_tva55 + adjSectionB.ligne10_tva21 + adjSectionB.ligne11_tvaIntra

    const adjSectionC = {
      ligne19_tvaImmo: getAdjustedValue('sectionC.ligne19', calculation.sectionC.ligne19_tvaImmo),
      ligne20_tvaABS: getAdjustedValue('sectionC.ligne20', calculation.sectionC.ligne20_tvaABS),
      ligne21_autreTVA: getAdjustedValue('sectionC.ligne21', calculation.sectionC.ligne21_autreTVA),
      ligne22_totalC: 0,
    }
    adjSectionC.ligne22_totalC = adjSectionC.ligne19_tvaImmo + adjSectionC.ligne20_tvaABS + adjSectionC.ligne21_autreTVA

    const adjSectionD = {
      ligne23_creditReporte: getAdjustedValue('sectionD.ligne23', calculation.sectionD.ligne23_creditReporte),
      ligne24_totalD: 0,
    }
    adjSectionD.ligne24_totalD = adjSectionD.ligne23_creditReporte

    const netResult = adjSectionB.ligne14_totalB - adjSectionC.ligne22_totalC - adjSectionD.ligne24_totalD
    const adjSectionE = {
      ligne25_tvaAPayer: netResult > 0 ? netResult : 0,
      ligne26_creditTVA: netResult < 0 ? Math.abs(netResult) : 0,
    }

    return {
      ...calculation,
      sectionA: adjSectionA,
      sectionB: adjSectionB,
      sectionC: adjSectionC,
      sectionD: adjSectionD,
      sectionE: adjSectionE,
      manualAdjustments,
    }
  }, [calculation, manualAdjustments])

  // Generate liquidation entries
  const handleGenerateEntries = async () => {
    const adjCalc = getAdjustedCalculation()
    if (!adjCalc) return

    setIsGeneratingEntries(true)
    try {
      const entries = await generateVATEntries(adjCalc)
      setGeneratedEntries(entries)
      setSuccessMessage('Ecritures de liquidation generees')
    } catch (err) {
      console.error('Error generating VAT entries:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la generation des ecritures')
    } finally {
      setIsGeneratingEntries(false)
    }
  }

  // Save declaration and entries
  const handleSaveDeclaration = async () => {
    const adjCalc = getAdjustedCalculation()
    if (!adjCalc) return

    setIsSaving(true)
    setError(null)

    try {
      const declarationData: VATDeclarationData = {
        periodStart: adjCalc.periodStart,
        periodEnd: adjCalc.periodEnd,
        type: periodType,
        totalCollected: adjCalc.sectionB.ligne14_totalB,
        totalDeductible: adjCalc.sectionC.ligne22_totalC,
        totalDue: adjCalc.sectionE.ligne25_tvaAPayer > 0
          ? adjCalc.sectionE.ligne25_tvaAPayer
          : -adjCalc.sectionE.ligne26_creditTVA,
        creditCarryForward: adjCalc.sectionE.ligne26_creditTVA,
        status: 'draft',
        ca3Data: adjCalc,
      }

      const savedDeclaration = await saveVATDeclaration(declarationData)

      // If entries were generated, save them too
      if (generatedEntries.length > 0) {
        await saveVATLiquidationEntries(generatedEntries, savedDeclaration.id)
      }

      setSuccessMessage('Declaration TVA sauvegardee avec succes')
      await loadHistory()
    } catch (err) {
      console.error('Error saving VAT declaration:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  // Update declaration status
  const handleUpdateStatus = async (declarationId: string, newStatus: 'submitted' | 'paid') => {
    try {
      await updateVATDeclarationStatus(declarationId, newStatus)
      await loadHistory()
      setSuccessMessage(`Declaration marquee comme ${statusLabels[newStatus].toLowerCase()}`)
    } catch (err) {
      console.error('Error updating declaration status:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise a jour du statut')
    }
  }

  // Export to PDF
  const handleExportPDF = () => {
    const adjCalc = getAdjustedCalculation()
    if (!adjCalc) {
      setError('Calculez d\'abord la declaration avant d\'exporter')
      return
    }

    const pdfData = generateCA3PDFData(adjCalc)
    console.log('PDF Data for export:', pdfData)

    // TODO: Implement actual PDF generation using a library like jsPDF or react-pdf
    setSuccessMessage('Export PDF en cours de developpement - Donnees preparees dans la console')
  }

  // Format period label
  const getPeriodLabel = () => {
    switch (periodType) {
      case 'monthly':
        return `${monthNames[selectedMonth - 1]} ${selectedYear}`
      case 'quarterly':
        return `T${selectedQuarter} ${selectedYear}`
      case 'yearly':
        return `Annee ${selectedYear}`
    }
  }

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Get current adjusted calculation for display
  const displayCalc = getAdjustedCalculation() || calculation

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Declaration TVA</h1>
            <span className="px-3 py-1 text-sm rounded-full" style={{ backgroundColor: '#F2F4F5', color: '#6C767F' }}>
              Formulaire CA3
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors hover:bg-gray-50"
              style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
            >
              <ClockIcon />
              Historique
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!displayCalc}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              style={{ borderColor: '#006666', color: '#006666' }}
            >
              <DownloadIcon />
              Exporter PDF
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      {(error || successMessage) && (
        <div className="px-6 py-3">
          {error && (
            <div className="p-3 rounded-lg border" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}>
              {error}
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-lg border" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' }}>
              {successMessage}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Period Selection Card */}
          <div className="bg-white rounded-lg border shadow-sm p-6" style={{ borderColor: '#E4E5E7' }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Selection de la periode</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Period Type */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#6C767F' }}>Type de periode</label>
                <div className="relative">
                  <select
                    value={periodType}
                    onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                    className="w-full px-3 py-2 border rounded-lg appearance-none bg-white pr-10"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    <option value="monthly">Mensuelle</option>
                    <option value="quarterly">Trimestrielle</option>
                    <option value="yearly">Annuelle</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6C767F' }}>
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#6C767F' }}>Annee</label>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg appearance-none bg-white pr-10"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    {yearOptions.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6C767F' }}>
                    <ChevronDownIcon />
                  </div>
                </div>
              </div>

              {/* Month (if monthly) */}
              {periodType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#6C767F' }}>Mois</label>
                  <div className="relative">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg appearance-none bg-white pr-10"
                      style={{ borderColor: '#D6D9DB' }}
                    >
                      {monthNames.map((name, idx) => (
                        <option key={idx} value={idx + 1}>{name}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6C767F' }}>
                      <ChevronDownIcon />
                    </div>
                  </div>
                </div>
              )}

              {/* Quarter (if quarterly) */}
              {periodType === 'quarterly' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#6C767F' }}>Trimestre</label>
                  <div className="relative">
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg appearance-none bg-white pr-10"
                      style={{ borderColor: '#D6D9DB' }}
                    >
                      <option value={1}>T1 (Jan-Mar)</option>
                      <option value={2}>T2 (Avr-Jun)</option>
                      <option value={3}>T3 (Jul-Sep)</option>
                      <option value={4}>T4 (Oct-Dec)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6C767F' }}>
                      <ChevronDownIcon />
                    </div>
                  </div>
                </div>
              )}

              {/* Calculate Button */}
              <div className="flex items-end">
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#006666' }}
                >
                  {isCalculating ? (
                    <>
                      <RefreshIcon />
                      Calcul en cours...
                    </>
                  ) : (
                    <>
                      <CalculatorIcon />
                      Calculer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CA3 Form - Full Structure */}
          {displayCalc && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* TVA Brute */}
                <div className="bg-white rounded-lg border shadow-sm p-4" style={{ borderColor: '#E4E5E7' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#6C767F' }}>TVA Brute (B)</span>
                    <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                      Ligne 14
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#141A1F' }}>
                    {formatCurrency(displayCalc.sectionB.ligne14_totalB)}
                  </div>
                </div>

                {/* TVA Deductible */}
                <div className="bg-white rounded-lg border shadow-sm p-4" style={{ borderColor: '#E4E5E7' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#6C767F' }}>TVA Deductible (C)</span>
                    <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                      Ligne 22
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#141A1F' }}>
                    {formatCurrency(displayCalc.sectionC.ligne22_totalC)}
                  </div>
                </div>

                {/* Credit Report */}
                <div className="bg-white rounded-lg border shadow-sm p-4" style={{ borderColor: '#E4E5E7' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#6C767F' }}>Credit reporte (D)</span>
                    <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: '#F3E8FF', color: '#7C3AED' }}>
                      Ligne 23
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#141A1F' }}>
                    {formatCurrency(displayCalc.sectionD.ligne24_totalD)}
                  </div>
                </div>

                {/* Net Result */}
                <div
                  className="bg-white rounded-lg border shadow-sm p-4"
                  style={{
                    borderColor: displayCalc.sectionE.ligne25_tvaAPayer > 0 ? '#F87171' : '#34D399',
                    backgroundColor: displayCalc.sectionE.ligne25_tvaAPayer > 0 ? '#FEF2F2' : '#F0FDF4',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#6C767F' }}>
                      {displayCalc.sectionE.ligne25_tvaAPayer > 0 ? 'TVA a payer' : 'Credit de TVA'}
                    </span>
                    <span
                      className="px-2 py-0.5 text-xs rounded"
                      style={{
                        backgroundColor: displayCalc.sectionE.ligne25_tvaAPayer > 0 ? '#FEE2E2' : '#D1FAE5',
                        color: displayCalc.sectionE.ligne25_tvaAPayer > 0 ? '#991B1B' : '#065F46',
                      }}
                    >
                      {displayCalc.sectionE.ligne25_tvaAPayer > 0 ? 'Ligne 25' : 'Ligne 26'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#141A1F' }}>
                    {formatCurrency(displayCalc.sectionE.ligne25_tvaAPayer > 0
                      ? displayCalc.sectionE.ligne25_tvaAPayer
                      : displayCalc.sectionE.ligne26_creditTVA)}
                  </div>
                </div>
              </div>

              {/* CA3 Form Style */}
              <div className="bg-white rounded-lg border shadow-sm" style={{ borderColor: '#E4E5E7' }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F8FAFC' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DocumentIcon />
                      <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                        Formulaire CA3 - {getPeriodLabel()}
                      </h2>
                    </div>
                    <span className="text-sm" style={{ color: '#6C767F' }}>
                      Du {formatDate(displayCalc.periodStart)} au {formatDate(displayCalc.periodEnd)}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  {/* Section A - Operations Imposables */}
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b" style={{ color: '#006666', borderColor: '#006666' }}>
                      A - Operations Imposables
                    </h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                          <th className="text-left py-2 w-16 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Ligne</th>
                          <th className="text-left py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Description</th>
                          <th className="text-right py-2 w-40 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Montant HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>01</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Ventes, prestations de services (compte 70xxx)</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionA.ligne01_ventesFrance}
                              onSave={(v) => handleAdjustment('sectionA.ligne01', v)}
                              label="Ventes France"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>02</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Autres operations imposables</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionA.ligne02_autresOperations}
                              onSave={(v) => handleAdjustment('sectionA.ligne02', v)}
                              label="Autres operations"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>03</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Acquisitions intracommunautaires (autoliquidation)</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionA.ligne03_acquisitionsIntra}
                              onSave={(v) => handleAdjustment('sectionA.ligne03', v)}
                              label="Acquisitions intra"
                            />
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: '#F2F4F5' }}>
                          <td className="py-3 text-sm font-mono font-bold" style={{ color: '#006666' }}>04</td>
                          <td className="py-3 text-sm font-bold" style={{ color: '#141A1F' }}>TOTAL A (base imposable)</td>
                          <td className="py-3 text-sm text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                            {formatCurrency(displayCalc.sectionA.ligne04_totalA)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section B - TVA Brute */}
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b" style={{ color: '#006666', borderColor: '#006666' }}>
                      B - TVA Brute
                    </h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                          <th className="text-left py-2 w-16 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Ligne</th>
                          <th className="text-left py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Description</th>
                          <th className="text-right py-2 w-32 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Base HT</th>
                          <th className="text-center py-2 w-16 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Taux</th>
                          <th className="text-right py-2 w-32 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>TVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>08</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Operations imposables a 20%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne08_base20}
                              onSave={(v) => handleAdjustment('sectionB.base20', v)}
                              label="Base 20%"
                            />
                          </td>
                          <td className="py-3 text-sm text-center" style={{ color: '#6C767F' }}>20%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne08_tva20}
                              onSave={(v) => handleAdjustment('sectionB.tva20', v)}
                              label="TVA 20%"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>09</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Operations imposables a 10%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne09_base10}
                              onSave={(v) => handleAdjustment('sectionB.base10', v)}
                              label="Base 10%"
                            />
                          </td>
                          <td className="py-3 text-sm text-center" style={{ color: '#6C767F' }}>10%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne09_tva10}
                              onSave={(v) => handleAdjustment('sectionB.tva10', v)}
                              label="TVA 10%"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>9B</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Operations imposables a 5,5%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne9B_base55}
                              onSave={(v) => handleAdjustment('sectionB.base55', v)}
                              label="Base 5.5%"
                            />
                          </td>
                          <td className="py-3 text-sm text-center" style={{ color: '#6C767F' }}>5,5%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne9B_tva55}
                              onSave={(v) => handleAdjustment('sectionB.tva55', v)}
                              label="TVA 5.5%"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>10</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Operations imposables a 2,1%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne10_base21}
                              onSave={(v) => handleAdjustment('sectionB.base21', v)}
                              label="Base 2.1%"
                            />
                          </td>
                          <td className="py-3 text-sm text-center" style={{ color: '#6C767F' }}>2,1%</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne10_tva21}
                              onSave={(v) => handleAdjustment('sectionB.tva21', v)}
                              label="TVA 2.1%"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3', backgroundColor: '#FFFBEB' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#92400E' }}>11</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>
                            <span className="font-medium">TVA sur acquisitions intracommunautaires</span>
                            <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                              Autoliquidation
                            </span>
                          </td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne11_baseIntra}
                              onSave={(v) => handleAdjustment('sectionB.baseIntra', v)}
                              label="Base intra"
                            />
                          </td>
                          <td className="py-3 text-sm text-center" style={{ color: '#6C767F' }}>-</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionB.ligne11_tvaIntra}
                              onSave={(v) => handleAdjustment('sectionB.tvaIntra', v)}
                              label="TVA intra"
                            />
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: '#F2F4F5' }}>
                          <td className="py-3 text-sm font-mono font-bold" style={{ color: '#006666' }}>14</td>
                          <td className="py-3 text-sm font-bold" style={{ color: '#141A1F' }}>TOTAL TVA BRUTE</td>
                          <td className="py-3"></td>
                          <td className="py-3"></td>
                          <td className="py-3 text-sm text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                            {formatCurrency(displayCalc.sectionB.ligne14_totalB)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section C - TVA Deductible */}
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b" style={{ color: '#006666', borderColor: '#006666' }}>
                      C - TVA Deductible
                    </h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                          <th className="text-left py-2 w-16 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Ligne</th>
                          <th className="text-left py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Description</th>
                          <th className="text-right py-2 w-40 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Montant TVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>19</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>TVA sur immobilisations (compte 44562)</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionC.ligne19_tvaImmo}
                              onSave={(v) => handleAdjustment('sectionC.ligne19', v)}
                              label="TVA immo"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>20</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>TVA sur autres biens et services (compte 44566)</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionC.ligne20_tvaABS}
                              onSave={(v) => handleAdjustment('sectionC.ligne20', v)}
                              label="TVA ABS"
                            />
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>21</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Autre TVA a deduire</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionC.ligne21_autreTVA}
                              onSave={(v) => handleAdjustment('sectionC.ligne21', v)}
                              label="Autre TVA"
                            />
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: '#F2F4F5' }}>
                          <td className="py-3 text-sm font-mono font-bold" style={{ color: '#006666' }}>22</td>
                          <td className="py-3 text-sm font-bold" style={{ color: '#141A1F' }}>TOTAL TVA DEDUCTIBLE</td>
                          <td className="py-3 text-sm text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                            {formatCurrency(displayCalc.sectionC.ligne22_totalC)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section D - Credit de TVA */}
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b" style={{ color: '#006666', borderColor: '#006666' }}>
                      D - Credit de TVA
                    </h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                          <th className="text-left py-2 w-16 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Ligne</th>
                          <th className="text-left py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Description</th>
                          <th className="text-right py-2 w-40 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b" style={{ borderColor: '#F2F2F3' }}>
                          <td className="py-3 text-sm font-mono font-semibold" style={{ color: '#006666' }}>23</td>
                          <td className="py-3 text-sm" style={{ color: '#141A1F' }}>Credit de TVA reporte de la periode precedente</td>
                          <td className="py-3 text-sm text-right">
                            <EditableField
                              value={displayCalc.sectionD.ligne23_creditReporte}
                              onSave={(v) => handleAdjustment('sectionD.ligne23', v)}
                              label="Credit reporte"
                            />
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: '#F2F4F5' }}>
                          <td className="py-3 text-sm font-mono font-bold" style={{ color: '#006666' }}>24</td>
                          <td className="py-3 text-sm font-bold" style={{ color: '#141A1F' }}>TOTAL CREDITS</td>
                          <td className="py-3 text-sm text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                            {formatCurrency(displayCalc.sectionD.ligne24_totalD)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section E - TVA Nette */}
                  <div className="p-4 rounded-lg" style={{ backgroundColor: displayCalc.sectionE.ligne25_tvaAPayer > 0 ? '#FEF2F2' : '#F0FDF4' }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 pb-2 border-b" style={{ color: '#006666', borderColor: '#006666' }}>
                      E - TVA Nette
                    </h3>
                    <table className="w-full">
                      <tbody>
                        <tr>
                          <td className="py-2 w-16 text-sm font-mono" style={{ color: '#6C767F' }}>-</td>
                          <td className="py-2 text-sm" style={{ color: '#141A1F' }}>TVA brute (ligne 14)</td>
                          <td className="py-2 w-40 text-sm text-right font-mono" style={{ color: '#141A1F' }}>{formatCurrency(displayCalc.sectionB.ligne14_totalB)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-mono" style={{ color: '#6C767F' }}>-</td>
                          <td className="py-2 text-sm" style={{ color: '#141A1F' }}>TVA deductible (ligne 22)</td>
                          <td className="py-2 text-sm text-right font-mono" style={{ color: '#141A1F' }}>- {formatCurrency(displayCalc.sectionC.ligne22_totalC)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-mono" style={{ color: '#6C767F' }}>-</td>
                          <td className="py-2 text-sm" style={{ color: '#141A1F' }}>Credit reporte (ligne 24)</td>
                          <td className="py-2 text-sm text-right font-mono" style={{ color: '#141A1F' }}>- {formatCurrency(displayCalc.sectionD.ligne24_totalD)}</td>
                        </tr>
                        <tr className="border-t-2" style={{ borderColor: '#006666' }}>
                          <td className="py-3 text-sm font-mono font-bold" style={{ color: '#006666' }}>25</td>
                          <td className="py-3 text-sm font-bold" style={{ color: '#141A1F' }}>TVA nette a payer (si B {'>'} C + D)</td>
                          <td className="py-3 text-lg text-right font-mono font-bold" style={{ color: displayCalc.sectionE.ligne25_tvaAPayer > 0 ? '#991B1B' : '#9CA3AF' }}>
                            {formatCurrency(displayCalc.sectionE.ligne25_tvaAPayer)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 text-sm font-mono font-bold" style={{ color: '#006666' }}>26</td>
                          <td className="py-3 text-sm font-bold" style={{ color: '#141A1F' }}>Credit de TVA (si C + D {'>'} B)</td>
                          <td className="py-3 text-lg text-right font-mono font-bold" style={{ color: displayCalc.sectionE.ligne26_creditTVA > 0 ? '#065F46' : '#9CA3AF' }}>
                            {formatCurrency(displayCalc.sectionE.ligne26_creditTVA)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Generated Entries */}
              {generatedEntries.length > 0 && (
                <div className="bg-white rounded-lg border shadow-sm" style={{ borderColor: '#E4E5E7' }}>
                  <div className="px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
                    <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Ecritures de liquidation TVA</h2>
                    <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                      Ces ecritures soldent les comptes de TVA et constatent la TVA a decaisser ou le credit
                    </p>
                  </div>
                  <div className="p-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                          <th className="text-left py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Date</th>
                          <th className="text-left py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Compte</th>
                          <th className="text-left py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Libelle</th>
                          <th className="text-right py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Debit</th>
                          <th className="text-right py-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedEntries.map((entry, idx) => (
                          <tr key={idx} className="border-b" style={{ borderColor: '#F2F2F3', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFB' }}>
                            <td className="py-3 text-sm" style={{ color: '#141A1F' }}>{formatDate(entry.date)}</td>
                            <td className="py-3 text-sm font-mono font-medium" style={{ color: '#006666' }}>{entry.accountCode}</td>
                            <td className="py-3 text-sm" style={{ color: '#141A1F' }}>{entry.label}</td>
                            <td className="py-3 text-sm text-right font-mono" style={{ color: entry.debit > 0 ? '#141A1F' : '#D6D9DB' }}>
                              {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                            </td>
                            <td className="py-3 text-sm text-right font-mono" style={{ color: entry.credit > 0 ? '#141A1F' : '#D6D9DB' }}>
                              {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#F2F4F5' }}>
                          <td colSpan={3} className="py-3 text-sm font-semibold" style={{ color: '#141A1F' }}>Total</td>
                          <td className="py-3 text-sm text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                            {formatCurrency(generatedEntries.reduce((sum, e) => sum + e.debit, 0))}
                          </td>
                          <td className="py-3 text-sm text-right font-mono font-bold" style={{ color: '#141A1F' }}>
                            {formatCurrency(generatedEntries.reduce((sum, e) => sum + e.credit, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="text-sm" style={{ color: '#6C767F' }}>
                  {Object.keys(manualAdjustments).length > 0 && (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      {Object.keys(manualAdjustments).length} ajustement(s) manuel(s) applique(s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateEntries}
                    disabled={isGeneratingEntries || generatedEntries.length > 0}
                    className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 hover:bg-gray-50"
                    style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                  >
                    <CalculatorIcon />
                    Generer ecritures de liquidation
                  </button>
                  <button
                    onClick={handleSaveDeclaration}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: '#006666' }}
                  >
                    <SaveIcon />
                    {isSaving ? 'Sauvegarde...' : 'Valider et sauvegarder'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* History Panel */}
          {showHistory && (
            <div className="bg-white rounded-lg border shadow-sm" style={{ borderColor: '#E4E5E7' }}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
                <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Historique des declarations</h2>
                <button
                  onClick={loadHistory}
                  disabled={loadingHistory}
                  className="p-2 rounded hover:bg-gray-100 transition-colors"
                >
                  <RefreshIcon />
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: '#F2F2F3' }}>
                {loadingHistory ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#006666' }} />
                  </div>
                ) : declarations.length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: '#6C767F' }}>
                    Aucune declaration enregistree
                  </div>
                ) : (
                  declarations.map(decl => (
                    <div key={decl.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            {decl.type === 'monthly' && `${monthNames[new Date(decl.period_start).getMonth()]} ${new Date(decl.period_start).getFullYear()}`}
                            {decl.type === 'quarterly' && `T${Math.ceil((new Date(decl.period_start).getMonth() + 1) / 3)} ${new Date(decl.period_start).getFullYear()}`}
                            {decl.type === 'yearly' && `Annee ${new Date(decl.period_start).getFullYear()}`}
                          </div>
                          <div className="text-xs" style={{ color: '#6C767F' }}>
                            {formatDate(decl.period_start)} - {formatDate(decl.period_end)}
                          </div>
                        </div>
                        <span
                          className="px-2 py-1 text-xs rounded-full"
                          style={{
                            backgroundColor: statusColors[decl.status].bg,
                            color: statusColors[decl.status].text,
                            border: `1px solid ${statusColors[decl.status].border}`,
                          }}
                        >
                          {statusLabels[decl.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium" style={{ color: decl.total_due >= 0 ? '#991B1B' : '#065F46' }}>
                            {decl.total_due >= 0 ? 'A payer: ' : 'Credit: '}
                            {formatCurrency(Math.abs(decl.total_due))}
                          </div>
                          <div className="text-xs" style={{ color: '#6C767F' }}>
                            Collectee: {formatCurrency(decl.total_collected)} / Deductible: {formatCurrency(decl.total_deductible)}
                          </div>
                        </div>
                        {decl.status === 'draft' && (
                          <button
                            onClick={() => handleUpdateStatus(decl.id, 'submitted')}
                            className="px-3 py-1 text-xs rounded border transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#93C5FD', color: '#1E40AF' }}
                          >
                            Marquer soumise
                          </button>
                        )}
                        {decl.status === 'submitted' && (
                          <button
                            onClick={() => handleUpdateStatus(decl.id, 'paid')}
                            className="px-3 py-1 text-xs rounded border transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#6EE7B7', color: '#065F46' }}
                          >
                            Marquer payee
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
