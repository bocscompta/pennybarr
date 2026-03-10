// Analyse Financiere Service - SIG, CAF et Ratios Financiers (PCG French standard)
import { supabase, COMPANY_ID } from '../lib/supabase'
import { generateBilan } from './etatsFinanciersService'

// ============ Types ============

export interface DateRange {
  startDate: string
  endDate: string
  label?: string
}

interface AccountBalance {
  code: string
  label: string
  debit: number
  credit: number
  solde: number // debit - credit (positif = charge, negatif = produit)
}

// ============ SIG Types ============

export interface SIGData {
  // Marge commerciale = Ventes de marchandises (707) - Achats de marchandises (607) - Variation de stocks marchandises
  margeCommerciale: {
    ventesMarchandises: number      // 707
    achatsMarchandises: number      // 607
    variationStocksMarchandises: number  // 6037
    total: number
  }

  // Production de l'exercice = Production vendue (70 sauf 707) + Production stockee (71) + Production immobilisee (72)
  productionExercice: {
    productionVendue: number        // 701, 702, 703, 704, 705, 706, 708
    productionStockee: number       // 71
    productionImmobilisee: number   // 72
    total: number
  }

  // Valeur ajoutee = Marge commerciale + Production de l'exercice - Consommations en provenance des tiers
  valeurAjoutee: {
    margeCommerciale: number
    productionExercice: number
    consommationsExternes: number   // 60 (sauf 607) + 61 + 62
    total: number
  }

  // EBE = Valeur ajoutee + Subventions d'exploitation - Impots et taxes - Charges de personnel
  excedentBrutExploitation: {
    valeurAjoutee: number
    subventionsExploitation: number  // 74
    impotsTaxes: number              // 63
    chargesPersonnel: number         // 64
    total: number
  }

  // Resultat d'exploitation = EBE + Autres produits - Autres charges + Reprises - Dotations
  resultatExploitation: {
    ebe: number
    autresProduits: number           // 75, 781, 791
    autresCharges: number            // 65, 681
    total: number
  }

  // Resultat courant avant impots = Resultat d'exploitation + Resultat financier
  resultatCourantAvantImpots: {
    resultatExploitation: number
    produitsFinanciers: number       // 76, 786, 796
    chargesFinancieres: number       // 66, 686
    total: number
  }

  // Resultat exceptionnel = Produits exceptionnels - Charges exceptionnelles
  resultatExceptionnel: {
    produitsExceptionnels: number    // 77, 787, 797
    chargesExceptionnelles: number   // 67, 687
    total: number
  }

  // Resultat net = RCAI + Resultat exceptionnel - Impots sur les benefices - Participation salaries
  resultatNet: {
    rcai: number
    resultatExceptionnel: number
    impotsBenefices: number          // 695, 697, 699
    participationSalaries: number    // 691
    total: number
  }
}

export interface SIGEvolution {
  period: DateRange
  sig: SIGData
}

// ============ CAF Types ============

export interface CAFData {
  // Methode additive (a partir du resultat net)
  methodeAdditive: {
    resultatNet: number
    // + Dotations aux amortissements et provisions
    dotationsAmortissementsProvisions: {
      exploitation: number        // 681
      financieres: number         // 686
      exceptionnelles: number     // 687
      total: number
    }
    // - Reprises sur amortissements et provisions
    reprisesAmortissementsProvisions: {
      exploitation: number        // 781
      financieres: number         // 786
      exceptionnelles: number     // 787
      total: number
    }
    // + Valeur comptable des elements d'actif cedes
    valeurComptableElementsCedes: number  // 675
    // - Produits des cessions d'elements d'actif
    produitsCessionsActifs: number        // 775
    // - Quote-part des subventions d'investissement viree au resultat
    quotePartSubventions: number          // 777
    caf: number
  }

