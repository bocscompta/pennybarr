// Emprunts Service - Gestion des emprunts bancaires et leurs échéances
import { supabase, COMPANY_ID } from '../lib/supabase'
import type {
  Loan,
  LoanFormData,
  LoanFilters,
  LoanPayment,
  LoanAmortizationEntry,
} from '../types/immobilisations'
import type { AccountingEntry, ChartOfAccount } from '../types/database'
import { generatePieceNumber, getJournalBanque } from './accountingService'
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

// ============ Types locaux ============

export interface LoanSummary {
  totalBorrowed: number        // Total emprunté
  totalRepaid: number          // Total remboursé (capital)
  totalInterestPaid: number    // Total intérêts payés
  remainingPrincipal: number   // Capital restant dû
  activeLoans: number          // Nombre d'emprunts actifs
  upcomingPayments: {
    loan: Loan
    payment: LoanPayment
  }[]                          // Prochaines échéances
}

// ============ Utilitaires ============

/**
 * Obtenir le compte d'emprunt selon le type (résolu dynamiquement depuis le plan comptable)
 * @throws Error if loanType is unknown (NO default fallback)
 */
function getLoanAccountCode(loanType: string, chartOfAccounts: ChartOfAccount[]): string {
  switch (loanType) {
    case 'bank':
      return resolveByRole('EMPRUNT_BANK', chartOfAccounts).code
    case 'shareholder':
      return resolveByRole('EMPRUNT_CCA', chartOfAccounts).code
    case 'leasing':
      return resolveByRole('EMPRUNT_LEASING', chartOfAccounts).code
    default:
      throw new Error(`Type d'emprunt inconnu: '${loanType}'. Types valides: bank, shareholder, leasing.`)
  }
}

/**
 * Calculer la date de fin d'emprunt à partir de la date de début et de la durée
 */
function calculateEndDate(startDate: string, durationMonths: number): string {
  const start = new Date(startDate)
  start.setMonth(start.getMonth() + durationMonths)
  return start.toISOString().split('T')[0]
}

/**
 * Calculer le nombre d'échéances selon la fréquence
 */
function getNumberOfPayments(durationMonths: number, frequency: 'monthly' | 'quarterly' | 'yearly'): number {
  switch (frequency) {
    case 'monthly':
      return durationMonths
    case 'quarterly':
      return Math.ceil(durationMonths / 3)
    case 'yearly':
      return Math.ceil(durationMonths / 12)
  }
}

/**
 * Calculer l'intervalle entre les échéances en mois
 */
function getPaymentIntervalMonths(frequency: 'monthly' | 'quarterly' | 'yearly'): number {
  switch (frequency) {
    case 'monthly':
      return 1
    case 'quarterly':
      return 3
    case 'yearly':
      return 12
  }
}

// ============ Calculs financiers ============

/**
 * Calculer le montant de l'échéance mensuelle (formule d'annuité constante)
 * PMT = P * (r * (1 + r)^n) / ((1 + r)^n - 1)
 *
 * @param principal - Capital emprunté
 * @param annualRate - Taux d'intérêt annuel (ex: 5 pour 5%)
 * @param months - Durée en mois
 * @returns Montant de l'échéance mensuelle
 */
export function calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) {
    throw new Error('Le capital et la durée doivent être positifs')
  }

  // Taux sans intérêt (prêt à taux 0)
  if (annualRate <= 0) {
    return Math.round((principal / months) * 100) / 100
  }

  // Taux mensuel
  const monthlyRate = annualRate / 100 / 12

  // Formule d'annuité constante
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, months)
  const denominator = Math.pow(1 + monthlyRate, months) - 1

  const payment = principal * (numerator / denominator)

  return Math.round(payment * 100) / 100
}

/**
 * Calculer le capital restant dû à une date donnée
 */
