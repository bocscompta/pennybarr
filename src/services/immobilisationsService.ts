// Immobilisations Service - Gestion des actifs immobilisés et amortissements
import { supabase, COMPANY_ID } from '../lib/supabase'
import type {
  Asset,
  AssetFormData,
  AssetFilters,
  AssetDepreciation,
  DepreciationScheduleEntry,
} from '../types/immobilisations'
import type { AccountingEntry, ChartOfAccount } from '../types/database'
import { generatePieceNumber, getJournalOD } from './accountingService'
import { resolveByRole } from './accountResolverService'

// ============ Chart of Accounts Loader ============

/**
 * Load chart_of_accounts from database.
 * @throws Error if query fails or no data returned
 */
async function loadChartOfAccounts(): Promise<ChartOfAccount[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error loading chart_of_accounts:', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }

  if (!data || data.length === 0) {
    console.error('loadChartOfAccounts: no accounts found for company', COMPANY_ID)
    throw new Error('Aucun compte trouvé dans le plan comptable. Vérifiez la configuration.')
  }

  return data
}

// ============ Types pour calculs avancés ============

export interface DepreciationResult {
  /** Année de la dotation */
  year: number
  /** Montant de la dotation */
  amount: number
  /** Amortissements cumulés après la dotation */
  cumulatedDepreciation: number
  /** VNC début de période */
  netBookValueStart: number
  /** VNC fin de période */
  netBookValueEnd: number
  /** Date début de la période */
  periodStart: string
  /** Date fin de la période */
  periodEnd: string
  /** Prorata appliqué (1 = année complète) */
  prorata: number
  /** Taux utilisé */
  rate: number
  /** Méthode utilisée cette année (peut différer si passage linéaire en dégressif) */
  methodUsed: 'linear' | 'degressive'
}

export interface DepreciationPreview {
  asset: Asset
  depreciation: DepreciationResult
  isAlreadyPosted: boolean
  existingDepreciationId?: string
}

// Coefficients fiscaux français 2024 pour l'amortissement dégressif
// Source: CGI art. 39A et BOI-BIC-AMT-20-20-20
const FISCAL_DEGRESSIVE_COEFFICIENTS = {
  // Durée 3-4 ans: coefficient 1.25
  3: 1.25,
  4: 1.25,
  // Durée 5-6 ans: coefficient 1.75
  5: 1.75,
  6: 1.75,
  // Durée > 6 ans: coefficient 2.25
  7: 2.25,
  8: 2.25,
  9: 2.25,
  10: 2.25,
  // Au-delà: 2.25 par défaut
} as const

// ============ CRUD Immobilisations ============

/**
 * Créer une nouvelle immobilisation
 */
export async function createAsset(data: AssetFormData): Promise<Asset> {
  const { data: asset, error } = await supabase
    .from('assets')
    .insert({
      company_id: COMPANY_ID,
      code: data.code,
      name: data.name,
      description: data.description,
      category: data.category,
      acquisition_date: data.acquisitionDate,
      acquisition_value: data.acquisitionValue,
      residual_value: data.residualValue,
      depreciation_method: data.depreciationMethod,
      depreciation_duration_months: data.depreciationDurationMonths,
      depreciation_start_date: data.depreciationStartDate,
      account_code_asset: data.accountCodeAsset,
      account_code_depreciation: data.accountCodeDepreciation,
      account_code_expense: data.accountCodeExpense,
      location: data.location,
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating asset:', error)
    throw new Error(`Erreur création immobilisation: ${error.message}`)
  }

  return asset
}

/**
 * Récupérer une immobilisation par ID
 */
export async function getAsset(assetId: string): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (error) {
    console.error('Error fetching asset:', error)
    throw new Error(`Erreur chargement immobilisation: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Immobilisation non trouvée: ${assetId}`)
  }

  return data
}

/**
 * Mettre à jour une immobilisation
 */
