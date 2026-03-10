import { useState, useEffect } from 'react'
import { supabase, COMPANY_ID } from '../lib/supabase'

// ============ Types ============

interface AccountBalance {
  code: string
  label: string
  debit: number
  credit: number
  solde: number
  color?: string
}

interface SubCategory {
  label: string
  amount: number
  color?: string
}

interface CompteResultatLine {
  label: string
  amount: number
  isHeader?: boolean
  isSubtotal?: boolean
  isTotal?: boolean
  isResult?: boolean
  indent?: number
  children?: CompteResultatLine[]
  expanded?: boolean
  subCategories?: SubCategory[]
  accountPrefixes?: string[]
}

interface CompteResultatData {
  produitsExploitation: CompteResultatLine[]
  totalProduitsExploitation: number
  chargesExploitation: CompteResultatLine[]
  totalChargesExploitation: number
  resultatExploitation: number

  quotesPartBenefice: number
  quotesPartPerte: number

  produitsFinanciers: CompteResultatLine[]
  totalProduitsFinanciers: number
  chargesFinancieres: CompteResultatLine[]
  totalChargesFinancieres: number
  resultatFinancier: number

  resultatCourantAvantImpot: number

  produitsExceptionnels: CompteResultatLine[]
  totalProduitsExceptionnels: number
  chargesExceptionnelles: CompteResultatLine[]
  totalChargesExceptionnelles: number
  resultatExceptionnel: number

  participationSalaries: number
  impotsBenefices: number

  totalProduits: number
  totalCharges: number
  resultatExercice: number
}

// ============ Formatters ============

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ============ Icons ============

const ChevronDownIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const ChevronRightIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

const InfoIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
)

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)

const SparklesIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
)

const TagIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
  </svg>
)

const TableIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
  </svg>
)

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

// ============ Exercise Types ============

interface ExerciceType {
  id: string
  label: string
  year: number
  isMultiYear?: boolean
  startMonth?: number
  endYear?: number
}

const exercices: ExerciceType[] = [
  { id: '2028', label: 'Exercice 2028', year: 2028 },
  { id: '2027', label: 'Exercice 2027', year: 2027 },
  { id: '2026', label: 'Exercice 2026', year: 2026 },
  { id: '2025', label: 'Exercice 2025', year: 2025 },
  { id: '2024-2025', label: 'Exercice 2024-2025', year: 2024, isMultiYear: true, startMonth: 3, endYear: 2025 },
]

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const getExerciceMonths = (exercice: ExerciceType): { month: number; year: number; label: string }[] => {
  const months: { month: number; year: number; label: string }[] = []

  if (exercice.isMultiYear && exercice.endYear) {
    const startMonth = exercice.startMonth || 0
    for (let m = startMonth; m < 12; m++) {
      months.push({ month: m, year: exercice.year, label: `${monthNames[m]} ${exercice.year}` })
    }
    for (let m = 0; m < 12; m++) {
      months.push({ month: m, year: exercice.endYear, label: `${monthNames[m]} ${exercice.endYear}` })
    }
  } else {
    for (let m = 0; m < 12; m++) {
      months.push({ month: m, year: exercice.year, label: `${monthNames[m]} ${exercice.year}` })
    }
  }

  return months
}

// ============ Data Loading ============

// Find the best label for an account code using prefix matching
function findLabelForCode(code: string, labelMap: Map<string, string>): string {
  // 1. Exact match
  if (labelMap.has(code)) {
    return labelMap.get(code)!
  }

  // 2. Try adding zeros (e.g., "6157" -> "615700000")
  if (code.length < 9) {
    const codeWithZeros = code + '0'.repeat(9 - code.length)
    if (labelMap.has(codeWithZeros)) {
      return labelMap.get(codeWithZeros)!
    }
  }

  // 3. Try parent codes by removing last digit progressively (e.g., "6288" -> "628" -> "62" -> "6")
  let parentCode = code
  while (parentCode.length > 1) {
    parentCode = parentCode.slice(0, -1)

    // Try exact parent match
    if (labelMap.has(parentCode)) {
      return labelMap.get(parentCode)!
    }

    // Try parent with zeros
    if (parentCode.length < 9) {
      const parentWithZeros = parentCode + '0'.repeat(9 - parentCode.length)
      if (labelMap.has(parentWithZeros)) {
        return labelMap.get(parentWithZeros)!
      }
    }
  }

  // 4. Fallback to default
  return `Compte ${code}`
}

