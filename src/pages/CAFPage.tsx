import { useState, useEffect, useMemo } from 'react'
import { calculateCAF, type CAFData } from '../services/analyseFinanciereService'
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts'

// Format number in French locale
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format number for export (comma as decimal separator)
const formatExportNumber = (value: number): string => {
  return value.toFixed(2).replace('.', ',')
}

// Format compact number for charts
const formatCompactNumber = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k`
  }
  return value.toFixed(0)
}

interface PeriodOption {
  value: string
  label: string
  startDate: string
  endDate: string
}

interface CAFPageProps {
  onNavigate?: (page: string) => void
}

export default function CAFPage({ onNavigate: _onNavigate }: CAFPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cafData, setCafData] = useState<CAFData | null>(null)
  const [cafDataN1, setCafDataN1] = useState<CAFData | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeMethod, setActiveMethod] = useState<'additive' | 'soustractive'>('additive')

  // Dividendes input for autofinancement calculation
  const [dividendes, setDividendes] = useState<number>(0)

  // Period selection
  const [periodType, setPeriodType] = useState<'fiscal' | 'custom'>('fiscal')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2024')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Generate period options
  const periodOptions: PeriodOption[] = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const options: PeriodOption[] = []

    // Generate last 5 fiscal years
    for (let year = currentYear; year >= currentYear - 4; year--) {
      options.push({
        value: year.toString(),
        label: `Exercice ${year}`,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      })
    }

    return options
  }, [])

  // Get current period dates
  const currentPeriodDates = useMemo(() => {
    if (periodType === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }

    const period = periodOptions.find(p => p.value === selectedPeriod)
    return period
      ? { startDate: period.startDate, endDate: period.endDate }
      : { startDate: '2024-01-01', endDate: '2024-12-31' }
  }, [periodType, selectedPeriod, customStartDate, customEndDate, periodOptions])

  // Get N-1 period dates for comparison
  const previousPeriodDates = useMemo(() => {
    const { startDate, endDate } = currentPeriodDates
    const startYear = parseInt(startDate.substring(0, 4)) - 1
    const endYear = parseInt(endDate.substring(0, 4)) - 1

    return {
      startDate: `${startYear}${startDate.substring(4)}`,
      endDate: `${endYear}${endDate.substring(4)}`,
    }
  }, [currentPeriodDates])

  // Load CAF data
  useEffect(() => {
    async function loadCAF() {
      setLoading(true)
      setError(null)

      try {
        const { startDate, endDate } = currentPeriodDates
        const data = await calculateCAF(startDate, endDate)
        setCafData(data)

        // Load N-1 data if comparison is enabled
        if (showComparison) {
          const dataN1 = await calculateCAF(previousPeriodDates.startDate, previousPeriodDates.endDate)
          setCafDataN1(dataN1)
        } else {
          setCafDataN1(null)
        }
      } catch (err) {
        console.error('Error loading CAF:', err)
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la CAF')
      } finally {
        setLoading(false)
      }
    }

    loadCAF()
  }, [currentPeriodDates, previousPeriodDates, showComparison])

  // Calculate autofinancement
  const autofinancement = useMemo(() => {
    if (!cafData) return 0
    return cafData.methodeAdditive.caf - dividendes
  }, [cafData, dividendes])

  // Check if both methods give the same result
  const methodsMatch = useMemo(() => {
    if (!cafData) return true
    return Math.abs(cafData.methodeAdditive.caf - cafData.methodeSoustractive.caf) < 0.01
  }, [cafData])

  // Chart data for comparison
  const chartData = useMemo(() => {
    if (!cafData) return []

    const data = [
      {
        name: 'N',
        cafAdditive: cafData.methodeAdditive.caf,
        cafSoustractive: cafData.methodeSoustractive.caf,
        autofinancement: autofinancement,
      },
    ]

    if (showComparison && cafDataN1) {
      data.unshift({
        name: 'N-1',
        cafAdditive: cafDataN1.methodeAdditive.caf,
        cafSoustractive: cafDataN1.methodeSoustractive.caf,
        autofinancement: cafDataN1.methodeAdditive.caf - dividendes,
      })
    }

    return data
  }, [cafData, cafDataN1, showComparison, autofinancement, dividendes])

  // Export to PDF
  const handleExportPDF = async () => {
    if (!cafData) return

    setExporting(true)
    setShowExportDropdown(false)

    try {
      // Dynamic imports for code splitting
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15

      // Header
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('CAPACITE D\'AUTO-FINANCEMENT (CAF)', pageWidth / 2, 20, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Periode: ${currentPeriodDates.startDate} au ${currentPeriodDates.endDate}`, pageWidth / 2, 28, { align: 'center' })

      // Date d'edition
      const today = new Date().toLocaleDateString('fr-FR')
      doc.setFontSize(8)
      doc.text(`Edition le ${today}`, pageWidth - margin - 30, 20)

      let yPos = 40

      // Result summary
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`CAF: ${formatNumber(cafData.methodeAdditive.caf)} EUR`, margin, yPos)
      yPos += 8
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Autofinancement (CAF - Dividendes): ${formatNumber(autofinancement)} EUR`, margin, yPos)
      yPos += 15

      // Methode Additive Table
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Methode Additive (a partir du Resultat Net)', margin, yPos)
      yPos += 8

      const additiveRows = [
        ['Resultat net', formatNumber(cafData.methodeAdditive.resultatNet)],
        ['+ Dotations amortissements (exploitation)', formatNumber(cafData.methodeAdditive.dotationsAmortissementsProvisions.exploitation)],
        ['+ Dotations amortissements (financieres)', formatNumber(cafData.methodeAdditive.dotationsAmortissementsProvisions.financieres)],
        ['+ Dotations amortissements (exceptionnelles)', formatNumber(cafData.methodeAdditive.dotationsAmortissementsProvisions.exceptionnelles)],
        ['- Reprises amortissements (exploitation)', formatNumber(-cafData.methodeAdditive.reprisesAmortissementsProvisions.exploitation)],
        ['- Reprises amortissements (financieres)', formatNumber(-cafData.methodeAdditive.reprisesAmortissementsProvisions.financieres)],
        ['- Reprises amortissements (exceptionnelles)', formatNumber(-cafData.methodeAdditive.reprisesAmortissementsProvisions.exceptionnelles)],
        ['+ Valeur comptable elements cedes (675)', formatNumber(cafData.methodeAdditive.valeurComptableElementsCedes)],
        ['- Produits de cession d\'actif (775)', formatNumber(-cafData.methodeAdditive.produitsCessionsActifs)],
        ['- Quote-part subventions virees (777)', formatNumber(-cafData.methodeAdditive.quotePartSubventions)],
        ['= CAF', formatNumber(cafData.methodeAdditive.caf)],
      ]

      autoTable(doc, {
        startY: yPos,
        head: [['Poste', 'Montant']],
        body: additiveRows,
        theme: 'plain',
        headStyles: { fillColor: [245, 245, 245], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 40, halign: 'right' },
        },
        didParseCell: (data) => {
          if (data.cell.raw?.toString().startsWith('=')) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [230, 230, 230]
          }
        },
      })

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15

      // Methode Soustractive Table
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Methode Soustractive (a partir de l\'EBE)', margin, yPos)
      yPos += 8

      const soustractiveRows = [
        ['Excedent Brut d\'Exploitation (EBE)', formatNumber(cafData.methodeSoustractive.ebe)],
        ['+ Transferts charges exploitation (791)', formatNumber(cafData.methodeSoustractive.transfertsChargesExploitation)],
        ['+ Autres produits exploitation (75)', formatNumber(cafData.methodeSoustractive.autresProduitsExploitation)],
        ['- Autres charges exploitation (65)', formatNumber(-cafData.methodeSoustractive.autresChargesExploitation)],
        ['+ Produits financiers (76)', formatNumber(cafData.methodeSoustractive.produitsFinanciers)],
        ['- Charges financieres (66)', formatNumber(-cafData.methodeSoustractive.chargesFinancieres)],
        ['+ Produits exceptionnels (hors cessions)', formatNumber(cafData.methodeSoustractive.produitsExceptionnels)],
        ['- Charges exceptionnelles (hors VNC)', formatNumber(-cafData.methodeSoustractive.chargesExceptionnelles)],
        ['- Impots sur les benefices', formatNumber(-cafData.methodeSoustractive.impotsBenefices)],
        ['- Participation des salaries (691)', formatNumber(-cafData.methodeSoustractive.participationSalaries)],
        ['= CAF', formatNumber(cafData.methodeSoustractive.caf)],
      ]

      autoTable(doc, {
        startY: yPos,
        head: [['Poste', 'Montant']],
        body: soustractiveRows,
        theme: 'plain',
        headStyles: { fillColor: [245, 245, 245], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 40, halign: 'right' },
        },
        didParseCell: (data) => {
          if (data.cell.raw?.toString().startsWith('=')) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [230, 230, 230]
          }
        },
      })

      // Download
      const filename = `caf_${currentPeriodDates.startDate}_${currentPeriodDates.endDate}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('Erreur export PDF:', err)
      alert('Erreur lors de l\'export PDF: ' + (err instanceof Error ? err.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  // Export to CSV
  const handleExportCSV = async () => {
    if (!cafData) return

    setExporting(true)
    setShowExportDropdown(false)

    try {
      const headers = showComparison
        ? ['Methode', 'Poste', 'Montant N', 'Montant N-1']
        : ['Methode', 'Poste', 'Montant']

      const rows: string[][] = []

      // Methode Additive
      rows.push(['METHODE ADDITIVE', '', '', ''])
      rows.push(['Additive', 'Resultat net', formatExportNumber(cafData.methodeAdditive.resultatNet), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeAdditive.resultatNet) : ''])
      rows.push(['Additive', 'Dotations exploitation (681)', formatExportNumber(cafData.methodeAdditive.dotationsAmortissementsProvisions.exploitation), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeAdditive.dotationsAmortissementsProvisions.exploitation) : ''])
      rows.push(['Additive', 'Dotations financieres (686)', formatExportNumber(cafData.methodeAdditive.dotationsAmortissementsProvisions.financieres), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeAdditive.dotationsAmortissementsProvisions.financieres) : ''])
      rows.push(['Additive', 'Dotations exceptionnelles (687)', formatExportNumber(cafData.methodeAdditive.dotationsAmortissementsProvisions.exceptionnelles), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeAdditive.dotationsAmortissementsProvisions.exceptionnelles) : ''])
      rows.push(['Additive', 'Reprises exploitation (781)', formatExportNumber(-cafData.methodeAdditive.reprisesAmortissementsProvisions.exploitation), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeAdditive.reprisesAmortissementsProvisions.exploitation) : ''])
      rows.push(['Additive', 'Reprises financieres (786)', formatExportNumber(-cafData.methodeAdditive.reprisesAmortissementsProvisions.financieres), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeAdditive.reprisesAmortissementsProvisions.financieres) : ''])
      rows.push(['Additive', 'Reprises exceptionnelles (787)', formatExportNumber(-cafData.methodeAdditive.reprisesAmortissementsProvisions.exceptionnelles), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeAdditive.reprisesAmortissementsProvisions.exceptionnelles) : ''])
      rows.push(['Additive', 'Valeur comptable elements cedes (675)', formatExportNumber(cafData.methodeAdditive.valeurComptableElementsCedes), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeAdditive.valeurComptableElementsCedes) : ''])
      rows.push(['Additive', 'Produits cession actifs (775)', formatExportNumber(-cafData.methodeAdditive.produitsCessionsActifs), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeAdditive.produitsCessionsActifs) : ''])
      rows.push(['Additive', 'Quote-part subventions (777)', formatExportNumber(-cafData.methodeAdditive.quotePartSubventions), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeAdditive.quotePartSubventions) : ''])
      rows.push(['Additive', 'CAF', formatExportNumber(cafData.methodeAdditive.caf), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeAdditive.caf) : ''])

      // Methode Soustractive
      rows.push(['', '', '', ''])
      rows.push(['METHODE SOUSTRACTIVE', '', '', ''])
      rows.push(['Soustractive', 'EBE', formatExportNumber(cafData.methodeSoustractive.ebe), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeSoustractive.ebe) : ''])
      rows.push(['Soustractive', 'Transferts charges (791)', formatExportNumber(cafData.methodeSoustractive.transfertsChargesExploitation), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeSoustractive.transfertsChargesExploitation) : ''])
      rows.push(['Soustractive', 'Autres produits (75)', formatExportNumber(cafData.methodeSoustractive.autresProduitsExploitation), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeSoustractive.autresProduitsExploitation) : ''])
      rows.push(['Soustractive', 'Autres charges (65)', formatExportNumber(-cafData.methodeSoustractive.autresChargesExploitation), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeSoustractive.autresChargesExploitation) : ''])
      rows.push(['Soustractive', 'Produits financiers (76)', formatExportNumber(cafData.methodeSoustractive.produitsFinanciers), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeSoustractive.produitsFinanciers) : ''])
      rows.push(['Soustractive', 'Charges financieres (66)', formatExportNumber(-cafData.methodeSoustractive.chargesFinancieres), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeSoustractive.chargesFinancieres) : ''])
      rows.push(['Soustractive', 'Produits exceptionnels', formatExportNumber(cafData.methodeSoustractive.produitsExceptionnels), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeSoustractive.produitsExceptionnels) : ''])
      rows.push(['Soustractive', 'Charges exceptionnelles', formatExportNumber(-cafData.methodeSoustractive.chargesExceptionnelles), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeSoustractive.chargesExceptionnelles) : ''])
      rows.push(['Soustractive', 'Impots benefices', formatExportNumber(-cafData.methodeSoustractive.impotsBenefices), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeSoustractive.impotsBenefices) : ''])
      rows.push(['Soustractive', 'Participation salaries (691)', formatExportNumber(-cafData.methodeSoustractive.participationSalaries), showComparison && cafDataN1 ? formatExportNumber(-cafDataN1.methodeSoustractive.participationSalaries) : ''])
      rows.push(['Soustractive', 'CAF', formatExportNumber(cafData.methodeSoustractive.caf), showComparison && cafDataN1 ? formatExportNumber(cafDataN1.methodeSoustractive.caf) : ''])

      // Autofinancement
      rows.push(['', '', '', ''])
      rows.push(['AUTOFINANCEMENT', '', '', ''])
      rows.push(['', 'CAF', formatExportNumber(cafData.methodeAdditive.caf), ''])
      rows.push(['', 'Dividendes', formatExportNumber(-dividendes), ''])
      rows.push(['', 'Autofinancement', formatExportNumber(autofinancement), ''])

      const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n')

      // Add BOM for Excel UTF-8 compatibility
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `caf_${currentPeriodDates.startDate}_${currentPeriodDates.endDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur export CSV:', err)
      alert('Erreur lors de l\'export CSV: ' + (err instanceof Error ? err.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  // Render a detail line
  const renderDetailLine = (
    label: string,
    amount: number,
    amountN1: number | null,
    isPositive: boolean,
    accountCode?: string
  ) => {
    const displayAmount = isPositive ? amount : -amount
    const displayAmountN1 = amountN1 !== null ? (isPositive ? amountN1 : -amountN1) : null
    const variation = displayAmountN1 && displayAmountN1 !== 0 ? ((displayAmount - displayAmountN1) / Math.abs(displayAmountN1)) * 100 : 0

    return (
      <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b" style={{ borderColor: '#F2F2F3' }}>
        <div className="flex items-center gap-3 pl-4">
          <span className={`text-sm font-medium ${isPositive ? 'text-stone-600' : 'text-rose-600'}`}>
            {isPositive ? '+' : '-'}
          </span>
          <span className="text-sm" style={{ color: '#141A1F' }}>
            {label}
          </span>
          {accountCode && (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
              {accountCode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <span
            className="text-sm font-mono tabular-nums w-28 text-right"
            style={{ color: displayAmount >= 0 ? '#141A1F' : '#C62828' }}
          >
            {formatNumber(displayAmount)}
          </span>
          {showComparison && (
            <>
              <span className="text-sm font-mono tabular-nums w-28 text-right" style={{ color: '#6C767F' }}>
                {displayAmountN1 !== null ? formatNumber(displayAmountN1) : '---'}
              </span>
              <span
                className="text-xs w-16 text-right"
                style={{
                  color: variation >= 0 ? '#2E7D32' : '#C62828',
                }}
              >
                {displayAmountN1 !== null ? `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%` : '---'}
              </span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Capacite d'Auto-Financement (CAF)</h1>

            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as 'fiscal' | 'custom')}
                className="px-3 py-1.5 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              >
                <option value="fiscal">Exercice fiscal</option>
                <option value="custom">Dates personnalisees</option>
              </select>

              {periodType === 'fiscal' ? (
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  style={{ borderColor: '#006666', color: '#006666' }}
                >
                  {periodOptions.map(period => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <span className="text-sm" style={{ color: '#6C767F' }}>au</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Comparison Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
                className="rounded w-4 h-4"
                style={{ accentColor: '#006666' }}
              />
              <span className="text-sm" style={{ color: '#141A1F' }}>Comparaison N-1</span>
            </label>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting || !cafData}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
                style={{ borderColor: '#006666', color: '#006666' }}
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-[#006666]/30 border-t-[#006666] rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                Exporter
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showExportDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b"
                    style={{ borderColor: '#F2F2F3', color: '#141A1F' }}
                  >
                    <span className="text-lg">PDF</span>
                    PDF (.pdf)
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    <span className="text-lg">CSV</span>
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: '#C62828' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm rounded-lg"
              style={{ backgroundColor: '#006666', color: 'white' }}
            >
              Recharger
            </button>
          </div>
        ) : cafData ? (
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Main Result Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CAF Card */}
              <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#006666' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: '#6C767F' }}>CAF</span>
                  <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                </div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: cafData.methodeAdditive.caf >= 0 ? '#006666' : '#C62828' }}>
                  {formatNumber(cafData.methodeAdditive.caf)}
                </div>
                {showComparison && cafDataN1 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm" style={{ color: '#6C767F' }}>N-1: {formatNumber(cafDataN1.methodeAdditive.caf)}</span>
                    {cafDataN1.methodeAdditive.caf !== 0 && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: cafData.methodeAdditive.caf >= cafDataN1.methodeAdditive.caf ? '#E8F5E9' : '#FFEBEE',
                          color: cafData.methodeAdditive.caf >= cafDataN1.methodeAdditive.caf ? '#2E7D32' : '#C62828',
                        }}
                      >
                        {((cafData.methodeAdditive.caf - cafDataN1.methodeAdditive.caf) / Math.abs(cafDataN1.methodeAdditive.caf) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Autofinancement Card */}
              <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: '#6C767F' }}>Autofinancement</span>
                  <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: autofinancement >= 0 ? '#141A1F' : '#C62828' }}>
                  {formatNumber(autofinancement)}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#6C767F' }}>CAF - Dividendes ({formatNumber(dividendes)})</span>
                </div>
              </div>

              {/* Dividendes Input Card */}
              <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: '#6C767F' }}>Dividendes verses</span>
                  <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={dividendes}
                    onChange={(e) => setDividendes(parseFloat(e.target.value) || 0)}
                    className="w-full text-xl font-bold px-3 py-2 border rounded-lg"
                    style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                    min={0}
                    step={1000}
                  />
                </div>
                <div className="mt-2 text-xs" style={{ color: '#6C767F' }}>
                  Saisir le montant des dividendes pour calculer l'autofinancement
                </div>
              </div>
            </div>

            {/* Methods Match Alert */}
            {!methodsMatch && (
              <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium" style={{ color: '#92400E' }}>
                    Attention: Les deux methodes donnent des resultats differents (Ecart: {formatNumber(Math.abs(cafData.methodeAdditive.caf - cafData.methodeSoustractive.caf))})
                  </span>
                </div>
              </div>
            )}

            {/* Evolution Chart */}
            {showComparison && chartData.length > 1 && (
              <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Evolution N-1 / N</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E5E7" />
                      <XAxis dataKey="name" tick={{ fill: '#6C767F', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#6C767F', fontSize: 12 }} tickFormatter={formatCompactNumber} />
                      <Tooltip
                        formatter={(value) => [formatNumber(value as number), '']}
                        labelStyle={{ color: '#141A1F' }}
                        contentStyle={{ borderColor: '#E4E5E7' }}
                      />
                      <Legend />
                      <ReferenceLine y={0} stroke="#6C767F" strokeDasharray="3 3" />
                      <Bar dataKey="cafAdditive" name="CAF" fill="#006666" />
                      <Bar dataKey="autofinancement" name="Autofinancement" fill="#78909C" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Method Tabs */}
            <div className="bg-white rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              {/* Tab Headers */}
              <div className="flex border-b" style={{ borderColor: '#E4E5E7' }}>
                <button
                  onClick={() => setActiveMethod('additive')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeMethod === 'additive' ? 'border-b-2' : ''
                  }`}
                  style={{
                    borderColor: activeMethod === 'additive' ? '#006666' : 'transparent',
                    color: activeMethod === 'additive' ? '#006666' : '#6C767F',
                    backgroundColor: activeMethod === 'additive' ? '#E6F0F0' : 'transparent',
                  }}
                >
                  Methode Additive
                  <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F2F2F3' }}>
                    (Resultat Net)
                  </span>
                </button>
                <button
                  onClick={() => setActiveMethod('soustractive')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeMethod === 'soustractive' ? 'border-b-2' : ''
                  }`}
                  style={{
                    borderColor: activeMethod === 'soustractive' ? '#006666' : 'transparent',
                    color: activeMethod === 'soustractive' ? '#006666' : '#6C767F',
                    backgroundColor: activeMethod === 'soustractive' ? '#E6F0F0' : 'transparent',
                  }}
                >
                  Methode Soustractive
                  <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F2F2F3' }}>
                    (EBE)
                  </span>
                </button>
              </div>

              {/* Column Headers */}
              {showComparison && (
                <div className="flex justify-end gap-6 px-4 py-2 text-xs font-medium uppercase tracking-wide border-b" style={{ color: '#6C767F', borderColor: '#F2F2F3' }}>
                  <span className="w-28 text-right">Exercice N</span>
                  <span className="w-28 text-right">Exercice N-1</span>
                  <span className="w-16 text-right">Variation</span>
                </div>
              )}

              {/* Methode Additive Content */}
              {activeMethod === 'additive' && (
                <div>
                  {/* Resultat Net (starting point) */}
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F8F9FA' }}>
                    <span className="font-semibold text-sm" style={{ color: '#141A1F' }}>
                      Resultat net de l'exercice
                    </span>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-sm tabular-nums w-28 text-right" style={{ color: '#141A1F' }}>
                        {formatNumber(cafData.methodeAdditive.resultatNet)}
                      </span>
                      {showComparison && cafDataN1 && (
                        <>
                          <span className="text-sm tabular-nums w-28 text-right" style={{ color: '#6C767F' }}>
                            {formatNumber(cafDataN1.methodeAdditive.resultatNet)}
                          </span>
                          <span className="w-16"></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dotations */}
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#006666', backgroundColor: '#E6F0F0' }}>
                    Dotations aux amortissements et provisions
                  </div>
                  {renderDetailLine(
                    'Dotations d\'exploitation',
                    cafData.methodeAdditive.dotationsAmortissementsProvisions.exploitation,
                    cafDataN1?.methodeAdditive.dotationsAmortissementsProvisions.exploitation ?? null,
                    true,
                    '681'
                  )}
                  {renderDetailLine(
                    'Dotations financieres',
                    cafData.methodeAdditive.dotationsAmortissementsProvisions.financieres,
                    cafDataN1?.methodeAdditive.dotationsAmortissementsProvisions.financieres ?? null,
                    true,
                    '686'
                  )}
                  {renderDetailLine(
                    'Dotations exceptionnelles',
                    cafData.methodeAdditive.dotationsAmortissementsProvisions.exceptionnelles,
                    cafDataN1?.methodeAdditive.dotationsAmortissementsProvisions.exceptionnelles ?? null,
                    true,
                    '687'
                  )}

                  {/* Reprises */}
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#C62828', backgroundColor: '#FFEBEE' }}>
                    Reprises sur amortissements et provisions
                  </div>
                  {renderDetailLine(
                    'Reprises d\'exploitation',
                    cafData.methodeAdditive.reprisesAmortissementsProvisions.exploitation,
                    cafDataN1?.methodeAdditive.reprisesAmortissementsProvisions.exploitation ?? null,
                    false,
                    '781'
                  )}
                  {renderDetailLine(
                    'Reprises financieres',
                    cafData.methodeAdditive.reprisesAmortissementsProvisions.financieres,
                    cafDataN1?.methodeAdditive.reprisesAmortissementsProvisions.financieres ?? null,
                    false,
                    '786'
                  )}
                  {renderDetailLine(
                    'Reprises exceptionnelles',
                    cafData.methodeAdditive.reprisesAmortissementsProvisions.exceptionnelles,
                    cafDataN1?.methodeAdditive.reprisesAmortissementsProvisions.exceptionnelles ?? null,
                    false,
                    '787'
                  )}

                  {/* Cessions */}
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#6C767F', backgroundColor: '#F2F2F3' }}>
                    Plus et moins-values de cession
                  </div>
                  {renderDetailLine(
                    'Valeur comptable des elements cedes',
                    cafData.methodeAdditive.valeurComptableElementsCedes,
                    cafDataN1?.methodeAdditive.valeurComptableElementsCedes ?? null,
                    true,
                    '675'
                  )}
                  {renderDetailLine(
                    'Produits de cession d\'actifs',
                    cafData.methodeAdditive.produitsCessionsActifs,
                    cafDataN1?.methodeAdditive.produitsCessionsActifs ?? null,
                    false,
                    '775'
                  )}
                  {renderDetailLine(
                    'Quote-part subventions virees',
                    cafData.methodeAdditive.quotePartSubventions,
                    cafDataN1?.methodeAdditive.quotePartSubventions ?? null,
                    false,
                    '777'
                  )}

                  {/* Total CAF */}
                  <div className="flex items-center justify-between px-4 py-4 border-t" style={{ borderColor: '#006666', backgroundColor: '#E6F0F0' }}>
                    <span className="font-bold text-base" style={{ color: '#006666' }}>= CAPACITE D'AUTO-FINANCEMENT</span>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-base tabular-nums w-28 text-right" style={{ color: '#006666' }}>
                        {formatNumber(cafData.methodeAdditive.caf)}
                      </span>
                      {showComparison && cafDataN1 && (
                        <>
                          <span className="text-sm font-bold tabular-nums w-28 text-right" style={{ color: '#6C767F' }}>
                            {formatNumber(cafDataN1.methodeAdditive.caf)}
                          </span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded w-16 text-center"
                            style={{
                              backgroundColor: cafData.methodeAdditive.caf >= cafDataN1.methodeAdditive.caf ? '#E8F5E9' : '#FFEBEE',
                              color: cafData.methodeAdditive.caf >= cafDataN1.methodeAdditive.caf ? '#2E7D32' : '#C62828',
                            }}
                          >
                            {cafDataN1.methodeAdditive.caf !== 0
                              ? `${cafData.methodeAdditive.caf >= cafDataN1.methodeAdditive.caf ? '+' : ''}${(((cafData.methodeAdditive.caf - cafDataN1.methodeAdditive.caf) / Math.abs(cafDataN1.methodeAdditive.caf)) * 100).toFixed(1)}%`
                              : '---'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Methode Soustractive Content */}
              {activeMethod === 'soustractive' && (
                <div>
                  {/* EBE (starting point) */}
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F8F9FA' }}>
                    <span className="font-semibold text-sm" style={{ color: '#141A1F' }}>
                      Excedent Brut d'Exploitation (EBE)
                    </span>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-sm tabular-nums w-28 text-right" style={{ color: '#141A1F' }}>
                        {formatNumber(cafData.methodeSoustractive.ebe)}
                      </span>
                      {showComparison && cafDataN1 && (
                        <>
                          <span className="text-sm tabular-nums w-28 text-right" style={{ color: '#6C767F' }}>
                            {formatNumber(cafDataN1.methodeSoustractive.ebe)}
                          </span>
                          <span className="w-16"></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Exploitation */}
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#6C767F', backgroundColor: '#F2F2F3' }}>
                    Autres elements d'exploitation
                  </div>
                  {renderDetailLine(
                    'Transferts de charges d\'exploitation',
                    cafData.methodeSoustractive.transfertsChargesExploitation,
                    cafDataN1?.methodeSoustractive.transfertsChargesExploitation ?? null,
                    true,
                    '791'
                  )}
                  {renderDetailLine(
                    'Autres produits d\'exploitation',
                    cafData.methodeSoustractive.autresProduitsExploitation,
                    cafDataN1?.methodeSoustractive.autresProduitsExploitation ?? null,
                    true,
                    '75'
                  )}
                  {renderDetailLine(
                    'Autres charges d\'exploitation',
                    cafData.methodeSoustractive.autresChargesExploitation,
                    cafDataN1?.methodeSoustractive.autresChargesExploitation ?? null,
                    false,
                    '65'
                  )}

                  {/* Financier */}
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#6C767F', backgroundColor: '#F2F2F3' }}>
                    Elements financiers (hors dotations/reprises)
                  </div>
                  {renderDetailLine(
                    'Produits financiers',
                    cafData.methodeSoustractive.produitsFinanciers,
                    cafDataN1?.methodeSoustractive.produitsFinanciers ?? null,
                    true,
                    '76'
                  )}
                  {renderDetailLine(
                    'Charges financieres',
                    cafData.methodeSoustractive.chargesFinancieres,
                    cafDataN1?.methodeSoustractive.chargesFinancieres ?? null,
                    false,
                    '66'
                  )}

                  {/* Exceptionnel */}
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#6C767F', backgroundColor: '#F2F2F3' }}>
                    Elements exceptionnels (hors cessions et dotations/reprises)
                  </div>
                  {renderDetailLine(
                    'Produits exceptionnels',
                    cafData.methodeSoustractive.produitsExceptionnels,
                    cafDataN1?.methodeSoustractive.produitsExceptionnels ?? null,
                    true,
                    '77 (hors 775, 777)'
                  )}
                  {renderDetailLine(
                    'Charges exceptionnelles',
                    cafData.methodeSoustractive.chargesExceptionnelles,
                    cafDataN1?.methodeSoustractive.chargesExceptionnelles ?? null,
                    false,
                    '67 (hors 675)'
                  )}

                  {/* Impots et participation */}
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: '#C62828', backgroundColor: '#FFEBEE' }}>
                    Impots et participation
                  </div>
                  {renderDetailLine(
                    'Impots sur les benefices',
                    cafData.methodeSoustractive.impotsBenefices,
                    cafDataN1?.methodeSoustractive.impotsBenefices ?? null,
                    false,
                    '695, 697, 699'
                  )}
                  {renderDetailLine(
                    'Participation des salaries',
                    cafData.methodeSoustractive.participationSalaries,
                    cafDataN1?.methodeSoustractive.participationSalaries ?? null,
                    false,
                    '691'
                  )}

                  {/* Total CAF */}
                  <div className="flex items-center justify-between px-4 py-4 border-t" style={{ borderColor: '#006666', backgroundColor: '#E6F0F0' }}>
                    <span className="font-bold text-base" style={{ color: '#006666' }}>= CAPACITE D'AUTO-FINANCEMENT</span>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-base tabular-nums w-28 text-right" style={{ color: '#006666' }}>
                        {formatNumber(cafData.methodeSoustractive.caf)}
                      </span>
                      {showComparison && cafDataN1 && (
                        <>
                          <span className="text-sm font-bold tabular-nums w-28 text-right" style={{ color: '#6C767F' }}>
                            {formatNumber(cafDataN1.methodeSoustractive.caf)}
                          </span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded w-16 text-center"
                            style={{
                              backgroundColor: cafData.methodeSoustractive.caf >= cafDataN1.methodeSoustractive.caf ? '#E8F5E9' : '#FFEBEE',
                              color: cafData.methodeSoustractive.caf >= cafDataN1.methodeSoustractive.caf ? '#2E7D32' : '#C62828',
                            }}
                          >
                            {cafDataN1.methodeSoustractive.caf !== 0
                              ? `${cafData.methodeSoustractive.caf >= cafDataN1.methodeSoustractive.caf ? '+' : ''}${(((cafData.methodeSoustractive.caf - cafDataN1.methodeSoustractive.caf) / Math.abs(cafDataN1.methodeSoustractive.caf)) * 100).toFixed(1)}%`
                              : '---'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Methods Verification */}
            <div className="px-4 py-4 rounded-lg border" style={{
              borderColor: methodsMatch ? '#006666' : '#F59E0B',
              backgroundColor: methodsMatch ? '#E6F0F0' : '#FEF3C7'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {methodsMatch ? (
                    <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  )}
                  <span className="font-medium text-sm" style={{ color: methodsMatch ? '#006666' : '#92400E' }}>
                    {methodsMatch ? 'Verification: Les deux methodes donnent le meme resultat' : 'Attention: Ecart entre les deux methodes'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span style={{ color: '#6C767F' }}>Additive: {formatNumber(cafData.methodeAdditive.caf)}</span>
                  <span style={{ color: '#6C767F' }}>Soustractive: {formatNumber(cafData.methodeSoustractive.caf)}</span>
                  <span className="font-mono font-bold" style={{ color: methodsMatch ? '#006666' : '#C62828' }}>
                    Ecart: {formatNumber(Math.abs(cafData.methodeAdditive.caf - cafData.methodeSoustractive.caf))}
                  </span>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: '#6C767F' }}>Aucune donnee disponible</p>
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {showExportDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExportDropdown(false)}
        />
      )}
    </div>
  )
}
