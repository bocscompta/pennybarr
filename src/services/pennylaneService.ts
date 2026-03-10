// Pennylane API Integration Service
// Documentation: https://pennylane.readme.io

const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2'

interface PennylaneConfig {
  apiKey: string
}

// Types based on Pennylane API response
export interface PennylaneLedgerAccount {
  id: number
  number: string
  label: string
  vat_rate: string
  country_alpha2: string
  enabled: boolean
  type: 'generic' | 'custom'
  letterable: boolean
  created_at: string
  updated_at: string
}

export interface PennylaneLedgerEntryLine {
  id: number
  debit: string
  credit: string
  label: string
  ledger_account: {
    id: number
    number: string
    url: string
  }
}

export interface PennylaneLedgerEntry {
  id: number
  label: string
  date: string
  piece_number: string
  due_date: string | null
  journal: {
    id: number
    url: string
  }
  categories: Array<{
    id: number
    label: string
    analytical_code: string | null
  }>
  attachment: {
    filename: string
    url: string
  } | null
  ledger_entry_lines?: PennylaneLedgerEntryLine[]
  created_at: string
  updated_at: string
}

export interface PennylaneJournal {
  id: number
  code: string
  label: string
  type: string
}

export interface PennylanePaginatedResponse<T> {
  total_pages: number
  current_page: number
  per_page: number
  total_items: number
  items: T[]
  has_more: boolean | null
  next_cursor: string | null
}

// Balance trial structure
export interface TrialBalanceLine {
  accountNumber: string
  accountLabel: string
  debit: number
  credit: number
  balance: number // debit - credit
}

export interface TrialBalance {
  lines: TrialBalanceLine[]
  totalDebit: number
  totalCredit: number
  startDate: string
  endDate: string
}

class PennylaneService {
  private apiKey: string | null = null

  configure(config: PennylaneConfig) {
    this.apiKey = config.apiKey
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Pennylane API key not configured. Call configure() first.')
    }

