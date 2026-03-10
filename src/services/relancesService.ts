// Relances Service - Gestion du recouvrement client et suivi des creances
import { supabase, COMPANY_ID } from '../lib/supabase'
import type { Invoice, ThirdParty, ChartOfAccount } from '../types/database'
import { resolveByRole, resolveJournal, resolveCustomerAccount } from './accountResolverService'

// ============ Types ============

export interface DunningLevel {
  level: 1 | 2 | 3 | 4
  name: string
  daysAfterDue: number
  template: string
  autoSend: boolean
}

export interface DunningHistory {
  id: string
  invoice_id: string
  level: number
  date: string
  method: 'email' | 'letter' | 'phone' | 'manual'
  notes?: string
  sent_by?: string
  letter_content?: string
  email_sent?: boolean
  created_at: string
}

export interface DunningFilters {
  customerId?: string
  delayMin?: number
  delayMax?: number
  level?: number
  status?: DunningStatus
  searchTerm?: string
}

export type DunningStatus =
  | 'pending'           // Non relance
  | 'relance_1'         // 1er rappel
  | 'relance_2'         // 2eme rappel
  | 'relance_3'         // Mise en demeure
  | 'relance_4'         // Pre-contentieux
  | 'litige'            // En litige
  | 'creance_douteuse'  // Compte 416
  | 'provision'         // Provision pour depreciation

export interface OverdueInvoice extends Invoice {
  third_party?: ThirdParty
  dunning_level: number
  dunning_status: DunningStatus
  days_overdue: number
  dunning_history: DunningHistory[]
  last_dunning_date?: string
  remaining_amount: number
}

export interface DunningStats {
  totalOverdue: number
  count0to30: number
  amount0to30: number
  count30to60: number
  amount30to60: number
  count60to90: number
  amount60to90: number
  count90plus: number
  amount90plus: number
  totalInvoices: number
  recoveryRate: number
  totalRecoveredThisYear: number
  totalDoubtfulDebts: number
  totalProvisions: number
}

export interface DoubtfulDebtEntry {
  id: string
  invoice_id: string
  original_amount: number
  provision_amount: number
  provision_percent: number
  reason: string
  date: string
  accounting_entry_id?: string
}

// ============ Dunning Levels Configuration ============

export const DUNNING_LEVELS: DunningLevel[] = [
  {
    level: 1,
    name: 'Rappel courtois',
    daysAfterDue: 7,
    autoSend: true,
    template: `Madame, Monsieur,

Nous nous permettons de vous rappeler que la facture n {invoiceNumber} d'un montant de {amount} EUR, dont l'echeance etait fixee au {dueDate}, demeure impayee a ce jour.

Nous vous serions reconnaissants de bien vouloir proceder au reglement de cette facture dans les meilleurs delais.

Si vous avez deja effectue ce paiement, nous vous prions de ne pas tenir compte de ce rappel.

Cordialement,
{companyName}`
  },
  {
    level: 2,
    name: 'Relance ferme',
    daysAfterDue: 30,
    autoSend: true,
    template: `Madame, Monsieur,

Malgre notre precedent courrier, nous constatons que la facture n {invoiceNumber} d'un montant de {amount} EUR, echue depuis le {dueDate}, reste impayee.

Nous vous prions de bien vouloir regulariser cette situation sous huitaine.

A defaut de paiement dans ce delai, nous serons contraints d'engager des procedures de recouvrement.

Cordialement,
{companyName}`
  },
  {
    level: 3,
    name: 'Mise en demeure',
    daysAfterDue: 60,
    autoSend: false,
    template: `Madame, Monsieur,

La presente constitue une mise en demeure.

Malgre nos precedents rappels, la facture n {invoiceNumber} d'un montant de {amount} EUR, echue depuis le {dueDate}, reste impayee.

Nous vous mettons en demeure de proceder au paiement de cette somme dans un delai de 8 jours a compter de la reception de ce courrier (LRAR recommande).

Passe ce delai, nous serons dans l'obligation de transmettre ce dossier a notre service contentieux, ce qui entrainera des frais supplementaires a votre charge conformement a l'article L.441-10 du Code de commerce :
- Indemnite forfaitaire pour frais de recouvrement : 40 EUR
- Penalites de retard au taux legal en vigueur

Cordialement,
{companyName}`
  },
  {
    level: 4,
    name: 'Pre-contentieux',
    daysAfterDue: 90,
    autoSend: false,
    template: `Madame, Monsieur,

DERNIER AVIS AVANT CONTENTIEUX

Malgre nos nombreuses relances restees sans effet, la facture n {invoiceNumber} d'un montant de {amount} EUR, demeure impayee.

Si nous ne recevons pas votre reglement ou une proposition de plan d'echelonnement sous 8 jours, nous transmettrons ce dossier a notre cabinet de recouvrement/avocat pour engagement de poursuites judiciaires.

Cette procedure entrainera des frais supplementaires importants a votre charge :
- Frais d'huissier
- Frais d'avocat
- Interets de retard majores
- Dommages et interets eventuels

Nous esperons que vous comprendrez le serieux de cette situation.

Cordialement,
{companyName}`
  }
]

