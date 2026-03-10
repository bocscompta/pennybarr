// États Financiers Service - Bilan et Compte de Résultat (PCG French standard)
// Labels are loaded from chart_of_accounts (DB), not hardcoded
import { supabase, COMPANY_ID } from '../lib/supabase'
// ChartOfAccount type used internally by loadLabelMap

// ============ Types ============

export interface BilanLine {
  code: string
  label: string
  amount: number
  children?: BilanLine[]
}

// Types pour le bilan structuré avec Brut / Amort. & dépréc. / Net
export interface BilanLineStructured {
  id: string
  code: string
  label: string
  brut: number
  amortissement: number // amortissements et dépréciations
  net: number
  isSubtotal?: boolean
  isTotal?: boolean
  children?: BilanLineStructured[]
}

export interface BilanPassifLine {
  id: string
  code: string
  label: string
  amount: number
  isSubtotal?: boolean
  isTotal?: boolean
  children?: BilanPassifLine[]
}

export interface BilanDataStructured {
  actif: {
    items: BilanLineStructured[]
    totalBrut: number
    totalAmortissement: number
    totalNet: number
  }
  passif: {
    items: BilanPassifLine[]
    total: number
  }
}

export interface BilanData {
  actif: {
    immobilisations: BilanLine[]
    actifCirculant: BilanLine[]
    tresorerie: BilanLine[]
    totalActif: number
  }
  passif: {
    capitauxPropres: BilanLine[]
    provisions: BilanLine[]
    dettes: BilanLine[]
    totalPassif: number
  }
}

export interface CompteResultatData {
  exploitation: {
    produits: BilanLine[]
    charges: BilanLine[]
    resultat: number
  }
  financier: {
    produits: BilanLine[]
    charges: BilanLine[]
    resultat: number
  }
  exceptionnel: {
    produits: BilanLine[]
    charges: BilanLine[]
    resultat: number
  }
  impots: number
  resultatNet: number
}

interface AccountBalance {
  code: string
  label: string
  debit: number
  credit: number
  solde: number // debit - credit
}

// ============ PCG Account Classification ============

// Comptes de classe 4 - La règle PCG est simple:
// - Solde DÉBITEUR (débit > crédit) = ACTIF (Créances)
// - Solde CRÉDITEUR (crédit > débit) = PASSIF (Dettes)
// Peu importe la nature "attendue" du compte, c'est le SOLDE RÉEL qui détermine la position

// Comptes à exclure des calculs (comptes spéciaux)
const COMPTES_EXCLUS_TRESORERIE = ['5809'] // Virements internes - contre-passation

// ============ DB-loaded label map ============

/**
 * Load all account labels from chart_of_accounts.
 * Builds a map code → label for label resolution.
 */
async function loadLabelMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('code, label')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)

  if (error) {
    console.error('loadLabelMap: failed to load chart_of_accounts', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }

  if (!data) {
    console.error('loadLabelMap: data is null')
    throw new Error('Erreur inattendue: données manquantes pour le plan comptable')
  }

  const labelMap = new Map<string, string>()
  for (const account of data) {
    labelMap.set(account.code, account.label)
  }
  return labelMap
}

// ============ Helper Functions ============

/**
 * Get account balances for a specific period.
 * Returns balances map AND the label map for downstream use.
 */
async function getAccountBalances(
  startDate: string,
  endDate: string
): Promise<{ balances: Map<string, AccountBalance>; labelMap: Map<string, string> }> {
  // Fetch all entries with pagination - Supabase limits to 1000 rows per request
  const PAGE_SIZE = 1000
  let allEntries: { account_code: string; debit: number; credit: number }[] = []
  let page = 0
  let hasMore = true

  // Start loading labels in parallel
  const labelMapPromise = loadLabelMap()

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

    if (error) {
      console.error('Error fetching accounting entries:', error)
      throw new Error(`Erreur chargement écritures comptables: ${error.message}`)
    }

    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allEntries = allEntries.concat(data)
      hasMore = data.length === PAGE_SIZE
      page++
    }
  }

  const labelMap = await labelMapPromise

  console.log(`[Bilan] Loaded ${allEntries.length} accounting entries for period ${startDate} to ${endDate} (${page} pages)`)

  // Group by account code
  const balances = new Map<string, AccountBalance>()

  for (const entry of allEntries) {
    const code = entry.account_code
    const existing = balances.get(code)

    if (existing) {
      existing.debit += Number(entry.debit) || 0
      existing.credit += Number(entry.credit) || 0
      existing.solde = existing.debit - existing.credit
    } else {
      const debit = Number(entry.debit) || 0
      const credit = Number(entry.credit) || 0
      balances.set(code, {
        code,
        label: getAccountLabel(code, labelMap),
        debit,
        credit,
        solde: debit - credit,
      })
    }
  }

  return { balances, labelMap }
}

/**
 * Get account label from DB-loaded label map.
 * Tries full code first, then progressively shorter prefixes.
 */