export async function updateAsset(assetId: string, data: Partial<AssetFormData>): Promise<Asset> {
  const updateData: Record<string, unknown> = {}

  if (data.code !== undefined) updateData.code = data.code
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.category !== undefined) updateData.category = data.category
  if (data.acquisitionDate !== undefined) updateData.acquisition_date = data.acquisitionDate
  if (data.acquisitionValue !== undefined) updateData.acquisition_value = data.acquisitionValue
  if (data.residualValue !== undefined) updateData.residual_value = data.residualValue
  if (data.depreciationMethod !== undefined) updateData.depreciation_method = data.depreciationMethod
  if (data.depreciationDurationMonths !== undefined) updateData.depreciation_duration_months = data.depreciationDurationMonths
  if (data.depreciationStartDate !== undefined) updateData.depreciation_start_date = data.depreciationStartDate
  if (data.accountCodeAsset !== undefined) updateData.account_code_asset = data.accountCodeAsset
  if (data.accountCodeDepreciation !== undefined) updateData.account_code_depreciation = data.accountCodeDepreciation
  if (data.accountCodeExpense !== undefined) updateData.account_code_expense = data.accountCodeExpense
  if (data.location !== undefined) updateData.location = data.location

  updateData.updated_at = new Date().toISOString()

  const { data: asset, error } = await supabase
    .from('assets')
    .update(updateData)
    .eq('id', assetId)
    .eq('company_id', COMPANY_ID)
    .select()
    .single()

  if (error) {
    console.error('Error updating asset:', error)
    throw new Error(`Erreur mise à jour immobilisation: ${error.message}`)
  }

  return asset
}

/**
 * Supprimer une immobilisation
 */
export async function deleteAsset(assetId: string): Promise<void> {
  // Vérifier que l'immobilisation n'a pas d'amortissements validés
  const { count, error: countError } = await supabase
    .from('asset_depreciations')
    .select('*', { count: 'exact', head: true })
    .eq('asset_id', assetId)
    .eq('is_posted', true)

  if (countError) {
    console.error('Error checking depreciations:', countError)
    throw new Error(`Erreur vérification amortissements: ${countError.message}`)
  }

  if (count && count > 0) {
    throw new Error('Impossible de supprimer une immobilisation avec des amortissements comptabilisés')
  }

  // Supprimer les amortissements non validés
  const { error: deleteDepError } = await supabase
    .from('asset_depreciations')
    .delete()
    .eq('asset_id', assetId)

  if (deleteDepError) {
    console.error('Error deleting depreciations:', deleteDepError)
    throw new Error(`Erreur suppression amortissements: ${deleteDepError.message}`)
  }

  // Supprimer l'immobilisation
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error deleting asset:', error)
    throw new Error(`Erreur suppression immobilisation: ${error.message}`)
  }
}

/**
 * Lister les immobilisations avec filtres optionnels
 */
export async function listAssets(filters?: AssetFilters): Promise<Asset[]> {
  let query = supabase
    .from('assets')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('code')

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.searchTerm) {
    query = query.or(`name.ilike.%${filters.searchTerm}%,code.ilike.%${filters.searchTerm}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error listing assets:', error)
    throw new Error(`Erreur chargement immobilisations: ${error.message}`)
  }

  if (!data) {
    console.error('listAssets: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour assets')
  }

  return data
}

// ============ Utilitaires de calcul ============

/**
 * Obtenir le coefficient dégressif fiscal français selon la durée d'amortissement
 * Coefficients fiscaux 2024 (CGI art. 39A):
 * - 3-4 ans: 1.25
 * - 5-6 ans: 1.75
 * - > 6 ans: 2.25
 */
function getDegressiveCoefficient(durationYears: number): number {
  if (durationYears <= 4) return 1.25
  if (durationYears <= 6) return 1.75
  return 2.25
}

/**
 * Calcule le nombre de jours entre deux dates (méthode 360 jours)
 * Utilisée pour le prorata temporis en comptabilité française
 */
function getDays360(startDate: Date, endDate: Date): number {
  const startDay = Math.min(startDate.getDate(), 30)
  const startMonth = startDate.getMonth()
  const startYear = startDate.getFullYear()

  const endDay = Math.min(endDate.getDate(), 30)
  const endMonth = endDate.getMonth()
  const endYear = endDate.getFullYear()

  return (
    (endYear - startYear) * 360 +
    (endMonth - startMonth) * 30 +
    (endDay - startDay)
  )
}

/**
 * Calcule le compte d'amortissement automatiquement à partir du compte d'immobilisation
 * Règle PCG: 2xxx -> 28xx (ajouter 8 après le 2)
 * Exemples: 205 -> 2805, 2154 -> 28154, 218 -> 2818
 */
export function getDepreciationAccount(assetAccount: string): string {
  if (!assetAccount || !assetAccount.startsWith('2')) {
    throw new Error(`Compte d'immobilisation invalide: ${assetAccount}. Doit commencer par 2.`)
  }

  // Retirer le premier caractère (2) et ajouter 28 devant
  return '28' + assetAccount.slice(1)
}

/**
 * Vérifie si une immobilisation est totalement amortie à une date donnée
 */