async function loadAccountBalances(startDate: string, endDate: string): Promise<Map<string, AccountBalance>> {
  const PAGE_SIZE = 1000
  let allEntries: { account_code: string; debit: number; credit: number }[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error } = await supabase
      .from('accounting_entries')
      .select('account_code, debit, credit')
      .eq('company_id', COMPANY_ID)
      .gte('date', startDate)
      .lte('date', endDate)
      .range(from, to)

    if (error) throw new Error(`Erreur chargement écritures: ${error.message}`)
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allEntries = allEntries.concat(data)
      hasMore = data.length === PAGE_SIZE
      page++
    }
  }

  // Load labels from chart of accounts
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('code, label')
    .eq('company_id', COMPANY_ID)

  const labelMap = new Map<string, string>()
  if (accounts) {
    for (const acc of accounts) {
      labelMap.set(acc.code, acc.label)
    }
  }

  // Load colors from transaction_categories
  const { data: categories } = await supabase
    .from('transaction_categories')
    .select('default_accounting_code, color')
    .eq('company_id', COMPANY_ID)

  const colorMap = new Map<string, string>()
  if (categories) {
    for (const cat of categories) {
      if (cat.default_accounting_code && cat.color) {
        colorMap.set(cat.default_accounting_code, cat.color)
      }
    }
  }

  // Find color for account code using prefix matching
  const findColorForCode = (code: string): string | undefined => {
    // Try progressively shorter prefixes
    let testCode = code
    while (testCode.length >= 2) {
      if (colorMap.has(testCode)) {
        return colorMap.get(testCode)
      }
      testCode = testCode.slice(0, -1)
    }
    return undefined
  }

  // Aggregate by account
  const balances = new Map<string, AccountBalance>()
  for (const entry of allEntries) {
    const code = entry.account_code
    const existing = balances.get(code)
    const debit = Number(entry.debit) || 0
    const credit = Number(entry.credit) || 0

    if (existing) {
      existing.debit += debit
      existing.credit += credit
      existing.solde = existing.debit - existing.credit
    } else {
      balances.set(code, {
        code,
        label: findLabelForCode(code, labelMap),
        debit,
        credit,
        solde: debit - credit,
        color: findColorForCode(code),
      })
    }
  }

  return balances
}

function sumAccountsByPrefix(balances: Map<string, AccountBalance>, prefixes: string[]): number {
  let total = 0
  for (const [code, balance] of balances) {
    if (prefixes.some(p => code.startsWith(p))) {
      total += balance.solde
    }
  }
  return total
}

function getProduitsAmount(balances: Map<string, AccountBalance>, prefixes: string[]): number {
  // Produits have credit balance (solde < 0), return as positive
  let total = 0
  for (const [code, balance] of balances) {
    if (prefixes.some(p => code.startsWith(p))) {
      if (balance.solde < 0) {
        total += Math.abs(balance.solde)
      }
    }
  }
  return total
}

function getChargesAmount(balances: Map<string, AccountBalance>, prefixes: string[]): number {
  // Charges have debit balance (solde > 0)
  let total = 0
  for (const [code, balance] of balances) {
    if (prefixes.some(p => code.startsWith(p))) {
      if (balance.solde > 0) {
        total += balance.solde
      }
    }
  }
  return total
}

function getChargesBreakdown(balances: Map<string, AccountBalance>, prefixes: string[]): SubCategory[] {
  const breakdown: SubCategory[] = []
  for (const [code, balance] of balances) {
    if (prefixes.some(p => code.startsWith(p))) {
      if (balance.solde > 0) {
        breakdown.push({
          label: balance.label || `Compte ${code}`,
          amount: balance.solde,
          color: balance.color
        })
      }
    }
  }
  // Sort by amount descending
  breakdown.sort((a, b) => b.amount - a.amount)
  return breakdown
}

function getProduitsBreakdown(balances: Map<string, AccountBalance>, prefixes: string[]): SubCategory[] {
  const breakdown: SubCategory[] = []
  for (const [code, balance] of balances) {
    if (prefixes.some(p => code.startsWith(p))) {
      if (balance.solde < 0) {
        breakdown.push({
          label: balance.label || `Compte ${code}`,
          amount: Math.abs(balance.solde),
          color: balance.color
        })
      }
    }
  }
  // Sort by amount descending
  breakdown.sort((a, b) => b.amount - a.amount)
  return breakdown
}