  // Methode soustractive (a partir de l'EBE)
  methodeSoustractive: {
    ebe: number
    // + Transferts de charges d'exploitation
    transfertsChargesExploitation: number  // 791
    // + Autres produits d'exploitation
    autresProduitsExploitation: number     // 75
    // - Autres charges d'exploitation
    autresChargesExploitation: number      // 65
    // + Produits financiers (sauf reprises)
    produitsFinanciers: number             // 76
    // - Charges financieres (sauf dotations)
    chargesFinancieres: number             // 66
    // + Produits exceptionnels (sauf reprises et cessions)
    produitsExceptionnels: number          // 77 sauf 775, 777, 787
    // - Charges exceptionnelles (sauf dotations et VNC)
    chargesExceptionnelles: number         // 67 sauf 675, 687
    // - Impots sur les benefices
    impotsBenefices: number                // 695, 697, 699
    // - Participation des salaries
    participationSalaries: number          // 691
    caf: number
  }

  // Utilisation de la CAF
  utilisationCAF: {
    remboursementsEmprunts: number        // Estimation basee sur dettes
    dividendesVerses: number              // Estimation
    autofinancement: number               // CAF - remboursements - dividendes
  }
}

export interface CAFEvolution {
  period: DateRange
  caf: CAFData
}

// ============ Financial Ratios Types ============

export interface FinancialRatios {
  // Ratios de rentabilite
  rentabilite: {
    tauxMargeCommerciale: number      // Marge commerciale / Ventes marchandises
    tauxMargeBrute: number            // (VA / CA) * 100
    tauxValeurAjoutee: number         // VA / Production
    tauxEBE: number                   // EBE / VA
    rentabiliteExploitation: number   // Resultat exploitation / CA
    rentabiliteNette: number          // Resultat net / CA
    rentabiliteEconomique: number     // Resultat exploitation / Actif total
    rentabiliteFinanciere: number     // Resultat net / Capitaux propres
  }

  // Ratios de structure financiere
  structureFinanciere: {
    fondsDeRoulement: number          // Ressources stables - Emplois stables
    besoinFondsRoulement: number      // Actif circulant - Passif circulant
    tresorerieNette: number           // FR - BFR
    ratioEndettement: number          // Dettes / Capitaux propres
    autonomieFinanciere: number       // Capitaux propres / Total passif
    capaciteRemboursement: number     // Dettes financieres / CAF
  }

  // Ratios de liquidite
  liquidite: {
    liquiditeGenerale: number         // Actif circulant / Dettes court terme
    liquiditeReduite: number          // (Actif circulant - Stocks) / Dettes CT
    liquiditeImmediate: number        // Tresorerie / Dettes court terme
  }

  // Ratios d'activite (en jours)
  activite: {
    rotationStocks: number            // Stocks moyens / (Achats/365)
    delaiClientsMoyen: number         // Creances clients / (CA TTC/365)
    delaiFournisseursMoyen: number    // Dettes fournisseurs / (Achats TTC/365)
    cycleDExploitation: number        // Rotation stocks + Delai clients - Delai fournisseurs
  }

  // Indicateurs de productivite
  productivite: {
    valeurAjouteeParSalarie: number   // VA / Effectif (si disponible)
    chargesPersonnelSurVA: number     // Charges personnel / VA
    investissementParSalarie: number  // Immobilisations / Effectif
  }
}

// ============ Helper Functions ============

/**
 * Get account balances for a specific period
 */
async function getAccountBalances(
  startDate: string,
  endDate: string
): Promise<Map<string, AccountBalance>> {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('account_code, debit, credit')
    .eq('company_id', COMPANY_ID)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) {
    console.error('Error fetching accounting entries:', error)
    throw new Error(`Erreur chargement ecritures comptables: ${error.message}`)
  }

  if (!data) {
    console.error('calculateBalances: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour accounting entries')
  }

  // Group by account code
  const balances = new Map<string, AccountBalance>()

  for (const entry of data) {
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
        label: `Compte ${code}`,
        debit,
        credit,
        solde: debit - credit,
      })
    }
  }

  return balances
}