export function calculateRemainingPrincipal(loan: Loan, asOfDate: string): number {
  const schedule = generatePaymentSchedule(loan)
  const date = new Date(asOfDate)

  // Trouver la dernière échéance passée
  let remainingPrincipal = loan.principal_amount

  for (const payment of schedule) {
    const dueDate = new Date(payment.dueDate)
    if (dueDate <= date) {
      remainingPrincipal = payment.remainingPrincipal
    } else {
      break
    }
  }

  return Math.round(remainingPrincipal * 100) / 100
}

// ============ Génération de l'échéancier ============

/**
 * Générer le tableau d'amortissement complet d'un emprunt
 * Méthode : amortissement constant (échéances décroissantes) ou annuités constantes
 * Par défaut : annuités constantes (échéances fixes)
 */
export function generatePaymentSchedule(loan: Loan): LoanAmortizationEntry[] {
  const schedule: LoanAmortizationEntry[] = []

  const numberOfPayments = getNumberOfPayments(loan.duration_months, loan.payment_frequency)
  const intervalMonths = getPaymentIntervalMonths(loan.payment_frequency)

  // Taux périodique
  const periodicRate = (loan.interest_rate / 100) * (intervalMonths / 12)

  // Calcul de l'échéance constante
  let periodicPayment: number
  if (loan.interest_rate <= 0) {
    // Prêt à taux 0
    periodicPayment = loan.principal_amount / numberOfPayments
  } else {
    const numerator = periodicRate * Math.pow(1 + periodicRate, numberOfPayments)
    const denominator = Math.pow(1 + periodicRate, numberOfPayments) - 1
    periodicPayment = loan.principal_amount * (numerator / denominator)
  }

  periodicPayment = Math.round(periodicPayment * 100) / 100

  let remainingPrincipal = loan.principal_amount
  let currentDate = new Date(loan.start_date)

  // Si un jour de paiement est défini, ajuster la première échéance
  if (loan.payment_day) {
    currentDate.setDate(loan.payment_day)
    if (currentDate <= new Date(loan.start_date)) {
      currentDate.setMonth(currentDate.getMonth() + intervalMonths)
    }
  } else {
    currentDate.setMonth(currentDate.getMonth() + intervalMonths)
  }

  for (let i = 1; i <= numberOfPayments; i++) {
    // Calcul des intérêts de la période
    const interest = Math.round(remainingPrincipal * periodicRate * 100) / 100

    // Calcul du capital remboursé
    let principal: number
    if (i === numberOfPayments) {
      // Dernière échéance : solder le capital restant
      principal = remainingPrincipal
    } else {
      principal = Math.round((periodicPayment - interest) * 100) / 100
    }

    // Ajustement si le capital dépasse le restant
    if (principal > remainingPrincipal) {
      principal = remainingPrincipal
    }

    const total = Math.round((principal + interest) * 100) / 100
    remainingPrincipal = Math.round((remainingPrincipal - principal) * 100) / 100

    schedule.push({
      number: i,
      dueDate: currentDate.toISOString().split('T')[0],
      principal,
      interest,
      total,
      remainingPrincipal: Math.max(0, remainingPrincipal),
    })

    // Passer à la prochaine échéance
    currentDate.setMonth(currentDate.getMonth() + intervalMonths)
  }

  return schedule
}

// ============ CRUD Emprunts ============

/**
 * Créer un nouvel emprunt
 */