export function isFullyDepreciated(asset: Asset, asOfDate?: string): boolean {
  const checkDate = asOfDate ? new Date(asOfDate) : new Date()
  const startDate = new Date(asset.depreciation_start_date)
  const durationYears = Math.ceil(asset.depreciation_duration_months / 12)
  const endYear = startDate.getFullYear() + durationYears - 1

  return checkDate.getFullYear() > endYear
}

/**
 * Calcule les années restantes d'amortissement
 */
export function getRemainingDepreciationYears(asset: Asset, asOfDate?: string): number {
  const checkDate = asOfDate ? new Date(asOfDate) : new Date()
  const startDate = new Date(asset.depreciation_start_date)
  const durationYears = Math.ceil(asset.depreciation_duration_months / 12)
  const endYear = startDate.getFullYear() + durationYears - 1

  return Math.max(0, endYear - checkDate.getFullYear())
}

// ============ Calculs d'amortissement linéaire ============

/**
 * Calcule l'amortissement linéaire avec prorata temporis
 *
 * Méthode:
 * - Base amortissable = Valeur acquisition - Valeur résiduelle
 * - Annuité = Base / Nombre d'années
 * - Prorata 1ère année = nb jours / 360 (ou nb mois / 12)
 * - Prorata dernière année = complément pour arriver à la base
 */
export function calculateLinearDepreciation(
  acquisitionValue: number,
  residualValue: number,
  durationMonths: number,
  startDate: string,
  year: number
): DepreciationResult {
  const start = new Date(startDate)
  const startYear = start.getFullYear()
  const durationYears = Math.ceil(durationMonths / 12)
  const endYear = startYear + durationYears - 1

  // Base amortissable
  const depreciableBase = acquisitionValue - residualValue

  // Taux linéaire annuel
  const linearRate = 1 / durationYears
  const fullYearAmount = depreciableBase * linearRate

  // Cas hors période
  if (year < startYear) {
    return {
      year,
      amount: 0,
      cumulatedDepreciation: 0,
      netBookValueStart: acquisitionValue,
      netBookValueEnd: acquisitionValue,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      prorata: 0,
      rate: linearRate,
      methodUsed: 'linear',
    }
  }

  if (year > endYear) {
    return {
      year,
      amount: 0,
      cumulatedDepreciation: depreciableBase,
      netBookValueStart: residualValue,
      netBookValueEnd: residualValue,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      prorata: 0,
      rate: linearRate,
      methodUsed: 'linear',
    }
  }

  // Calcul du cumul des années précédentes (récursif)
  let cumulatedBefore = 0
  for (let y = startYear; y < year; y++) {
    const prevResult = calculateLinearDepreciation(
      acquisitionValue, residualValue, durationMonths, startDate, y
    )
    cumulatedBefore += prevResult.amount
  }

  const vncStart = acquisitionValue - cumulatedBefore
  let amount: number
  let prorata: number
  let periodStart: string
  let periodEnd: string

  // Première année: prorata temporis
  if (year === startYear) {
    // Méthode 360 jours
    const yearEndDate = new Date(year, 11, 31)
    const daysRemaining = getDays360(start, yearEndDate)
    prorata = daysRemaining / 360

    amount = Math.round(fullYearAmount * prorata * 100) / 100
    periodStart = startDate
    periodEnd = `${year}-12-31`
  }
  // Dernière année: complément
  else if (year === endYear) {
    // Le reste pour atteindre exactement la base amortissable
    amount = Math.round((depreciableBase - cumulatedBefore) * 100) / 100
    prorata = amount / fullYearAmount
    periodStart = `${year}-01-01`
    periodEnd = `${year}-12-31`
  }
  // Années intermédiaires: année pleine
  else {
    amount = Math.round(fullYearAmount * 100) / 100
    prorata = 1
    periodStart = `${year}-01-01`
    periodEnd = `${year}-12-31`
  }

  const cumulatedDepreciation = Math.round((cumulatedBefore + amount) * 100) / 100
  const vncEnd = Math.round((acquisitionValue - cumulatedDepreciation) * 100) / 100

  return {
    year,
    amount,
    cumulatedDepreciation,
    netBookValueStart: vncStart,
    netBookValueEnd: vncEnd,
    periodStart,
    periodEnd,
    prorata,
    rate: linearRate,
    methodUsed: 'linear',
  }
}

// ============ Calculs d'amortissement dégressif ============

/**
 * Calcule l'amortissement dégressif avec coefficients fiscaux français
 *
 * Méthode:
 * - Taux dégressif = Taux linéaire x Coefficient fiscal
 * - Base = VNC début d'année (pas valeur d'origine)
 * - Passage au linéaire quand le linéaire sur VNC > dégressif
 * - Prorata 1ère année: en mois entiers (méthode fiscale)
 */