// ============ Helper Functions ============

/**
 * Calculate days overdue from due date
 */
function calculateDaysOverdue(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffTime = today.getTime() - due.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Determine dunning status from level and special flags
 */
function determineDunningStatus(
  level: number,
  isLitige: boolean,
  isDoubtful: boolean,
  hasProvision: boolean
): DunningStatus {
  if (hasProvision) return 'provision'
  if (isDoubtful) return 'creance_douteuse'
  if (isLitige) return 'litige'

  switch (level) {
    case 0: return 'pending'
    case 1: return 'relance_1'
    case 2: return 'relance_2'
    case 3: return 'relance_3'
    case 4: return 'relance_4'
    default: return 'pending'
  }
}

/**
 * Format number with French locale
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

/**
 * Format date in French locale
 */
function formatDateFR(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Load chart of accounts from database
 */
async function loadChartOfAccounts(): Promise<ChartOfAccount[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error loading chart of accounts:', error)
    throw new Error(`Erreur chargement plan comptable: ${error.message}`)
  }

  if (!data || data.length === 0) {
    console.error('loadChartOfAccounts: no accounts found for company', COMPANY_ID)
    throw new Error('Plan comptable vide ou introuvable. Vérifiez la configuration.')
  }

  return data
}

// ============ Core Functions ============

/**
 * Get overdue invoices with dunning info
 */
export async function getOverdueInvoices(
  filters?: DunningFilters
): Promise<OverdueInvoice[]> {
  // Fetch unpaid customer invoices
  const { data: invoices, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      third_party:third_parties(id, name, email, phone, address, postal_code, city, country)
    `)
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .neq('status', 'paid')
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true })

  if (invoiceError) {
    console.error('Error fetching overdue invoices:', invoiceError)
    throw new Error(`Erreur chargement factures: ${invoiceError.message}`)
  }

  if (!invoices || invoices.length === 0) {
    return []
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch dunning history for all invoices
  const invoiceIds = invoices.map(i => i.id)
  const { data: historyData, error: historyError } = await supabase
    .from('dunning_history')
    .select('*')
    .in('invoice_id', invoiceIds)
    .order('date', { ascending: false })

  if (historyError) {
    console.error('Error fetching dunning history:', historyError)
    // Continue without history rather than failing completely
  }

  // Group history by invoice
  const historyByInvoice = new Map<string, DunningHistory[]>()
  for (const h of historyData || []) {
    const existing = historyByInvoice.get(h.invoice_id) || []
    existing.push(h)
    historyByInvoice.set(h.invoice_id, existing)
  }

  // Fetch doubtful debt status
  const { data: doubtfulData } = await supabase
    .from('doubtful_debts')
    .select('invoice_id, provision_percent')
    .in('invoice_id', invoiceIds)

  const doubtfulByInvoice = new Map<string, number>()
  for (const d of doubtfulData || []) {
    doubtfulByInvoice.set(d.invoice_id, d.provision_percent)
  }

  // Transform invoices
  const overdueInvoices: OverdueInvoice[] = invoices
    .filter(inv => {
      if (!inv.due_date) return false
      const dueDate = new Date(inv.due_date)
      return dueDate < today
    })
    .map(inv => {
      const daysOverdue = calculateDaysOverdue(inv.due_date || '')
      const history = historyByInvoice.get(inv.id) || []
      const maxLevel = history.length > 0
        ? Math.max(...history.map(h => h.level))
        : 0

      const isLitige = inv.status === 'litige' || (inv as Record<string, unknown>).is_litige === true
      const provisionPercent = doubtfulByInvoice.get(inv.id)
      const isDoubtful = provisionPercent !== undefined
      const hasProvision = (provisionPercent || 0) > 0

      const dunningStatus = determineDunningStatus(maxLevel, isLitige, isDoubtful, hasProvision)
      const lastDunning = history[0]

      return {
        ...inv,
        dunning_level: maxLevel,
        dunning_status: dunningStatus,
        days_overdue: daysOverdue,
        dunning_history: history,
        last_dunning_date: lastDunning?.date,
        remaining_amount: inv.total_ttc
      }
    })

  // Apply filters
  let filtered = overdueInvoices

  if (filters?.customerId) {
    filtered = filtered.filter(i => i.third_party_id === filters.customerId)
  }

  if (filters?.delayMin !== undefined) {
    filtered = filtered.filter(i => i.days_overdue >= filters.delayMin!)
  }

  if (filters?.delayMax !== undefined) {
    filtered = filtered.filter(i => i.days_overdue <= filters.delayMax!)
  }

  if (filters?.level !== undefined) {
    filtered = filtered.filter(i => i.dunning_level === filters.level)
  }

  if (filters?.status) {
    filtered = filtered.filter(i => i.dunning_status === filters.status)
  }

  if (filters?.searchTerm) {
    const search = filters.searchTerm.toLowerCase()
    filtered = filtered.filter(i =>
      i.third_party?.name?.toLowerCase().includes(search) ||
      i.number.toLowerCase().includes(search)
    )
  }

  return filtered
}

/**
 * Record a dunning action
 */
export async function recordDunning(
  invoiceId: string,
  level: number,
  method: 'email' | 'letter' | 'phone' | 'manual',
  notes?: string,
  letterContent?: string,
  emailSent?: boolean
): Promise<DunningHistory> {
  const { data, error } = await supabase
    .from('dunning_history')
    .insert({
      invoice_id: invoiceId,
      level,
      date: new Date().toISOString().split('T')[0],
      method,
      notes,
      letter_content: letterContent,
      email_sent: emailSent || false,
      company_id: COMPANY_ID
    })
    .select()
    .single()

  if (error) {
    console.error('Error recording dunning:', error)
    throw new Error(`Erreur enregistrement relance: ${error.message}`)
  }

  return data
}

/**
 * Get dunning history for an invoice
 */
export async function getDunningHistory(invoiceId: string): Promise<DunningHistory[]> {
  const { data, error } = await supabase
    .from('dunning_history')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching dunning history:', error)
    throw new Error(`Erreur chargement historique relances: ${error.message}`)
  }

  if (!data) {
    console.error('getDunningHistory: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour dunning history')
  }

  return data
}

// ============ Letter Generation ============

/**
 * Generate dunning letter content
 */
export function generateDunningLetter(
  invoice: Invoice,
  level: number,
  customer: ThirdParty,
  companyName: string = 'Votre entreprise'
): string {
  const dunningLevel = DUNNING_LEVELS.find(d => d.level === level)
  if (!dunningLevel) {
    throw new Error(`Niveau de relance invalide: ${level}`)
  }

  let content = dunningLevel.template
  content = content.replace(/{invoiceNumber}/g, invoice.number)
  content = content.replace(/{amount}/g, formatNumber(invoice.total_ttc))
  content = content.replace(/{dueDate}/g, formatDateFR(invoice.due_date || ''))
  content = content.replace(/{companyName}/g, companyName)

  // Add customer address header
  const header = `${customer.name}
${customer.address || ''}
${customer.postal_code || ''} ${customer.city || ''}
${customer.country || 'France'}

Le ${formatDateFR(new Date().toISOString())}

Objet : ${dunningLevel.name} - Facture n ${invoice.number}

`

  return header + content
}

/**
 * Generate PDF dunning letter (returns blob for download)
 * Note: In production, use jspdf or call a PDF generation service
 */
export async function exportDunningLetterPDF(
  invoiceId: string,
  level: number
): Promise<Blob> {
  // Fetch invoice with customer info
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      third_party:third_parties(*)
    `)
    .eq('id', invoiceId)
    .single()

  if (invoiceError) {
    console.error('Error fetching invoice for PDF:', invoiceError)
    throw new Error(`Erreur chargement facture: ${invoiceError.message}`)
  }

  if (!invoice.third_party) {
    throw new Error('Client non trouve pour cette facture')
  }

  // Fetch company info
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', COMPANY_ID)
    .single()

  const letterContent = generateDunningLetter(
    invoice,
    level,
    invoice.third_party,
    company?.name || 'Votre entreprise'
  )

  // For now, return as text blob (in production, use jspdf)
  // The frontend will need to convert this to proper PDF
  const blob = new Blob([letterContent], { type: 'text/plain;charset=utf-8' })
  return blob
}

// ============ Doubtful Debts & Provisions ============

/**
 * Mark an invoice as doubtful debt (creance douteuse)
 * Creates accounting entry: Debit 416xxx / Credit 411xxx
 */
export async function markAsDoubtfulDebt(
  invoiceId: string,
  reason: string
): Promise<void> {
  // Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, third_party:third_parties(*)')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    throw new Error(`Facture non trouvee: ${invoiceError?.message}`)
  }

  if (!invoice.third_party_id) {
    throw new Error('Client non defini pour cette facture')
  }

  if (!invoice.third_party?.name) {
    throw new Error('Nom du client non disponible pour cette facture')
  }

  const chartOfAccounts = await loadChartOfAccounts()
  const customerName = invoice.third_party.name
  const customerAccount = resolveCustomerAccount(customerName, chartOfAccounts).code
  const doubtfulAccount = `416${invoice.third_party_id.replace(/-/g, '').slice(-6).toUpperCase()}`
  const today = new Date().toISOString().split('T')[0]

  // Resolve journal
  const journalOD = await resolveJournal('misc')

  // Generate piece number
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('journal', journalOD.code)
    .gte('date', `${year}-01-01`)

  const pieceNumber = `${journalOD.code}${year}${String((count || 0) + 1).padStart(6, '0')}`

  // Create accounting entries for transfer to doubtful debt account
  const entries = [
    {
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date: today,
      piece_number: pieceNumber,
      label: `Creance douteuse - ${invoice.number} - ${reason}`,
      account_code: doubtfulAccount,
      debit: invoice.total_ttc,
      credit: 0,
      linked_invoice_id: invoiceId,
      is_validated: false
    },
    {
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date: today,
      piece_number: pieceNumber,
      label: `Creance douteuse - ${invoice.number} - ${reason}`,
      account_code: customerAccount,
      debit: 0,
      credit: invoice.total_ttc,
      linked_invoice_id: invoiceId,
      is_validated: false
    }
  ]

  const { error: entriesError } = await supabase
    .from('accounting_entries')
    .insert(entries)

  if (entriesError) {
    console.error('Error creating doubtful debt entries:', entriesError)
    throw new Error(`Erreur creation ecritures creance douteuse: ${entriesError.message}`)
  }

  // Record in doubtful_debts table
  const { error: doubtfulError } = await supabase
    .from('doubtful_debts')
    .insert({
      company_id: COMPANY_ID,
      invoice_id: invoiceId,
      original_amount: invoice.total_ttc,
      provision_amount: 0,
      provision_percent: 0,
      reason,
      date: today,
      accounting_entry_piece: pieceNumber
    })

  if (doubtfulError) {
    console.error('Error recording doubtful debt:', doubtfulError)
    throw new Error(`Erreur enregistrement creance douteuse: ${doubtfulError.message}`)
  }
}