export async function createLoan(data: LoanFormData): Promise<Loan> {
  // Charger le plan comptable pour résolution dynamique
  const chartOfAccounts = await loadChartOfAccounts()

  // Calculer la date de fin
  const endDate = calculateEndDate(data.startDate, data.durationMonths)

  // Calculer le montant de l'échéance
  const numberOfPayments = getNumberOfPayments(data.durationMonths, data.paymentFrequency)
  const paymentAmount = data.interestRate > 0
    ? calculateMonthlyPayment(data.principalAmount, data.interestRate, data.durationMonths)
    : data.principalAmount / numberOfPayments

  // Ajuster le montant selon la fréquence
  const intervalMonths = getPaymentIntervalMonths(data.paymentFrequency)
  const adjustedPayment = intervalMonths > 1
    ? Math.round(paymentAmount * intervalMonths * 100) / 100
    : paymentAmount

  // Déterminer les comptes comptables (résolution dynamique depuis le plan comptable)
  const accountCodeLoan = data.accountCodeLoan || getLoanAccountCode(data.loanType, chartOfAccounts)
  const accountCodeInterest = data.accountCodeInterest || resolveByRole('INTERETS_EMPRUNTS', chartOfAccounts).code

  const { data: loan, error } = await supabase
    .from('loans')
    .insert({
      company_id: COMPANY_ID,
      name: data.name,
      reference: data.reference,
      loan_type: data.loanType,
      lender: data.lender,
      principal_amount: data.principalAmount,
      interest_rate: data.interestRate,
      start_date: data.startDate,
      end_date: endDate,
      duration_months: data.durationMonths,
      payment_frequency: data.paymentFrequency,
      payment_amount: adjustedPayment,
      payment_day: data.paymentDay,
      status: 'active',
      remaining_principal: data.principalAmount,
      account_code_loan: accountCodeLoan,
      account_code_interest: accountCodeInterest,
      notes: data.notes,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating loan:', error)
    throw new Error(`Erreur création emprunt: ${error.message}`)
  }

  // Générer l'échéancier et l'insérer en base
  const schedule = generatePaymentSchedule(loan)
  const payments = schedule.map(entry => ({
    loan_id: loan.id,
    due_date: entry.dueDate,
    principal_amount: entry.principal,
    interest_amount: entry.interest,
    total_amount: entry.total,
    remaining_principal: entry.remainingPrincipal,
    is_paid: false,
  }))

  const { error: paymentsError } = await supabase
    .from('loan_payments')
    .insert(payments)

  if (paymentsError) {
    console.error('Error creating loan payments:', paymentsError)
    throw new Error(`Erreur création échéancier: ${paymentsError.message}`)
  }

  console.log(`Created loan ${loan.name} with ${payments.length} scheduled payments`)
  return loan
}

/**
 * Récupérer un emprunt par ID
 */
export async function getLoan(loanId: string): Promise<Loan> {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .eq('company_id', COMPANY_ID)
    .single()

  if (error) {
    console.error('Error fetching loan:', error)
    throw new Error(`Erreur chargement emprunt: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Emprunt non trouvé: ${loanId}`)
  }

  return data
}

/**
 * Mettre à jour un emprunt
 */
export async function updateLoan(loanId: string, data: Partial<LoanFormData>): Promise<Loan> {
  const updateData: Record<string, unknown> = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.reference !== undefined) updateData.reference = data.reference
  if (data.loanType !== undefined) updateData.loan_type = data.loanType
  if (data.lender !== undefined) updateData.lender = data.lender
  if (data.principalAmount !== undefined) updateData.principal_amount = data.principalAmount
  if (data.interestRate !== undefined) updateData.interest_rate = data.interestRate
  if (data.startDate !== undefined) updateData.start_date = data.startDate
  if (data.durationMonths !== undefined) updateData.duration_months = data.durationMonths
  if (data.paymentFrequency !== undefined) updateData.payment_frequency = data.paymentFrequency
  if (data.paymentDay !== undefined) updateData.payment_day = data.paymentDay
  if (data.accountCodeLoan !== undefined) updateData.account_code_loan = data.accountCodeLoan
  if (data.accountCodeInterest !== undefined) updateData.account_code_interest = data.accountCodeInterest
  if (data.notes !== undefined) updateData.notes = data.notes

  // Recalculer la date de fin si la durée ou la date de début change
  if (data.startDate !== undefined || data.durationMonths !== undefined) {
    const loan = await getLoan(loanId)
    const startDate = data.startDate || loan.start_date
    const durationMonths = data.durationMonths || loan.duration_months
    updateData.end_date = calculateEndDate(startDate, durationMonths)
  }

  updateData.updated_at = new Date().toISOString()

  const { data: loan, error } = await supabase
    .from('loans')
    .update(updateData)
    .eq('id', loanId)
    .eq('company_id', COMPANY_ID)
    .select()
    .single()

  if (error) {
    console.error('Error updating loan:', error)
    throw new Error(`Erreur mise à jour emprunt: ${error.message}`)
  }

  return loan
}