/**
 * Sum balances for accounts matching a set of prefixes
 * For charges (class 6): positive solde = expense
 * For products (class 7): negative solde = revenue (we return absolute value)
 */
function sumAccountsByPrefixes(
  balances: Map<string, AccountBalance>,
  prefixes: string[],
  type: 'charge' | 'produit'
): number {
  let total = 0
  for (const [code, balance] of balances) {
    if (prefixes.some(p => code.startsWith(p))) {
      if (type === 'charge') {
        // Charges: debit is positive
        total += balance.solde > 0 ? balance.solde : 0
      } else {
        // Produits: credit is positive (solde negative)
        total += balance.solde < 0 ? Math.abs(balance.solde) : 0
      }
    }
  }
  return total
}

/**
 * Sum balances for accounts matching prefixes, excluding some
 */
function sumAccountsByPrefixesExcluding(
  balances: Map<string, AccountBalance>,
  prefixes: string[],
  excludePrefixes: string[],
  type: 'charge' | 'produit'
): number {
  let total = 0
  for (const [code, balance] of balances) {
    if (prefixes.some(p => code.startsWith(p)) && !excludePrefixes.some(e => code.startsWith(e))) {
      if (type === 'charge') {
        total += balance.solde > 0 ? balance.solde : 0
      } else {
        total += balance.solde < 0 ? Math.abs(balance.solde) : 0
      }
    }
  }
  return total
}

// ============ SIG Functions ============

/**
 * Calculate SIG (Soldes Intermediaires de Gestion)
 */
