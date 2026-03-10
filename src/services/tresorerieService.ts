// Tresorerie Service - Planification et suivi de tresorerie
import { supabase, COMPANY_ID } from '../lib/supabase'

// ============ Types ============

export interface CashPosition {
  bankAccounts: { id: string; name: string; balance: number }[]
  cashAccounts: { id: string; name: string; balance: number }[]
  totalAvailable: number
  asOfDate: string
}

export interface CashFlow {
  id: string
  date: string
  label: string
  amount: number
  type: 'inflow' | 'outflow'
  source: 'invoice' | 'loan' | 'salary' | 'tax' | 'other'
  probability: number // 0-100%
}

export interface CashFlowForecast {
  month: string // Format: YYYY-MM
  openingBalance: number
  totalInflows: number
  totalOutflows: number
  closingBalance: number
  budgetedInflows?: number
  budgetedOutflows?: number
  varianceInflows?: number
  varianceOutflows?: number
}

export interface BudgetLine {
  id: string
  month: string // Format: YYYY-MM
  category: string
  type: 'inflow' | 'outflow'
  amount: number
  createdAt: string
  updatedAt: string
}

export interface BudgetComparison {
  month: string
  category: string
  type: 'inflow' | 'outflow'
  budgeted: number
  actual: number
  variance: number
  variancePercent: number
}

export interface CashAlert {
  id: string
  type: 'negative_balance' | 'large_payment' | 'budget_variance'
  severity: 'warning' | 'critical'
  title: string
  message: string
  date: string
  amount?: number
  relatedEntityId?: string
}

// ============ Constants ============

// Comptes PCG pour la tresorerie
const ACCOUNT_CASH_PREFIX = '53'  // Caisse

// Seuils pour les alertes
const LARGE_PAYMENT_THRESHOLD = 10000 // Alerter si echeance > 10 000 EUR
const BUDGET_VARIANCE_THRESHOLD = 0.20 // Alerter si ecart > 20%
const CRITICAL_DAYS_AHEAD = 7 // Solde negatif dans les 7 jours = critique

// ============ Position de tresorerie ============

/**
 * Obtenir la position de tresorerie actuelle
 * Combine les soldes des comptes banque (512) et caisse (53)
 */
export async function getCurrentCashPosition(): Promise<CashPosition> {
  const asOfDate = new Date().toISOString().split('T')[0]

  // Recuperer les comptes bancaires actifs
  const { data: bankAccountsData, error: bankError } = await supabase
    .from('bank_accounts')
    .select('id, name, current_balance')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('name')

  if (bankError) {
    console.error('Error fetching bank accounts:', bankError)
    throw new Error(`Erreur chargement comptes bancaires: ${bankError.message}`)
  }

  const bankAccounts = (bankAccountsData || []).map(account => ({
    id: account.id,
    name: account.name,
    balance: Number(account.current_balance) || 0,
  }))

  // Recuperer les soldes des comptes de caisse depuis les ecritures comptables
  // Les comptes caisse commencent par 53
  const { data: cashEntries, error: cashError } = await supabase
    .from('accounting_entries')
    .select('account_code, debit, credit')
    .eq('company_id', COMPANY_ID)
    .like('account_code', `${ACCOUNT_CASH_PREFIX}%`)

  if (cashError) {
    console.error('Error fetching cash entries:', cashError)
    throw new Error(`Erreur chargement ecritures caisse: ${cashError.message}`)
  }

  if (!cashEntries) {
    console.error('getTreasuryDashboard: cashEntries is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour cash entries')
  }

  // Grouper par compte et calculer le solde
  const cashBalanceMap = new Map<string, { name: string; balance: number }>()

  for (const entry of cashEntries) {
    const existing = cashBalanceMap.get(entry.account_code) || {
      name: `Caisse ${entry.account_code}`,
      balance: 0,
    }
    existing.balance += (entry.debit || 0) - (entry.credit || 0)
    cashBalanceMap.set(entry.account_code, existing)
  }

  const cashAccounts = Array.from(cashBalanceMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    balance: Math.round(data.balance * 100) / 100,
  }))

  // Calculer le total disponible
  const totalBank = bankAccounts.reduce((sum, a) => sum + a.balance, 0)
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0)

  return {
    bankAccounts,
    cashAccounts,
    totalAvailable: Math.round((totalBank + totalCash) * 100) / 100,
    asOfDate,
  }
}

// ============ Previsions d'entrees ============