export function calculateDegressiveDepreciation(
  acquisitionValue: number,
  residualValue: number,
  durationMonths: number,
  startDate: string,
  year: number,
  customCoefficient?: number
): DepreciationResult {
  const start = new Date(startDate)
  const startYear = start.getFullYear()
  const durationYears = Math.ceil(durationMonths / 12)
  const endYear = startYear + durationYears - 1

  // Base amortissable (utilisée seulement pour comparaison)
  const depreciableBase = acquisitionValue - residualValue

  // Coefficient fiscal
  const coefficient = customCoefficient ||
    FISCAL_DEGRESSIVE_COEFFICIENTS[durationYears as keyof typeof FISCAL_DEGRESSIVE_COEFFICIENTS] ||
    getDegressiveCoefficient(durationYears)

  // Taux dégressif
  const linearRate = 1 / durationYears
  const degressiveRate = linearRate * coefficient

  // Cas hors période
  if (year < startYear) {
    return {
      year,
      amount: 0,
      cumulatedDepreciation: 0,
      netBookValueStart: acquisitionValue,
      netBookValueEnd: acquisitionValue,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      prorata: 0,
      rate: degressiveRate,
      methodUsed: 'degressive',
    }
  }

  // Calcul récursif du cumul et VNC
  let cumulatedBefore = 0
  for (let y = startYear; y < year; y++) {
    const prevResult = calculateDegressiveDepreciation(
      acquisitionValue, residualValue, durationMonths, startDate, y, customCoefficient
    )
    cumulatedBefore += prevResult.amount
  }

  const vncStart = acquisitionValue - cumulatedBefore

  // Si VNC = valeur résiduelle ou dépassement
  if (vncStart <= residualValue || cumulatedBefore >= depreciableBase) {
    return {
      year,
      amount: 0,
      cumulatedDepreciation: depreciableBase,
      netBookValueStart: residualValue,
      netBookValueEnd: residualValue,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      prorata: 0,
      rate: degressiveRate,
      methodUsed: 'degressive',
    }
  }

  let amount: number
  let prorata: number
  let methodUsed: 'linear' | 'degressive' = 'degressive'
  let periodStart: string
  let periodEnd: string

  // Première année: prorata en mois entiers (méthode fiscale française)
  if (year === startYear) {
    const startMonth = start.getMonth() // 0-11
    const monthsRemaining = 12 - startMonth
    prorata = monthsRemaining / 12

    // En dégressif, on applique le taux dégressif sur la valeur d'origine
    amount = Math.round(acquisitionValue * degressiveRate * prorata * 100) / 100
    periodStart = startDate
    periodEnd = `${year}-12-31`
  }
  // Années suivantes
  else {
    const remainingYears = endYear - year + 1

    // Calcul dégressif: taux dégressif sur VNC
    const degressiveAmount = vncStart * degressiveRate

    // Calcul linéaire: VNC restante / années restantes
    // (on soustrait la valeur résiduelle)
    const linearOnVNC = (vncStart - residualValue) / remainingYears

    // On prend le plus avantageux
    if (linearOnVNC > degressiveAmount) {
      // Passage au linéaire
      amount = Math.round(linearOnVNC * 100) / 100
      methodUsed = 'linear'
    } else {
      amount = Math.round(degressiveAmount * 100) / 100
      methodUsed = 'degressive'
    }

    prorata = 1
    periodStart = `${year}-01-01`
    periodEnd = `${year}-12-31`

    // Ne pas dépasser la base amortissable
    if (cumulatedBefore + amount > depreciableBase) {
      amount = Math.round((depreciableBase - cumulatedBefore) * 100) / 100
    }
  }

  const cumulatedDepreciation = Math.round((cumulatedBefore + amount) * 100) / 100
  const vncEnd = Math.round((acquisitionValue - cumulatedDepreciation) * 100) / 100

  return {
    year,
    amount,
    cumulatedDepreciation,
    netBookValueStart: vncStart,
    netBookValueEnd: Math.max(vncEnd, residualValue),
    periodStart,
    periodEnd,
    prorata,
    rate: methodUsed === 'degressive' ? degressiveRate : linearRate,
    methodUsed,
  }
}

// ============ Génération du plan d'amortissement complet ============

/**
 * Génère le tableau d'amortissement complet pour une immobilisation
 * Retourne toutes les années avec leurs dotations calculées
 */