/**
 * Create a provision for bad debt depreciation
 * Creates accounting entry: Debit 68174 / Credit 491
 */
export async function createBadDebtProvision(
  invoiceId: string,
  provisionPercent: number
): Promise<void> {
  if (provisionPercent < 0 || provisionPercent > 100) {
    throw new Error('Le pourcentage de provision doit etre entre 0 et 100')
  }

  // Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    throw new Error(`Facture non trouvee: ${invoiceError?.message}`)
  }

  // Calculate provision amount (on HT amount, not TTC)
  const provisionAmount = Math.round(invoice.total_ht * (provisionPercent / 100) * 100) / 100
  const today = new Date().toISOString().split('T')[0]

  // Resolve accounts and journal from chart of accounts
  const chartOfAccounts = await loadChartOfAccounts()
  const journalOD = await resolveJournal('misc')
  const dotationProvAccount = resolveByRole('DOTATION_PROV_CREANCES', chartOfAccounts).code
  const provisionDeprecAccount = resolveByRole('PROVISION_DEPREC_CLIENTS', chartOfAccounts).code

  // Generate piece number
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('journal', journalOD.code)
    .gte('date', `${year}-01-01`)

  const pieceNumber = `${journalOD.code}${year}${String((count || 0) + 1).padStart(6, '0')}`

  // Create accounting entries:
  // Debit DOTATION_PROV_CREANCES (Dotation provision creances douteuses)
  // Credit PROVISION_DEPREC_CLIENTS (Provision depreciation comptes clients)
  const entries = [
    {
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date: today,
      piece_number: pieceNumber,
      label: `Provision depreciation creance - ${invoice.number} (${provisionPercent}%)`,
      account_code: dotationProvAccount,
      debit: provisionAmount,
      credit: 0,
      linked_invoice_id: invoiceId,
      is_validated: false
    },
    {
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date: today,
      piece_number: pieceNumber,
      label: `Provision depreciation creance - ${invoice.number} (${provisionPercent}%)`,
      account_code: provisionDeprecAccount,
      debit: 0,
      credit: provisionAmount,
      linked_invoice_id: invoiceId,
      is_validated: false
    }
  ]

  const { error: entriesError } = await supabase
    .from('accounting_entries')
    .insert(entries)

  if (entriesError) {
    console.error('Error creating provision entries:', entriesError)
    throw new Error(`Erreur creation ecritures provision: ${entriesError.message}`)
  }

  // Update doubtful_debts table
  const { error: updateError } = await supabase
    .from('doubtful_debts')
    .upsert({
      company_id: COMPANY_ID,
      invoice_id: invoiceId,
      original_amount: invoice.total_ttc,
      provision_amount: provisionAmount,
      provision_percent: provisionPercent,
      date: today,
      accounting_entry_piece: pieceNumber
    }, {
      onConflict: 'invoice_id'
    })

  if (updateError) {
    console.error('Error updating provision record:', updateError)
    throw new Error(`Erreur mise a jour provision: ${updateError.message}`)
  }
}