export async function calculateSIG(
  startDate: string,
  endDate: string
): Promise<SIGData> {
  const balances = await getAccountBalances(startDate, endDate)

  // ============ Marge Commerciale ============
  // Ventes de marchandises (707)
  const ventesMarchandises = sumAccountsByPrefixes(balances, ['707'], 'produit')
  // Achats de marchandises (607)
  const achatsMarchandises = sumAccountsByPrefixes(balances, ['607'], 'charge')
  // Variation de stocks de marchandises (6037)
  const variationStocksMarchandises = sumAccountsByPrefixes(balances, ['6037'], 'charge')

  const margeCommerciale = {
    ventesMarchandises,
    achatsMarchandises,
    variationStocksMarchandises,
    total: ventesMarchandises - achatsMarchandises - variationStocksMarchandises
  }

  // ============ Production de l'exercice ============
  // Production vendue (70 sauf 707)
  const productionVendue = sumAccountsByPrefixesExcluding(balances, ['70'], ['707'], 'produit')
  // Production stockee (71)
  const productionStockee = sumAccountsByPrefixes(balances, ['71'], 'produit')
  // Production immobilisee (72)
  const productionImmobilisee = sumAccountsByPrefixes(balances, ['72'], 'produit')

  const productionExercice = {
    productionVendue,
    productionStockee,
    productionImmobilisee,
    total: productionVendue + productionStockee + productionImmobilisee
  }

  // ============ Valeur Ajoutee ============
  // Consommations en provenance des tiers = 60 (sauf 607) + 61 + 62
  const consommationsExternes =
    sumAccountsByPrefixesExcluding(balances, ['60'], ['607'], 'charge') +
    sumAccountsByPrefixes(balances, ['61'], 'charge') +
    sumAccountsByPrefixes(balances, ['62'], 'charge')

  const valeurAjoutee = {
    margeCommerciale: margeCommerciale.total,
    productionExercice: productionExercice.total,
    consommationsExternes,
    total: margeCommerciale.total + productionExercice.total - consommationsExternes
  }

  // ============ EBE (Excedent Brut d'Exploitation) ============
  // Subventions d'exploitation (74)
  const subventionsExploitation = sumAccountsByPrefixes(balances, ['74'], 'produit')
  // Impots et taxes (63)
  const impotsTaxes = sumAccountsByPrefixes(balances, ['63'], 'charge')
  // Charges de personnel (64)
  const chargesPersonnel = sumAccountsByPrefixes(balances, ['64'], 'charge')

  const excedentBrutExploitation = {
    valeurAjoutee: valeurAjoutee.total,
    subventionsExploitation,
    impotsTaxes,
    chargesPersonnel,
    total: valeurAjoutee.total + subventionsExploitation - impotsTaxes - chargesPersonnel
  }

  // ============ Resultat d'Exploitation ============
  // Autres produits (75) + Reprises exploitation (781) + Transferts charges (791)
  const autresProduitsExploitation =
    sumAccountsByPrefixes(balances, ['75'], 'produit') +
    sumAccountsByPrefixes(balances, ['781'], 'produit') +
    sumAccountsByPrefixes(balances, ['791'], 'produit')
  // Autres charges (65) + Dotations exploitation (681)
  const autresChargesExploitation =
    sumAccountsByPrefixes(balances, ['65'], 'charge') +
    sumAccountsByPrefixes(balances, ['681'], 'charge')

  const resultatExploitation = {
    ebe: excedentBrutExploitation.total,
    autresProduits: autresProduitsExploitation,
    autresCharges: autresChargesExploitation,
    total: excedentBrutExploitation.total + autresProduitsExploitation - autresChargesExploitation
  }

  // ============ Resultat Courant Avant Impots ============
  // Produits financiers (76) + Reprises financieres (786)
  const produitsFinanciers =
    sumAccountsByPrefixes(balances, ['76'], 'produit') +
    sumAccountsByPrefixes(balances, ['786'], 'produit') +
    sumAccountsByPrefixes(balances, ['796'], 'produit')
  // Charges financieres (66) + Dotations financieres (686)
  const chargesFinancieres =
    sumAccountsByPrefixes(balances, ['66'], 'charge') +
    sumAccountsByPrefixes(balances, ['686'], 'charge')

  const resultatCourantAvantImpots = {
    resultatExploitation: resultatExploitation.total,
    produitsFinanciers,
    chargesFinancieres,
    total: resultatExploitation.total + produitsFinanciers - chargesFinancieres
  }

  // ============ Resultat Exceptionnel ============
  // Produits exceptionnels (77) + Reprises exceptionnelles (787)
  const produitsExceptionnels =
    sumAccountsByPrefixes(balances, ['77'], 'produit') +
    sumAccountsByPrefixes(balances, ['787'], 'produit') +
    sumAccountsByPrefixes(balances, ['797'], 'produit')
  // Charges exceptionnelles (67) + Dotations exceptionnelles (687)
  const chargesExceptionnelles =
    sumAccountsByPrefixes(balances, ['67'], 'charge') +
    sumAccountsByPrefixes(balances, ['687'], 'charge')

  const resultatExceptionnel = {
    produitsExceptionnels,
    chargesExceptionnelles,
    total: produitsExceptionnels - chargesExceptionnelles
  }

  // ============ Resultat Net ============
  // Impots sur les benefices (695, 697, 699)
  const impotsBenefices = sumAccountsByPrefixes(balances, ['695', '697', '698', '699'], 'charge')
  // Participation des salaries (691)
  const participationSalaries = sumAccountsByPrefixes(balances, ['691'], 'charge')

  const resultatNet = {
    rcai: resultatCourantAvantImpots.total,
    resultatExceptionnel: resultatExceptionnel.total,
    impotsBenefices,
    participationSalaries,
    total: resultatCourantAvantImpots.total + resultatExceptionnel.total - impotsBenefices - participationSalaries
  }

  return {
    margeCommerciale,
    productionExercice,
    valeurAjoutee,
    excedentBrutExploitation,
    resultatExploitation,
    resultatCourantAvantImpots,
    resultatExceptionnel,
    resultatNet
  }
}

/**
 * Get SIG evolution over multiple periods
 */
export async function getSIGEvolution(periods: DateRange[]): Promise<SIGEvolution[]> {
  const results: SIGEvolution[] = []

  for (const period of periods) {
    const sig = await calculateSIG(period.startDate, period.endDate)
    results.push({ period, sig })
  }

  return results
}