async function generateCompteResultatData(startDate: string, endDate: string): Promise<CompteResultatData> {
  const balances = await loadAccountBalances(startDate, endDate)

  // ===== PRODUITS D'EXPLOITATION =====
  const venteMarchandises = getProduitsAmount(balances, ['707'])
  const productionVendueBiens = getProduitsAmount(balances, ['701', '702', '703'])
  const productionVendueServices = getProduitsAmount(balances, ['706', '704', '705', '708', '709'])
  const chiffreAffaires = venteMarchandises + productionVendueBiens + productionVendueServices

  const productionStockee = getProduitsAmount(balances, ['71'])
  const productionImmobilisee = getProduitsAmount(balances, ['72'])
  const subventionsExploitation = getProduitsAmount(balances, ['74'])
  const reprisesProvisions = getProduitsAmount(balances, ['781', '791'])
  const autresProduits = getProduitsAmount(balances, ['75'])

  const totalProduitsExploitation = chiffreAffaires + productionStockee + productionImmobilisee +
                                    subventionsExploitation + reprisesProvisions + autresProduits

  const produitsExploitation: CompteResultatLine[] = [
    { label: 'Vente de marchandises', amount: venteMarchandises },
    { label: 'Production vendue de biens', amount: productionVendueBiens },
    { label: 'Production vendue de services', amount: productionVendueServices },
    { label: 'MONTANT NET DU CHIFFRE D\'AFFAIRES', amount: chiffreAffaires, isSubtotal: true },
    { label: 'Production stockée', amount: productionStockee },
    { label: 'Production immobilisée', amount: productionImmobilisee },
    { label: 'Subventions d\'exploitation', amount: subventionsExploitation },
    { label: 'Reprises sur provisions et amortissements, transferts de charges', amount: reprisesProvisions },
    { label: 'Autres produits', amount: autresProduits },
  ]

  // ===== CHARGES D'EXPLOITATION =====
  const achatsMarchandises = getChargesAmount(balances, ['607'])
  const variationStocksMarchandises = sumAccountsByPrefix(balances, ['6037'])
  const achatsMatieresPremieres = getChargesAmount(balances, ['601', '602'])
  const variationStocks = sumAccountsByPrefix(balances, ['6031', '6032'])
  const autresAchatsChargesExternes = getChargesAmount(balances, ['604', '605', '606', '61', '62'])
  const impotsTaxes = getChargesAmount(balances, ['63'])
  const salairesTraitements = getChargesAmount(balances, ['641', '644', '645', '648'])
  const chargesSociales = getChargesAmount(balances, ['645', '646', '647', '648'])
  // Recalcul correct des charges de personnel
  const chargesPersonnel = getChargesAmount(balances, ['64'])
  const dotationsAmortissements = getChargesAmount(balances, ['681'])
  const autresCharges = getChargesAmount(balances, ['65'])

  const totalChargesExploitation = achatsMarchandises + variationStocksMarchandises +
                                   achatsMatieresPremieres + variationStocks +
                                   autresAchatsChargesExternes + impotsTaxes +
                                   chargesPersonnel + dotationsAmortissements + autresCharges

  // Get breakdown for key lines
  const autresAchatsBreakdown = getChargesBreakdown(balances, ['604', '605', '606', '61', '62'])
  const salairesBreakdown = getChargesBreakdown(balances, ['641', '644', '645', '648'])
  const chargesSocialesBreakdown = getChargesBreakdown(balances, ['645', '646', '647', '648'])

  const chargesExploitation: CompteResultatLine[] = [
    { label: 'Achats de marchandises', amount: achatsMarchandises },
    { label: 'Variation des stocks de marchandises', amount: variationStocksMarchandises },
    { label: 'Achats de matières premières et autres approvisionnements', amount: achatsMatieresPremieres },
    { label: 'Variation de stocks', amount: variationStocks },
    { label: 'Autres achats et charges externes', amount: autresAchatsChargesExternes, subCategories: autresAchatsBreakdown, accountPrefixes: ['604', '605', '606', '61', '62'] },
    { label: 'Impôts, taxes et versements assimilés', amount: impotsTaxes },
    { label: 'Salaires et traitements', amount: salairesTraitements > 0 ? salairesTraitements : chargesPersonnel, subCategories: salairesBreakdown, accountPrefixes: ['641', '644', '645', '648'] },
    { label: 'Charges sociales', amount: chargesSociales, subCategories: chargesSocialesBreakdown, accountPrefixes: ['645', '646', '647', '648'] },
    { label: 'Dotations aux amortissements et aux provisions', amount: dotationsAmortissements },
    { label: 'Autres charges', amount: autresCharges },
  ]

  const resultatExploitation = totalProduitsExploitation - totalChargesExploitation

  // ===== QUOTES-PARTS =====
  const quotesPartBenefice = getProduitsAmount(balances, ['755'])
  const quotesPartPerte = getChargesAmount(balances, ['655'])

  // ===== PRODUITS FINANCIERS =====
  const produitsParticipations = getProduitsAmount(balances, ['761'])
  const produitsAutresValeursMobilieres = getProduitsAmount(balances, ['762'])
  const autresInterets = getProduitsAmount(balances, ['763', '764', '765', '768'])
  const reprisesProvisionsFinancieres = getProduitsAmount(balances, ['786', '796'])
  const differencesPositivesChange = getProduitsAmount(balances, ['766'])
  const produitsCessionsVMP = getProduitsAmount(balances, ['767'])

  const totalProduitsFinanciers = produitsParticipations + produitsAutresValeursMobilieres +
                                  autresInterets + reprisesProvisionsFinancieres +
                                  differencesPositivesChange + produitsCessionsVMP

  // Get breakdown for financial products
  const differencesPositivesBreakdown = getProduitsBreakdown(balances, ['766'])

  const produitsFinanciers: CompteResultatLine[] = [
    { label: 'De participations', amount: produitsParticipations },
    { label: 'D\'autres valeurs mobilières et créances de l\'actif immobilisé', amount: produitsAutresValeursMobilieres },
    { label: 'Autres intérêts et produits assimilés', amount: autresInterets },
    { label: 'Reprises sur provisions et transferts de charges', amount: reprisesProvisionsFinancieres },
    { label: 'Différences positives de change', amount: differencesPositivesChange, subCategories: differencesPositivesBreakdown, accountPrefixes: ['766'] },
    { label: 'Produits nets sur cessions de valeurs mobilières de placement', amount: produitsCessionsVMP },
  ]

  // ===== CHARGES FINANCIÈRES =====
  const dotationsFinancieres = getChargesAmount(balances, ['686'])
  const interetsCharges = getChargesAmount(balances, ['661', '664', '665', '668'])
  const differencesNegativesChange = getChargesAmount(balances, ['666'])
  const chargesCessionsVMP = getChargesAmount(balances, ['667'])

  const totalChargesFinancieres = dotationsFinancieres + interetsCharges +
                                  differencesNegativesChange + chargesCessionsVMP

  const chargesFinancieres: CompteResultatLine[] = [
    { label: 'Dotations aux amortissements et aux provisions', amount: dotationsFinancieres },
    { label: 'Intérêts et charges assimilées', amount: interetsCharges },
    { label: 'Différences négatives de change', amount: differencesNegativesChange },
    { label: 'Charges nettes sur cessions de valeurs mobilières de placement', amount: chargesCessionsVMP },
  ]

  const resultatFinancier = totalProduitsFinanciers - totalChargesFinancieres
  const resultatCourantAvantImpot = resultatExploitation + quotesPartBenefice - quotesPartPerte + resultatFinancier

  // ===== PRODUITS EXCEPTIONNELS =====
  const produitsExceptionnelsGestion = getProduitsAmount(balances, ['771'])
  const produitsExceptionnelsCapital = getProduitsAmount(balances, ['775', '777', '778'])
  const reprisesProvisionsExceptionnelles = getProduitsAmount(balances, ['787', '797'])

  const totalProduitsExceptionnels = produitsExceptionnelsGestion + produitsExceptionnelsCapital +
                                     reprisesProvisionsExceptionnelles

  const produitsExceptionnels: CompteResultatLine[] = [
    { label: 'Sur opérations de gestion', amount: produitsExceptionnelsGestion },
    { label: 'Sur opérations en capital', amount: produitsExceptionnelsCapital },
    { label: 'Reprises sur provisions et transferts de charges', amount: reprisesProvisionsExceptionnelles },
  ]

  // ===== CHARGES EXCEPTIONNELLES =====
  const chargesExceptionnellesGestion = getChargesAmount(balances, ['671'])
  const chargesExceptionnellesCapital = getChargesAmount(balances, ['675', '678'])
  const dotationsExceptionnelles = getChargesAmount(balances, ['687'])

  const totalChargesExceptionnelles = chargesExceptionnellesGestion + chargesExceptionnellesCapital +
                                      dotationsExceptionnelles

  const chargesExceptionnelles: CompteResultatLine[] = [
    { label: 'Sur opérations de gestion', amount: chargesExceptionnellesGestion },
    { label: 'Sur opérations en capital', amount: chargesExceptionnellesCapital },
    { label: 'Dotations aux amortissements et aux provisions', amount: dotationsExceptionnelles },
  ]

  const resultatExceptionnel = totalProduitsExceptionnels - totalChargesExceptionnelles

  // ===== PARTICIPATION ET IMPÔTS =====
  const participationSalaries = getChargesAmount(balances, ['691'])
  const impotsBenefices = getChargesAmount(balances, ['695', '696', '697', '698', '699'])

  // ===== TOTAUX FINAUX =====
  const totalProduits = totalProduitsExploitation + quotesPartBenefice + totalProduitsFinanciers + totalProduitsExceptionnels
  const totalCharges = totalChargesExploitation + quotesPartPerte + totalChargesFinancieres +
                       totalChargesExceptionnelles + participationSalaries + impotsBenefices
  const resultatExercice = totalProduits - totalCharges

  return {
    produitsExploitation,
    totalProduitsExploitation,
    chargesExploitation,
    totalChargesExploitation,
    resultatExploitation,
    quotesPartBenefice,
    quotesPartPerte,
    produitsFinanciers,
    totalProduitsFinanciers,
    chargesFinancieres,
    totalChargesFinancieres,
    resultatFinancier,
    resultatCourantAvantImpot,
    produitsExceptionnels,
    totalProduitsExceptionnels,
    chargesExceptionnelles,
    totalChargesExceptionnelles,
    resultatExceptionnel,
    participationSalaries,
    impotsBenefices,
    totalProduits,
    totalCharges,
    resultatExercice,
  }
}