/**
 * Reverse a provision (when debt is recovered or written off)
 * Creates accounting entry: Debit 491 / Credit 78174
 */
export async function reverseProvision(
  invoiceId: string,
  reason: 'recovered' | 'written_off'
): Promise<void> {
  // Fetch existing provision
  const { data: provision, error: provisionError } = await supabase
    .from('doubtful_debts')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single()

  if (provisionError || !provision || provision.provision_amount === 0) {
    throw new Error('Aucune provision a reprendre pour cette facture')
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('number')
    .eq('id', invoiceId)
    .single()

  const today = new Date().toISOString().split('T')[0]
  const year = new Date().getFullYear()

  // Resolve accounts and journal from chart of accounts
  const chartOfAccounts = await loadChartOfAccounts()
  const journalOD = await resolveJournal('misc')
  const provisionDeprecAccount = resolveByRole('PROVISION_DEPREC_CLIENTS', chartOfAccounts).code
  const repriseProvAccount = resolveByRole('REPRISE_PROV_CREANCES', chartOfAccounts).code

  const { count } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('journal', journalOD.code)
    .gte('date', `${year}-01-01`)

  const pieceNumber = `${journalOD.code}${year}${String((count || 0) + 1).padStart(6, '0')}`
  const label = reason === 'recovered'
    ? `Reprise provision - ${invoice?.number} - creance recouvree`
    : `Reprise provision - ${invoice?.number} - creance annulee`

  // Create reversal entries:
  // Debit PROVISION_DEPREC_CLIENTS (Provision depreciation comptes clients)
  // Credit REPRISE_PROV_CREANCES (Reprise provision creances douteuses)
  const entries = [
    {
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date: today,
      piece_number: pieceNumber,
      label,
      account_code: provisionDeprecAccount,
      debit: provision.provision_amount,
      credit: 0,
      linked_invoice_id: invoiceId,
      is_validated: false
    },
    {
      company_id: COMPANY_ID,
      journal: journalOD.code,
      date: today,
      piece_number: pieceNumber,
      label,
      account_code: repriseProvAccount,
      debit: 0,
      credit: provision.provision_amount,
      linked_invoice_id: invoiceId,
      is_validated: false
    }
  ]

  const { error: entriesError } = await supabase
    .from('accounting_entries')
    .insert(entries)

  if (entriesError) {
    throw new Error(`Erreur creation ecritures reprise: ${entriesError.message}`)
  }

  // Update provision to zero
  await supabase
    .from('doubtful_debts')
    .update({ provision_amount: 0, provision_percent: 0 })
    .eq('invoice_id', invoiceId)
}

// ============ Litige Management ============

/**
 * Mark an invoice as in dispute (litige)
 */
export async function markAsLitige(
  invoiceId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'litige' as Invoice['status'],
      notes: reason
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Error marking as litige:', error)
    throw new Error(`Erreur marquage litige: ${error.message}`)
  }

  // Record in dunning history
  await recordDunning(invoiceId, 0, 'manual', `Passe en litige: ${reason}`)
}