// ============ CAF Functions ============

/**
 * Calculate CAF (Capacite d'Auto-Financement)
 */
export async function calculateCAF(
  startDate: string,
  endDate: string
): Promise<CAFData> {
  const balances = await getAccountBalances(startDate, endDate)
  const sig = await calculateSIG(startDate, endDate)

  // ============ Methode Additive ============

  // Dotations aux amortissements et provisions
  const dotationsExploitation = sumAccountsByPrefixes(balances, ['681'], 'charge')
  const dotationsFinancieres = sumAccountsByPrefixes(balances, ['686'], 'charge')
  const dotationsExceptionnelles = sumAccountsByPrefixes(balances, ['687'], 'charge')
  const totalDotations = dotationsExploitation + dotationsFinancieres + dotationsExceptionnelles

  // Reprises sur amortissements et provisions
  const reprisesExploitation = sumAccountsByPrefixes(balances, ['781'], 'produit')
  const reprisesFinancieres = sumAccountsByPrefixes(balances, ['786'], 'produit')
  const reprisesExceptionnelles = sumAccountsByPrefixes(balances, ['787'], 'produit')
  const totalReprises = reprisesExploitation + reprisesFinancieres + reprisesExceptionnelles

  // Valeur comptable des elements d'actif cedes (675)
  const valeurComptableElementsCedes = sumAccountsByPrefixes(balances, ['675'], 'charge')

  // Produits des cessions d'elements d'actif (775)
  const produitsCessionsActifs = sumAccountsByPrefixes(balances, ['775'], 'produit')

  // Quote-part des subventions d'investissement viree au resultat (777)
  const quotePartSubventions = sumAccountsByPrefixes(balances, ['777'], 'produit')

  const cafAdditive = sig.resultatNet.total
    + totalDotations
    - totalReprises
    + valeurComptableElementsCedes
    - produitsCessionsActifs
    - quotePartSubventions

  // ============ Methode Soustractive ============

  // Transferts de charges d'exploitation (791)
  const transfertsChargesExploitation = sumAccountsByPrefixes(balances, ['791'], 'produit')

  // Autres produits d'exploitation (75)
  const autresProduitsExploitation = sumAccountsByPrefixes(balances, ['75'], 'produit')

  // Autres charges d'exploitation (65)
  const autresChargesExploitation = sumAccountsByPrefixes(balances, ['65'], 'charge')

  // Produits financiers (76 uniquement, hors reprises)
  const produitsFinanciersHorsReprises = sumAccountsByPrefixes(balances, ['76'], 'produit')

  // Charges financieres (66 uniquement, hors dotations)
  const chargesFinancieresHorsDotations = sumAccountsByPrefixes(balances, ['66'], 'charge')

  // Produits exceptionnels (77 sauf 775, 777) - hors reprises (787)
  const produitsExceptionnelsHorsCessions = sumAccountsByPrefixesExcluding(
    balances,
    ['77'],
    ['775', '777', '787'],
    'produit'
  )

  // Charges exceptionnelles (67 sauf 675) - hors dotations (687)
  const chargesExceptionnellesHorsVNC = sumAccountsByPrefixesExcluding(
    balances,
    ['67'],
    ['675', '687'],
    'charge'
  )

  // Impots sur les benefices
  const impotsBenefices = sumAccountsByPrefixes(balances, ['695', '697', '698', '699'], 'charge')

  // Participation des salaries (691)
  const participationSalaries = sumAccountsByPrefixes(balances, ['691'], 'charge')

  const cafSoustractive = sig.excedentBrutExploitation.total
    + transfertsChargesExploitation
    + autresProduitsExploitation
    - autresChargesExploitation
    + produitsFinanciersHorsReprises
    - chargesFinancieresHorsDotations
    + produitsExceptionnelsHorsCessions
    - chargesExceptionnellesHorsVNC
    - impotsBenefices
    - participationSalaries

  // ============ Utilisation de la CAF (Estimation) ============
  // Note: Ces valeurs necessiteraient des donnees complementaires
  // Ici on utilise des estimations basees sur les dettes
  const remboursementsEmprunts = 0  // A calculer avec donnees d'emprunts
  const dividendesVerses = 0        // A calculer avec donnees de distribution
  const autofinancement = cafAdditive - remboursementsEmprunts - dividendesVerses

  return {
    methodeAdditive: {
      resultatNet: sig.resultatNet.total,
      dotationsAmortissementsProvisions: {
        exploitation: dotationsExploitation,
        financieres: dotationsFinancieres,
        exceptionnelles: dotationsExceptionnelles,
        total: totalDotations
      },
      reprisesAmortissementsProvisions: {
        exploitation: reprisesExploitation,
        financieres: reprisesFinancieres,
        exceptionnelles: reprisesExceptionnelles,
        total: totalReprises
      },
      valeurComptableElementsCedes,
      produitsCessionsActifs,
      quotePartSubventions,
      caf: cafAdditive
    },
    methodeSoustractive: {
      ebe: sig.excedentBrutExploitation.total,
      transfertsChargesExploitation,
      autresProduitsExploitation,
      autresChargesExploitation,
      produitsFinanciers: produitsFinanciersHorsReprises,
      chargesFinancieres: chargesFinancieresHorsDotations,
      produitsExceptionnels: produitsExceptionnelsHorsCessions,
      chargesExceptionnelles: chargesExceptionnellesHorsVNC,
      impotsBenefices,
      participationSalaries,
      caf: cafSoustractive
    },
    utilisationCAF: {
      remboursementsEmprunts,
      dividendesVerses,
      autofinancement
    }
  }
}