/**
 * Obtenir les entrees de tresorerie prevues (factures clients a encaisser)
 */
export async function getForecastedInflows(
  startDate: string,
  endDate: string
): Promise<CashFlow[]> {
  const flows: CashFlow[] = []

  // 1. Factures clients non payees avec date d'echeance dans la periode
  const { data: customerInvoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, number, due_date, total_ttc, status, third_party:third_parties(name)')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'customer')
    .neq('status', 'paid')
    .neq('status', 'cancelled')
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .order('due_date')

  if (invoicesError) {
    console.error('Error fetching customer invoices:', invoicesError)
    throw new Error(`Erreur chargement factures clients: ${invoicesError.message}`)
  }

  if (!customerInvoices) {
    console.error('getProjectedCashFlows: customerInvoices is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour customer invoices')
  }

  for (const invoice of customerInvoices) {
    const thirdPartyName = (invoice.third_party as { name?: string })?.name || 'Client'

    // Probabilite basee sur le statut et le retard
    let probability = 90 // Par defaut
    if (invoice.status === 'draft') {
      probability = 50 // Facture non encore envoyee
    } else {
      const dueDate = new Date(invoice.due_date!)
      const today = new Date()
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysOverdue > 90) {
        probability = 30
      } else if (daysOverdue > 60) {
        probability = 50
      } else if (daysOverdue > 30) {
        probability = 70
      }
    }

    flows.push({
      id: `invoice-${invoice.id}`,
      date: invoice.due_date!,
      label: `Facture ${invoice.number} - ${thirdPartyName}`,
      amount: invoice.total_ttc,
      type: 'inflow',
      source: 'invoice',
      probability,
    })
  }

  // 2. Produits a recevoir prevus dans le budget
  const budgetInflows = await getBudgetFlows(startDate, endDate, 'inflow')
  for (const budget of budgetInflows) {
    // Eviter les doublons avec les factures
    if (budget.category !== 'factures_clients') {
      flows.push({
        id: `budget-inflow-${budget.id}`,
        date: `${budget.month}-15`, // Milieu du mois par defaut
        label: `Budget: ${budget.category}`,
        amount: budget.amount,
        type: 'inflow',
        source: 'other',
        probability: 70, // Prevision budgetaire
      })
    }
  }

  // Trier par date
  flows.sort((a, b) => a.date.localeCompare(b.date))

  return flows
}

// ============ Previsions de sorties ============

/**
 * Obtenir les sorties de tresorerie prevues
 */