/**
 * Remove litige status
 */
export async function removeLitige(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent' })
    .eq('id', invoiceId)

  if (error) {
    throw new Error(`Erreur suppression litige: ${error.message}`)
  }

  await recordDunning(invoiceId, 0, 'manual', 'Litige resolu')
}

// ============ Statistics ============

/**
 * Get dunning statistics
 */
export async function getDunningStats(): Promise<DunningStats> {
  const overdueInvoices = await getOverdueInvoices()

  const stats: DunningStats = {
    totalOverdue: 0,
    count0to30: 0,
    amount0to30: 0,
    count30to60: 0,
    amount30to60: 0,
    count60to90: 0,
    amount60to90: 0,
    count90plus: 0,
    amount90plus: 0,
    totalInvoices: overdueInvoices.length,
    recoveryRate: 0,
    totalRecoveredThisYear: 0,
    totalDoubtfulDebts: 0,
    totalProvisions: 0
  }

  for (const inv of overdueInvoices) {
    stats.totalOverdue += inv.total_ttc

    if (inv.days_overdue <= 30) {
      stats.count0to30++
      stats.amount0to30 += inv.total_ttc
    } else if (inv.days_overdue <= 60) {
      stats.count30to60++
      stats.amount30to60 += inv.total_ttc
    } else if (inv.days_overdue <= 90) {
      stats.count60to90++
      stats.amount60to90 += inv.total_ttc
    } else {
      stats.count90plus++
      stats.amount90plus += inv.total_ttc
    }

    if (inv.dunning_status === 'creance_douteuse') {
      stats.totalDoubtfulDebts += inv.total_ttc
    }
  }

  // Calculate recovery rate from this year
  const year = new Date().getFullYear()
  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('total_ttc, due_date')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .eq('status', 'paid')
    .gte('due_date', `${year}-01-01`)
    .lte('due_date', `${year}-12-31`)

  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('total_ttc')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .gte('due_date', `${year}-01-01`)
    .lte('due_date', `${year}-12-31`)

  if (paidInvoices && allInvoices && allInvoices.length > 0) {
    const totalPaid = paidInvoices.reduce((sum, i) => sum + i.total_ttc, 0)
    const totalAll = allInvoices.reduce((sum, i) => sum + i.total_ttc, 0)
    stats.recoveryRate = Math.round((totalPaid / totalAll) * 100)
    stats.totalRecoveredThisYear = totalPaid
  }

  // Get total provisions
  const { data: provisions } = await supabase
    .from('doubtful_debts')
    .select('provision_amount')
    .eq('company_id', COMPANY_ID)

  if (provisions) {
    stats.totalProvisions = provisions.reduce((sum, p) => sum + (p.provision_amount || 0), 0)
  }

  return stats
}

