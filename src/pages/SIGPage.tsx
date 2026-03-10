import { useState, useEffect, useMemo } from 'react'
import { calculateSIG, type SIGData, type DateRange } from '../services/analyseFinanciereService'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

// ============ Types ============

type PeriodType = 'fiscal' | 'custom'

interface SIGLineData {
  key: string
  label: string
  valueN: number
  valueN1: number | null
  percentCA_N: number
  percentCA_N1: number | null
  variation: number | null
  isTotal: boolean
  isSubItem: boolean
  isNegative?: boolean // For display of charges (subtractions)
}

// ============ Formatters ============

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatPercent = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'auto',
  }).format(value / 100)
}

const formatPercentChange = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value / 100)
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ============ Icons ============

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)

// ============ Component ============

interface SIGPageProps {
  onNavigate?: (page: string) => void
}

export default function SIGPage({ onNavigate: _onNavigate }: SIGPageProps) {
  // Period selection
  const [periodType, setPeriodType] = useState<PeriodType>('fiscal')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Comparison N-1
  const [showComparison, setShowComparison] = useState(true)

  // Data state
  const [sigDataN, setSigDataN] = useState<SIGData | null>(null)
  const [sigDataN1, setSigDataN1] = useState<SIGData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Year options (last 5 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - i)
  }, [])

  // Get period dates based on selection
  const getPeriodDates = (year: number): DateRange => {
    if (periodType === 'fiscal') {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        label: `Exercice ${year}`,
      }
    } else {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        label: `Du ${formatDate(customStartDate)} au ${formatDate(customEndDate)}`,
      }
    }
  }

  // Get previous period dates
  const getPreviousPeriodDates = (currentPeriod: DateRange): DateRange => {
    const startYear = parseInt(currentPeriod.startDate.substring(0, 4)) - 1
    const endYear = parseInt(currentPeriod.endDate.substring(0, 4)) - 1
    return {
      startDate: `${startYear}${currentPeriod.startDate.substring(4)}`,
      endDate: `${endYear}${currentPeriod.endDate.substring(4)}`,
      label: periodType === 'fiscal' ? `Exercice ${startYear}` : 'N-1',
    }
  }

  // Load data
  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const currentPeriod = getPeriodDates(selectedYear)

      if (!currentPeriod.startDate || !currentPeriod.endDate) {
        throw new Error('Veuillez selectionner une periode valide')
      }

      // Load current year data
      const dataN = await calculateSIG(currentPeriod.startDate, currentPeriod.endDate)
      setSigDataN(dataN)

      // Load N-1 data if comparison is enabled
      if (showComparison) {
        const prevPeriod = getPreviousPeriodDates(currentPeriod)
        try {
          const dataN1 = await calculateSIG(prevPeriod.startDate, prevPeriod.endDate)
          setSigDataN1(dataN1)
        } catch {
          console.warn('Donnees N-1 non disponibles')
          setSigDataN1(null)
        }
      } else {
        setSigDataN1(null)
      }
    } catch (err) {
      console.error('Error loading SIG:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des donnees')
    } finally {
      setLoading(false)
    }
  }

  // Load on mount and when period changes
  useEffect(() => {
    if (periodType === 'fiscal' || (customStartDate && customEndDate)) {
      loadData()
    }
  }, [selectedYear, periodType, showComparison])

  // Calculate CA (Chiffre d'Affaires) for percentage calculations
  const calculateCA = (sig: SIGData): number => {
    // CA = Production vendue (services/marchandises) = 70 accounts
    return sig.margeCommerciale.ventesMarchandises + sig.productionExercice.productionVendue
  }

  // Transform SIG data for display
  const sigTableData = useMemo((): SIGLineData[] => {
    if (!sigDataN) return []

    const caN = calculateCA(sigDataN)
    const caN1 = sigDataN1 ? calculateCA(sigDataN1) : null

    const calcPercent = (value: number, ca: number): number => {
      return ca !== 0 ? (value / ca) * 100 : 0
    }

    const calcVariation = (valueN: number, valueN1: number | null): number | null => {
      if (valueN1 === null || valueN1 === 0) return null
      return ((valueN - valueN1) / Math.abs(valueN1)) * 100
    }

    const lines: SIGLineData[] = []

    // 1. Marge Commerciale
    lines.push({
      key: 'mc-ventes',
      label: 'Ventes de marchandises (707)',
      valueN: sigDataN.margeCommerciale.ventesMarchandises,
      valueN1: sigDataN1?.margeCommerciale.ventesMarchandises ?? null,
      percentCA_N: calcPercent(sigDataN.margeCommerciale.ventesMarchandises, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.margeCommerciale.ventesMarchandises ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.margeCommerciale.ventesMarchandises, sigDataN1?.margeCommerciale.ventesMarchandises ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 'mc-achats',
      label: 'Achats de marchandises (607)',
      valueN: -sigDataN.margeCommerciale.achatsMarchandises,
      valueN1: sigDataN1 ? -sigDataN1.margeCommerciale.achatsMarchandises : null,
      percentCA_N: calcPercent(-sigDataN.margeCommerciale.achatsMarchandises, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.margeCommerciale.achatsMarchandises ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.margeCommerciale.achatsMarchandises, sigDataN1?.margeCommerciale.achatsMarchandises ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'mc-total',
      label: '1. MARGE COMMERCIALE',
      valueN: sigDataN.margeCommerciale.total,
      valueN1: sigDataN1?.margeCommerciale.total ?? null,
      percentCA_N: calcPercent(sigDataN.margeCommerciale.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.margeCommerciale.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.margeCommerciale.total, sigDataN1?.margeCommerciale.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    // 2. Production de l'exercice
    lines.push({
      key: 'pe-vendue',
      label: 'Production vendue (70 sauf 707)',
      valueN: sigDataN.productionExercice.productionVendue,
      valueN1: sigDataN1?.productionExercice.productionVendue ?? null,
      percentCA_N: calcPercent(sigDataN.productionExercice.productionVendue, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.productionExercice.productionVendue ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.productionExercice.productionVendue, sigDataN1?.productionExercice.productionVendue ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 'pe-stockee',
      label: 'Production stockee (71)',
      valueN: sigDataN.productionExercice.productionStockee,
      valueN1: sigDataN1?.productionExercice.productionStockee ?? null,
      percentCA_N: calcPercent(sigDataN.productionExercice.productionStockee, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.productionExercice.productionStockee ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.productionExercice.productionStockee, sigDataN1?.productionExercice.productionStockee ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 'pe-immo',
      label: 'Production immobilisee (72)',
      valueN: sigDataN.productionExercice.productionImmobilisee,
      valueN1: sigDataN1?.productionExercice.productionImmobilisee ?? null,
      percentCA_N: calcPercent(sigDataN.productionExercice.productionImmobilisee, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.productionExercice.productionImmobilisee ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.productionExercice.productionImmobilisee, sigDataN1?.productionExercice.productionImmobilisee ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 'pe-total',
      label: '2. PRODUCTION DE L\'EXERCICE',
      valueN: sigDataN.productionExercice.total,
      valueN1: sigDataN1?.productionExercice.total ?? null,
      percentCA_N: calcPercent(sigDataN.productionExercice.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.productionExercice.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.productionExercice.total, sigDataN1?.productionExercice.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    // 3. Valeur Ajoutee
    lines.push({
      key: 'va-conso',
      label: 'Consommations en provenance des tiers (60-62)',
      valueN: -sigDataN.valeurAjoutee.consommationsExternes,
      valueN1: sigDataN1 ? -sigDataN1.valeurAjoutee.consommationsExternes : null,
      percentCA_N: calcPercent(-sigDataN.valeurAjoutee.consommationsExternes, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.valeurAjoutee.consommationsExternes ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.valeurAjoutee.consommationsExternes, sigDataN1?.valeurAjoutee.consommationsExternes ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'va-total',
      label: '3. VALEUR AJOUTEE',
      valueN: sigDataN.valeurAjoutee.total,
      valueN1: sigDataN1?.valeurAjoutee.total ?? null,
      percentCA_N: calcPercent(sigDataN.valeurAjoutee.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.valeurAjoutee.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.valeurAjoutee.total, sigDataN1?.valeurAjoutee.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    // 4. EBE
    lines.push({
      key: 'ebe-subv',
      label: 'Subventions d\'exploitation (74)',
      valueN: sigDataN.excedentBrutExploitation.subventionsExploitation,
      valueN1: sigDataN1?.excedentBrutExploitation.subventionsExploitation ?? null,
      percentCA_N: calcPercent(sigDataN.excedentBrutExploitation.subventionsExploitation, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.excedentBrutExploitation.subventionsExploitation ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.excedentBrutExploitation.subventionsExploitation, sigDataN1?.excedentBrutExploitation.subventionsExploitation ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 'ebe-impots',
      label: 'Impots, taxes et versements assimiles (63)',
      valueN: -sigDataN.excedentBrutExploitation.impotsTaxes,
      valueN1: sigDataN1 ? -sigDataN1.excedentBrutExploitation.impotsTaxes : null,
      percentCA_N: calcPercent(-sigDataN.excedentBrutExploitation.impotsTaxes, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.excedentBrutExploitation.impotsTaxes ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.excedentBrutExploitation.impotsTaxes, sigDataN1?.excedentBrutExploitation.impotsTaxes ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'ebe-personnel',
      label: 'Charges de personnel (64)',
      valueN: -sigDataN.excedentBrutExploitation.chargesPersonnel,
      valueN1: sigDataN1 ? -sigDataN1.excedentBrutExploitation.chargesPersonnel : null,
      percentCA_N: calcPercent(-sigDataN.excedentBrutExploitation.chargesPersonnel, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.excedentBrutExploitation.chargesPersonnel ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.excedentBrutExploitation.chargesPersonnel, sigDataN1?.excedentBrutExploitation.chargesPersonnel ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'ebe-total',
      label: '4. EXCEDENT BRUT D\'EXPLOITATION (EBE)',
      valueN: sigDataN.excedentBrutExploitation.total,
      valueN1: sigDataN1?.excedentBrutExploitation.total ?? null,
      percentCA_N: calcPercent(sigDataN.excedentBrutExploitation.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.excedentBrutExploitation.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.excedentBrutExploitation.total, sigDataN1?.excedentBrutExploitation.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    // 5. Resultat d'exploitation
    lines.push({
      key: 're-autres-produits',
      label: 'Autres produits (75, 781, 791)',
      valueN: sigDataN.resultatExploitation.autresProduits,
      valueN1: sigDataN1?.resultatExploitation.autresProduits ?? null,
      percentCA_N: calcPercent(sigDataN.resultatExploitation.autresProduits, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.resultatExploitation.autresProduits ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.resultatExploitation.autresProduits, sigDataN1?.resultatExploitation.autresProduits ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 're-autres-charges',
      label: 'Autres charges (65, 681)',
      valueN: -sigDataN.resultatExploitation.autresCharges,
      valueN1: sigDataN1 ? -sigDataN1.resultatExploitation.autresCharges : null,
      percentCA_N: calcPercent(-sigDataN.resultatExploitation.autresCharges, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.resultatExploitation.autresCharges ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.resultatExploitation.autresCharges, sigDataN1?.resultatExploitation.autresCharges ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 're-total',
      label: '5. RESULTAT D\'EXPLOITATION',
      valueN: sigDataN.resultatExploitation.total,
      valueN1: sigDataN1?.resultatExploitation.total ?? null,
      percentCA_N: calcPercent(sigDataN.resultatExploitation.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.resultatExploitation.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.resultatExploitation.total, sigDataN1?.resultatExploitation.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    // 6. Resultat courant avant impots
    lines.push({
      key: 'rcai-produits-fi',
      label: 'Produits financiers (76, 786, 796)',
      valueN: sigDataN.resultatCourantAvantImpots.produitsFinanciers,
      valueN1: sigDataN1?.resultatCourantAvantImpots.produitsFinanciers ?? null,
      percentCA_N: calcPercent(sigDataN.resultatCourantAvantImpots.produitsFinanciers, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.resultatCourantAvantImpots.produitsFinanciers ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.resultatCourantAvantImpots.produitsFinanciers, sigDataN1?.resultatCourantAvantImpots.produitsFinanciers ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 'rcai-charges-fi',
      label: 'Charges financieres (66, 686)',
      valueN: -sigDataN.resultatCourantAvantImpots.chargesFinancieres,
      valueN1: sigDataN1 ? -sigDataN1.resultatCourantAvantImpots.chargesFinancieres : null,
      percentCA_N: calcPercent(-sigDataN.resultatCourantAvantImpots.chargesFinancieres, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.resultatCourantAvantImpots.chargesFinancieres ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.resultatCourantAvantImpots.chargesFinancieres, sigDataN1?.resultatCourantAvantImpots.chargesFinancieres ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'rcai-total',
      label: '6. RESULTAT COURANT AVANT IMPOTS (RCAI)',
      valueN: sigDataN.resultatCourantAvantImpots.total,
      valueN1: sigDataN1?.resultatCourantAvantImpots.total ?? null,
      percentCA_N: calcPercent(sigDataN.resultatCourantAvantImpots.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.resultatCourantAvantImpots.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.resultatCourantAvantImpots.total, sigDataN1?.resultatCourantAvantImpots.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    // 7. Resultat exceptionnel
    lines.push({
      key: 'rex-produits',
      label: 'Produits exceptionnels (77, 787, 797)',
      valueN: sigDataN.resultatExceptionnel.produitsExceptionnels,
      valueN1: sigDataN1?.resultatExceptionnel.produitsExceptionnels ?? null,
      percentCA_N: calcPercent(sigDataN.resultatExceptionnel.produitsExceptionnels, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.resultatExceptionnel.produitsExceptionnels ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.resultatExceptionnel.produitsExceptionnels, sigDataN1?.resultatExceptionnel.produitsExceptionnels ?? null),
      isTotal: false,
      isSubItem: true,
    })
    lines.push({
      key: 'rex-charges',
      label: 'Charges exceptionnelles (67, 687)',
      valueN: -sigDataN.resultatExceptionnel.chargesExceptionnelles,
      valueN1: sigDataN1 ? -sigDataN1.resultatExceptionnel.chargesExceptionnelles : null,
      percentCA_N: calcPercent(-sigDataN.resultatExceptionnel.chargesExceptionnelles, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.resultatExceptionnel.chargesExceptionnelles ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.resultatExceptionnel.chargesExceptionnelles, sigDataN1?.resultatExceptionnel.chargesExceptionnelles ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'rex-total',
      label: '7. RESULTAT EXCEPTIONNEL',
      valueN: sigDataN.resultatExceptionnel.total,
      valueN1: sigDataN1?.resultatExceptionnel.total ?? null,
      percentCA_N: calcPercent(sigDataN.resultatExceptionnel.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.resultatExceptionnel.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.resultatExceptionnel.total, sigDataN1?.resultatExceptionnel.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    // 8. Resultat net
    lines.push({
      key: 'rn-impots',
      label: 'Impots sur les benefices (69)',
      valueN: -sigDataN.resultatNet.impotsBenefices,
      valueN1: sigDataN1 ? -sigDataN1.resultatNet.impotsBenefices : null,
      percentCA_N: calcPercent(-sigDataN.resultatNet.impotsBenefices, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.resultatNet.impotsBenefices ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.resultatNet.impotsBenefices, sigDataN1?.resultatNet.impotsBenefices ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'rn-participation',
      label: 'Participation des salaries (691)',
      valueN: -sigDataN.resultatNet.participationSalaries,
      valueN1: sigDataN1 ? -sigDataN1.resultatNet.participationSalaries : null,
      percentCA_N: calcPercent(-sigDataN.resultatNet.participationSalaries, caN),
      percentCA_N1: caN1 ? calcPercent(-(sigDataN1?.resultatNet.participationSalaries ?? 0), caN1) : null,
      variation: calcVariation(sigDataN.resultatNet.participationSalaries, sigDataN1?.resultatNet.participationSalaries ?? null),
      isTotal: false,
      isSubItem: true,
      isNegative: true,
    })
    lines.push({
      key: 'rn-total',
      label: '8. RESULTAT NET',
      valueN: sigDataN.resultatNet.total,
      valueN1: sigDataN1?.resultatNet.total ?? null,
      percentCA_N: calcPercent(sigDataN.resultatNet.total, caN),
      percentCA_N1: caN1 ? calcPercent(sigDataN1?.resultatNet.total ?? 0, caN1) : null,
      variation: calcVariation(sigDataN.resultatNet.total, sigDataN1?.resultatNet.total ?? null),
      isTotal: true,
      isSubItem: false,
    })

    return lines
  }, [sigDataN, sigDataN1])

  // Chart data (only totals)
  const chartData = useMemo(() => {
    if (!sigDataN) return []

    return [
      {
        name: 'Marge commerciale',
        valueN: sigDataN.margeCommerciale.total,
        valueN1: sigDataN1?.margeCommerciale.total ?? 0,
      },
      {
        name: 'Production exercice',
        valueN: sigDataN.productionExercice.total,
        valueN1: sigDataN1?.productionExercice.total ?? 0,
      },
      {
        name: 'Valeur ajoutee',
        valueN: sigDataN.valeurAjoutee.total,
        valueN1: sigDataN1?.valeurAjoutee.total ?? 0,
      },
      {
        name: 'EBE',
        valueN: sigDataN.excedentBrutExploitation.total,
        valueN1: sigDataN1?.excedentBrutExploitation.total ?? 0,
      },
      {
        name: 'Resultat exploitation',
        valueN: sigDataN.resultatExploitation.total,
        valueN1: sigDataN1?.resultatExploitation.total ?? 0,
      },
      {
        name: 'RCAI',
        valueN: sigDataN.resultatCourantAvantImpots.total,
        valueN1: sigDataN1?.resultatCourantAvantImpots.total ?? 0,
      },
      {
        name: 'Resultat exceptionnel',
        valueN: sigDataN.resultatExceptionnel.total,
        valueN1: sigDataN1?.resultatExceptionnel.total ?? 0,
      },
      {
        name: 'Resultat net',
        valueN: sigDataN.resultatNet.total,
        valueN1: sigDataN1?.resultatNet.total ?? 0,
      },
    ]
  }, [sigDataN, sigDataN1])

  // Export to PDF
  const handleExportPDF = async () => {
    if (!sigDataN) return

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
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Soldes Intermediaires de Gestion (SIG)', margin, 20)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const currentPeriod = getPeriodDates(selectedYear)
      doc.text(`Periode: du ${formatDate(currentPeriod.startDate)} au ${formatDate(currentPeriod.endDate)}`, margin, 28)

      const today = new Date().toLocaleDateString('fr-FR')
      doc.setFontSize(8)
      doc.text(`Edition le ${today}`, pageWidth - margin - 30, 20)

      // Table
      const headers = showComparison
        ? ['Solde', 'Exercice N', '% CA', 'Exercice N-1', '% CA', 'Variation']
        : ['Solde', 'Montant', '% du CA']

      const rows = sigTableData
        .filter(line => line.isTotal)
        .map(line => {
          if (showComparison) {
            return [
              line.label,
              formatNumber(line.valueN),
              formatPercent(line.percentCA_N),
              line.valueN1 !== null ? formatNumber(line.valueN1) : '-',
              line.percentCA_N1 !== null ? formatPercent(line.percentCA_N1) : '-',
              line.variation !== null ? formatPercentChange(line.variation) : '-',
            ]
          } else {
            return [
              line.label,
              formatNumber(line.valueN),
              formatPercent(line.percentCA_N),
            ]
          }
        })

      autoTable(doc, {
        startY: 40,
        head: [headers],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [87, 83, 78], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: showComparison
          ? {
              0: { cellWidth: 60 },
              1: { halign: 'right', cellWidth: 25 },
              2: { halign: 'right', cellWidth: 18 },
              3: { halign: 'right', cellWidth: 25 },
              4: { halign: 'right', cellWidth: 18 },
              5: { halign: 'right', cellWidth: 20 },
            }
          : {
              0: { cellWidth: 100 },
              1: { halign: 'right', cellWidth: 35 },
              2: { halign: 'right', cellWidth: 25 },
            },
        didParseCell: (cellData) => {
          // Highlight result net
          if (cellData.row.index === rows.length - 1) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.fillColor = [215, 211, 209]
          }
        },
      })

      // Save
      const filename = `sig_${currentPeriod.startDate}_${currentPeriod.endDate}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('Erreur export PDF:', err)
      throw new Error(`Erreur export PDF: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setExporting(false)
    }
  }

  // Export to CSV
  const handleExportCSV = async () => {
    if (!sigDataN) return

    setExporting(true)
    setShowExportDropdown(false)

    try {
      const currentPeriod = getPeriodDates(selectedYear)

      const headers = showComparison
        ? ['Solde', 'Exercice N', '% CA', 'Exercice N-1', '% CA', 'Variation']
        : ['Solde', 'Montant', '% du CA']

      const rows = sigTableData.map(line => {
        if (showComparison) {
          return [
            `"${line.label}"`,
            formatNumber(line.valueN).replace(/\s/g, ''),
            formatPercent(line.percentCA_N),
            line.valueN1 !== null ? formatNumber(line.valueN1).replace(/\s/g, '') : '',
            line.percentCA_N1 !== null ? formatPercent(line.percentCA_N1) : '',
            line.variation !== null ? formatPercentChange(line.variation) : '',
          ]
        } else {
          return [
            `"${line.label}"`,
            formatNumber(line.valueN).replace(/\s/g, ''),
            formatPercent(line.percentCA_N),
          ]
        }
      })

      const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n')

      // Download
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sig_${currentPeriod.startDate}_${currentPeriod.endDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export CSV error:', err)
      throw new Error(`Erreur export CSV: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
              Soldes Intermediaires de Gestion
            </h1>
            {periodType === 'fiscal' && (
              <span
                className="px-3 py-1 text-sm rounded-full"
                style={{ backgroundColor: '#F5F5F4', color: '#57534e' }}
              >
                Exercice {selectedYear}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting || !sigDataN}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
                style={{ borderColor: '#78716c', color: '#78716c' }}
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-stone-400/30 border-t-stone-600 rounded-full animate-spin" />
                ) : (
                  <DownloadIcon />
                )}
                Exporter
                <ChevronDownIcon />
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50 border-b"
                    style={{ borderColor: '#F2F2F3', color: '#141A1F' }}
                  >
                    PDF (.pdf)
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50"
                    style={{ color: '#141A1F' }}
                  >
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-6">
          {/* Period Type */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: '#6C767F' }}>Periode:</label>
            <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: '#D6D9DB' }}>
              <button
                onClick={() => setPeriodType('fiscal')}
                className={`px-3 py-1.5 text-sm ${periodType === 'fiscal' ? 'bg-stone-600 text-white' : 'bg-white text-stone-600'}`}
              >
                Exercice fiscal
              </button>
              <button
                onClick={() => setPeriodType('custom')}
                className={`px-3 py-1.5 text-sm border-l ${periodType === 'custom' ? 'bg-stone-600 text-white' : 'bg-white text-stone-600'}`}
                style={{ borderColor: '#D6D9DB' }}
              >
                Personnalise
              </button>
            </div>
          </div>

          {/* Year or Custom Dates */}
          {periodType === 'fiscal' ? (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{ color: '#6C767F' }}>Annee:</label>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1.5 pr-8 border rounded-lg appearance-none bg-white text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6C767F' }}>
                  <ChevronDownIcon />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium" style={{ color: '#6C767F' }}>Du:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium" style={{ color: '#6C767F' }}>Au:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <button
                onClick={loadData}
                disabled={!customStartDate || !customEndDate}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-50"
                style={{ backgroundColor: '#57534e' }}
              >
                <RefreshIcon />
                Charger
              </button>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Comparison Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
              className="rounded w-4 h-4"
              style={{ accentColor: '#57534e' }}
            />
            <span className="text-sm" style={{ color: '#141A1F' }}>Comparaison N / N-1</span>
          </label>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#78716c' }} />
          </div>
        ) : error ? (
          <div className="max-w-3xl mx-auto">
            <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}>
              {error}
            </div>
          </div>
        ) : sigDataN ? (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-sm font-medium" style={{ color: '#6C767F' }}>
                  Valeur Ajoutee
                </div>
                <div className="text-2xl font-semibold mt-1" style={{ color: '#57534e' }}>
                  {formatCurrency(sigDataN.valeurAjoutee.total)}
                </div>
                {showComparison && sigDataN1 && sigDataN1.valeurAjoutee.total !== 0 && (
                  <div className="text-xs mt-1" style={{
                    color: sigDataN.valeurAjoutee.total >= sigDataN1.valeurAjoutee.total ? '#57534e' : '#b91c1c'
                  }}>
                    {formatPercentChange(((sigDataN.valeurAjoutee.total - sigDataN1.valeurAjoutee.total) / Math.abs(sigDataN1.valeurAjoutee.total)) * 100)} vs N-1
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-sm font-medium" style={{ color: '#6C767F' }}>
                  EBE
                </div>
                <div className="text-2xl font-semibold mt-1" style={{
                  color: sigDataN.excedentBrutExploitation.total >= 0 ? '#57534e' : '#b91c1c'
                }}>
                  {formatCurrency(sigDataN.excedentBrutExploitation.total)}
                </div>
                {showComparison && sigDataN1 && sigDataN1.excedentBrutExploitation.total !== 0 && (
                  <div className="text-xs mt-1" style={{
                    color: sigDataN.excedentBrutExploitation.total >= sigDataN1.excedentBrutExploitation.total ? '#57534e' : '#b91c1c'
                  }}>
                    {formatPercentChange(((sigDataN.excedentBrutExploitation.total - sigDataN1.excedentBrutExploitation.total) / Math.abs(sigDataN1.excedentBrutExploitation.total)) * 100)} vs N-1
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
                <div className="text-sm font-medium" style={{ color: '#6C767F' }}>
                  Resultat Exploitation
                </div>
                <div className="text-2xl font-semibold mt-1" style={{
                  color: sigDataN.resultatExploitation.total >= 0 ? '#57534e' : '#b91c1c'
                }}>
                  {formatCurrency(sigDataN.resultatExploitation.total)}
                </div>
                {showComparison && sigDataN1 && sigDataN1.resultatExploitation.total !== 0 && (
                  <div className="text-xs mt-1" style={{
                    color: sigDataN.resultatExploitation.total >= sigDataN1.resultatExploitation.total ? '#57534e' : '#b91c1c'
                  }}>
                    {formatPercentChange(((sigDataN.resultatExploitation.total - sigDataN1.resultatExploitation.total) / Math.abs(sigDataN1.resultatExploitation.total)) * 100)} vs N-1
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border p-4" style={{ borderColor: sigDataN.resultatNet.total >= 0 ? '#E4E5E7' : '#FECACA' }}>
                <div className="text-sm font-medium" style={{ color: '#6C767F' }}>
                  Resultat Net
                </div>
                <div className="text-2xl font-bold mt-1" style={{
                  color: sigDataN.resultatNet.total >= 0 ? '#44403c' : '#b91c1c'
                }}>
                  {formatCurrency(sigDataN.resultatNet.total)}
                </div>
                {showComparison && sigDataN1 && sigDataN1.resultatNet.total !== 0 && (
                  <div className="text-xs mt-1" style={{
                    color: sigDataN.resultatNet.total >= sigDataN1.resultatNet.total ? '#57534e' : '#b91c1c'
                  }}>
                    {formatPercentChange(((sigDataN.resultatNet.total - sigDataN1.resultatNet.total) / Math.abs(sigDataN1.resultatNet.total)) * 100)} vs N-1
                  </div>
                )}
              </div>
            </div>

            {/* SIG Table */}
            <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                  Tableau des Soldes Intermediaires de Gestion
                </h2>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                      Solde
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                      Exercice N
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                      % CA
                    </th>
                    {showComparison && (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                          Exercice N-1
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                          % CA
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                          Variation
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sigTableData.map((line) => (
                    <tr
                      key={line.key}
                      className={`border-b ${line.isTotal ? 'bg-stone-50' : 'hover:bg-gray-50'}`}
                      style={{ borderColor: line.isTotal ? '#a8a29e' : '#F2F2F3' }}
                    >
                      <td className={`px-4 py-2.5 ${line.isSubItem ? 'pl-8' : ''}`}>
                        <span
                          className={`text-sm ${line.isTotal ? 'font-semibold' : ''}`}
                          style={{ color: line.isTotal ? '#44403c' : '#141A1F' }}
                        >
                          {line.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`text-sm font-mono ${line.isTotal ? 'font-semibold' : ''}`}
                          style={{ color: line.valueN >= 0 ? (line.isTotal ? '#44403c' : '#141A1F') : '#b91c1c' }}
                        >
                          {formatNumber(line.valueN)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-mono" style={{ color: '#6C767F' }}>
                          {formatPercent(line.percentCA_N)}
                        </span>
                      </td>
                      {showComparison && (
                        <>
                          <td className="px-4 py-2.5 text-right">
                            <span
                              className="text-sm font-mono"
                              style={{ color: line.valueN1 !== null ? (line.valueN1 >= 0 ? '#6C767F' : '#b91c1c') : '#D6D9DB' }}
                            >
                              {line.valueN1 !== null ? formatNumber(line.valueN1) : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-sm font-mono" style={{ color: '#9CA3AF' }}>
                              {line.percentCA_N1 !== null ? formatPercent(line.percentCA_N1) : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span
                              className={`text-sm font-mono ${line.isTotal ? 'font-semibold' : ''}`}
                              style={{
                                color: line.variation !== null
                                  ? (line.variation >= 0 ? '#57534e' : '#b91c1c')
                                  : '#D6D9DB'
                              }}
                            >
                              {line.variation !== null ? formatPercentChange(line.variation) : '-'}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
                Graphique des Soldes Intermediaires
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatNumber(value)}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={115}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #E4E5E7', borderRadius: '8px' }}
                  />
                  <Legend />
                  <ReferenceLine x={0} stroke="#a8a29e" strokeDasharray="3 3" />
                  <Bar dataKey="valueN" name="Exercice N" fill="#57534e" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-n-${index}`} fill={entry.valueN >= 0 ? '#57534e' : '#b91c1c'} />
                    ))}
                  </Bar>
                  {showComparison && sigDataN1 && (
                    <Bar dataKey="valueN1" name="Exercice N-1" fill="#a8a29e" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-n1-${index}`} fill={entry.valueN1 >= 0 ? '#a8a29e' : '#fca5a5'} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: '#6C767F' }}>
              Selectionnez une periode pour afficher les Soldes Intermediaires de Gestion
            </p>
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
