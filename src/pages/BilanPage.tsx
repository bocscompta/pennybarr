import { useState, useEffect, useMemo, useCallback, ReactNode, Fragment } from 'react'
import {
  generateBilan,
  generateBilanStructured,
  type BilanData,
  type BilanLine,
  type BilanDataStructured,
  type BilanLineStructured,
  type BilanPassifLine
} from '../services/etatsFinanciersService'

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

// Format date to DD/MM/YYYY
const formatDateFR = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Parse DD/MM/YYYY to Date
const parseDateFR = (dateStr: string): Date | null => {
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  const date = new Date(year, month, day)
  return isNaN(date.getTime()) ? null : date
}

// Month names in French
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const DAYS_FR = ['LU', 'MA', 'ME', 'JE', 'VE', 'SA', 'DI']

interface PeriodOption {
  value: string
  label: string
  startDate: string
  endDate: string
}

interface BilanPageProps {
  onNavigate?: (page: string) => void
}

export default function BilanPage({ onNavigate }: BilanPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bilanData, setBilanData] = useState<BilanData | null>(null)
  const [bilanStructured, setBilanStructured] = useState<BilanDataStructured | null>(null)
  const [useStructuredView, setUseStructuredView] = useState(false) // Legacy view - shows all rows including zeros
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'actif' | 'passif'>('actif')
  const [showInfoBanner, setShowInfoBanner] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Period selection - Enhanced
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [showCustomDates, setShowCustomDates] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('custom')
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date(2024, 3, 30)) // 30/04/2024
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date(2025, 11, 31)) // 31/12/2025
  const [tempStartDate, setTempStartDate] = useState<string>('30/04/2024')
  const [tempEndDate, setTempEndDate] = useState<string>('31/12/2025')
  const [calendarMonth, setCalendarMonth] = useState<number>(3) // April (0-indexed)
  const [calendarYear, setCalendarYear] = useState<number>(2024)
  const [selectingDate, setSelectingDate] = useState<'start' | 'end'>('start')
  const [hoveredExercice, setHoveredExercice] = useState<string | null>(null)

  // Comparison period states (UI only for now)
  const [showCompareDropdown, setShowCompareDropdown] = useState(false)
  const [comparePeriod, setComparePeriod] = useState<string | null>(null)
  const [comparePeriodLabel, setComparePeriodLabel] = useState<string | null>(null)
  const [hoveredCompareExercice, setHoveredCompareExercice] = useState<string | null>(null)

  // Generate period options
  const periodOptions: PeriodOption[] = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const options: PeriodOption[] = []

    for (let year = currentYear + 2; year >= 2024; year--) {
      if (year === 2024 || year === 2025) {
        // Special case for 2024-2025 (skip 2025 as it's part of 2024-2025)
        if (year === 2024) {
          options.push({
            value: '2024-2025',
            label: 'Exercice 2024-2025',
            startDate: '2024-04-30',
            endDate: '2025-12-31',
          })
        }
      } else {
        options.push({
          value: `${year}`,
          label: `Exercice ${year}`,
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
        })
      }
    }

    return options
  }, [])

  // Get current period dates
  const currentPeriodDates = useMemo(() => {
    if (selectedPeriod === 'custom') {
      return {
        startDate: `${customStartDate.getFullYear()}-${String(customStartDate.getMonth() + 1).padStart(2, '0')}-${String(customStartDate.getDate()).padStart(2, '0')}`,
        endDate: `${customEndDate.getFullYear()}-${String(customEndDate.getMonth() + 1).padStart(2, '0')}-${String(customEndDate.getDate()).padStart(2, '0')}`,
      }
    }
    const period = periodOptions.find(p => p.value === selectedPeriod)
    return period
      ? { startDate: period.startDate, endDate: period.endDate }
      : { startDate: '2024-04-30', endDate: '2025-12-31' }
  }, [selectedPeriod, periodOptions, customStartDate, customEndDate])

  // Period display label
  const periodDisplayLabel = useMemo(() => {
    if (selectedPeriod === 'custom') {
      return `${formatDateFR(customStartDate)} - ${formatDateFR(customEndDate)}`
    }
    const period = periodOptions.find(p => p.value === selectedPeriod)
    return period?.label || 'Exercice 2024-2025'
  }, [selectedPeriod, periodOptions, customStartDate, customEndDate])

  // Comparison period display label
  const comparePeriodDisplayLabel = useMemo(() => {
    if (!comparePeriod) return 'Période à considérer'
    if (comparePeriodLabel) return comparePeriodLabel
    const period = periodOptions.find(p => p.value === comparePeriod)
    return period?.label || 'Période à considérer'
  }, [comparePeriod, comparePeriodLabel, periodOptions])

  // Generate months for an exercise period
  const getExerciceMonths = useCallback((periodValue: string): { label: string; value: string }[] => {
    const period = periodOptions.find(p => p.value === periodValue)
    if (!period) return []

    const startDate = new Date(period.startDate)
    const endDate = new Date(period.endDate)
    const months: { label: string; value: string }[] = []

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (current <= endDate) {
      const monthName = MONTHS_FR[current.getMonth()]
      const year = current.getFullYear()
      const monthLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`
      months.push({ label: monthLabel, value: `${year}-${String(current.getMonth() + 1).padStart(2, '0')}` })
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }, [periodOptions])

  // Load bilan data
  useEffect(() => {
    async function loadBilan() {
      setLoading(true)
      setError(null)

      try {
        const { startDate, endDate } = currentPeriodDates
        // Load both legacy and structured data
        const [legacyData, structuredData] = await Promise.all([
          generateBilan(startDate, endDate),
          generateBilanStructured(startDate, endDate)
        ])
        setBilanData(legacyData)
        setBilanStructured(structuredData)
      } catch (err) {
        console.error('Error loading bilan:', err)
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement du bilan')
      } finally {
        setLoading(false)
      }
    }

    loadBilan()
  }, [currentPeriodDates])

  // Toggle expanded items
  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Check if bilan is balanced
  const isBalanced = useMemo(() => {
    if (!bilanData) return true
    return Math.abs(bilanData.actif.totalActif - bilanData.passif.totalPassif) < 0.01
  }, [bilanData])

  // Get end date formatted
  const endDateFormatted = useMemo(() => {
    if (selectedPeriod === 'custom') {
      return formatDateFR(customEndDate)
    }
    const period = periodOptions.find(p => p.value === selectedPeriod)
    if (!period) return '31/12/2025'
    const date = new Date(period.endDate)
    return formatDateFR(date)
  }, [selectedPeriod, periodOptions, customEndDate])

  // Calendar helpers
  const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number, year: number): number => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Convert to Monday-first (0 = Monday)
  }

  const generateCalendarDays = useCallback(() => {
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear)
    const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear)
    const days: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

    // Previous month days
    const prevMonth = calendarMonth === 0 ? 11 : calendarMonth - 1
    const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear
    const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear)
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month: calendarMonth, year: calendarYear, isCurrentMonth: true })
    }

    // Next month days
    const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1
    const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, month: nextMonth, year: nextYear, isCurrentMonth: false })
    }

    return days
  }, [calendarMonth, calendarYear])

  const isDateInRange = (day: number, month: number, year: number): boolean => {
    const date = new Date(year, month, day)
    return date >= customStartDate && date <= customEndDate
  }

  const isDateSelected = (day: number, month: number, year: number): boolean => {
    const date = new Date(year, month, day)
    return (
      (date.getTime() === customStartDate.getTime()) ||
      (date.getTime() === customEndDate.getTime())
    )
  }

  const handleDateClick = (day: number, month: number, year: number) => {
    const newDate = new Date(year, month, day)
    if (selectingDate === 'start') {
      setCustomStartDate(newDate)
      setTempStartDate(formatDateFR(newDate))
      setSelectingDate('end')
    } else {
      if (newDate < customStartDate) {
        setCustomStartDate(newDate)
        setTempStartDate(formatDateFR(newDate))
      } else {
        setCustomEndDate(newDate)
        setTempEndDate(formatDateFR(newDate))
      }
    }
  }

  const handleApplyCustomDates = () => {
    const start = parseDateFR(tempStartDate)
    const end = parseDateFR(tempEndDate)
    if (start && end && start <= end) {
      setCustomStartDate(start)
      setCustomEndDate(end)
      setSelectedPeriod('custom')
      setShowCustomDates(false)
      setShowPeriodDropdown(false)
    }
  }

  const handlePeriodSelect = (value: string) => {
    if (value === 'custom') {
      setShowCustomDates(true)
      setCalendarMonth(customStartDate.getMonth())
      setCalendarYear(customStartDate.getFullYear())
      setSelectingDate('start')
    } else {
      setSelectedPeriod(value)
      setShowCustomDates(false)
      setShowPeriodDropdown(false)
    }
  }

  // Helper to render account detail row
  const renderAccountDetail = (line: BilanLine, isActif: boolean = true) => {
    const displayCode = line.code.length >= 8 ? line.code : ''
    const displayLabel = displayCode ? `${line.code} - ${line.label}` : line.label

    return (
      <tr key={`detail-${line.code}`} className="border-t" style={{ borderColor: '#F2F2F3' }}>
        <td className="px-4 py-2 text-sm pl-12" style={{ color: '#141A1F' }}>
          {displayLabel}
        </td>
        {isActif ? (
          <>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#141A1F' }}>
              {formatNumber(Math.abs(line.amount))}
            </td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#141A1F' }}>
              0,00
            </td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#141A1F' }}>
              {formatNumber(Math.abs(line.amount))}
            </td>
          </>
        ) : (
          <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#141A1F' }}>
            {formatNumber(line.amount)}
          </td>
        )}
      </tr>
    )
  }

  // Export to CSV
  const handleExportCSV = async () => {
    if (!bilanData) return

    setExporting(true)
    setShowExportDropdown(false)

    try {
      const rows: string[][] = []

      // ACTIF
      rows.push(['Postes', 'Brut', 'Amort. & dépréc.', `Net ${endDateFormatted}`])
      rows.push(['Capital souscrit non appelé (I)', '0,00', '0,00', '0,00'])

      rows.push(['Immobilisations incorporelles', '', '', ''])
      rows.push(['Frais d\'établissement', '0,00', '0,00', '0,00'])
      rows.push(['Frais de recherche et développement', '0,00', '0,00', '0,00'])
      rows.push(['Concessions, brevets, licences, marques, procédés, droits et valeurs similaires', '0,00', '0,00', '0,00'])
      rows.push(['Fonds commercial', '0,00', '0,00', '0,00'])
      rows.push(['Autres immobilisations incorporelles', '0,00', '0,00', '0,00'])
      rows.push(['Avances et acomptes', '0,00', '0,00', '0,00'])

      rows.push(['Immobilisations corporelles', '', '', ''])
      // Add actual immobilisations data
      const immoCorpTotal = bilanData.actif.immobilisations
        .filter(l => l.code.startsWith('21') || l.code.startsWith('22') || l.code.startsWith('23'))
        .reduce((sum, l) => sum + l.amount, 0)

      rows.push(['Terrains', '0,00', '0,00', '0,00'])
      rows.push(['Constructions', '0,00', '0,00', '0,00'])
      rows.push(['Installations techniques, matériels et outillages industriels', '0,00', '0,00', '0,00'])

      const autresImmoCorp = bilanData.actif.immobilisations.filter(l => l.code.startsWith('218'))
      const autresImmoCorpTotal = autresImmoCorp.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Autres immobilisations corporelles', formatExportNumber(autresImmoCorpTotal), '0,00', formatExportNumber(autresImmoCorpTotal)])
      autresImmoCorp.forEach(line => {
        if (line.children) {
          line.children.forEach(child => {
            rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount), '0,00', formatExportNumber(child.amount)])
          })
        } else if (line.amount !== 0) {
          rows.push([`${line.code} - ${line.label}`, formatExportNumber(line.amount), '0,00', formatExportNumber(line.amount)])
        }
      })

      const totalActifImmo = bilanData.actif.immobilisations.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Total actif immobilisé (II)', formatExportNumber(totalActifImmo), '0,00', formatExportNumber(totalActifImmo)])

      // Actif circulant
      rows.push(['Stocks et en-cours', '', '', ''])
      rows.push(['Matières premières et autres approvisionnements', '0,00', '0,00', '0,00'])

      rows.push(['Créances', '', '', ''])
      const creancesClients = bilanData.actif.actifCirculant.filter(l => l.code.startsWith('411'))
      const creancesClientsTotal = creancesClients.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Créances clients et comptes rattachés', formatExportNumber(creancesClientsTotal), '0,00', formatExportNumber(creancesClientsTotal)])
      creancesClients.forEach(line => {
        if (line.children) {
          line.children.forEach(child => {
            rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount), '0,00', formatExportNumber(child.amount)])
          })
        }
      })

      const autresCreances = bilanData.actif.actifCirculant.filter(l => !l.code.startsWith('411'))
      const autresCreancesTotal = autresCreances.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Autres créances', formatExportNumber(autresCreancesTotal), '0,00', formatExportNumber(autresCreancesTotal)])
      autresCreances.forEach(line => {
        if (line.children) {
          line.children.forEach(child => {
            rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount), '0,00', formatExportNumber(child.amount)])
          })
        } else if (line.amount !== 0) {
          rows.push([`${line.code} - ${line.label}`, formatExportNumber(line.amount), '0,00', formatExportNumber(line.amount)])
        }
      })

      rows.push(['Disponibilités et charges', '', '', ''])
      const disponibilites = bilanData.actif.tresorerie.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Disponibilités', formatExportNumber(disponibilites), '0,00', formatExportNumber(disponibilites)])
      bilanData.actif.tresorerie.forEach(line => {
        if (line.children) {
          line.children.forEach(child => {
            rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount), '0,00', formatExportNumber(child.amount)])
          })
        } else if (line.amount !== 0) {
          rows.push([`${line.code} - ${line.label}`, formatExportNumber(line.amount), '0,00', formatExportNumber(line.amount)])
        }
      })

      const totalActifCirculant = bilanData.actif.actifCirculant.reduce((sum, l) => sum + l.amount, 0) + disponibilites
      rows.push(['Total actif circulant (III)', formatExportNumber(totalActifCirculant), '0,00', formatExportNumber(totalActifCirculant)])

      rows.push([`Total actif (I + II + III + IV + V + VI)`, formatExportNumber(bilanData.actif.totalActif), '0,00', formatExportNumber(bilanData.actif.totalActif)])

      // PASSIF
      rows.push([''])
      rows.push(['Postes', `${endDateFormatted}`])

      const capital = bilanData.passif.capitauxPropres.find(l => l.code.startsWith('10'))
      rows.push(['Capital', formatExportNumber(capital?.amount || 0)])
      if (capital?.children) {
        capital.children.forEach(child => {
          rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount)])
        })
      }

      const resultat = bilanData.passif.capitauxPropres.find(l => l.code.startsWith('12'))
      rows.push(['Résultat de l\'exercice', formatExportNumber(resultat?.amount || 0)])

      const totalCapitaux = bilanData.passif.capitauxPropres.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Total capitaux propres (I)', formatExportNumber(totalCapitaux)])

      rows.push(['TOTAL PROVISIONS (II)', '0,00'])

      const dettesFournisseurs = bilanData.passif.dettes.filter(l => l.code.startsWith('401'))
      const dettesFournisseursTotal = dettesFournisseurs.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Dettes fournisseurs et comptes rattachés', formatExportNumber(dettesFournisseursTotal)])
      dettesFournisseurs.forEach(line => {
        if (line.children) {
          line.children.forEach(child => {
            rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount)])
          })
        }
      })

      const dettesFiscales = bilanData.passif.dettes.filter(l => l.code.startsWith('43') || l.code.startsWith('44'))
      const dettesFiscalesTotal = dettesFiscales.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Dettes fiscales et sociales', formatExportNumber(dettesFiscalesTotal)])
      dettesFiscales.forEach(line => {
        if (line.children) {
          line.children.forEach(child => {
            rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount)])
          })
        } else if (line.amount !== 0) {
          rows.push([`${line.code} - ${line.label}`, formatExportNumber(line.amount)])
        }
      })

      const autresDettes = bilanData.passif.dettes.filter(l => !l.code.startsWith('401') && !l.code.startsWith('43') && !l.code.startsWith('44'))
      const autresDettesTotal = autresDettes.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Autres dettes', formatExportNumber(autresDettesTotal)])
      autresDettes.forEach(line => {
        if (line.children) {
          line.children.forEach(child => {
            rows.push([`${child.code} - ${child.label}`, formatExportNumber(child.amount)])
          })
        } else if (line.amount !== 0) {
          rows.push([`${line.code} - ${line.label}`, formatExportNumber(line.amount)])
        }
      })

      const totalDettes = bilanData.passif.dettes.reduce((sum, l) => sum + l.amount, 0)
      rows.push(['Total dettes (III)', formatExportNumber(totalDettes)])

      rows.push([`Total passif (I + I bis + II + III + IV)`, formatExportNumber(bilanData.passif.totalPassif)])

      const csvContent = rows.map(row => row.join(';')).join('\r\n')
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `Bilan_détaillé_${selectedPeriod.replace('-', '_')}.csv`
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

  // ============ STRUCTURED VIEW RENDER FUNCTIONS ============

  // Render a single actif line with Brut/Amort/Net
  const renderActifLineStructured = (item: BilanLineStructured, depth: number = 0): ReactNode => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.id)
    const paddingLeft = depth === 0 ? 16 : 16 + depth * 24

    const isZero = item.net === 0 && item.brut === 0
    const textColor = isZero ? '#9CA3AF' : '#141A1F'
    const amountColor = isZero ? '#9CA3AF' : (item.net !== 0 ? '#141A1F' : '#9CA3AF')

    return (
      <Fragment key={item.id}>
        <tr
          className={`border-t ${hasChildren ? 'cursor-pointer hover:bg-gray-50' : ''}`}
          style={{
            borderColor: item.isSubtotal ? '#E4E5E7' : '#F2F2F3',
            backgroundColor: item.isSubtotal ? '#FAFBFC' : (item.isTotal ? '#E6F0F0' : 'transparent')
          }}
          onClick={hasChildren ? () => toggleExpanded(item.id) : undefined}
        >
          <td
            className={`px-4 py-2.5 text-sm ${item.isSubtotal || item.isTotal ? 'font-semibold' : ''}`}
            style={{ color: item.isTotal ? '#006666' : textColor, paddingLeft }}
          >
            <span className="flex items-center gap-2">
              {hasChildren && (
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {item.label}
            </span>
          </td>
          <td
            className={`px-4 py-2.5 text-right font-mono text-sm ${item.isSubtotal || item.isTotal ? 'font-bold' : ''}`}
            style={{ color: item.isTotal ? '#006666' : amountColor }}
          >
            {formatNumber(item.brut)}
          </td>
          <td
            className={`px-4 py-2.5 text-right font-mono text-sm ${item.isSubtotal || item.isTotal ? 'font-bold' : ''}`}
            style={{ color: item.isTotal ? '#006666' : (item.amortissement !== 0 ? '#141A1F' : '#9CA3AF') }}
          >
            {formatNumber(item.amortissement)}
          </td>
          <td
            className={`px-4 py-2.5 text-right font-mono text-sm ${item.isSubtotal || item.isTotal ? 'font-bold' : ''}`}
            style={{ color: item.isTotal ? '#006666' : amountColor }}
          >
            {formatNumber(item.net)}
          </td>
        </tr>
        {hasChildren && isExpanded && item.children?.map(child => renderActifLineStructured(child, depth + 1))}
      </Fragment>
    )
  }

  // Render a single passif line
  const renderPassifLineStructured = (item: BilanPassifLine, depth: number = 0): ReactNode => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.id)
    const paddingLeft = depth === 0 ? 16 : 16 + depth * 24

    const isZero = item.amount === 0
    const textColor = isZero ? '#9CA3AF' : '#141A1F'

    return (
      <Fragment key={item.id}>
        <tr
          className={`border-t ${hasChildren ? 'cursor-pointer hover:bg-gray-50' : ''}`}
          style={{
            borderColor: item.isSubtotal ? '#E4E5E7' : '#F2F2F3',
            backgroundColor: item.isSubtotal ? '#FAFBFC' : (item.isTotal ? '#E6F0F0' : 'transparent')
          }}
          onClick={hasChildren ? () => toggleExpanded(item.id) : undefined}
        >
          <td
            className={`px-4 py-2.5 text-sm ${item.isSubtotal || item.isTotal ? 'font-semibold' : ''}`}
            style={{ color: item.isTotal ? '#006666' : textColor, paddingLeft }}
          >
            <span className="flex items-center gap-2">
              {hasChildren && (
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {item.label}
            </span>
          </td>
          <td
            className={`px-4 py-2.5 text-right font-mono text-sm ${item.isSubtotal || item.isTotal ? 'font-bold' : ''}`}
            style={{ color: item.isTotal ? '#006666' : (isZero ? '#9CA3AF' : '#141A1F') }}
          >
            {formatNumber(item.amount)}
          </td>
        </tr>
        {hasChildren && isExpanded && item.children?.map(child => renderPassifLineStructured(child, depth + 1))}
      </Fragment>
    )
  }

  // Render structured ACTIF table
  const renderActifTableStructured = () => {
    if (!bilanStructured) return null

    return (
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr style={{ backgroundColor: '#F8F9FA' }}>
            <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#141A1F' }}>Postes</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-32" style={{ color: '#141A1F' }}>Brut</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-36" style={{ color: '#141A1F' }}>Amort. & dépréc.</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-32" style={{ color: '#141A1F' }}>Net {endDateFormatted}</th>
          </tr>
        </thead>
        <tbody>
          {bilanStructured.actif.items.map(item => renderActifLineStructured(item))}
          {/* Total row */}
          <tr style={{ backgroundColor: '#006666' }}>
            <td className="px-4 py-3 text-sm font-bold text-white">TOTAL ACTIF</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">
              {formatNumber(bilanStructured.actif.totalBrut)}
            </td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">
              {formatNumber(bilanStructured.actif.totalAmortissement)}
            </td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">
              {formatNumber(bilanStructured.actif.totalNet)}
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  // Render structured PASSIF table
  const renderPassifTableStructured = () => {
    if (!bilanStructured) return null

    return (
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr style={{ backgroundColor: '#F8F9FA' }}>
            <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#141A1F' }}>Postes</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-32" style={{ color: '#141A1F' }}>Montant {endDateFormatted}</th>
          </tr>
        </thead>
        <tbody>
          {bilanStructured.passif.items.map(item => renderPassifLineStructured(item))}
          {/* Total row */}
          <tr style={{ backgroundColor: '#006666' }}>
            <td className="px-4 py-3 text-sm font-bold text-white">TOTAL PASSIF</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">
              {formatNumber(bilanStructured.passif.total)}
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  // ============ LEGACY VIEW RENDER FUNCTIONS ============

  // Render ACTIF table
  const renderActifTable = () => {
    if (!bilanData) return null

    const totalImmo = bilanData.actif.immobilisations.reduce((sum, l) => sum + l.amount, 0)
    const totalCirculant = bilanData.actif.actifCirculant.reduce((sum, l) => sum + l.amount, 0)
    const totalTreso = bilanData.actif.tresorerie.reduce((sum, l) => sum + l.amount, 0)

    // Group immobilisations by type
    const immoIncorp = bilanData.actif.immobilisations.filter(l => l.code.startsWith('20'))
    const immoCorp = bilanData.actif.immobilisations.filter(l => l.code.startsWith('21') || l.code.startsWith('22') || l.code.startsWith('23'))
    const immoFin = bilanData.actif.immobilisations.filter(l => l.code.startsWith('26') || l.code.startsWith('27'))

    // Group actif circulant
    const stocks = bilanData.actif.actifCirculant.filter(l => l.code.startsWith('3'))
    const creancesClients = bilanData.actif.actifCirculant.filter(l => l.code.startsWith('411'))
    const autresCreances = bilanData.actif.actifCirculant.filter(l => !l.code.startsWith('3') && !l.code.startsWith('411'))

    return (
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr style={{ backgroundColor: '#F8F9FA' }}>
            <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#141A1F' }}>Postes</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-28" style={{ color: '#141A1F' }}>Brut</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-32" style={{ color: '#141A1F' }}>Amort. & dépréc.</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-32" style={{ color: '#141A1F' }}>Net {endDateFormatted}</th>
          </tr>
        </thead>
        <tbody>
          {/* Capital souscrit non appelé */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7' }}>
            <td className="px-4 py-2.5 text-sm font-medium" style={{ color: '#141A1F' }}>Capital souscrit non appelé (I)</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Immobilisations incorporelles */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Immobilisations incorporelles</td>
            <td></td><td></td><td></td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Frais d'établissement</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Frais de recherche et développement</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Concessions, brevets, licences, marques, procédés, droits et valeurs similaires</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Fonds commercial</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres immobilisations incorporelles</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Avances et acomptes</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Immobilisations corporelles */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Immobilisations corporelles</td>
            <td></td><td></td><td></td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Terrains</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Constructions</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Installations techniques, matériels et outillages industriels</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Autres immobilisations corporelles - with data */}
          {(() => {
            const autresImmoCorp = immoCorp.filter(l => l.code.startsWith('218'))
            const autresImmoCorpTotal = autresImmoCorp.reduce((sum, l) => sum + l.amount, 0)
            if (autresImmoCorpTotal !== 0) {
              return (
                <>
                  <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
                    <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres immobilisations corporelles</td>
                    <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#141A1F' }}>{formatNumber(autresImmoCorpTotal)}</td>
                    <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                    <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#141A1F' }}>{formatNumber(autresImmoCorpTotal)}</td>
                  </tr>
                  {autresImmoCorp.map(line => {
                    if (line.children && line.children.length > 0) {
                      return line.children.map(child => (
                        <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                          <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
                          <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                          <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                          <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                        </tr>
                      ))
                    } else if (line.amount !== 0) {
                      return (
                        <tr key={line.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                          <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{line.code} - {line.label}</td>
                          <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                          <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                          <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                        </tr>
                      )
                    }
                    return null
                  })}
                </>
              )
            } else {
              return (
                <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres immobilisations corporelles</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                </tr>
              )
            }
          })()}

          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Immobilisations corporelles en cours</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Avances et acomptes</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Immobilisations financières */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Immobilisations financières</td>
            <td></td><td></td><td></td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Participations</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Créances rattachées à des participations</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres titres immobilisés</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Prêts</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres immobilisations financières</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Total actif immobilisé */}
          <tr style={{ backgroundColor: '#E6F0F0' }}>
            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#006666' }}>Total actif immobilisé (II)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>{formatNumber(totalImmo)}</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>0,00</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>{formatNumber(totalImmo)}</td>
          </tr>

          {/* Stocks et en-cours */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Stocks et en-cours</td>
            <td></td><td></td><td></td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Matières premières et autres approvisionnements</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>En-cours de production</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Produits intermédiaires et finis</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Marchandises</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Avances et acomptes versés sur commandes</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Créances */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Créances</td>
            <td></td><td></td><td></td>
          </tr>

          {/* Créances clients */}
          {(() => {
            const clientsTotal = creancesClients.reduce((sum, l) => sum + l.amount, 0)
            return (
              <>
                <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Créances clients et comptes rattachés</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: clientsTotal !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(clientsTotal)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: clientsTotal !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(clientsTotal)}</td>
                </tr>
                {creancesClients.map(line => {
                  if (line.children && line.children.length > 0) {
                    return line.children.map(child => (
                      <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                      </tr>
                    ))
                  } else if (line.amount !== 0) {
                    return (
                      <tr key={line.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{line.code} - {line.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                      </tr>
                    )
                  }
                  return null
                })}
              </>
            )
          })()}

          {/* Autres créances */}
          {(() => {
            const autresTotal = autresCreances.reduce((sum, l) => sum + l.amount, 0)
            return (
              <>
                <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres créances</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: autresTotal !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(autresTotal)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: autresTotal !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(autresTotal)}</td>
                </tr>
                {autresCreances.map(line => {
                  if (line.children && line.children.length > 0) {
                    return line.children.map(child => (
                      <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                      </tr>
                    ))
                  } else if (line.amount !== 0) {
                    return (
                      <tr key={line.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{line.code} - {line.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                      </tr>
                    )
                  }
                  return null
                })}
              </>
            )
          })()}

          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Capital souscrit - appelé, non versé</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Valeurs mobilières de placement */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Valeurs mobilières de placement</td>
            <td></td><td></td><td></td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Actions propres</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres titres et instruments de trésorerie</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Disponibilités et charges */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Disponibilités et charges</td>
            <td></td><td></td><td></td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Disponibilités</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: totalTreso !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(totalTreso)}</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: totalTreso !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(totalTreso)}</td>
          </tr>
          {bilanData.actif.tresorerie.map(line => {
            if (line.children && line.children.length > 0) {
              return line.children.map(child => (
                <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                </tr>
              ))
            } else if (line.amount !== 0) {
              return (
                <tr key={line.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2 text-sm pl-12" style={{ color: '#6C767F' }}>{line.code} - {line.label}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
                  <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                </tr>
              )
            }
            return null
          })}
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Charges constatées d'avance</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Total actif circulant */}
          <tr style={{ backgroundColor: '#E6F0F0' }}>
            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#006666' }}>Total actif circulant (III)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>{formatNumber(totalCirculant + totalTreso)}</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>0,00</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>{formatNumber(totalCirculant + totalTreso)}</td>
          </tr>

          {/* Other totals */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Frais d'émission des emprunts (IV)</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Primes de remboursement des obligations (V)</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Écarts de conversion - Actif (VI)</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* TOTAL ACTIF */}
          <tr style={{ backgroundColor: '#006666' }}>
            <td className="px-4 py-3 text-sm font-bold text-white">Total actif (I + II + III + IV + V + VI)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">{formatNumber(bilanData.actif.totalActif)}</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">0,00</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">{formatNumber(bilanData.actif.totalActif)}</td>
          </tr>
        </tbody>
      </table>
    )
  }

  // Render PASSIF table
  const renderPassifTable = () => {
    if (!bilanData) return null

    const totalCapitaux = bilanData.passif.capitauxPropres.reduce((sum, l) => sum + l.amount, 0)
    const totalProvisions = bilanData.passif.provisions.reduce((sum, l) => sum + l.amount, 0)
    const totalDettes = bilanData.passif.dettes.reduce((sum, l) => sum + l.amount, 0)

    // Find specific items
    const capital = bilanData.passif.capitauxPropres.find(l => l.code.startsWith('10'))
    const reserves = bilanData.passif.capitauxPropres.filter(l => l.code.startsWith('106'))
    const reportNouveau = bilanData.passif.capitauxPropres.find(l => l.code.startsWith('11'))
    const resultat = bilanData.passif.capitauxPropres.find(l => l.code.startsWith('12'))

    const dettesFournisseurs = bilanData.passif.dettes.filter(l => l.code.startsWith('401') || l.code.startsWith('40'))
    const dettesFiscales = bilanData.passif.dettes.filter(l => l.code.startsWith('43') || l.code.startsWith('44'))
    const autresDettes = bilanData.passif.dettes.filter(l =>
      !l.code.startsWith('40') && !l.code.startsWith('43') && !l.code.startsWith('44') && !l.code.startsWith('16')
    )

    return (
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr style={{ backgroundColor: '#F8F9FA' }}>
            <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#141A1F' }}>Postes</th>
            <th className="px-4 py-3 text-right text-sm font-semibold w-36" style={{ color: '#141A1F' }}>{endDateFormatted}</th>
          </tr>
        </thead>
        <tbody>
          {/* Capital */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7' }}>
            <td className="px-4 py-2.5 text-sm font-medium" style={{ color: '#141A1F' }}>Capital</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: capital?.amount ? '#141A1F' : '#9CA3AF' }}>{formatNumber(capital?.amount || 0)}</td>
          </tr>
          {capital?.children?.map(child => (
            <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
              <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
              <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
            </tr>
          ))}
          {capital && !capital.children && capital.amount !== 0 && (
            <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
              <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{capital.code} - {capital.label}</td>
              <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(capital.amount)}</td>
            </tr>
          )}

          {/* Primes */}
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Primes d'émission, de fusion, d'apport</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Écarts de réévaluation</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Écarts d'équivalence</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Réserves */}
          <tr className="border-t" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFBFC' }}>
            <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#141A1F' }}>Réserves</td>
            <td></td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Réserve légale</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Réserves statutaires ou contractuelles</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Réserves réglementées</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Réserves indisponibles</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2 text-sm pl-8" style={{ color: '#141A1F' }}>Autres réserves</td>
            <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Report à nouveau */}
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Report à nouveau</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: reportNouveau?.amount ? '#141A1F' : '#9CA3AF' }}>{formatNumber(reportNouveau?.amount || 0)}</td>
          </tr>

          {/* Résultat de l'exercice */}
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Résultat de l'exercice</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: resultat?.amount ? '#141A1F' : '#9CA3AF' }}>{formatNumber(resultat?.amount || 0)}</td>
          </tr>

          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Subventions d'investissement</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Provisions réglementées</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Total capitaux propres */}
          <tr style={{ backgroundColor: '#E6F0F0' }}>
            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#006666' }}>Total capitaux propres (I)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>{formatNumber(totalCapitaux)}</td>
          </tr>

          {/* Autres fonds propres */}
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Produit des émissions de titres participatifs</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Avances conditionnées</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr style={{ backgroundColor: '#E6F0F0' }}>
            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#006666' }}>Total autres fonds propres (I bis)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>0,00</td>
          </tr>

          {/* Provisions */}
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Provisions pour risques</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Provisions pour charges</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr style={{ backgroundColor: '#E6F0F0' }}>
            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#006666' }}>TOTAL PROVISIONS (II)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>{formatNumber(totalProvisions)}</td>
          </tr>

          {/* Emprunts */}
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Emprunts obligataires convertibles</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Autres emprunts obligataires</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Emprunts et dettes auprès des établissements de crédit</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Emprunts et dettes financières diverses</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>
          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Avances et acomptes reçus sur commandes en cours</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Dettes fournisseurs */}
          {(() => {
            const fournTotal = dettesFournisseurs.reduce((sum, l) => sum + l.amount, 0)
            return (
              <>
                <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Dettes fournisseurs et comptes rattachés</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: fournTotal !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(fournTotal)}</td>
                </tr>
                {dettesFournisseurs.map(line => {
                  if (line.children && line.children.length > 0) {
                    return line.children.map(child => (
                      <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                      </tr>
                    ))
                  } else if (line.amount !== 0) {
                    return (
                      <tr key={line.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{line.code} - {line.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                      </tr>
                    )
                  }
                  return null
                })}
              </>
            )
          })()}

          {/* Dettes fiscales et sociales */}
          {(() => {
            const fiscTotal = dettesFiscales.reduce((sum, l) => sum + l.amount, 0)
            return (
              <>
                <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Dettes fiscales et sociales</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: fiscTotal !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(fiscTotal)}</td>
                </tr>
                {dettesFiscales.map(line => {
                  if (line.children && line.children.length > 0) {
                    return line.children.map(child => (
                      <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                      </tr>
                    ))
                  } else if (line.amount !== 0) {
                    return (
                      <tr key={line.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{line.code} - {line.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                      </tr>
                    )
                  }
                  return null
                })}
              </>
            )
          })()}

          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Dettes sur immobilisations et comptes rattachés</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Autres dettes */}
          {(() => {
            const autresTotal = autresDettes.reduce((sum, l) => sum + l.amount, 0)
            return (
              <>
                <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
                  <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Autres dettes</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: autresTotal !== 0 ? '#141A1F' : '#9CA3AF' }}>{formatNumber(autresTotal)}</td>
                </tr>
                {autresDettes.map(line => {
                  if (line.children && line.children.length > 0) {
                    return line.children.map(child => (
                      <tr key={child.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{child.code} - {child.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(child.amount)}</td>
                      </tr>
                    ))
                  } else if (line.amount !== 0) {
                    return (
                      <tr key={line.code} className="border-t" style={{ borderColor: '#F2F2F3' }}>
                        <td className="px-4 py-2 text-sm pl-8" style={{ color: '#6C767F' }}>{line.code} - {line.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm" style={{ color: '#6C767F' }}>{formatNumber(line.amount)}</td>
                      </tr>
                    )
                  }
                  return null
                })}
              </>
            )
          })()}

          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Produits constatés d'avance</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* Total dettes */}
          <tr style={{ backgroundColor: '#E6F0F0' }}>
            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#006666' }}>Total dettes (III)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold" style={{ color: '#006666' }}>{formatNumber(totalDettes)}</td>
          </tr>

          <tr className="border-t" style={{ borderColor: '#F2F2F3' }}>
            <td className="px-4 py-2.5 text-sm" style={{ color: '#141A1F' }}>Écarts de conversion - Passif (IV)</td>
            <td className="px-4 py-2.5 text-right font-mono text-sm" style={{ color: '#9CA3AF' }}>0,00</td>
          </tr>

          {/* TOTAL PASSIF */}
          <tr style={{ backgroundColor: '#006666' }}>
            <td className="px-4 py-3 text-sm font-bold text-white">Total passif (I + I bis + II + III + IV)</td>
            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">{formatNumber(bilanData.passif.totalPassif)}</td>
          </tr>
        </tbody>
      </table>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Bilan</h1>
            <span className="px-2 py-1 text-xs font-medium rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>Provisoire</span>

            {/* Period Selector with Navigation Arrows */}
            <div className="flex items-center gap-1">
              {/* Previous Period Arrow */}
              <button
                onClick={() => {
                  const currentIndex = periodOptions.findIndex(p => p.value === selectedPeriod)
                  if (currentIndex < periodOptions.length - 1) {
                    setSelectedPeriod(periodOptions[currentIndex + 1].value)
                  }
                }}
                className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                style={{ borderColor: '#E4E5E7', color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Period Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowPeriodDropdown(!showPeriodDropdown)
                    setShowCompareDropdown(false)
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium"
                  style={{ borderColor: '#006666', color: 'white', backgroundColor: '#006666' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {selectedPeriod === 'custom' ? `Exercice ${customStartDate.getFullYear()}-${customEndDate.getFullYear()}` : periodDisplayLabel}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

              {/* Period Dropdown Menu */}
              {showPeriodDropdown && (
                <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-50" style={{ borderColor: '#E4E5E7', minWidth: showCustomDates ? '580px' : (hoveredExercice ? '400px' : '220px') }}>
                  <div className="flex">
                    {/* Left side - Period list */}
                    <div className="py-2" style={{ minWidth: '220px' }}>
                      {periodOptions.map(period => (
                        <div
                          key={period.value}
                          className="relative"
                          onMouseEnter={() => {
                            if (!showCustomDates) setHoveredExercice(period.value)
                          }}
                        >
                          <button
                            onClick={() => handlePeriodSelect(period.value)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                            style={{
                              color: selectedPeriod === period.value ? '#006666' : '#141A1F',
                              backgroundColor: hoveredExercice === period.value ? '#F0F7F7' : (selectedPeriod === period.value ? '#F0F7F7' : 'transparent')
                            }}
                          >
                            <span>{period.label}</span>
                            <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      <div className="border-t my-2" style={{ borderColor: '#E4E5E7' }} />

                      <button
                        onClick={() => handlePeriodSelect('custom')}
                        onMouseEnter={() => setHoveredExercice(null)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                        style={{
                          color: selectedPeriod === 'custom' ? '#006666' : '#141A1F',
                          backgroundColor: showCustomDates ? '#F0F7F7' : 'transparent'
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Dates personnalisées
                      </button>

                      <div className="border-t my-2" style={{ borderColor: '#E4E5E7' }} />

                      <button
                        onClick={() => {
                          setShowPeriodDropdown(false)
                          onNavigate?.('informations-entreprise')
                        }}
                        onMouseEnter={() => setHoveredExercice(null)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                        style={{ color: '#141A1F' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Paramètres
                      </button>
                    </div>

                    {/* Middle - Months submenu (when hovering an exercise) */}
                    {hoveredExercice && !showCustomDates && (
                      <div
                        className="border-l py-2 overflow-y-auto"
                        style={{ borderColor: '#E4E5E7', minWidth: '160px', maxHeight: '350px' }}
                        onMouseLeave={() => setHoveredExercice(null)}
                      >
                        <button
                          onClick={() => {
                            handlePeriodSelect(hoveredExercice)
                            setHoveredExercice(null)
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors font-medium"
                          style={{ color: '#141A1F' }}
                        >
                          Exercice complet
                        </button>
                        {getExerciceMonths(hoveredExercice).map((month, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              // For now, just select the exercise - month filtering can be added later
                              handlePeriodSelect(hoveredExercice)
                              setHoveredExercice(null)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                            style={{ color: '#141A1F' }}
                          >
                            {month.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Right side - Calendar (only if custom dates selected) */}
                    {showCustomDates && (
                      <div className="border-l p-4" style={{ borderColor: '#E4E5E7', minWidth: '340px' }}>
                        {/* Date inputs */}
                        <div className="flex gap-3 mb-4">
                          <input
                            type="text"
                            value={tempStartDate}
                            onChange={(e) => setTempStartDate(e.target.value)}
                            onClick={() => setSelectingDate('start')}
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                            style={{
                              borderColor: selectingDate === 'start' ? '#006666' : '#E4E5E7',
                              backgroundColor: selectingDate === 'start' ? '#F0F7F7' : 'white'
                            }}
                            placeholder="JJ/MM/AAAA"
                          />
                          <input
                            type="text"
                            value={tempEndDate}
                            onChange={(e) => setTempEndDate(e.target.value)}
                            onClick={() => setSelectingDate('end')}
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                            style={{
                              borderColor: selectingDate === 'end' ? '#006666' : '#E4E5E7',
                              backgroundColor: selectingDate === 'end' ? '#F0F7F7' : 'white'
                            }}
                            placeholder="JJ/MM/AAAA"
                          />
                        </div>

                        {/* Month/Year navigation */}
                        <div className="flex items-center justify-between mb-3">
                          <button
                            onClick={() => {
                              if (calendarMonth === 0) {
                                setCalendarMonth(11)
                                setCalendarYear(calendarYear - 1)
                              } else {
                                setCalendarMonth(calendarMonth - 1)
                              }
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100"
                            style={{ color: '#006666' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>

                          <div className="flex items-center gap-2">
                            <select
                              value={calendarMonth}
                              onChange={(e) => setCalendarMonth(parseInt(e.target.value))}
                              className="px-2 py-1 border rounded text-sm"
                              style={{ borderColor: '#E4E5E7' }}
                            >
                              {MONTHS_FR.map((month, idx) => (
                                <option key={month} value={idx}>{month}</option>
                              ))}
                            </select>
                            <select
                              value={calendarYear}
                              onChange={(e) => setCalendarYear(parseInt(e.target.value))}
                              className="px-2 py-1 border rounded text-sm"
                              style={{ borderColor: '#E4E5E7' }}
                            >
                              {Array.from({ length: 10 }, (_, i) => 2020 + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={() => {
                              if (calendarMonth === 11) {
                                setCalendarMonth(0)
                                setCalendarYear(calendarYear + 1)
                              } else {
                                setCalendarMonth(calendarMonth + 1)
                              }
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100"
                            style={{ color: '#006666' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>

                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1 mb-4">
                          {/* Day headers */}
                          {DAYS_FR.map(day => (
                            <div key={day} className="text-center text-xs font-medium py-1" style={{ color: '#6C767F' }}>
                              {day}
                            </div>
                          ))}

                          {/* Calendar days */}
                          {generateCalendarDays().map((day, idx) => {
                            const inRange = isDateInRange(day.day, day.month, day.year)
                            const isSelected = isDateSelected(day.day, day.month, day.year)
                            const isWeekend = idx % 7 >= 5

                            return (
                              <button
                                key={idx}
                                onClick={() => handleDateClick(day.day, day.month, day.year)}
                                className="p-2 text-sm rounded-lg transition-colors"
                                style={{
                                  color: !day.isCurrentMonth ? '#D1D5DB' : isWeekend ? '#006666' : '#141A1F',
                                  backgroundColor: isSelected ? '#006666' : inRange ? '#E6F0F0' : 'transparent',
                                  fontWeight: isSelected ? 600 : 400,
                                }}
                              >
                                <span style={{ color: isSelected ? 'white' : undefined }}>{day.day}</span>
                              </button>
                            )
                          })}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowCustomDates(false)
                              setTempStartDate(formatDateFR(customStartDate))
                              setTempEndDate(formatDateFR(customEndDate))
                            }}
                            className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium"
                            style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                          >
                            Annuler
                          </button>
                          <button
                            onClick={handleApplyCustomDates}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: '#006666' }}
                          >
                            Appliquer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>

              {/* Next Period Arrow */}
              <button
                onClick={() => {
                  const currentIndex = periodOptions.findIndex(p => p.value === selectedPeriod)
                  if (currentIndex > 0) {
                    setSelectedPeriod(periodOptions[currentIndex - 1].value)
                  }
                }}
                className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                style={{ borderColor: '#E4E5E7', color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Compare with section */}
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: '#141A1F' }}>Comparer avec :</span>

              {/* Previous month arrow */}
              {comparePeriod && (
                <button
                  onClick={() => {
                    // Navigate to previous month
                    const [year, month] = comparePeriod.split('-').map(Number)
                    if (month && year) {
                      const newMonth = month === 1 ? 12 : month - 1
                      const newYear = month === 1 ? year - 1 : year
                      const monthName = MONTHS_FR[newMonth - 1]
                      setComparePeriod(`${newYear}-${String(newMonth).padStart(2, '0')}`)
                      setComparePeriodLabel(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${newYear}`)
                    }
                  }}
                  className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ borderColor: '#E4E5E7', color: '#006666' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => {
                    setShowCompareDropdown(!showCompareDropdown)
                    setShowPeriodDropdown(false)
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium"
                  style={{
                    borderColor: comparePeriod ? '#006666' : '#E4E5E7',
                    color: comparePeriod ? '#006666' : '#6C767F',
                    backgroundColor: 'white'
                  }}
                >
                  {comparePeriodDisplayLabel}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Compare Dropdown Menu */}
                {showCompareDropdown && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-50" style={{ borderColor: '#E4E5E7', minWidth: hoveredCompareExercice ? '400px' : '220px' }}>
                    <div className="flex">
                      {/* Left side - Period list */}
                      <div className="py-2" style={{ minWidth: '220px' }}>
                        {periodOptions.map(period => (
                          <div
                            key={period.value}
                            className="relative"
                            onMouseEnter={() => setHoveredCompareExercice(period.value)}
                          >
                            <button
                              onClick={() => {
                                setComparePeriod(period.value)
                                setComparePeriodLabel(period.label)
                                setShowCompareDropdown(false)
                                setHoveredCompareExercice(null)
                              }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                              style={{
                                color: comparePeriod === period.value ? '#006666' : '#141A1F',
                                backgroundColor: hoveredCompareExercice === period.value ? '#F0F7F7' : (comparePeriod === period.value ? '#F0F7F7' : 'transparent')
                              }}
                            >
                              <span>{period.label}</span>
                              <svg className="w-4 h-4" style={{ color: '#9CA3AF' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        <div className="border-t my-2" style={{ borderColor: '#E4E5E7' }} />

                        <button
                          onMouseEnter={() => setHoveredCompareExercice(null)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                          style={{ color: '#141A1F' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Dates personnalisées
                        </button>

                        {/* Effacer button */}
                        <button
                          onClick={() => {
                            setComparePeriod(null)
                            setComparePeriodLabel(null)
                            setShowCompareDropdown(false)
                            setHoveredCompareExercice(null)
                          }}
                          onMouseEnter={() => setHoveredCompareExercice(null)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                          style={{ color: '#DC2626' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Effacer
                        </button>

                        <div className="border-t my-2" style={{ borderColor: '#E4E5E7' }} />

                        <button
                          onClick={() => {
                            setShowCompareDropdown(false)
                            onNavigate?.('informations-entreprise')
                          }}
                          onMouseEnter={() => setHoveredCompareExercice(null)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                          style={{ color: '#141A1F' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Paramètres
                        </button>
                      </div>

                      {/* Right side - Months submenu */}
                      {hoveredCompareExercice && (
                        <div
                          className="border-l py-2 overflow-y-auto"
                          style={{ borderColor: '#E4E5E7', minWidth: '160px', maxHeight: '350px' }}
                          onMouseLeave={() => setHoveredCompareExercice(null)}
                        >
                          <button
                            onClick={() => {
                              const period = periodOptions.find(p => p.value === hoveredCompareExercice)
                              setComparePeriod(hoveredCompareExercice)
                              setComparePeriodLabel(period?.label || null)
                              setShowCompareDropdown(false)
                              setHoveredCompareExercice(null)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors font-medium"
                            style={{ color: '#141A1F' }}
                          >
                            Exercice complet
                          </button>
                          {getExerciceMonths(hoveredCompareExercice).map((month, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setComparePeriod(month.value)
                                setComparePeriodLabel(month.label)
                                setShowCompareDropdown(false)
                                setHoveredCompareExercice(null)
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                              style={{ color: '#141A1F' }}
                            >
                              {month.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Next month arrow */}
              {comparePeriod && (
                <button
                  onClick={() => {
                    // Navigate to next month
                    const [year, month] = comparePeriod.split('-').map(Number)
                    if (month && year) {
                      const newMonth = month === 12 ? 1 : month + 1
                      const newYear = month === 12 ? year + 1 : year
                      const monthName = MONTHS_FR[newMonth - 1]
                      setComparePeriod(`${newYear}-${String(newMonth).padStart(2, '0')}`)
                      setComparePeriodLabel(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${newYear}`)
                    }
                  }}
                  className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ borderColor: '#E4E5E7', color: '#006666' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting || !bilanData}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50"
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
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    <span>📊</span> Excel (.csv)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      {bilanData && (
        <div className="px-6 py-4 border-b bg-white" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex gap-6">
            <div
              className="flex-1 px-5 py-4 rounded-lg border cursor-pointer transition-colors"
              style={{ borderColor: activeTab === 'actif' ? '#006666' : '#E4E5E7', backgroundColor: activeTab === 'actif' ? '#F0F7F7' : 'white' }}
              onClick={() => setActiveTab('actif')}
            >
              <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Actif</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#141A1F' }}>{formatNumber(bilanData.actif.totalActif)} €</p>
            </div>
            <div
              className="flex-1 px-5 py-4 rounded-lg border cursor-pointer transition-colors"
              style={{ borderColor: activeTab === 'passif' ? '#006666' : '#E4E5E7', backgroundColor: activeTab === 'passif' ? '#F0F7F7' : 'white' }}
              onClick={() => setActiveTab('passif')}
            >
              <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Passif</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#141A1F' }}>{formatNumber(bilanData.passif.totalPassif)} €</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {showInfoBanner && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg border flex items-start justify-between" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5" style={{ color: '#3B82F6' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: '#1E40AF' }}>États financiers dynamiques</p>
              <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>Les données sont calculées en temps réel à partir de vos écritures comptables.</p>
            </div>
          </div>
          <button onClick={() => setShowInfoBanner(false)} className="p-1 hover:bg-blue-100 rounded">
            <svg className="w-4 h-4" style={{ color: '#3B82F6' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Balance Warning */}
      {bilanData && !isBalanced && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg border" style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#92400E' }}>
              Attention: Le bilan n'est pas équilibré. Écart de {formatNumber(Math.abs(bilanData.actif.totalActif - bilanData.passif.totalPassif))} €
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 pt-4 flex border-b" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => setActiveTab('actif')}
          className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          style={{ borderColor: activeTab === 'actif' ? '#006666' : 'transparent', color: activeTab === 'actif' ? '#006666' : '#6C767F' }}
        >
          Actif
        </button>
        <button
          onClick={() => setActiveTab('passif')}
          className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          style={{ borderColor: activeTab === 'passif' ? '#006666' : 'transparent', color: activeTab === 'passif' ? '#006666' : '#6C767F' }}
        >
          Passif
        </button>
      </div>

      {/* Content Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: '#C62828' }}>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: '#006666', color: 'white' }}>
              Recharger
            </button>
          </div>
        ) : (bilanData || bilanStructured) ? (
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
            {useStructuredView && bilanStructured ? (
              activeTab === 'actif' ? renderActifTableStructured() : renderPassifTableStructured()
            ) : (
              activeTab === 'actif' ? renderActifTable() : renderPassifTable()
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: '#6C767F' }}>Aucune donnée disponible</p>
          </div>
        )}
      </div>

      {/* Backdrop for dropdowns */}
      {showExportDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />}
      {showPeriodDropdown && <div className="fixed inset-0 z-40" onClick={() => { setShowPeriodDropdown(false); setShowCustomDates(false) }} />}
    </div>
  )
}