/**
 * Get CAF evolution over multiple periods
 */
export async function getCAFEvolution(periods: DateRange[]): Promise<CAFEvolution[]> {
  const results: CAFEvolution[] = []

  for (const period of periods) {
    const caf = await calculateCAF(period.startDate, period.endDate)
    results.push({ period, caf })
  }

  return results
}

// ============ Financial Ratios Functions ============

/**
 * Calculate comprehensive financial ratios
 */
export async function calculateFinancialRatios(
  startDate: string,
  endDate: string
): Promise<FinancialRatios> {
  const balances = await getAccountBalances(startDate, endDate)
  const sig = await calculateSIG(startDate, endDate)
  const caf = await calculateCAF(startDate, endDate)
  const bilan = await generateBilan(startDate, endDate)

  // ============ Calculs preliminaires ============

  // Chiffre d'affaires total (70)
  const chiffreAffaires = sumAccountsByPrefixes(balances, ['70'], 'produit')

  // Actifs
  const actifImmobilise = bilan.actif.immobilisations.reduce((sum, l) => sum + l.amount, 0)
  const actifCirculant = bilan.actif.actifCirculant.reduce((sum, l) => sum + l.amount, 0)
  const tresorerie = bilan.actif.tresorerie.reduce((sum, l) => sum + l.amount, 0)
  const totalActif = bilan.actif.totalActif

  // Stocks (31-37)
  const stocks = sumAccountsByPrefixesExcluding(balances, ['3'], ['39'], 'charge')

  // Passifs
  const capitauxPropres = bilan.passif.capitauxPropres.reduce((sum, l) => sum + l.amount, 0)
  const totalPassif = bilan.passif.totalPassif

  // Dettes
  const totalDettes = bilan.passif.dettes.reduce((sum, l) => sum + l.amount, 0)
  const dettesFinancieres = bilan.passif.dettes
    .filter(d => d.code.startsWith('16'))
    .reduce((sum, l) => sum + l.amount, 0)
  const dettesCourtTerme = totalDettes - dettesFinancieres

  // Ressources stables
  const provisions = bilan.passif.provisions.reduce((sum, l) => sum + l.amount, 0)
  const ressourcesStables = capitauxPropres + provisions + dettesFinancieres

  // Creances clients (411)
  const creancesClients = sumAccountsByPrefixes(balances, ['411'], 'charge')

  // Dettes fournisseurs (401)
  const dettesFournisseurs = sumAccountsByPrefixes(balances, ['401'], 'produit')

  // Achats (60)
  const achats = sumAccountsByPrefixes(balances, ['60'], 'charge')

  // ============ Ratios de Rentabilite ============

  const tauxMargeCommerciale = sig.margeCommerciale.ventesMarchandises !== 0
    ? (sig.margeCommerciale.total / sig.margeCommerciale.ventesMarchandises) * 100
    : 0

  const tauxMargeBrute = chiffreAffaires !== 0
    ? (sig.valeurAjoutee.total / chiffreAffaires) * 100
    : 0

  const tauxValeurAjoutee = sig.productionExercice.total !== 0
    ? (sig.valeurAjoutee.total / sig.productionExercice.total) * 100
    : 0

  const tauxEBE = sig.valeurAjoutee.total !== 0
    ? (sig.excedentBrutExploitation.total / sig.valeurAjoutee.total) * 100
    : 0

  const rentabiliteExploitation = chiffreAffaires !== 0
    ? (sig.resultatExploitation.total / chiffreAffaires) * 100
    : 0

  const rentabiliteNette = chiffreAffaires !== 0
    ? (sig.resultatNet.total / chiffreAffaires) * 100
    : 0

  const rentabiliteEconomique = totalActif !== 0
    ? (sig.resultatExploitation.total / totalActif) * 100
    : 0

  const rentabiliteFinanciere = capitauxPropres !== 0
    ? (sig.resultatNet.total / capitauxPropres) * 100
    : 0

  // ============ Ratios de Structure Financiere ============

  const fondsDeRoulement = ressourcesStables - actifImmobilise
  const besoinFondsRoulement = actifCirculant - dettesCourtTerme
  const tresorerieNette = fondsDeRoulement - besoinFondsRoulement

  const ratioEndettement = capitauxPropres !== 0
    ? totalDettes / capitauxPropres
    : 0

  const autonomieFinanciere = totalPassif !== 0
    ? (capitauxPropres / totalPassif) * 100
    : 0

  const capaciteRemboursement = caf.methodeAdditive.caf !== 0
    ? dettesFinancieres / caf.methodeAdditive.caf
    : 0

  // ============ Ratios de Liquidite ============

  const liquiditeGenerale = dettesCourtTerme !== 0
    ? (actifCirculant + tresorerie) / dettesCourtTerme
    : 0

  const liquiditeReduite = dettesCourtTerme !== 0
    ? (actifCirculant + tresorerie - stocks) / dettesCourtTerme
    : 0

  const liquiditeImmediate = dettesCourtTerme !== 0
    ? tresorerie / dettesCourtTerme
    : 0

  // ============ Ratios d'Activite (en jours) ============

  const rotationStocks = achats !== 0
    ? (stocks / (achats / 365))
    : 0

  // Estimation CA TTC (CA HT * 1.2)
  const caTTC = chiffreAffaires * 1.2
  const delaiClientsMoyen = caTTC !== 0
    ? (creancesClients / (caTTC / 365))
    : 0

  // Estimation Achats TTC (Achats HT * 1.2)
  const achatsTTC = achats * 1.2
  const delaiFournisseursMoyen = achatsTTC !== 0
    ? (dettesFournisseurs / (achatsTTC / 365))
    : 0

  const cycleDExploitation = rotationStocks + delaiClientsMoyen - delaiFournisseursMoyen

  // ============ Indicateurs de Productivite ============
  // Note: L'effectif n'est pas disponible dans les donnees comptables
  // On utilise une estimation ou on retourne 0

  const chargesPersonnel = sig.excedentBrutExploitation.chargesPersonnel
  const chargesPersonnelSurVA = sig.valeurAjoutee.total !== 0
    ? (chargesPersonnel / sig.valeurAjoutee.total) * 100
    : 0

  return {
    rentabilite: {
      tauxMargeCommerciale,
      tauxMargeBrute,
      tauxValeurAjoutee,
      tauxEBE,
      rentabiliteExploitation,
      rentabiliteNette,
      rentabiliteEconomique,
      rentabiliteFinanciere
    },
    structureFinanciere: {
      fondsDeRoulement,
      besoinFondsRoulement,
      tresorerieNette,
      ratioEndettement,
      autonomieFinanciere,
      capaciteRemboursement
    },
    liquidite: {
      liquiditeGenerale,
      liquiditeReduite,
      liquiditeImmediate
    },
    activite: {
      rotationStocks,
      delaiClientsMoyen,
      delaiFournisseursMoyen,
      cycleDExploitation
    },
    productivite: {
      valeurAjouteeParSalarie: 0, // Necessite les donnees d'effectif
      chargesPersonnelSurVA,
      investissementParSalarie: 0 // Necessite les donnees d'effectif
    }
  }
}