export function generateFullDepreciationSchedule(asset: Asset): DepreciationScheduleEntry[] {
  const startDate = new Date(asset.depreciation_start_date)
  const startYear = startDate.getFullYear()
  const durationYears = Math.ceil(asset.depreciation_duration_months / 12)
  const endYear = startYear + durationYears - 1

  const schedule: DepreciationScheduleEntry[] = []

  for (let year = startYear; year <= endYear; year++) {
    let result: DepreciationResult

    if (asset.depreciation_method === 'linear') {
      result = calculateLinearDepreciation(
        asset.acquisition_value,
        asset.residual_value,
        asset.depreciation_duration_months,
        asset.depreciation_start_date,
        year
      )
    } else {
      result = calculateDegressiveDepreciation(
        asset.acquisition_value,
        asset.residual_value,
        asset.depreciation_duration_months,
        asset.depreciation_start_date,
        year,
        asset.depreciation_rate
      )
    }

    schedule.push({
      year: result.year,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      openingValue: result.netBookValueStart,
      depreciationAmount: result.amount,
      cumulatedDepreciation: result.cumulatedDepreciation,
      closingValue: result.netBookValueEnd,
    })
  }

  return schedule
}

// ============ Calcul d'amortissement (fonction existante améliorée) ============

/**
 * Calculer l'amortissement pour une année donnée
 * Utilise les fonctions de calcul linéaire/dégressif avancées
 */
export function calculateDepreciation(asset: Asset, year: number): AssetDepreciation {
  let result: DepreciationResult

  if (asset.depreciation_method === 'linear') {
    result = calculateLinearDepreciation(
      asset.acquisition_value,
      asset.residual_value,
      asset.depreciation_duration_months,
      asset.depreciation_start_date,
      year
    )
  } else {
    result = calculateDegressiveDepreciation(
      asset.acquisition_value,
      asset.residual_value,
      asset.depreciation_duration_months,
      asset.depreciation_start_date,
      year,
      asset.depreciation_rate
    )
  }

  return {
    id: '',
    asset_id: asset.id,
    fiscal_year_id: '',
    date: result.periodEnd,
    period_start: result.periodStart,
    period_end: result.periodEnd,
    amount: result.amount,
    cumulated_amount: result.cumulatedDepreciation,
    net_book_value: result.netBookValueEnd,
    is_posted: false,
    created_at: new Date().toISOString(),
  }
}

/**
 * Calculer l'amortissement avec détails avancés (prorata, taux, méthode utilisée)
 */
export function calculateDepreciationDetailed(asset: Asset, year: number): DepreciationResult {
  if (asset.depreciation_method === 'linear') {
    return calculateLinearDepreciation(
      asset.acquisition_value,
      asset.residual_value,
      asset.depreciation_duration_months,
      asset.depreciation_start_date,
      year
    )
  } else {
    return calculateDegressiveDepreciation(
      asset.acquisition_value,
      asset.residual_value,
      asset.depreciation_duration_months,
      asset.depreciation_start_date,
      year,
      asset.depreciation_rate
    )
  }
}

/**
 * Prévisualiser les dotations de l'année pour toutes les immobilisations actives
 * Ne génère rien en base, permet d'afficher un aperçu avant validation
 */
export async function previewYearlyDepreciations(year: number): Promise<DepreciationPreview[]> {
  // Récupérer toutes les immobilisations actives
  const assets = await listAssets({ status: 'active' })

  const previews: DepreciationPreview[] = []

  for (const asset of assets) {
    const depreciation = calculateDepreciationDetailed(asset, year)

    // Ne pas inclure si montant = 0
    if (depreciation.amount <= 0) {
      continue
    }

    // Vérifier si un amortissement existe déjà pour cette année
    const { data: existing, error: checkError } = await supabase
      .from('asset_depreciations')
      .select('id, is_posted')
      .eq('asset_id', asset.id)
      .gte('period_start', `${year}-01-01`)
      .lte('period_end', `${year}-12-31`)
      .limit(1)

    if (checkError) {
      console.error('Error checking existing depreciation:', checkError)
      throw new Error(`Erreur vérification amortissement existant: ${checkError.message}`)
    }

    previews.push({
      asset,
      depreciation,
      isAlreadyPosted: existing && existing.length > 0 ? existing[0].is_posted : false,
      existingDepreciationId: existing && existing.length > 0 ? existing[0].id : undefined,
    })
  }

  return previews
}

/**
 * Générer les amortissements de l'année pour toutes les immobilisations actives
 */