    const response = await fetch(`${PENNYLANE_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(`Pennylane API error: ${error.error || response.statusText}`)
    }

    return response.json()
  }

  // ============ Ledger Accounts ============

  async getLedgerAccounts(limit: number = 100, page: number = 1): Promise<PennylanePaginatedResponse<PennylaneLedgerAccount>> {
    return this.fetch(`/ledger_accounts?limit=${limit}&page=${page}`)
  }

  async getAllLedgerAccounts(): Promise<PennylaneLedgerAccount[]> {
    const allAccounts: PennylaneLedgerAccount[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.getLedgerAccounts(100, page)
      allAccounts.push(...response.items)
      hasMore = page < response.total_pages
      page++
    }

    return allAccounts
  }

  async getLedgerAccount(id: number): Promise<PennylaneLedgerAccount> {
    return this.fetch(`/ledger_accounts/${id}`)
  }

  // ============ Ledger Entries ============

  async getLedgerEntries(limit: number = 100, page: number = 1): Promise<PennylanePaginatedResponse<PennylaneLedgerEntry>> {
    return this.fetch(`/ledger_entries?limit=${limit}&page=${page}`)
  }

  async getLedgerEntry(id: number): Promise<PennylaneLedgerEntry> {
    return this.fetch(`/ledger_entries/${id}`)
  }

  async getAllLedgerEntries(startDate?: string, endDate?: string): Promise<PennylaneLedgerEntry[]> {
    const allEntries: PennylaneLedgerEntry[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      let url = `/ledger_entries?limit=100&page=${page}`
      if (startDate) url += `&filter[date][gte]=${startDate}`
      if (endDate) url += `&filter[date][lte]=${endDate}`

      const response: PennylanePaginatedResponse<PennylaneLedgerEntry> = await this.fetch(url)
      allEntries.push(...response.items)
      hasMore = page < response.total_pages
      page++
    }

    return allEntries
  }

  // ============ Journals ============

  async getJournals(): Promise<PennylanePaginatedResponse<PennylaneJournal>> {
    return this.fetch('/journals')
  }

  // ============ Trial Balance Calculation ============

  async calculateTrialBalance(startDate: string, endDate: string): Promise<TrialBalance> {
    // Fetch all entries for the period
    const entries = await this.getAllLedgerEntries(startDate, endDate)

    // Fetch all accounts for labels
    const accounts = await this.getAllLedgerAccounts()
    const accountMap = new Map<string, string>()
    for (const account of accounts) {
      accountMap.set(account.number, account.label)
    }

    // Calculate balances per account
    const balances = new Map<string, { debit: number; credit: number }>()

    for (const entry of entries) {
      // Fetch entry details with lines if not included
      let entryWithLines = entry
      if (!entry.ledger_entry_lines) {
        entryWithLines = await this.getLedgerEntry(entry.id)
      }

      if (entryWithLines.ledger_entry_lines) {
        for (const line of entryWithLines.ledger_entry_lines) {
          const accountNumber = line.ledger_account.number
          const debit = parseFloat(line.debit) || 0
          const credit = parseFloat(line.credit) || 0

          const existing = balances.get(accountNumber) || { debit: 0, credit: 0 }
          balances.set(accountNumber, {
            debit: existing.debit + debit,
            credit: existing.credit + credit,
          })
        }
      }
    }

    // Build trial balance lines
    const lines: TrialBalanceLine[] = []
    let totalDebit = 0
    let totalCredit = 0

    for (const [accountNumber, { debit, credit }] of balances) {
      const balance = debit - credit
      lines.push({
        accountNumber,
        accountLabel: accountMap.get(accountNumber) || `Compte ${accountNumber}`,
        debit,
        credit,
        balance,
      })
      totalDebit += debit
      totalCredit += credit
    }

    // Sort by account number
    lines.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))

    return {
      lines,
      totalDebit,
      totalCredit,
      startDate,
      endDate,
    }
  }

  // ============ Balance Sheet (Bilan) ============

  async generateBilan(startDate: string, endDate: string): Promise<{
    actif: {
      immobilisations: TrialBalanceLine[]
      actifCirculant: TrialBalanceLine[]
      tresorerie: TrialBalanceLine[]
      totalActif: number
    }
    passif: {
      capitauxPropres: TrialBalanceLine[]
      provisions: TrialBalanceLine[]
      dettes: TrialBalanceLine[]
      totalPassif: number
    }
  }> {
    const trialBalance = await this.calculateTrialBalance(startDate, endDate)

    // Classify accounts
    const immobilisations = trialBalance.lines.filter(l => l.accountNumber.startsWith('2'))
    const stocks = trialBalance.lines.filter(l => l.accountNumber.startsWith('3'))
    const creances = trialBalance.lines.filter(l =>
      l.accountNumber.startsWith('4') && l.balance > 0 // Debit balance = asset
    )
    const tresorerie = trialBalance.lines.filter(l => l.accountNumber.startsWith('5'))

    const capitauxPropres = trialBalance.lines.filter(l =>
      l.accountNumber.startsWith('1') && !l.accountNumber.startsWith('15') && !l.accountNumber.startsWith('16')
    )
    const provisions = trialBalance.lines.filter(l => l.accountNumber.startsWith('15'))
    const dettes = trialBalance.lines.filter(l =>
      l.accountNumber.startsWith('16') ||
      (l.accountNumber.startsWith('4') && l.balance < 0) // Credit balance = liability
    )

    const totalActif =
      immobilisations.reduce((sum, l) => sum + l.balance, 0) +
      stocks.reduce((sum, l) => sum + l.balance, 0) +
      creances.reduce((sum, l) => sum + l.balance, 0) +
      tresorerie.reduce((sum, l) => sum + l.balance, 0)

    const totalPassif =
      Math.abs(capitauxPropres.reduce((sum, l) => sum + l.balance, 0)) +
      Math.abs(provisions.reduce((sum, l) => sum + l.balance, 0)) +
      Math.abs(dettes.reduce((sum, l) => sum + l.balance, 0))

    return {
      actif: {
        immobilisations,
        actifCirculant: [...stocks, ...creances],
        tresorerie,
        totalActif,
      },
      passif: {
        capitauxPropres: capitauxPropres.map(l => ({ ...l, balance: Math.abs(l.balance) })),
        provisions: provisions.map(l => ({ ...l, balance: Math.abs(l.balance) })),
        dettes: dettes.map(l => ({ ...l, balance: Math.abs(l.balance) })),
        totalPassif,
      },
    }
  }
}

// Export singleton instance
export const pennylaneService = new PennylaneService()

// Configure with API key from environment or directly
export function configurePennylane(apiKey: string) {
  pennylaneService.configure({ apiKey })
}