function getAccountLabel(code: string, labelMap: Map<string, string>): string {
  // Check full code first
  const fullLabel = labelMap.get(code)
  if (fullLabel) return fullLabel

  // Try progressively shorter prefixes
  for (let len = code.length - 1; len >= 2; len--) {
    const prefix = code.slice(0, len)
    const prefixLabel = labelMap.get(prefix)
    if (prefixLabel) return prefixLabel
  }

  return `Compte ${code}`
}

/**
 * Aggregate balances by account prefix
 */
function aggregateByPrefix(
  balances: Map<string, AccountBalance>,
  classPrefix: string,
  excludePrefixes: string[] = [],
  labelMap?: Map<string, string>
): BilanLine[] {
  const lines: BilanLine[] = []
  const processed = new Set<string>()

  // Group accounts by their 2-digit prefix
  const byPrefix = new Map<string, AccountBalance[]>()

  for (const [code, balance] of balances) {
    // Skip if doesn't match class prefix or matches exclusion
    if (!code.startsWith(classPrefix)) continue
    if (excludePrefixes.some(exc => code.startsWith(exc))) continue

    const prefix = code.slice(0, 2)
    const existing = byPrefix.get(prefix) || []
    existing.push(balance)
    byPrefix.set(prefix, existing)
    processed.add(code)
  }

  // Create lines for each prefix
  for (const [prefix, accounts] of Array.from(byPrefix.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const totalSolde = accounts.reduce((sum, acc) => sum + acc.solde, 0)

    // Only include if there's activity
    if (totalSolde !== 0 || accounts.some(a => a.debit !== 0 || a.credit !== 0)) {
      const children: BilanLine[] = accounts
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(acc => ({
          code: acc.code,
          label: acc.label,
          amount: acc.solde,
        }))
        .filter(child => child.amount !== 0)

      lines.push({
        code: prefix,
        label: labelMap ? getAccountLabel(prefix, labelMap) : `Compte ${prefix}`,
        amount: totalSolde,
        children: children.length >= 1 ? children : undefined,
      })
    }
  }

  return lines
}

/**
 * Get balances for class 4 accounts (Tiers), split by debtor/creditor nature
 * PCG Rule: The ACTUAL balance determines position, not the account's "expected" nature
 * - Solde débiteur (debit > credit) → ACTIF (Créances)
 * - Solde créditeur (credit > debit) → PASSIF (Dettes)
 */
function getClasse4Balances(
  balances: Map<string, AccountBalance>,
  type: 'debiteur' | 'crediteur',
  labelMap?: Map<string, string>
): BilanLine[] {
  const lines: BilanLine[] = []

  // Group by 3-digit prefix
  const byPrefix = new Map<string, AccountBalance[]>()

  for (const [code, balance] of balances) {
    if (!code.startsWith('4')) continue

    // PCG Rule: Use ACTUAL balance to determine position
    // Debiteur = positive balance (debit > credit) → ACTIF
    // Crediteur = negative balance (credit > debit) → PASSIF
    const isDebiteur = balance.solde > 0
    const isCrediteur = balance.solde < 0

    if (type === 'debiteur' && !isDebiteur) continue
    if (type === 'crediteur' && !isCrediteur) continue

    const effectiveAmount = type === 'debiteur' ? balance.solde : Math.abs(balance.solde)

    // Group by first 3 digits of account code
    const prefix = code.slice(0, 3)
    const existing = byPrefix.get(prefix) || []
    existing.push({ ...balance, solde: effectiveAmount })
    byPrefix.set(prefix, existing)
  }

  // Create lines
  for (const [prefix, accounts] of Array.from(byPrefix.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const totalAmount = accounts.reduce((sum, acc) => sum + acc.solde, 0)

    const children: BilanLine[] = accounts
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(acc => ({
        code: acc.code,
        label: acc.label,
        amount: acc.solde,
      }))
      .filter(child => child.amount !== 0)

    if (totalAmount !== 0) {
      lines.push({
        code: prefix,
        label: labelMap ? getAccountLabel(prefix, labelMap) : `Compte ${prefix}`,
        amount: totalAmount,
        children: children.length >= 1 ? children : undefined,
      })
    }
  }

  return lines
}

// ============ Public Functions ============

/**
 * Get balances for a specific account class
 */
export async function getBalancesByClass(
  classCode: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const { balances } = await getAccountBalances(startDate, endDate)
  const result = new Map<string, number>()

  for (const [code, balance] of balances) {
    if (code.startsWith(classCode)) {
      result.set(code, balance.solde)
    }
  }

  return result
}

/**
 * Generate the Bilan (Balance Sheet)
 *
 * ACTIF (debit > credit):
 * - Immobilisations (classe 2)
 * - Stocks (classe 3)
 * - Créances (classe 4 débiteur)
 * - Disponibilités (classe 5)
 *
 * PASSIF (credit > debit):
 * - Capitaux propres (classe 1)
 * - Provisions (classe 15)
 * - Dettes (classe 4 créditeur + emprunts classe 16)
 */
export async function generateBilan(
  startDate: string,
  endDate: string
): Promise<BilanData> {
  const { balances, labelMap } = await getAccountBalances(startDate, endDate)

  // ============ ACTIF ============

  // Immobilisations (classe 2)
  // Note: Les amortissements (28) et dépréciations (29) viennent en déduction
  const immobilisationsLines = aggregateByPrefix(balances, '2', ['28', '29'], labelMap)
  const amortissements = aggregateByPrefix(balances, '28', [], labelMap)
  const depreciationsImmo = aggregateByPrefix(balances, '29', [], labelMap)

  // Add amortissements and depreciations as negative values
  const immobilisations: BilanLine[] = [
    ...immobilisationsLines,
    ...amortissements.map(line => ({
      ...line,
      label: `Amortissements - ${line.label}`,
      amount: -Math.abs(line.amount), // Always negative
    })),
    ...depreciationsImmo.map(line => ({
      ...line,
      label: `Dépréciations - ${line.label}`,
      amount: -Math.abs(line.amount),
    })),
  ]

  // Stocks (classe 3)
  const stocksLines = aggregateByPrefix(balances, '3', ['39'], labelMap)
  const depreciationsStocks = aggregateByPrefix(balances, '39', [], labelMap)

  const actifCirculant: BilanLine[] = [
    ...stocksLines,
    ...depreciationsStocks.map(line => ({
      ...line,
      label: `Dépréciations stocks`,
      amount: -Math.abs(line.amount),
    })),
    // Add créances (classe 4 débiteur)
    ...getClasse4Balances(balances, 'debiteur', labelMap),
  ]

  // Trésorerie (classe 5)
  // PCG: Include accounts with positive balance, exclude 5809 (virements internes contra)
  const tresorerieLines: BilanLine[] = []

  for (const [code, balance] of balances) {
    // Only class 5 accounts
    if (!code.startsWith('5')) continue
    // Exclude depreciations (59) and internal transfer contra accounts (5809)
    if (code.startsWith('59') || code.startsWith('5809')) continue
    // Only positive balances (debit > credit) go to ACTIF
    if (balance.solde <= 0) continue

    tresorerieLines.push({
      code,
      label: balance.label,
      amount: balance.solde,
    })
  }

  // Sort by account code
  tresorerieLines.sort((a, b) => a.code.localeCompare(b.code))

  // Add depreciations VMP as negative
  const depreciationsVMP = aggregateByPrefix(balances, '59', [], labelMap)
  for (const line of depreciationsVMP) {
    tresorerieLines.push({
      ...line,
      label: `Dépréciations VMP`,
      amount: -Math.abs(line.amount),
    })
  }

  // Calculate total actif
  const totalActif = [
    ...immobilisations,
    ...actifCirculant,
    ...tresorerieLines,
  ].reduce((sum, line) => sum + line.amount, 0)

  // ============ PASSIF ============

  // Capitaux propres (classe 1, excluding 15 provisions and 16 emprunts)
  const capitauxPropres = aggregateByPrefix(balances, '1', ['15', '16', '17', '18', '19'], labelMap)
    .map(line => ({
      ...line,
      // Capitaux propres: solde créditeur = positif au passif
      amount: -line.amount, // Invert because credit is positive in passif
    }))
    .filter(line => line.amount !== 0)

  // Provisions (classe 15)
  const provisions = aggregateByPrefix(balances, '15', [], labelMap)
    .map(line => ({
      ...line,
      amount: -line.amount,
    }))
    .filter(line => line.amount !== 0)

  // Emprunts (classe 16)
  const emprunts = aggregateByPrefix(balances, '16', [], labelMap)
    .map(line => ({
      ...line,
      amount: -line.amount,
    }))
    .filter(line => line.amount !== 0)

  // Dettes (classe 4 créditeur)
  const dettesClasse4 = getClasse4Balances(balances, 'crediteur', labelMap)

  // Dettes financières (classe 5 avec solde créditeur - ex: virements internes, découverts)
  const dettesFinancieres: BilanLine[] = []
  for (const [code, balance] of balances) {
    if (!code.startsWith('5')) continue
    if (code.startsWith('59')) continue // Exclude depreciations
    // Only credit balances (credit > debit) go to PASSIF
    if (balance.solde >= 0) continue

    dettesFinancieres.push({
      code,
      label: balance.label,
      amount: Math.abs(balance.solde), // Positive amount for passif
    })
  }
  dettesFinancieres.sort((a, b) => a.code.localeCompare(b.code))

  // Résultat de l'exercice (Produits - Charges)
  let resultatExercice = 0
  for (const [code, balance] of balances) {
    if (code.startsWith('6')) {
      resultatExercice -= balance.solde // Charges reduce result
    } else if (code.startsWith('7')) {
      resultatExercice -= balance.solde // Produits (credit) increase result
    }
  }

  const dettes: BilanLine[] = [
    ...emprunts,
    ...dettesClasse4,
    ...dettesFinancieres,
  ]

  // Ajouter le résultat aux capitaux propres
  if (resultatExercice !== 0) {
    capitauxPropres.push({
      code: 'RESULTAT',
      label: resultatExercice >= 0 ? 'Résultat de l\'exercice (bénéfice)' : 'Résultat de l\'exercice (perte)',
      amount: resultatExercice,
    })
  }

  // Calculate total passif
  const totalPassif = [
    ...capitauxPropres,
    ...provisions,
    ...dettes,
  ].reduce((sum, line) => sum + line.amount, 0)

  return {
    actif: {
      immobilisations,
      actifCirculant,
      tresorerie: tresorerieLines,
      totalActif,
    },
    passif: {
      capitauxPropres,
      provisions,
      dettes,
      totalPassif,
    },
  }
}

/**
 * Generate the Compte de Résultat (Income Statement)
 *
 * CHARGES (classe 6):
 * - 60-65: Charges d'exploitation
 * - 66: Charges financières
 * - 67: Charges exceptionnelles
 * - 68: Dotations aux amortissements
 * - 69: Impôts sur les bénéfices
 *
 * PRODUITS (classe 7):
 * - 70-75: Produits d'exploitation
 * - 76: Produits financiers
 * - 77: Produits exceptionnels
 * - 78: Reprises sur amortissements
 */
export async function generateCompteResultat(
  startDate: string,
  endDate: string
): Promise<CompteResultatData> {
  const { balances, labelMap } = await getAccountBalances(startDate, endDate)

  // Helper to get charges/produits for a range of prefixes
  const getChargesForPrefixes = (prefixes: string[]): BilanLine[] => {
    const lines: BilanLine[] = []
    for (const prefix of prefixes) {
      const prefixLines = aggregateByPrefix(balances, prefix, [], labelMap)
      lines.push(...prefixLines.map(line => ({
        ...line,
        // Charges: debit is positive (expense)
        amount: line.amount > 0 ? line.amount : 0,
      })).filter(l => l.amount !== 0))
    }
    return lines
  }

  const getProduitsForPrefixes = (prefixes: string[]): BilanLine[] => {
    const lines: BilanLine[] = []
    for (const prefix of prefixes) {
      const prefixLines = aggregateByPrefix(balances, prefix, [], labelMap)
      lines.push(...prefixLines.map(line => ({
        ...line,
        // Produits: credit is positive (revenue)
        amount: line.amount < 0 ? Math.abs(line.amount) : 0,
      })).filter(l => l.amount !== 0))
    }
    return lines
  }

  // ============ EXPLOITATION ============

  // Produits d'exploitation (70-75)
  const produitsExploitation = getProduitsForPrefixes(['70', '71', '72', '74', '75'])
  // @ts-expect-error Reserved for future use in exploitation totals
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalProduitsExploitation = produitsExploitation.reduce((sum, l) => sum + l.amount, 0)

  // Charges d'exploitation (60-65)
  const chargesExploitation = getChargesForPrefixes(['60', '61', '62', '63', '64', '65'])

  // Add dotations d'exploitation (681)
  const dotationsExploitation: BilanLine[] = []
  for (const [code, balance] of balances) {
    if (code.startsWith('681')) {
      const amount = balance.solde > 0 ? balance.solde : 0
      if (amount !== 0) {
        dotationsExploitation.push({
          code,
          label: getAccountLabel(code, labelMap),
          amount,
        })
      }
    }
  }

  // Add reprises d'exploitation (781)
  const reprisesExploitation: BilanLine[] = []
  for (const [code, balance] of balances) {
    if (code.startsWith('781')) {
      const amount = balance.solde < 0 ? Math.abs(balance.solde) : 0
      if (amount !== 0) {
        reprisesExploitation.push({
          code,
          label: getAccountLabel(code, labelMap),
          amount,
        })
      }
    }
  }

  const chargesExploitationTotal = [...chargesExploitation, ...dotationsExploitation]
  const totalChargesExploitation = chargesExploitationTotal.reduce((sum, l) => sum + l.amount, 0)

  const produitsExploitationTotal = [...produitsExploitation, ...reprisesExploitation]
  const totalProduitsExploitationFinal = produitsExploitationTotal.reduce((sum, l) => sum + l.amount, 0)

  const resultatExploitation = totalProduitsExploitationFinal - totalChargesExploitation

  // ============ FINANCIER ============

  // Produits financiers (76)
  const produitsFinanciers = getProduitsForPrefixes(['76'])

  // Add reprises financières (786)
  const reprisesFinancieres: BilanLine[] = []
  for (const [code, balance] of balances) {
    if (code.startsWith('786')) {
      const amount = balance.solde < 0 ? Math.abs(balance.solde) : 0
      if (amount !== 0) {
        reprisesFinancieres.push({
          code,
          label: getAccountLabel(code, labelMap),
          amount,
        })
      }
    }
  }

  const produitsFinanciersTotal = [...produitsFinanciers, ...reprisesFinancieres]
  const totalProduitsFinanciers = produitsFinanciersTotal.reduce((sum, l) => sum + l.amount, 0)

  // Charges financières (66)
  const chargesFinancieres = getChargesForPrefixes(['66'])

  // Add dotations financières (686)
  const dotationsFinancieres: BilanLine[] = []
  for (const [code, balance] of balances) {
    if (code.startsWith('686')) {
      const amount = balance.solde > 0 ? balance.solde : 0
      if (amount !== 0) {
        dotationsFinancieres.push({
          code,
          label: getAccountLabel(code, labelMap),
          amount,
        })
      }
    }
  }

  const chargesFinancieresTotal = [...chargesFinancieres, ...dotationsFinancieres]
  const totalChargesFinancieres = chargesFinancieresTotal.reduce((sum, l) => sum + l.amount, 0)

  const resultatFinancier = totalProduitsFinanciers - totalChargesFinancieres

  // ============ EXCEPTIONNEL ============

  // Produits exceptionnels (77)
  const produitsExceptionnels = getProduitsForPrefixes(['77'])

  // Add reprises exceptionnelles (787)
  const reprisesExceptionnelles: BilanLine[] = []
  for (const [code, balance] of balances) {
    if (code.startsWith('787')) {
      const amount = balance.solde < 0 ? Math.abs(balance.solde) : 0
      if (amount !== 0) {
        reprisesExceptionnelles.push({
          code,
          label: getAccountLabel(code, labelMap),
          amount,
        })
      }
    }
  }

  const produitsExceptionnelsTotal = [...produitsExceptionnels, ...reprisesExceptionnelles]
  const totalProduitsExceptionnels = produitsExceptionnelsTotal.reduce((sum, l) => sum + l.amount, 0)

  // Charges exceptionnelles (67)
  const chargesExceptionnelles = getChargesForPrefixes(['67'])

  // Add dotations exceptionnelles (687)
  const dotationsExceptionnelles: BilanLine[] = []
  for (const [code, balance] of balances) {
    if (code.startsWith('687')) {
      const amount = balance.solde > 0 ? balance.solde : 0
      if (amount !== 0) {
        dotationsExceptionnelles.push({
          code,
          label: getAccountLabel(code, labelMap),
          amount,
        })
      }
    }
  }

  const chargesExceptionnellesTotal = [...chargesExceptionnelles, ...dotationsExceptionnelles]
  const totalChargesExceptionnelles = chargesExceptionnellesTotal.reduce((sum, l) => sum + l.amount, 0)

  const resultatExceptionnel = totalProduitsExceptionnels - totalChargesExceptionnelles

  // ============ IMPÔTS ============

  // Impôts sur les bénéfices (69)
  let impots = 0
  for (const [code, balance] of balances) {
    if (code.startsWith('69')) {
      impots += balance.solde > 0 ? balance.solde : 0
    }
  }

  // ============ RÉSULTAT NET ============

  const resultatNet = resultatExploitation + resultatFinancier + resultatExceptionnel - impots

  return {
    exploitation: {
      produits: produitsExploitationTotal,
      charges: chargesExploitationTotal,
      resultat: resultatExploitation,
    },
    financier: {
      produits: produitsFinanciersTotal,
      charges: chargesFinancieresTotal,
      resultat: resultatFinancier,
    },
    exceptionnel: {
      produits: produitsExceptionnelsTotal,
      charges: chargesExceptionnellesTotal,
      resultat: resultatExceptionnel,
    },
    impots,
    resultatNet,
  }
}

/**
 * Calculate key financial ratios
 */
export async function calculateRatios(
  startDate: string,
  endDate: string
): Promise<{
  fondDeRoulement: number
  besoinFondDeRoulement: number
  tresorerieNette: number
  ratioLiquidite: number
  ratioEndettement: number
  margeNette: number
}> {
  const bilan = await generateBilan(startDate, endDate)
  const cr = await generateCompteResultat(startDate, endDate)

  // Calcul des agrégats
  const actifImmobilise = bilan.actif.immobilisations.reduce((sum, l) => sum + l.amount, 0)
  const actifCirculant = bilan.actif.actifCirculant.reduce((sum, l) => sum + l.amount, 0)
  const tresorerie = bilan.actif.tresorerie.reduce((sum, l) => sum + l.amount, 0)

  const capitauxPropres = bilan.passif.capitauxPropres.reduce((sum, l) => sum + l.amount, 0)
  const provisions = bilan.passif.provisions.reduce((sum, l) => sum + l.amount, 0)
  const dettes = bilan.passif.dettes.reduce((sum, l) => sum + l.amount, 0)

  // Ressources stables = Capitaux propres + Dettes long terme (emprunts)
  const empruntsLongTerme = bilan.passif.dettes
    .filter(d => d.code.startsWith('16'))
    .reduce((sum, l) => sum + l.amount, 0)
  const ressourcesStables = capitauxPropres + provisions + empruntsLongTerme

  // Dettes court terme (hors emprunts)
  const dettesCourtTerme = dettes - empruntsLongTerme

  // Calcul du CA (produits d'exploitation hors reprises)
  const chiffreAffaires = cr.exploitation.produits
    .filter(p => !p.code.startsWith('78'))
    .reduce((sum, l) => sum + l.amount, 0)

  // Fonds de roulement = Ressources stables - Actif immobilisé
  const fondDeRoulement = ressourcesStables - actifImmobilise

  // BFR = Actif circulant - Dettes court terme
  const besoinFondDeRoulement = actifCirculant - dettesCourtTerme

  // Trésorerie nette = FR - BFR (ou Trésorerie actif - Dettes financières CT)
  const tresorerieNette = fondDeRoulement - besoinFondDeRoulement

  // Ratio de liquidité = Actif circulant + Trésorerie / Dettes court terme
  const ratioLiquidite = dettesCourtTerme !== 0
    ? (actifCirculant + tresorerie) / dettesCourtTerme
    : 0

  // Ratio d'endettement = Dettes / Capitaux propres
  const ratioEndettement = capitauxPropres !== 0
    ? dettes / capitauxPropres
    : 0

  // Marge nette = Résultat net / CA
  const margeNette = chiffreAffaires !== 0
    ? cr.resultatNet / chiffreAffaires
    : 0

  return {
    fondDeRoulement,
    besoinFondDeRoulement,
    tresorerieNette,
    ratioLiquidite,
    ratioEndettement,
    margeNette,
  }
}

/**
 * Get summary totals for quick display
 */
export async function getFinancialSummary(
  startDate: string,
  endDate: string
): Promise<{
  totalActif: number
  totalPassif: number
  capitauxPropres: number
  resultatNet: number
  chiffreAffaires: number
  totalCharges: number
  isBalanced: boolean
}> {
  const bilan = await generateBilan(startDate, endDate)
  const cr = await generateCompteResultat(startDate, endDate)

  const capitauxPropres = bilan.passif.capitauxPropres.reduce((sum, l) => sum + l.amount, 0)

  const chiffreAffaires = cr.exploitation.produits
    .filter(p => p.code.startsWith('70'))
    .reduce((sum, l) => sum + l.amount, 0)

  const totalCharges = cr.exploitation.charges.reduce((sum, l) => sum + l.amount, 0)
    + cr.financier.charges.reduce((sum, l) => sum + l.amount, 0)
    + cr.exceptionnel.charges.reduce((sum, l) => sum + l.amount, 0)
    + cr.impots

  // Check if bilan is balanced (actif = passif within 1 cent)
  const isBalanced = Math.abs(bilan.actif.totalActif - bilan.passif.totalPassif) < 0.01

  return {
    totalActif: bilan.actif.totalActif,
    totalPassif: bilan.passif.totalPassif,
    capitauxPropres,
    resultatNet: cr.resultatNet,
    chiffreAffaires,
    totalCharges,
    isBalanced,
  }
}

// ============ Bilan Structuré (Brut / Amort. & dépréc. / Net) ============

interface BalanceSheetItem {
  id: string
  code: string
  label: string
  section: 'actif' | 'passif'
  category: string
  parent_id: string | null
  display_order: number
  is_total: boolean
  is_subtotal: boolean
}

interface BalanceSheetItemRange {
  id: string
  balance_sheet_item_id: string
  account_prefix: string
  nature: 'brut' | 'amort_deprec' | 'simple'
  sign: number
}

/**
 * Generate the Bilan Structuré with Brut / Amortissements & Dépréciations / Net columns
 * Uses the balance_sheet_items and balance_sheet_item_account_ranges tables
 */
export async function generateBilanStructured(
  startDate: string,
  endDate: string
): Promise<BilanDataStructured> {
  // Load balance sheet items configuration
  const { data: items, error: itemsError } = await supabase
    .from('balance_sheet_items')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('display_order', { ascending: true })

  if (itemsError) {
    console.error('Error loading balance sheet items:', itemsError)
    throw new Error(`Erreur chargement postes du bilan: ${itemsError.message}`)
  }

  if (!items || items.length === 0) {
    // Fallback to legacy method if no configuration
    console.warn('No balance sheet items configured, using legacy method')
    const legacyBilan = await generateBilan(startDate, endDate)
    return convertLegacyToStructured(legacyBilan)
  }

  // Load account ranges for all items
  const itemIds = items.map((i: BalanceSheetItem) => i.id)
  const { data: ranges, error: rangesError } = await supabase
    .from('balance_sheet_item_account_ranges')
    .select('*')
    .in('balance_sheet_item_id', itemIds)

  if (rangesError) {
    console.error('Error loading account ranges:', rangesError)
    throw new Error(`Erreur chargement plages de comptes: ${rangesError.message}`)
  }

  // Get trial balance (balance des comptes)
  const { balances } = await getAccountBalances(startDate, endDate)

  // Group ranges by item
  const rangesByItem = new Map<string, BalanceSheetItemRange[]>()
  for (const range of (ranges || [])) {
    const existing = rangesByItem.get(range.balance_sheet_item_id) || []
    existing.push(range)
    rangesByItem.set(range.balance_sheet_item_id, existing)
  }

  // Calculate amounts for each item
  const itemAmounts = new Map<string, { brut: number; amortissement: number; simple: number }>()

  for (const item of items as BalanceSheetItem[]) {
    const itemRanges = rangesByItem.get(item.id) || []
    let brut = 0
    let amortissement = 0
    let simple = 0

    for (const range of itemRanges) {
      // Sum all accounts matching this prefix
      for (const [code, balance] of balances) {
        if (code.startsWith(range.account_prefix)) {
          const amount = balance.solde * (range.sign || 1)

          if (range.nature === 'brut') {
            brut += amount
          } else if (range.nature === 'amort_deprec') {
            amortissement += amount
          } else {
            simple += amount
          }
        }
      }
    }

    itemAmounts.set(item.id, { brut, amortissement, simple })
  }

  // Build hierarchical structure
  const itemsById = new Map<string, BalanceSheetItem>()
  for (const item of items as BalanceSheetItem[]) {
    itemsById.set(item.id, item)
  }

  // Get root items (no parent)
  const actifRoots = (items as BalanceSheetItem[]).filter(i => i.section === 'actif' && !i.parent_id)
  const passifRoots = (items as BalanceSheetItem[]).filter(i => i.section === 'passif' && !i.parent_id)

  // Recursive function to build tree and calculate subtotals
  function buildActifTree(item: BalanceSheetItem): BilanLineStructured {
    const children = (items as BalanceSheetItem[])
      .filter(i => i.parent_id === item.id)
      .sort((a, b) => a.display_order - b.display_order)

    const amounts = itemAmounts.get(item.id) || { brut: 0, amortissement: 0, simple: 0 }

    let childrenBuilt: BilanLineStructured[] | undefined
    let totalBrut = amounts.brut + amounts.simple
    let totalAmortissement = amounts.amortissement

    if (children.length > 0) {
      childrenBuilt = children.map(c => buildActifTree(c))
      // Sum children totals for subtotals
      if (item.is_subtotal || item.is_total) {
        totalBrut = childrenBuilt.reduce((sum, c) => sum + c.brut, 0)
        totalAmortissement = childrenBuilt.reduce((sum, c) => sum + c.amortissement, 0)
      }
    }

    return {
      id: item.id,
      code: item.code,
      label: item.label,
      brut: totalBrut,
      amortissement: Math.abs(totalAmortissement), // Amortissements are always shown positive
      net: totalBrut - Math.abs(totalAmortissement),
      isSubtotal: item.is_subtotal,
      isTotal: item.is_total,
      children: childrenBuilt,
    }
  }

  function buildPassifTree(item: BalanceSheetItem): BilanPassifLine {
    const children = (items as BalanceSheetItem[])
      .filter(i => i.parent_id === item.id)
      .sort((a, b) => a.display_order - b.display_order)

    const amounts = itemAmounts.get(item.id) || { brut: 0, amortissement: 0, simple: 0 }

    let childrenBuilt: BilanPassifLine[] | undefined
    let totalAmount = amounts.simple

    if (children.length > 0) {
      childrenBuilt = children.map(c => buildPassifTree(c))
      // Sum children totals for subtotals
      if (item.is_subtotal || item.is_total) {
        totalAmount = childrenBuilt.reduce((sum, c) => sum + c.amount, 0)
      }
    }

    return {
      id: item.id,
      code: item.code,
      label: item.label,
      amount: totalAmount,
      isSubtotal: item.is_subtotal,
      isTotal: item.is_total,
      children: childrenBuilt,
    }
  }

  // Build trees
  const actifItems = actifRoots
    .sort((a, b) => a.display_order - b.display_order)
    .map(item => buildActifTree(item))
    .filter(item => !item.isTotal) // Exclude total row from items

  const passifItems = passifRoots
    .sort((a, b) => a.display_order - b.display_order)
    .map(item => buildPassifTree(item))
    .filter(item => !item.isTotal)

  // Calculate totals
  const totalBrut = actifItems.reduce((sum, item) => sum + item.brut, 0)
  const totalAmortissement = actifItems.reduce((sum, item) => sum + item.amortissement, 0)
  const totalNet = totalBrut - totalAmortissement
  const totalPassif = passifItems.reduce((sum, item) => sum + item.amount, 0)

  return {
    actif: {
      items: actifItems,
      totalBrut,
      totalAmortissement,
      totalNet,
    },
    passif: {
      items: passifItems,
      total: totalPassif,
    },
  }
}

/**
 * Convert legacy BilanData to BilanDataStructured for fallback
 */
function convertLegacyToStructured(legacy: BilanData): BilanDataStructured {
  // Convert actif items
  const actifItems: BilanLineStructured[] = []

  // Immobilisations
  if (legacy.actif.immobilisations.length > 0) {
    const immoChildren: BilanLineStructured[] = legacy.actif.immobilisations.map((line, idx) => ({
      id: `immo-${idx}`,
      code: line.code,
      label: line.label,
      brut: line.amount > 0 ? line.amount : 0,
      amortissement: line.amount < 0 ? Math.abs(line.amount) : 0,
      net: line.amount,
    }))

    const totalBrut = immoChildren.reduce((sum, c) => sum + c.brut, 0)
    const totalAmort = immoChildren.reduce((sum, c) => sum + c.amortissement, 0)

    actifItems.push({
      id: 'actif-immobilise',
      code: 'ACTIF_IMMO',
      label: 'ACTIF IMMOBILISÉ',
      brut: totalBrut,
      amortissement: totalAmort,
      net: totalBrut - totalAmort,
      isSubtotal: true,
      children: immoChildren.filter(c => c.net !== 0),
    })
  }

  // Actif circulant
  if (legacy.actif.actifCirculant.length > 0) {
    const circChildren: BilanLineStructured[] = legacy.actif.actifCirculant.map((line, idx) => ({
      id: `circ-${idx}`,
      code: line.code,
      label: line.label,
      brut: line.amount > 0 ? line.amount : 0,
      amortissement: line.amount < 0 ? Math.abs(line.amount) : 0,
      net: line.amount,
    }))

    const totalBrut = circChildren.reduce((sum, c) => sum + c.brut, 0)
    const totalAmort = circChildren.reduce((sum, c) => sum + c.amortissement, 0)

    actifItems.push({
      id: 'actif-circulant',
      code: 'ACTIF_CIRC',
      label: 'ACTIF CIRCULANT',
      brut: totalBrut,
      amortissement: totalAmort,
      net: totalBrut - totalAmort,
      isSubtotal: true,
      children: circChildren.filter(c => c.net !== 0),
    })
  }

  // Trésorerie
  if (legacy.actif.tresorerie.length > 0) {
    const tresoChildren: BilanLineStructured[] = legacy.actif.tresorerie.map((line, idx) => ({
      id: `treso-${idx}`,
      code: line.code,
      label: line.label,
      brut: line.amount,
      amortissement: 0,
      net: line.amount,
    }))

    const totalNet = tresoChildren.reduce((sum, c) => sum + c.net, 0)

    actifItems.push({
      id: 'tresorerie',
      code: 'TRESORERIE',
      label: 'TRÉSORERIE',
      brut: totalNet,
      amortissement: 0,
      net: totalNet,
      isSubtotal: true,
      children: tresoChildren.filter(c => c.net !== 0),
    })
  }

  // Convert passif items
  const passifItems: BilanPassifLine[] = []

  // Capitaux propres
  if (legacy.passif.capitauxPropres.length > 0) {
    const cpChildren: BilanPassifLine[] = legacy.passif.capitauxPropres.map((line, idx) => ({
      id: `cp-${idx}`,
      code: line.code,
      label: line.label,
      amount: line.amount,
    }))

    passifItems.push({
      id: 'capitaux-propres',
      code: 'CAP_PROPRES',
      label: 'CAPITAUX PROPRES',
      amount: cpChildren.reduce((sum, c) => sum + c.amount, 0),
      isSubtotal: true,
      children: cpChildren.filter(c => c.amount !== 0),
    })
  }

  // Provisions
  if (legacy.passif.provisions.length > 0) {
    const provChildren: BilanPassifLine[] = legacy.passif.provisions.map((line, idx) => ({
      id: `prov-${idx}`,
      code: line.code,
      label: line.label,
      amount: line.amount,
    }))

    passifItems.push({
      id: 'provisions',
      code: 'PROVISIONS',
      label: 'PROVISIONS',
      amount: provChildren.reduce((sum, c) => sum + c.amount, 0),
      isSubtotal: true,
      children: provChildren.filter(c => c.amount !== 0),
    })
  }

  // Dettes
  if (legacy.passif.dettes.length > 0) {
    const detteChildren: BilanPassifLine[] = legacy.passif.dettes.map((line, idx) => ({
      id: `dette-${idx}`,
      code: line.code,
      label: line.label,
      amount: line.amount,
    }))

    passifItems.push({
      id: 'dettes',
      code: 'DETTES',
      label: 'DETTES',
      amount: detteChildren.reduce((sum, c) => sum + c.amount, 0),
      isSubtotal: true,
      children: detteChildren.filter(c => c.amount !== 0),
    })
  }

  const totalBrut = actifItems.reduce((sum, i) => sum + i.brut, 0)
  const totalAmortissement = actifItems.reduce((sum, i) => sum + i.amortissement, 0)

  return {
    actif: {
      items: actifItems,
      totalBrut,
      totalAmortissement,
      totalNet: totalBrut - totalAmortissement,
    },
    passif: {
      items: passifItems,
      total: legacy.passif.totalPassif,
    },
  }
}