export async function generateYearlyDepreciation(year: number): Promise<AssetDepreciation[]> {
  // Récupérer toutes les immobilisations actives
  const assets = await listAssets({ status: 'active' })

  const depreciations: AssetDepreciation[] = []

  for (const asset of assets) {
    const depreciation = calculateDepreciation(asset, year)

    // Ne pas générer si montant = 0
    if (depreciation.amount <= 0) {
      continue
    }

    // Vérifier si un amortissement existe déjà pour cette année
    const { data: existing, error: checkError } = await supabase
      .from('asset_depreciations')
      .select('id')
      .eq('asset_id', asset.id)
      .gte('period_start', `${year}-01-01`)
      .lte('period_end', `${year}-12-31`)
      .limit(1)

    if (checkError) {
      console.error('Error checking existing depreciation:', checkError)
      throw new Error(`Erreur vérification amortissement existant: ${checkError.message}`)
    }

    if (existing && existing.length > 0) {
      console.log(`Depreciation already exists for asset ${asset.code} year ${year}`)
      continue
    }

    // Insérer l'amortissement
    const { data: inserted, error: insertError } = await supabase
      .from('asset_depreciations')
      .insert({
        asset_id: asset.id,
        fiscal_year_id: '', // TODO: lier à l'exercice fiscal
        date: depreciation.date,
        period_start: depreciation.period_start,
        period_end: depreciation.period_end,
        amount: depreciation.amount,
        cumulated_amount: depreciation.cumulated_amount,
        net_book_value: depreciation.net_book_value,
        is_posted: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting depreciation:', insertError)
      throw new Error(`Erreur création amortissement: ${insertError.message}`)
    }

    depreciations.push(inserted)
  }

  console.log(`Generated ${depreciations.length} depreciations for year ${year}`)
  return depreciations
}

/**
 * Générer les écritures comptables pour les dotations aux amortissements de l'année
 * Débit 681 (dotation aux amortissements) / Crédit 28xxx (amortissement immo)
 */
export async function generateDepreciationEntries(year: number): Promise<AccountingEntry[]> {
  // Charger le plan comptable pour résolution dynamique
  const chartOfAccounts = await loadChartOfAccounts()

  // Récupérer les amortissements non comptabilisés de l'année
  const { data: depreciations, error: fetchError } = await supabase
    .from('asset_depreciations')
    .select('*, asset:assets(*)')
    .gte('period_start', `${year}-01-01`)
    .lte('period_end', `${year}-12-31`)
    .eq('is_posted', false)

  if (fetchError) {
    console.error('Error fetching depreciations:', fetchError)
    throw new Error(`Erreur chargement amortissements: ${fetchError.message}`)
  }

  if (!depreciations || depreciations.length === 0) {
    console.log('No depreciations to post for year', year)
    return []
  }

  const entries: AccountingEntry[] = []
  const journalOD = await getJournalOD()
  const pieceNumber = await generatePieceNumber(journalOD)

  for (const dep of depreciations) {
    const asset = dep.asset as Asset
    if (!asset) {
      console.error('Asset not found for depreciation:', dep.id)
      continue
    }

    const label = `Dotation amortissement - ${asset.name} - ${year}`

    // Compte de dotation selon la catégorie (résolu dynamiquement)
    const dotationAccount = asset.category === 'incorporel'
      ? resolveByRole('DOTATION_AMORT_INCORP', chartOfAccounts).code
      : asset.account_code_expense || resolveByRole('DOTATION_AMORT_CORP', chartOfAccounts).code

    // Écriture de dotation
    const entryData: Partial<AccountingEntry>[] = [
      // Débit 681 - Dotation aux amortissements
      {
        company_id: COMPANY_ID,
        journal: journalOD,
        date: dep.date,
        piece_number: pieceNumber,
        label,
        account_code: dotationAccount,
        debit: dep.amount,
        credit: 0,
        is_validated: false,
      },
      // Crédit 28xxx - Amortissement immobilisation
      {
        company_id: COMPANY_ID,
        journal: journalOD,
        date: dep.date,
        piece_number: pieceNumber,
        label,
        account_code: asset.account_code_depreciation,
        debit: 0,
        credit: dep.amount,
        is_validated: false,
      },
    ]

    const { data: insertedEntries, error: insertError } = await supabase
      .from('accounting_entries')
      .insert(entryData)
      .select()

    if (insertError) {
      console.error('Error creating depreciation entries:', insertError)
      throw new Error(`Erreur création écritures amortissement: ${insertError.message}`)
    }

    // Marquer l'amortissement comme comptabilisé
    const { error: updateError } = await supabase
      .from('asset_depreciations')
      .update({
        is_posted: true,
        accounting_entry_id: insertedEntries[0]?.id,
      })
      .eq('id', dep.id)

    if (updateError) {
      console.error('Error updating depreciation status:', updateError)
      throw new Error(`Erreur mise à jour statut amortissement: ${updateError.message}`)
    }

    entries.push(...insertedEntries)
  }

  console.log(`Created ${entries.length} depreciation entries for year ${year}`)
  return entries
}

// ============ Cession d'immobilisation ============

/**
 * Céder une immobilisation (vente)
 * Génère les écritures de cession :
 * - Sortie de l'immobilisation (crédit 2xxx)
 * - Annulation des amortissements (débit 28xxx)
 * - Plus-value (crédit 775) ou moins-value (débit 675)
 * - Encaissement prix de vente (débit 512 ou 462)
 */
export async function sellAsset(
  assetId: string,
  saleDate: string,
  salePrice: number
): Promise<void> {
  // Charger le plan comptable pour résolution dynamique
  const chartOfAccounts = await loadChartOfAccounts()

  // Récupérer l'immobilisation
  const asset = await getAsset(assetId)

  if (asset.status !== 'active') {
    throw new Error('Cette immobilisation n\'est plus active')
  }

  // Calculer les amortissements cumulés à la date de cession
  const saleYear = new Date(saleDate).getFullYear()

  // Récupérer les amortissements déjà enregistrés
  const { data: existingDeps, error: depsError } = await supabase
    .from('asset_depreciations')
    .select('amount')
    .eq('asset_id', assetId)
    .lte('period_end', saleDate)

  if (depsError) {
    console.error('Error fetching depreciations:', depsError)
    throw new Error(`Erreur chargement amortissements: ${depsError.message}`)
  }

  let cumulatedDepreciation = 0
  if (existingDeps) {
    cumulatedDepreciation = existingDeps.reduce((sum, d) => sum + d.amount, 0)
  }

  // Si on est en cours d'année, calculer le prorata de l'année en cours
  const lastDepYear = existingDeps && existingDeps.length > 0
    ? new Date(saleDate).getFullYear() - 1
    : new Date(asset.depreciation_start_date).getFullYear() - 1

  if (saleYear > lastDepYear) {
    const yearlyDep = calculateDepreciation(asset, saleYear)
    // Prorata jusqu'à la date de cession
    const saleMonth = new Date(saleDate).getMonth()
    const prorata = (saleMonth + 1) / 12
    const partialDep = Math.round(yearlyDep.amount * prorata * 100) / 100
    cumulatedDepreciation += partialDep
  }

  // Valeur nette comptable
  const netBookValue = Math.round((asset.acquisition_value - cumulatedDepreciation) * 100) / 100

  // Plus ou moins-value
  const gainLoss = Math.round((salePrice - netBookValue) * 100) / 100

  // Générer les écritures de cession
  const journalOD = await getJournalOD()
  const pieceNumber = await generatePieceNumber(journalOD)
  const label = `Cession immobilisation - ${asset.name}`

  const entries: Partial<AccountingEntry>[] = []

  // 1. Annulation des amortissements cumulés
  // Débit 28xxx (compte amortissement)
  if (cumulatedDepreciation > 0) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: saleDate,
      piece_number: pieceNumber,
      label: `${label} - Annulation amortissements`,
      account_code: asset.account_code_depreciation,
      debit: cumulatedDepreciation,
      credit: 0,
      is_validated: false,
    })
  }

  // 2. Sortie de l'immobilisation
  // Crédit 2xxx (compte immobilisation)
  entries.push({
    company_id: COMPANY_ID,
    journal: journalOD,
    date: saleDate,
    piece_number: pieceNumber,
    label: `${label} - Sortie immobilisation`,
    account_code: asset.account_code_asset,
    debit: 0,
    credit: asset.acquisition_value,
    is_validated: false,
  })

  // 3. Valeur comptable des éléments cédés (VNC)
  // Débit 675 pour la VNC
  if (netBookValue > 0) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: saleDate,
      piece_number: pieceNumber,
      label: `${label} - VNC`,
      account_code: resolveByRole('MOINS_VALUE_CESSION', chartOfAccounts).code,
      debit: netBookValue,
      credit: 0,
      is_validated: false,
    })
  }

  // 4. Prix de cession
  // Crédit 775 (produits de cession)
  if (salePrice > 0) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: saleDate,
      piece_number: pieceNumber,
      label: `${label} - Prix de cession`,
      account_code: resolveByRole('PLUS_VALUE_CESSION', chartOfAccounts).code,
      debit: 0,
      credit: salePrice,
      is_validated: false,
    })
  }

  // 5. Créance sur l'acquéreur (ou banque si encaissement immédiat)
  // Débit 462 (créances sur cession d'immobilisations) ou 512 (banque)
  if (salePrice > 0) {
    entries.push({
      company_id: COMPANY_ID,
      journal: journalOD,
      date: saleDate,
      piece_number: pieceNumber,
      label: `${label} - Créance acquéreur`,
      account_code: '462', // Créances sur cession d'immobilisations
      debit: salePrice,
      credit: 0,
      is_validated: false,
    })
  }

  // Insérer les écritures
  const { error: entriesError } = await supabase
    .from('accounting_entries')
    .insert(entries)

  if (entriesError) {
    console.error('Error creating sale entries:', entriesError)
    throw new Error(`Erreur création écritures de cession: ${entriesError.message}`)
  }

  // Mettre à jour l'immobilisation
  const { error: updateError } = await supabase
    .from('assets')
    .update({
      status: 'disposed',
      disposal_date: saleDate,
      disposal_value: salePrice,
      disposal_reason: 'vente',
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId)

  if (updateError) {
    console.error('Error updating asset status:', updateError)
    throw new Error(`Erreur mise à jour statut immobilisation: ${updateError.message}`)
  }

  console.log(`Asset ${asset.code} sold for ${salePrice}. Gain/Loss: ${gainLoss}`)
}