// ============ Utility Functions ============

/**
 * Generate standard periods for comparison (current year, previous year, etc.)
 */
export function generateStandardPeriods(year: number): DateRange[] {
  return [
    {
      startDate: `${year - 1}-01-01`,
      endDate: `${year - 1}-12-31`,
      label: `Exercice ${year - 1}`
    },
    {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      label: `Exercice ${year}`
    }
  ]
}

/**
 * Generate quarterly periods for a year
 */
export function generateQuarterlyPeriods(year: number): DateRange[] {
  return [
    {
      startDate: `${year}-01-01`,
      endDate: `${year}-03-31`,
      label: `T1 ${year}`
    },
    {
      startDate: `${year}-04-01`,
      endDate: `${year}-06-30`,
      label: `T2 ${year}`
    },
    {
      startDate: `${year}-07-01`,
      endDate: `${year}-09-30`,
      label: `T3 ${year}`
    },
    {
      startDate: `${year}-10-01`,
      endDate: `${year}-12-31`,
      label: `T4 ${year}`
    }
  ]
}

/**
 * Generate monthly periods for a year
 */
export function generateMonthlyPeriods(year: number): DateRange[] {
  const months = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
  ]

  return months.map((label, index) => {
    const month = (index + 1).toString().padStart(2, '0')
    const lastDay = new Date(year, index + 1, 0).getDate()
    return {
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${lastDay}`,
      label: `${label} ${year}`
    }
  })
}

/**
 * Get financial analysis summary (quick overview)
 */
export async function getAnalyseFinanciereSummary(
  startDate: string,
  endDate: string
): Promise<{
  sig: {
    margeCommerciale: number
    valeurAjoutee: number
    ebe: number
    resultatExploitation: number
    resultatNet: number
  }
  caf: number
  ratios: {
    rentabiliteNette: number
    fondsDeRoulement: number
    tresorerieNette: number
    ratioEndettement: number
    liquiditeGenerale: number
  }
}> {
  const sig = await calculateSIG(startDate, endDate)
  const caf = await calculateCAF(startDate, endDate)
  const ratios = await calculateFinancialRatios(startDate, endDate)

  return {
    sig: {
      margeCommerciale: sig.margeCommerciale.total,
      valeurAjoutee: sig.valeurAjoutee.total,
      ebe: sig.excedentBrutExploitation.total,
      resultatExploitation: sig.resultatExploitation.total,
      resultatNet: sig.resultatNet.total
    },
    caf: caf.methodeAdditive.caf,
    ratios: {
      rentabiliteNette: ratios.rentabilite.rentabiliteNette,
      fondsDeRoulement: ratios.structureFinanciere.fondsDeRoulement,
      tresorerieNette: ratios.structureFinanciere.tresorerieNette,
      ratioEndettement: ratios.structureFinanciere.ratioEndettement,
      liquiditeGenerale: ratios.liquidite.liquiditeGenerale
    }
  }
}
