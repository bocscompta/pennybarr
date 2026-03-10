/**
 * Service de classification automatique des comptes de contrepartie.
 *
 * Logique de priorité :
 * 1. Historique fournisseur (le compte le plus utilisé pour ce tiers)
 * 2. Matching par mots-clés depuis account_classification_rules (DB)
 * 3. Aucune suggestion si rien ne matche (pas de fallback)
 */
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { AccountClassificationRule } from '../types/database'

export interface AccountSuggestion {
  code: string
  label: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

// ============ Historique fournisseur ============

/**
 * Cherche le compte de charge le plus utilisé pour un fournisseur donné.
 * Regarde les écritures comptables liées aux factures de ce tiers.
 */
async function getHistoricalAccountForSupplier(
  supplierName: string
): Promise<AccountSuggestion | null> {
  // Chercher le tiers par nom
  const { data: thirdParty } = await supabase
    .from('third_parties')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .ilike('name', supplierName.trim().toUpperCase())
    .maybeSingle()

  if (!thirdParty) return null

  // Chercher les factures de ce tiers
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('third_party_id', thirdParty.id)

  if (!invoices || invoices.length === 0) return null

  const invoiceIds = invoices.map(inv => inv.id)

  // Chercher les écritures de charge (comptes 6xxx) liées à ces factures
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('account_code')
    .eq('company_id', COMPANY_ID)
    .in('linked_invoice_id', invoiceIds)
    .like('account_code', '6%')
    .gt('debit', 0)

  if (!entries || entries.length === 0) return null

  // Compter les occurrences de chaque compte
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const code = entry.account_code
    counts.set(code, (counts.get(code) || 0) + 1)
  }

  // Trouver le compte le plus fréquent
  let bestCode = ''
  let bestCount = 0
  for (const [code, count] of counts) {
    if (count > bestCount) {
      bestCode = code
      bestCount = count
    }
  }

  if (!bestCode) return null

  // Chercher le libellé du compte
  const { data: account } = await supabase
    .from('chart_of_accounts')
    .select('label')
    .eq('company_id', COMPANY_ID)
    .eq('code', bestCode)
    .maybeSingle()

  if (!account) {
    console.error(`getHistoricalAccountForSupplier: account label not found for code '${bestCode}'`)
    throw new Error(`Libellé du compte '${bestCode}' non trouvé dans le plan comptable`)
  }

  return {
    code: bestCode,
    label: account.label,
    confidence: bestCount >= 3 ? 'high' : 'medium',
    reason: `Utilisé ${bestCount} fois pour ${supplierName}`,
  }
}

// ============ Matching par mots-clés depuis DB ============

/**
 * Charge les règles de classification depuis la table account_classification_rules.
 */
async function loadClassificationRules(): Promise<AccountClassificationRule[]> {
  const { data, error } = await supabase
    .from('account_classification_rules')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (error) {
    console.error('loadClassificationRules: failed to load rules', error)
    throw new Error(`Erreur chargement règles de classification: ${error.message}`)
  }

  if (!data) {
    console.error('loadClassificationRules: data is null')
    throw new Error('Erreur inattendue: données manquantes pour les règles de classification')
  }

  return data
}

/**
 * Cherche une correspondance par mots-clés dans le nom du tiers et le libellé.
 * Les règles sont chargées depuis la DB (account_classification_rules).
 */
async function matchByKeywords(
  supplierName: string,
  entryLabel: string
): Promise<AccountSuggestion | null> {
  const rules = await loadClassificationRules()
  const searchText = `${supplierName} ${entryLabel}`.toLowerCase()

  let bestMatch: AccountClassificationRule | null = null
  let bestMatchCount = 0

  for (const rule of rules) {
    let matchCount = 0
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        matchCount++
      }
    }
    if (matchCount > bestMatchCount) {
      bestMatch = rule
      bestMatchCount = matchCount
    }
  }

  if (!bestMatch) return null

  return {
    code: bestMatch.account_code,
    label: bestMatch.account_label,
    confidence: bestMatchCount >= 2 ? 'medium' : 'low',
    reason: `Détecté par mots-clés`,
  }
}

// ============ API publique ============

/**
 * Suggère un compte de contrepartie pour une facture fournisseur.
 *
 * Priorité :
 * 1. Historique fournisseur (confiance haute/moyenne)
 * 2. Matching mots-clés depuis DB (confiance moyenne/basse)
 * 3. null si rien ne matche
 */
export async function suggestCounterpartAccount(
  supplierName: string,
  entryLabel: string = ''
): Promise<AccountSuggestion | null> {
  if (!supplierName.trim()) return null

  // 1. Chercher dans l'historique (isolé pour ne pas bloquer le keyword matching)
  try {
    const historicalSuggestion = await getHistoricalAccountForSupplier(supplierName)
    if (historicalSuggestion) {
      console.log('[Classification] Historique trouvé pour', supplierName, ':', historicalSuggestion.code)
      return historicalSuggestion
    }
  } catch (err) {
    console.warn('[Classification] Erreur historique (ignorée, passage aux mots-clés):', err)
  }

  // 2. Matching par mots-clés depuis DB
  const keywordSuggestion = await matchByKeywords(supplierName, entryLabel)
  if (keywordSuggestion) {
    console.log('[Classification] Mots-clés trouvés pour', supplierName, ':', keywordSuggestion.code, keywordSuggestion.label)
    return keywordSuggestion
  }

  console.log('[Classification] Aucune suggestion pour', supplierName)
  return null
}

/**
 * Cherche les comptes de charge disponibles pour l'autocomplétion.
 * Retourne les comptes 6xxx actifs du plan comptable.
 */
export async function searchExpenseAccounts(
  query: string
): Promise<{ code: string; label: string }[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('code, label')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .like('code', '6%')
    .or(`code.ilike.%${query}%,label.ilike.%${query}%`)
    .order('code')
    .limit(15)

  if (error) {
    console.error('Error searching expense accounts:', error)
    throw new Error(`Erreur recherche comptes: ${error.message}`)
  }

  if (!data) {
    console.error('searchExpenseAccounts: data is null')
    throw new Error('Erreur inattendue: données manquantes pour la recherche de comptes')
  }

  return data
}