// ============ Tableaux de bord ============

/**
 * Obtenir le tableau d'amortissement complet d'une immobilisation
 * Inclut les informations sur les amortissements déjà comptabilisés
 */
export async function getDepreciationSchedule(assetId: string): Promise<DepreciationScheduleEntry[]> {
  const asset = await getAsset(assetId)

  // Utiliser la nouvelle fonction de génération
  return generateFullDepreciationSchedule(asset)
}

/**
 * Obtenir le tableau d'amortissement avec statut de comptabilisation
 */
export async function getDepreciationScheduleWithStatus(assetId: string): Promise<(DepreciationScheduleEntry & {
  isPosted: boolean
  depreciationId?: string
})[]> {
  const asset = await getAsset(assetId)
  const schedule = generateFullDepreciationSchedule(asset)

  // Récupérer les amortissements existants
  const { data: existingDeps, error } = await supabase
    .from('asset_depreciations')
    .select('id, period_start, period_end, is_posted')
    .eq('asset_id', assetId)
    .order('period_start')

  if (error) {
    console.error('Error fetching existing depreciations:', error)
    throw new Error(`Erreur chargement amortissements: ${error.message}`)
  }

  // Mapper les statuts
  return schedule.map((entry) => {
    const existing = existingDeps?.find((dep) => {
      const depYear = new Date(dep.period_start).getFullYear()
      return depYear === entry.year
    })

    return {
      ...entry,
      isPosted: existing?.is_posted || false,
      depreciationId: existing?.id,
    }
  })
}