// ============ Bulk Operations ============

/**
 * Send bulk dunning for multiple invoices
 */
export async function sendBulkDunning(
  invoiceIds: string[],
  level: number,
  method: 'email' | 'letter' | 'phone' | 'manual'
): Promise<{ success: number; failed: number; errors: string[] }> {
  const result = { success: 0, failed: 0, errors: [] as string[] }

  for (const invoiceId of invoiceIds) {
    try {
      await recordDunning(invoiceId, level, method)
      result.success++
    } catch (err) {
      result.failed++
      result.errors.push(`Facture ${invoiceId}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    }
  }

  return result
}

/**
 * Get suggested dunning level based on days overdue
 */
export function getSuggestedDunningLevel(daysOverdue: number): number {
  for (let i = DUNNING_LEVELS.length - 1; i >= 0; i--) {
    if (daysOverdue >= DUNNING_LEVELS[i].daysAfterDue) {
      return DUNNING_LEVELS[i].level
    }
  }
  return 1
}

/**
 * Export dunning report as CSV
 */
export async function exportDunningReport(): Promise<string> {
  const invoices = await getOverdueInvoices()

  const headers = [
    'Client',
    'N Facture',
    'Date Facture',
    'Echeance',
    'Montant TTC',
    'Jours de retard',
    'Niveau relance',
    'Derniere relance',
    'Statut'
  ]

  const rows = invoices.map(inv => [
    inv.third_party?.name || 'Inconnu',
    inv.number,
    formatDateFR(inv.date),
    formatDateFR(inv.due_date || ''),
    formatNumber(inv.total_ttc),
    inv.days_overdue.toString(),
    inv.dunning_level.toString(),
    inv.last_dunning_date ? formatDateFR(inv.last_dunning_date) : '',
    inv.dunning_status
  ])

  const csvContent = [
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\n')

  return csvContent
}