/**
 * Supprimer un emprunt
 */
export async function deleteLoan(loanId: string): Promise<void> {
  // Vérifier qu'aucun paiement n'a été enregistré
  const { count, error: countError } = await supabase
    .from('loan_payments')
    .select('*', { count: 'exact', head: true })
    .eq('loan_id', loanId)
    .eq('is_paid', true)

  if (countError) {
    console.error('Error checking payments:', countError)
    throw new Error(`Erreur vérification paiements: ${countError.message}`)
  }

  if (count && count > 0) {
    throw new Error('Impossible de supprimer un emprunt avec des échéances payées')
  }

  // Supprimer les échéances non payées
  const { error: deletePaymentsError } = await supabase
    .from('loan_payments')
    .delete()
    .eq('loan_id', loanId)

  if (deletePaymentsError) {
    console.error('Error deleting payments:', deletePaymentsError)
    throw new Error(`Erreur suppression échéances: ${deletePaymentsError.message}`)
  }

  // Supprimer l'emprunt
  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId)
    .eq('company_id', COMPANY_ID)

  if (error) {
    console.error('Error deleting loan:', error)
    throw new Error(`Erreur suppression emprunt: ${error.message}`)
  }
}

/**
 * Lister les emprunts avec filtres optionnels
 */
export async function listLoans(filters?: LoanFilters): Promise<Loan[]> {
  let query = supabase
    .from('loans')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('start_date', { ascending: false })

  if (filters?.loanType) {
    query = query.eq('loan_type', filters.loanType)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.searchTerm) {
    query = query.or(`name.ilike.%${filters.searchTerm}%,lender.ilike.%${filters.searchTerm}%,reference.ilike.%${filters.searchTerm}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error listing loans:', error)
    throw new Error(`Erreur chargement emprunts: ${error.message}`)
  }

  if (!data) {
    console.error('listLoans: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour loans')
  }

  return data
}

// ============ Échéances ============

/**
 * Récupérer les prochaines échéances à venir (tous emprunts confondus)
 */
export async function getUpcomingPayments(days: number = 30): Promise<LoanPayment[]> {
  const today = new Date().toISOString().split('T')[0]
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)
  const futureDateStr = futureDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('loan_payments')
    .select('*, loan:loans(*)')
    .eq('is_paid', false)
    .gte('due_date', today)
    .lte('due_date', futureDateStr)
    .order('due_date')

  if (error) {
    console.error('Error fetching upcoming payments:', error)
    throw new Error(`Erreur chargement échéances: ${error.message}`)
  }

  // Filtrer pour ne garder que les échéances des emprunts de l'entreprise
  const payments = (data || []).filter(p => {
    const loan = p.loan as Loan
    return loan && loan.company_id === COMPANY_ID
  })

  return payments
}

/**
 * Récupérer les échéances d'un emprunt spécifique
 */
export async function getLoanPayments(loanId: string): Promise<LoanPayment[]> {
  const { data, error } = await supabase
    .from('loan_payments')
    .select('*')
    .eq('loan_id', loanId)
    .order('due_date')

  if (error) {
    console.error('Error fetching loan payments:', error)
    throw new Error(`Erreur chargement échéances: ${error.message}`)
  }

  if (!data) {
    console.error('getLoanPayments: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour loan_payments')
  }

  return data
}

// ============ Enregistrement des paiements ============

/**
 * Enregistrer le paiement d'une échéance d'emprunt
 * Génère les écritures comptables :
 * - Débit 164 (emprunt) = capital remboursé
 * - Débit 6611 (intérêts) = intérêts
 * - Crédit 512 (banque) = total échéance
 */
export async function recordLoanPayment(
  loanId: string,
  paymentDate: string,
  amount: number,
  bankAccountCode?: string
): Promise<void> {
  // Charger le plan comptable pour résolution dynamique
  const chartOfAccounts = await loadChartOfAccounts()

  // Résoudre le compte banque si non fourni
  const resolvedBankAccountCode = bankAccountCode || resolveByRole('BANQUE_PRINCIPALE', chartOfAccounts).code

  // Récupérer l'emprunt
  const loan = await getLoan(loanId)

  // Trouver la prochaine échéance non payée
  const { data: payments, error: paymentsError } = await supabase
    .from('loan_payments')
    .select('*')
    .eq('loan_id', loanId)
    .eq('is_paid', false)
    .order('due_date')
    .limit(1)

  if (paymentsError) {
    console.error('Error fetching payment:', paymentsError)
    throw new Error(`Erreur chargement échéance: ${paymentsError.message}`)
  }

  if (!payments || payments.length === 0) {
    throw new Error('Aucune échéance en attente pour cet emprunt')
  }

  const payment = payments[0]

  // Vérifier que le montant correspond (tolérance de 1%)
  const tolerance = payment.total_amount * 0.01
  if (Math.abs(amount - payment.total_amount) > tolerance) {
    console.warn(`Payment amount ${amount} differs from scheduled ${payment.total_amount}`)
  }

  // Ajuster les montants si le paiement diffère légèrement
  let principalAmount = payment.principal_amount
  let interestAmount = payment.interest_amount

  if (amount !== payment.total_amount) {
    // Répartir la différence proportionnellement
    const ratio = amount / payment.total_amount
    interestAmount = Math.round(payment.interest_amount * ratio * 100) / 100
    principalAmount = Math.round((amount - interestAmount) * 100) / 100
  }

  // Générer les écritures comptables
  const journalBanque = await getJournalBanque()
  const pieceNumber = await generatePieceNumber(journalBanque)
  const label = `Échéance emprunt ${loan.name} - ${loan.lender}`

  const entries: Partial<AccountingEntry>[] = [
    // Débit 164 (ou compte emprunt) = capital remboursé
    {
      company_id: COMPANY_ID,
      journal: journalBanque,
      date: paymentDate,
      piece_number: pieceNumber,
      label: `${label} - Capital`,
      account_code: loan.account_code_loan,
      debit: principalAmount,
      credit: 0,
      is_validated: false,
    },
    // Débit 6611 (intérêts) = intérêts
    {
      company_id: COMPANY_ID,
      journal: journalBanque,
      date: paymentDate,
      piece_number: pieceNumber,
      label: `${label} - Intérêts`,
      account_code: loan.account_code_interest,
      debit: interestAmount,
      credit: 0,
      is_validated: false,
    },
    // Crédit 512 (banque) = total échéance
    {
      company_id: COMPANY_ID,
      journal: journalBanque,
      date: paymentDate,
      piece_number: pieceNumber,
      label,
      account_code: resolvedBankAccountCode,
      debit: 0,
      credit: amount,
      is_validated: false,
    },
  ]

  // Insérer les écritures
  const { data: insertedEntries, error: entriesError } = await supabase
    .from('accounting_entries')
    .insert(entries)
    .select()

  if (entriesError) {
    console.error('Error creating payment entries:', entriesError)
    throw new Error(`Erreur création écritures: ${entriesError.message}`)
  }

  // Marquer l'échéance comme payée
  const { error: updatePaymentError } = await supabase
    .from('loan_payments')
    .update({
      payment_date: paymentDate,
      is_paid: true,
      accounting_entry_id: insertedEntries[0]?.id,
    })
    .eq('id', payment.id)

  if (updatePaymentError) {
    console.error('Error updating payment status:', updatePaymentError)
    throw new Error(`Erreur mise à jour échéance: ${updatePaymentError.message}`)
  }

  // Mettre à jour le capital restant dû sur l'emprunt
  const newRemainingPrincipal = Math.round((loan.remaining_principal - principalAmount) * 100) / 100

  const updateLoanData: Record<string, unknown> = {
    remaining_principal: Math.max(0, newRemainingPrincipal),
    updated_at: new Date().toISOString(),
  }

  // Si le capital restant est soldé, marquer l'emprunt comme terminé
  if (newRemainingPrincipal <= 0) {
    updateLoanData.status = 'completed'
  }

  const { error: updateLoanError } = await supabase
    .from('loans')
    .update(updateLoanData)
    .eq('id', loanId)

  if (updateLoanError) {
    console.error('Error updating loan:', updateLoanError)
    throw new Error(`Erreur mise à jour emprunt: ${updateLoanError.message}`)
  }

  console.log(`Recorded payment of ${amount} for loan ${loan.name}. Remaining: ${newRemainingPrincipal}`)
}

// ============ Tableaux de bord ============

/**
 * Obtenir le résumé global des emprunts
 */
export async function getLoanSummary(): Promise<LoanSummary> {
  // Récupérer tous les emprunts
  const loans = await listLoans()

  // Récupérer toutes les échéances payées
  const { data: paidPayments, error: paidError } = await supabase
    .from('loan_payments')
    .select('*, loan:loans(*)')
    .eq('is_paid', true)

  if (paidError) {
    console.error('Error fetching paid payments:', paidError)
    throw new Error(`Erreur chargement paiements: ${paidError.message}`)
  }

  // Filtrer pour ne garder que les paiements de l'entreprise
  const companyPayments = (paidPayments || []).filter(p => {
    const loan = p.loan as Loan
    return loan && loan.company_id === COMPANY_ID
  })

  // Calculer les totaux
  const totalBorrowed = loans.reduce((sum, loan) => sum + loan.principal_amount, 0)
  const totalRepaid = companyPayments.reduce((sum, p) => sum + p.principal_amount, 0)
  const totalInterestPaid = companyPayments.reduce((sum, p) => sum + p.interest_amount, 0)
  const remainingPrincipal = loans
    .filter(l => l.status === 'active')
    .reduce((sum, l) => sum + l.remaining_principal, 0)

  // Nombre d'emprunts actifs
  const activeLoans = loans.filter(l => l.status === 'active').length

  // Prochaines échéances (30 jours)
  const upcoming = await getUpcomingPayments(30)
  const upcomingPayments = upcoming.map(payment => {
    const loan = (payment as unknown as { loan: Loan }).loan
    return { loan, payment }
  })

  return {
    totalBorrowed: Math.round(totalBorrowed * 100) / 100,
    totalRepaid: Math.round(totalRepaid * 100) / 100,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
    activeLoans,
    upcomingPayments,
  }
}

/**
 * Obtenir le tableau d'amortissement d'un emprunt avec l'état des paiements
 */
export async function getLoanAmortizationTable(loanId: string): Promise<{
  loan: Loan
  schedule: (LoanAmortizationEntry & { isPaid: boolean; paymentDate?: string })[]
}> {
  const loan = await getLoan(loanId)
  const payments = await getLoanPayments(loanId)

  // Générer le tableau d'amortissement théorique
  const schedule = generatePaymentSchedule(loan)

  // Enrichir avec l'état des paiements réels
  const enrichedSchedule = schedule.map((entry, index) => {
    const payment = payments[index]
    return {
      ...entry,
      isPaid: payment?.is_paid || false,
      paymentDate: payment?.payment_date || undefined,
    }
  })

  return { loan, schedule: enrichedSchedule }
}

/**
 * Obtenir les emprunts arrivant à échéance prochainement
 */
export async function getLoansEndingSoon(months: number = 6): Promise<Loan[]> {
  const today = new Date().toISOString().split('T')[0]
  const futureDate = new Date()
  futureDate.setMonth(futureDate.getMonth() + months)
  const futureDateStr = futureDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('status', 'active')
    .gte('end_date', today)
    .lte('end_date', futureDateStr)
    .order('end_date')

  if (error) {
    console.error('Error fetching loans ending soon:', error)
    throw new Error(`Erreur chargement emprunts: ${error.message}`)
  }

  if (!data) {
    console.error('getLoansEndingSoon: data is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour loans ending soon')
  }

  return data
}