/**
 * Type pour le registre des immobilisations
 */
export interface AssetRegisterEntry {
  asset: Asset
  acquisitionValue: number
  cumulatedDepreciation: number
  netBookValue: number
  depreciationMethod: string
  remainingYears: number
}

/**
 * Obtenir le registre des immobilisations (état des actifs à une date donnée)
 */
export async function getAssetRegister(asOfDate?: string): Promise<AssetRegisterEntry[]> {
  const date = asOfDate || new Date().toISOString().split('T')[0]
  const year = new Date(date).getFullYear()

  // Récupérer toutes les immobilisations (actives ou cédées après la date)
  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .or(`status.eq.active,disposal_date.gt.${date}`)
    .order('code')

  if (error) {
    console.error('Error fetching assets:', error)
    throw new Error(`Erreur chargement immobilisations: ${error.message}`)
  }

  if (!assets) {
    console.error('getAssetRegister: assets is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour assets')
  }

  const register: AssetRegisterEntry[] = []

  for (const asset of assets) {
    // Calculer les amortissements cumulés à la date
    const depreciation = calculateDepreciation(asset, year)

    // Calculer les années restantes
    const startYear = new Date(asset.depreciation_start_date).getFullYear()
    const durationYears = Math.ceil(asset.depreciation_duration_months / 12)
    const endYear = startYear + durationYears - 1
    const remainingYears = Math.max(0, endYear - year)

    register.push({
      asset,
      acquisitionValue: asset.acquisition_value,
      cumulatedDepreciation: depreciation.cumulated_amount,
      netBookValue: depreciation.net_book_value,
      depreciationMethod: asset.depreciation_method === 'linear' ? 'Linéaire' : 'Dégressif',
      remainingYears,
    })
  }

  return register
}