// ============ Component ============

interface CompteResultatPageProps {
  onNavigate?: (page: string) => void
}

export default function CompteResultatPage({ onNavigate: _onNavigate }: CompteResultatPageProps) {
  const [startDate, setStartDate] = useState('2024-04-30')
  const [endDate, setEndDate] = useState('2025-12-31')
  const [data, setData] = useState<CompteResultatData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
    'produits-exploitation', 'charges-exploitation',
    'produits-financiers', 'charges-financieres',
    'produits-exceptionnels', 'charges-exceptionnelles'
  ]))
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set())
  const [showInfoBanner, setShowInfoBanner] = useState(true)
  const [cumulativeValues, setCumulativeValues] = useState(false)
  const [analyticsMode, setAnalyticsMode] = useState(false)

  // Exercise dropdown state
  const [showExerciceDropdown, setShowExerciceDropdown] = useState(false)
  const [hoveredExercice, setHoveredExercice] = useState<string | null>(null)
  const [selectedExercice, setSelectedExercice] = useState('2024-2025')
  const [selectedPeriod, setSelectedPeriod] = useState<'full' | 'month'>('full')
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [selectedYear, setSelectedYear] = useState(2025)
  const [showCustomDates, setShowCustomDates] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Get display label for current selection
  const getPeriodLabel = () => {
    if (selectedPeriod === 'full') {
      const exercice = exercices.find(e => e.id === selectedExercice)
      return exercice?.label || `Exercice ${selectedExercice}`
    }
    return `${monthNames[selectedMonth]} ${selectedYear}`
  }

  // Handle exercise complete selection
  const handleExerciceComplete = (exerciceId: string) => {
    setSelectedExercice(exerciceId)
    setSelectedPeriod('full')
    const exercice = exercices.find(e => e.id === exerciceId)
    if (exercice) {
      if (exercice.isMultiYear && exercice.endYear) {
        const startMonth = exercice.startMonth || 0
        setStartDate(`${exercice.year}-${String(startMonth + 1).padStart(2, '0')}-01`)
        setEndDate(`${exercice.endYear}-12-31`)
      } else {
        setStartDate(`${exercice.year}-01-01`)
        setEndDate(`${exercice.year}-12-31`)
      }
    }
    setShowExerciceDropdown(false)
    setHoveredExercice(null)
  }

  // Handle month selection
  const handleMonthSelect = (exerciceId: string, monthIndex: number, year: number) => {
    setSelectedExercice(exerciceId)
    setSelectedPeriod('month')
    setSelectedMonth(monthIndex)
    setSelectedYear(year)

    const month = String(monthIndex + 1).padStart(2, '0')
    const lastDay = new Date(year, monthIndex + 1, 0).getDate()

    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${lastDay}`)
    setShowExerciceDropdown(false)
    setHoveredExercice(null)
  }

  // Handle custom dates apply
  const handleCustomDatesApply = () => {
    if (customStartDate && customEndDate) {
      setStartDate(customStartDate)
      setEndDate(customEndDate)
      setSelectedPeriod('full')
      setShowCustomDates(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateCompteResultatData(startDate, endDate)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections)
    if (newSet.has(section)) {
      newSet.delete(section)
    } else {
      newSet.add(section)
    }
    setExpandedSections(newSet)
  }

  const toggleLine = (lineKey: string) => {
    const newSet = new Set(expandedLines)
    if (newSet.has(lineKey)) {
      newSet.delete(lineKey)
    } else {
      newSet.add(lineKey)
    }
    setExpandedLines(newSet)
  }

  const renderLine = (line: CompteResultatLine, indent: number = 0, sectionId: string = '') => {
    const isZero = line.amount === 0
    const lineKey = `${sectionId}-${line.label}`
    const hasSubCategories = line.subCategories && line.subCategories.length > 0
    const isLineExpanded = expandedLines.has(lineKey)

    if (line.isSubtotal) {
      return (
        <tr key={line.label} className="bg-gray-50">
          <td className="py-2 px-4 text-sm font-medium" style={{ paddingLeft: `${16 + indent * 20}px` }}>
            {line.label}
          </td>
          <td className="py-2 px-4 text-right font-medium text-sm">
            {formatNumber(line.amount)}
          </td>
        </tr>
      )
    }

    if (line.isTotal) {
      return (
        <tr key={line.label} className="bg-[#E8F5F5]">
          <td className="py-3 px-4 font-semibold text-sm" style={{ color: '#006666' }}>
            {line.label}
          </td>
          <td className="py-3 px-4 text-right font-bold text-sm" style={{ color: '#006666' }}>
            {formatNumber(line.amount)}
          </td>
        </tr>
      )
    }

    if (line.isResult) {
      const isPositive = line.amount >= 0
      return (
        <tr key={line.label} className={isPositive ? 'bg-green-50' : 'bg-red-50'}>
          <td className="py-3 px-4 font-semibold text-sm" style={{ paddingLeft: `${16 + indent * 20}px` }}>
            {line.label}
          </td>
          <td className={`py-3 px-4 text-right font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {formatNumber(line.amount)}
          </td>
        </tr>
      )
    }

    // Regular line with optional subcategories
    const rows = []

    rows.push(
      <tr
        key={line.label}
        className={`border-b border-gray-100 ${hasSubCategories ? 'cursor-pointer hover:bg-gray-100' : 'hover:bg-gray-50'}`}
        onClick={hasSubCategories ? () => toggleLine(lineKey) : undefined}
      >
        <td
          className="py-2 px-4 text-sm"
          style={{ paddingLeft: `${16 + indent * 20}px`, color: isZero ? '#9CA3AF' : '#374151' }}
        >
          <div className="flex items-center gap-2">
            {hasSubCategories && (
              isLineExpanded
                ? <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span className={hasSubCategories ? 'font-medium' : ''}>{line.label}</span>
          </div>
        </td>
        <td
          className="py-2 px-4 text-right text-sm font-mono"
          style={{ color: isZero ? '#9CA3AF' : '#374151' }}
        >
          {formatNumber(line.amount)}
        </td>
      </tr>
    )

    // Render subcategories if expanded
    if (hasSubCategories && isLineExpanded) {
      for (const sub of line.subCategories!) {
        // Use category color or default gray
        const badgeColor = sub.color || '#6B7280'
        // Create a light background version (15% opacity)
        const bgColor = `${badgeColor}26` // hex with 15% opacity

        rows.push(
          <tr key={`${lineKey}-${sub.label}`} className="bg-white">
            <td className="py-1.5 px-4 text-sm" style={{ paddingLeft: `${48 + indent * 20}px` }}>
              <span
                className="inline-block px-2.5 py-1 rounded text-sm font-medium"
                style={{ backgroundColor: bgColor, color: badgeColor }}
              >
                {sub.label.length > 50 ? sub.label.substring(0, 47) + '...' : sub.label}
              </span>
            </td>
            <td className="py-1.5 px-4 text-right text-sm" style={{ color: '#374151' }}>
              {formatNumber(sub.amount)}
            </td>
          </tr>
        )
      }
    }

    return <>{rows}</>
  }

  const renderSection = (
    id: string,
    title: string,
    lines: CompteResultatLine[],
    total: number,
    totalLabel: string,
    bgColor: string = '#F9FAFB'
  ) => {
    const isExpanded = expandedSections.has(id)

    return (
      <div key={id} className="mb-2">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-t-lg hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-gray-500" /> : <ChevronRightIcon className="w-4 h-4 text-gray-500" />}
            <span className="font-semibold text-sm" style={{ color: '#374151' }}>{title}</span>
          </div>
        </button>

        {isExpanded && (
          <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden" style={{ backgroundColor: bgColor }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Postes</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase w-32">2024 - 2025</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => renderLine(line, 0, id))}
                <tr className="bg-[#E8F5F5]">
                  <td className="py-3 px-4 font-semibold text-sm" style={{ color: '#006666' }}>
                    {totalLabel}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-sm" style={{ color: '#006666' }}>
                    {formatNumber(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006666]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header - Row 1 */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Compte de résultat</h1>

            {/* Exercise/Period Selector with Cascading Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExerciceDropdown(!showExerciceDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#E8F5F5', color: '#006666' }}
              >
                <InfoIcon />
                {getPeriodLabel()}
                <ChevronDownIcon className="w-3 h-3" />
              </button>

              {showExerciceDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowExerciceDropdown(false)
                      setHoveredExercice(null)
                    }}
                  />

                  {/* Main Dropdown */}
                  <div className="absolute left-0 mt-2 w-52 bg-white rounded-lg shadow-xl border z-50" style={{ borderColor: '#E4E5E7' }}>
                    {exercices.map((exercice) => (
                      <div
                        key={exercice.id}
                        className="relative"
                        onMouseEnter={() => setHoveredExercice(exercice.id)}
                        onMouseLeave={() => setHoveredExercice(null)}
                      >
                        <button
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[#E6F5F0] transition-colors ${
                            hoveredExercice === exercice.id ? 'bg-[#E6F5F0]' : ''
                          }`}
                          style={{
                            color: '#141A1F',
                            borderBottom: '1px solid #F2F2F3'
                          }}
                        >
                          <span>{exercice.label}</span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>

                        {/* Submenu with months */}
                        {hoveredExercice === exercice.id && (
                          <div
                            className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto"
                            style={{ borderColor: '#E4E5E7' }}
                            onMouseEnter={() => setHoveredExercice(exercice.id)}
                          >
                            {/* Exercice complet option */}
                            <button
                              onClick={() => handleExerciceComplete(exercice.id)}
                              className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors font-medium"
                              style={{ color: '#141A1F', borderBottom: '1px solid #F2F2F3' }}
                            >
                              Exercice complet
                            </button>

                            {/* Month options */}
                            {getExerciceMonths(exercice).map((monthData) => {
                              const isSelected = selectedExercice === exercice.id &&
                                selectedPeriod === 'month' &&
                                selectedMonth === monthData.month &&
                                selectedYear === monthData.year
                              return (
                                <button
                                  key={`${monthData.year}-${monthData.month}`}
                                  onClick={() => handleMonthSelect(exercice.id, monthData.month, monthData.year)}
                                  className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                                    isSelected ? 'bg-[#059669] text-white' : 'hover:bg-gray-50'
                                  }`}
                                  style={{ color: isSelected ? '#FFFFFF' : '#141A1F' }}
                                >
                                  {monthData.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Separator */}
                    <div className="border-t" style={{ borderColor: '#E4E5E7' }} />

                    {/* Custom dates option */}
                    <button
                      onClick={() => {
                        setShowCustomDates(true)
                        setShowExerciceDropdown(false)
                        setHoveredExercice(null)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      style={{ color: '#141A1F', borderBottom: '1px solid #F2F2F3' }}
                    >
                      <CalendarIcon />
                      <span>Dates personnalisées</span>
                    </button>

                    {/* Settings option */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors rounded-b-lg"
                      style={{ color: '#141A1F' }}
                    >
                      <SettingsIcon />
                      <span>Paramètres</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button className="p-1.5 rounded border" style={{ borderColor: '#D6D9DB' }}>
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm text-gray-500 ml-2">Comparer avec :</span>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: '#D6D9DB', color: '#374151' }}>
              Période à considérer
              <ChevronDownIcon className="w-3 h-3" />
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#006666' }}>
            <SettingsIcon />
            Configurer les postes
          </button>
        </div>
      </header>

      {/* Custom Dates Modal */}
      {showCustomDates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>Dates personnalisées</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Date de début</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Date de fin</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCustomDates(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border"
                style={{ borderColor: '#D6D9DB', color: '#374151' }}
              >
                Annuler
              </button>
              <button
                onClick={handleCustomDatesApply}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white"
                style={{ backgroundColor: '#006666' }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {showInfoBanner && (
        <div className="mx-6 mt-4 p-4 rounded-lg border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <InfoIcon />
              </div>
              <div>
                <p className="font-medium text-sm" style={{ color: '#1E40AF' }}>États financiers dynamiques</p>
                <p className="text-sm mt-0.5" style={{ color: '#1E40AF' }}>
                  Le règlement ANC n°2022-06 est disponible sur l'exercice 2024 pour faciliter la comparaison entre exercices. Vous pouvez modifier cette visualisation dans la configuration des postes.
                </p>
              </div>
            </div>
            <button onClick={() => setShowInfoBanner(false)} className="p-1 hover:bg-blue-100 rounded" style={{ color: '#1E40AF' }}>
              <XIcon />
            </button>
          </div>
        </div>
      )}

      {/* Filters Row */}
      <div className="bg-white border-b px-6 py-3 mt-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: '#D6D9DB', color: '#374151' }}>
              Période complète
              <ChevronDownIcon className="w-3 h-3" />
            </button>

            {/* Cumulative Values Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCumulativeValues(!cumulativeValues)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${cumulativeValues ? 'bg-[#006666]' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cumulativeValues ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-gray-600">Valeurs cumulatives</span>
            </div>

            {/* Analytics Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAnalyticsMode(!analyticsMode)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${analyticsMode ? 'bg-[#006666]' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${analyticsMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-gray-600">Mode analytique</span>
            </div>

            {/* Active Filter Tag */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: '#E8F5F5', color: '#006666' }}>
              <TableIcon />
              Types de dépenses / revenus
              <button className="ml-1 hover:bg-teal-200 rounded p-0.5">
                <XIcon />
              </button>
            </div>

            {/* Categories Button */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: '#D6D9DB', color: '#374151' }}>
              <TagIcon />
              Catégories
            </button>

            {/* Analyze by Column Button */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: '#D6D9DB', color: '#374151' }}>
              <TableIcon />
              Analyser par colonne
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Analyze Button */}
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#006666' }}>
              <SparklesIcon />
              Analyser
            </button>

            {/* Customize Button */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: '#D6D9DB', color: '#374151' }}>
              <SettingsIcon />
              Personnaliser
            </button>

            {/* Export Button */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: '#D6D9DB', color: '#374151' }}>
              <DownloadIcon />
              Exporter
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {data && (
          <div className="space-y-4">

            {/* PRODUITS D'EXPLOITATION */}
            {renderSection(
              'produits-exploitation',
              'Produits d\'exploitation',
              data.produitsExploitation,
              data.totalProduitsExploitation,
              'TOTAL PRODUITS D\'EXPLOITATION (I)'
            )}

            {/* CHARGES D'EXPLOITATION */}
            {renderSection(
              'charges-exploitation',
              'Charges d\'exploitation',
              data.chargesExploitation,
              data.totalChargesExploitation,
              'TOTAL CHARGES D\'EXPLOITATION (II)'
            )}

            {/* RÉSULTAT D'EXPLOITATION */}
            <div className={`rounded-lg p-4 ${data.resultatExploitation >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex justify-between items-center">
                <span className="font-semibold">RÉSULTAT D'EXPLOITATION (I - II)</span>
                <span className={`font-bold text-lg ${data.resultatExploitation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(data.resultatExploitation)}
                </span>
              </div>
            </div>

            {/* QUOTES-PARTS */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">Quotes-parts de résultat sur opérations faites en commun</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Bénéfice attribué ou perte transférée (III)</span>
                  <span className="font-mono">{formatNumber(data.quotesPartBenefice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Perte supportée ou bénéfice transféré (IV)</span>
                  <span className="font-mono">{formatNumber(data.quotesPartPerte)}</span>
                </div>
              </div>
            </div>

            {/* PRODUITS FINANCIERS */}
            {renderSection(
              'produits-financiers',
              'Produits financiers',
              data.produitsFinanciers,
              data.totalProduitsFinanciers,
              'TOTAL PRODUITS FINANCIERS (V)'
            )}

            {/* CHARGES FINANCIÈRES */}
            {renderSection(
              'charges-financieres',
              'Charges financières',
              data.chargesFinancieres,
              data.totalChargesFinancieres,
              'TOTAL CHARGES FINANCIÈRES (VI)'
            )}

            {/* RÉSULTAT FINANCIER */}
            <div className={`rounded-lg p-4 ${data.resultatFinancier >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex justify-between items-center">
                <span className="font-semibold">RÉSULTAT FINANCIER (V - VI)</span>
                <span className={`font-bold text-lg ${data.resultatFinancier >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(data.resultatFinancier)}
                </span>
              </div>
            </div>

            {/* RÉSULTAT COURANT AVANT IMPÔT */}
            <div className="bg-[#006666] text-white rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">RÉSULTAT COURANT AVANT IMPÔT (I - II + III - IV + V - VI)</span>
                <span className="font-bold text-lg">{formatNumber(data.resultatCourantAvantImpot)}</span>
              </div>
            </div>

            {/* PRODUITS EXCEPTIONNELS */}
            {renderSection(
              'produits-exceptionnels',
              'Produits exceptionnels',
              data.produitsExceptionnels,
              data.totalProduitsExceptionnels,
              'TOTAL PRODUITS EXCEPTIONNELS (VII)'
            )}

            {/* CHARGES EXCEPTIONNELLES */}
            {renderSection(
              'charges-exceptionnelles',
              'Charges exceptionnelles',
              data.chargesExceptionnelles,
              data.totalChargesExceptionnelles,
              'TOTAL CHARGES EXCEPTIONNELLES (VIII)'
            )}

            {/* RÉSULTAT EXCEPTIONNEL */}
            <div className={`rounded-lg p-4 ${data.resultatExceptionnel >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex justify-between items-center">
                <span className="font-semibold">RÉSULTAT EXCEPTIONNEL (VII - VIII)</span>
                <span className={`font-bold text-lg ${data.resultatExceptionnel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(data.resultatExceptionnel)}
                </span>
              </div>
            </div>

            {/* PARTICIPATION ET IMPÔTS */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Participation des salariés aux résultats de l'entreprise (IX)</span>
                  <span className="font-mono">{formatNumber(data.participationSalaries)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Impôts sur les bénéfices (X)</span>
                  <span className="font-mono">{formatNumber(data.impotsBenefices)}</span>
                </div>
              </div>
            </div>

            {/* TOTAUX FINAUX */}
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span>TOTAL DES PRODUITS (I + III + V + VII)</span>
                <span className="font-mono font-bold">{formatNumber(data.totalProduits)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>TOTAL DES CHARGES (II + IV + VI + VIII + IX + X)</span>
                <span className="font-mono font-bold">{formatNumber(data.totalCharges)}</span>
              </div>
            </div>

            {/* RÉSULTAT DE L'EXERCICE */}
            <div
              className="rounded-lg p-6"
              style={{ backgroundColor: data.resultatExercice >= 0 ? '#006666' : '#991B1B' }}
            >
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-lg">RÉSULTAT DE L'EXERCICE</span>
                <span className="text-white font-bold text-2xl">{formatNumber(data.resultatExercice)}</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