export async function getForecastedOutflows(
  startDate: string,
  endDate: string
): Promise<CashFlow[]> {
  const flows: CashFlow[] = []

  // 1. Factures fournisseurs non payees
  const { data: supplierInvoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, number, due_date, total_ttc, status, third_party:third_parties(name)')
    .eq('company_id', COMPANY_ID)
    .eq('type', 'supplier')
    .neq('status', 'paid')
    .neq('status', 'cancelled')
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .order('due_date')

  if (invoicesError) {
    console.error('Error fetching supplier invoices:', invoicesError)
    throw new Error(`Erreur chargement factures fournisseurs: ${invoicesError.message}`)
  }

  if (!supplierInvoices) {
    console.error('getProjectedCashOutflows: supplierInvoices is null after successful query')
    throw new Error('Erreur inattendue: données manquantes pour supplier invoices')
  }

  for (const invoice of supplierInvoices) {
    const thirdPartyName = (invoice.third_party as { name?: string })?.name || 'Fournisseur'

    flows.push({
      id: `invoice-${invoice.id}`,
      date: invoice.due_date!,
      label: `Facture ${invoice.number} - ${thirdPartyName}`,
      amount: invoice.total_ttc,
      type: 'outflow',
      source: 'invoice',
      probability: 95, // Factures fournisseurs = certaines
    })
  }

  // 2. Echeances d'emprunts
  const { data: loanPayments, error: loanError } = await supabase
    .from('loan_payments')
    .select('id, due_date, total_amount, loan:loans(name, lender, company_id)')
    .eq('is_paid', false)
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .order('due_date')

  if (loanError) {
    console.error('Error fetching loan payments:', loanError)
    throw new Error(`Erreur chargement echeances emprunts: ${loanError.message}`)
  }

  // Filtrer pour ne garder que les emprunts de l'entreprise
  const companyLoanPayments = (loanPayments || []).filter(p => {
    const loan = p.loan as { company_id?: string }
    return loan && loan.company_id === COMPANY_ID
  })

  for (const payment of companyLoanPayments) {
    const loanData = payment.loan as unknown as { name: string; lender: string } | { name: string; lender: string }[] | null
    const loan = Array.isArray(loanData) ? loanData[0] : loanData
    if (loan) {
      flows.push({
        id: `loan-${payment.id}`,
        date: payment.due_date,
        label: `Echeance ${loan.name} - ${loan.lender}`,
        amount: payment.total_amount,
        type: 'outflow',
        source: 'loan',
        probability: 100, // Echeances emprunts = certaines
      })
    }
  }

  // 3. Charges budgetees (salaires, charges sociales, taxes)
  const budgetOutflows = await getBudgetFlows(startDate, endDate, 'outflow')
  for (const budget of budgetOutflows) {
    // Eviter les doublons avec factures et emprunts
    if (!['factures_fournisseurs', 'emprunts'].includes(budget.category)) {
      let source: CashFlow['source'] = 'other'
      let probability = 80

      if (budget.category.includes('salaire')) {
        source = 'salary'
        probability = 100 // Salaires = certains
      } else if (budget.category.includes('charge') || budget.category.includes('cotisation')) {
        source = 'salary'
        probability = 100
      } else if (budget.category.includes('tva') || budget.category.includes('impot') || budget.category.includes('taxe')) {
        source = 'tax'
        probability = 95
      }

      flows.push({
        id: `budget-outflow-${budget.id}`,
        date: `${budget.month}-15`, // Milieu du mois par defaut
        label: `Budget: ${budget.category}`,
        amount: budget.amount,
        type: 'outflow',
        source,
        probability,
      })
    }
  }

  // Trier par date
  flows.sort((a, b) => a.date.localeCompare(b.date))

  return flows
}

// ============ Plan de tresorerie ============

/**
 * Generer le plan de tresorerie previsionnel sur plusieurs mois
 */
export async function generateCashFlowForecast(
  startDate: string,
  months: number
): Promise<CashFlowForecast[]> {
  const forecasts: CashFlowForecast[] = []

  // Obtenir la position actuelle
  const currentPosition = await getCurrentCashPosition()
  let currentBalance = currentPosition.totalAvailable

  const start = new Date(startDate)

  for (let i = 0; i < months; i++) {
    const monthDate = new Date(start)
    monthDate.setMonth(monthDate.getMonth() + i)

    const year = monthDate.getFullYear()
    const month = String(monthDate.getMonth() + 1).padStart(2, '0')
    const monthKey = `${year}-${month}`

    // Calculer les dates de debut et fin du mois
    const monthStart = `${monthKey}-01`
    const lastDay = new Date(year, monthDate.getMonth() + 1, 0).getDate()
    const monthEnd = `${monthKey}-${lastDay}`

    // Recuperer les flux prevus pour ce mois
    const inflows = await getForecastedInflows(monthStart, monthEnd)
    const outflows = await getForecastedOutflows(monthStart, monthEnd)

    // Calculer les totaux ponderes par la probabilite
    const totalInflows = inflows.reduce((sum, f) => sum + (f.amount * f.probability / 100), 0)
    const totalOutflows = outflows.reduce((sum, f) => sum + (f.amount * f.probability / 100), 0)

    // Recuperer le budget pour comparaison
    const budget = await getBudgetForMonth(monthKey)
    const budgetedInflows = budget.filter(b => b.type === 'inflow').reduce((sum, b) => sum + b.amount, 0)
    const budgetedOutflows = budget.filter(b => b.type === 'outflow').reduce((sum, b) => sum + b.amount, 0)

    const openingBalance = currentBalance
    const closingBalance = openingBalance + totalInflows - totalOutflows

    forecasts.push({
      month: monthKey,
      openingBalance: Math.round(openingBalance * 100) / 100,
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      budgetedInflows: budgetedInflows > 0 ? Math.round(budgetedInflows * 100) / 100 : undefined,
      budgetedOutflows: budgetedOutflows > 0 ? Math.round(budgetedOutflows * 100) / 100 : undefined,
      varianceInflows: budgetedInflows > 0
        ? Math.round((totalInflows - budgetedInflows) * 100) / 100
        : undefined,
      varianceOutflows: budgetedOutflows > 0
        ? Math.round((totalOutflows - budgetedOutflows) * 100) / 100
        : undefined,
    })

    // Mettre a jour le solde pour le mois suivant
    currentBalance = closingBalance
  }

  return forecasts
}

// ============ Budget de tresorerie ============

/**
 * Sauvegarder ou mettre a jour une ligne de budget
 */
export async function saveBudgetLine(
  month: string,
  category: string,
  amount: number,
  type: 'inflow' | 'outflow' = 'outflow'
): Promise<void> {
  // Verifier si une ligne existe deja
  const { data: existing, error: selectError } = await supabase
    .from('treasury_budget')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('month', month)
    .eq('category', category)
    .single()

  if (selectError && selectError.code !== 'PGRST116') {
    // PGRST116 = not found, c'est OK
    console.error('Error checking existing budget:', selectError)
    throw new Error(`Erreur verification budget: ${selectError.message}`)
  }

  if (existing) {
    // Mettre a jour
    const { error: updateError } = await supabase
      .from('treasury_budget')
      .update({
        amount,
        type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      console.error('Error updating budget:', updateError)
      throw new Error(`Erreur mise a jour budget: ${updateError.message}`)
    }
  } else {
    // Creer
    const { error: insertError } = await supabase
      .from('treasury_budget')
      .insert({
        company_id: COMPANY_ID,
        month,
        category,
        amount,
        type,
      })

    if (insertError) {
      console.error('Error creating budget:', insertError)
      throw new Error(`Erreur creation budget: ${insertError.message}`)
    }
  }
}

/**
 * Obtenir le budget pour une annee
 */
export async function getBudget(year: number): Promise<BudgetLine[]> {
  const startMonth = `${year}-01`
  const endMonth = `${year}-12`

  const { data, error } = await supabase
    .from('treasury_budget')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .gte('month', startMonth)
    .lte('month', endMonth)
    .order('month')
    .order('category')

  if (error) {
    console.error('Error fetching budget:', error)
    throw new Error(`Erreur chargement budget: ${error.message}`)
  }

  return (data || []).map(line => ({
    id: line.id,
    month: line.month,
    category: line.category,
    type: line.type as 'inflow' | 'outflow',
    amount: line.amount,
    createdAt: line.created_at,
    updatedAt: line.updated_at,
  }))
}

/**
 * Obtenir le budget pour un mois specifique
 */
async function getBudgetForMonth(month: string): Promise<BudgetLine[]> {
  const { data, error } = await supabase
    .from('treasury_budget')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('month', month)
    .order('category')

  if (error) {
    console.error('Error fetching budget for month:', error)
    throw new Error(`Erreur chargement budget mois: ${error.message}`)
  }

  return (data || []).map(line => ({
    id: line.id,
    month: line.month,
    category: line.category,
    type: line.type as 'inflow' | 'outflow',
    amount: line.amount,
    createdAt: line.created_at,
    updatedAt: line.updated_at,
  }))
}

/**
 * Obtenir les flux budgetes pour une periode
 */
async function getBudgetFlows(
  startDate: string,
  endDate: string,
  type: 'inflow' | 'outflow'
): Promise<BudgetLine[]> {
  const startMonth = startDate.slice(0, 7) // YYYY-MM
  const endMonth = endDate.slice(0, 7)

  const { data, error } = await supabase
    .from('treasury_budget')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('type', type)
    .gte('month', startMonth)
    .lte('month', endMonth)

  if (error) {
    console.error('Error fetching budget flows:', error)
    throw new Error(`Erreur chargement budget: ${error.message}`)
  }

  return (data || []).map(line => ({
    id: line.id,
    month: line.month,
    category: line.category,
    type: line.type as 'inflow' | 'outflow',
    amount: line.amount,
    createdAt: line.created_at,
    updatedAt: line.updated_at,
  }))
}

/**
 * Comparer le budget au reel pour une annee
 */
export async function compareBudgetVsActual(year: number): Promise<BudgetComparison[]> {
  const comparisons: BudgetComparison[] = []
  const budget = await getBudget(year)

  // Pour chaque ligne de budget, calculer le reel
  for (const budgetLine of budget) {
    const monthStart = `${budgetLine.month}-01`
    const monthNum = parseInt(budgetLine.month.slice(5, 7))
    const lastDay = new Date(year, monthNum, 0).getDate()
    const monthEnd = `${budgetLine.month}-${lastDay}`

    let actual = 0

    // Calculer le reel selon la categorie
    if (budgetLine.type === 'inflow') {
      const inflows = await getForecastedInflows(monthStart, monthEnd)
      // Ne compter que les flux realises (probabilite 100% = factures payees)
      actual = inflows
        .filter(f => f.probability === 100)
        .reduce((sum, f) => sum + f.amount, 0)
    } else {
      const outflows = await getForecastedOutflows(monthStart, monthEnd)
      actual = outflows
        .filter(f => f.probability === 100)
        .reduce((sum, f) => sum + f.amount, 0)
    }

    const variance = actual - budgetLine.amount
    const variancePercent = budgetLine.amount > 0
      ? (variance / budgetLine.amount) * 100
      : 0

    comparisons.push({
      month: budgetLine.month,
      category: budgetLine.category,
      type: budgetLine.type,
      budgeted: budgetLine.amount,
      actual: Math.round(actual * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variancePercent: Math.round(variancePercent * 10) / 10,
    })
  }

  return comparisons
}

// ============ Alertes ============

/**
 * Obtenir les alertes de tresorerie
 */
export async function getCashAlerts(): Promise<CashAlert[]> {
  const alerts: CashAlert[] = []
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 1. Verifier le solde previsionnel sur les 3 prochains mois
  const forecasts = await generateCashFlowForecast(todayStr, 3)

  for (const forecast of forecasts) {
    if (forecast.closingBalance < 0) {
      const monthDate = new Date(forecast.month + '-01')
      const daysUntil = Math.floor((monthDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      alerts.push({
        id: `negative-${forecast.month}`,
        type: 'negative_balance',
        severity: daysUntil <= CRITICAL_DAYS_AHEAD ? 'critical' : 'warning',
        title: 'Solde previsionnel negatif',
        message: `Le solde de tresorerie prevu pour ${forecast.month} est de ${forecast.closingBalance.toLocaleString('fr-FR')} EUR`,
        date: forecast.month,
        amount: forecast.closingBalance,
      })
    }
  }

  // 2. Verifier les grosses echeances a venir (30 jours)
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 30)
  const futureDateStr = futureDate.toISOString().split('T')[0]

  const outflows = await getForecastedOutflows(todayStr, futureDateStr)
  const largePayments = outflows.filter(f => f.amount >= LARGE_PAYMENT_THRESHOLD)

  for (const payment of largePayments) {
    const daysUntil = Math.floor(
      (new Date(payment.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    alerts.push({
      id: `large-${payment.id}`,
      type: 'large_payment',
      severity: daysUntil <= CRITICAL_DAYS_AHEAD ? 'critical' : 'warning',
      title: 'Echeance importante a venir',
      message: `${payment.label}: ${payment.amount.toLocaleString('fr-FR')} EUR le ${payment.date}`,
      date: payment.date,
      amount: payment.amount,
      relatedEntityId: payment.id,
    })
  }

  // 3. Verifier les ecarts budgetaires
  const currentYear = today.getFullYear()
  const comparisons = await compareBudgetVsActual(currentYear)

  for (const comp of comparisons) {
    if (Math.abs(comp.variancePercent) > BUDGET_VARIANCE_THRESHOLD * 100) {
      const direction = comp.variance > 0 ? 'superieur' : 'inferieur'

      alerts.push({
        id: `variance-${comp.month}-${comp.category}`,
        type: 'budget_variance',
        severity: 'warning',
        title: 'Ecart budgetaire important',
        message: `${comp.category} (${comp.month}): reel ${direction} de ${Math.abs(comp.variancePercent).toFixed(1)}% au budget`,
        date: comp.month,
        amount: comp.variance,
      })
    }
  }

  // Trier par severite puis par date
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1
    }
    return a.date.localeCompare(b.date)
  })

  return alerts
}

// ============ Utilitaires exports ============

/**
 * Obtenir un resume rapide de la tresorerie pour le dashboard
 */
export async function getTreasurySummary(): Promise<{
  currentBalance: number
  forecastedBalance30Days: number
  alertCount: number
  criticalAlertCount: number
}> {
  const position = await getCurrentCashPosition()
  const alerts = await getCashAlerts()

  // Prevision a 30 jours
  const today = new Date().toISOString().split('T')[0]
  const forecasts = await generateCashFlowForecast(today, 2)
  const forecastedBalance30Days = forecasts.length > 0 ? forecasts[0].closingBalance : position.totalAvailable

  return {
    currentBalance: position.totalAvailable,
    forecastedBalance30Days,
    alertCount: alerts.length,
    criticalAlertCount: alerts.filter(a => a.severity === 'critical').length,
  }
}
