import { useState, useEffect, useCallback } from 'react'
import * as supabaseService from '../services/supabaseService'
import type {
  BankAccount,
  BankTransaction,
  ThirdParty,
  Invoice,
  ChartOfAccount,
  TransactionCategory,
  DashboardStats,
} from '../types/database'

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.getDashboardStats()
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}

export function useBankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    supabaseService.getBankAccounts()
      .then(setAccounts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { accounts, loading, error, refetch }
}

export function useBankTransactions(accountId: string | null) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    if (!accountId) {
      setTransactions([])
      return
    }
    setLoading(true)
    supabaseService.getBankTransactions(accountId)
      .then(setTransactions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [accountId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { transactions, loading, error, refetch }
}

export function useAllBankTransactions() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    supabaseService.getAllBankTransactions()
      .then(setTransactions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { transactions, loading, error, refetch }
}

export function useSuggestedReconciliationStats() {
  const [stats, setStats] = useState<{ count: number; amount: number }>({ count: 0, amount: 0 })
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    supabaseService.getSuggestedReconciliationStats()
      .then(setStats)
      .catch(err => console.error('Suggested reconciliation stats error:', err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { stats, loading, refetch }
}

export function useSuggestedReconciliationIds() {
  const [ids, setIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    supabaseService.getSuggestedReconciliationTransactionIds()
      .then(setIds)
      .catch(err => console.error('Suggested reconciliation IDs error:', err.message))
      .finally(() => setLoading(false))
  }, [])

  return { ids, loading, fetch }
}

export function useUnreconciledTransactions(limit: number = 10) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    supabaseService.getUnreconciledTransactions(limit)
      .then(setTransactions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [limit])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { transactions, loading, error, refetch }
}

export function useThirdParties(type?: 'customer' | 'supplier') {
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.getThirdParties(type)
      .then(setThirdParties)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [type])

  return { thirdParties, loading, error }
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<ThirdParty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.getSuppliers()
      .then(setSuppliers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { suppliers, loading, error }
}

export function useSuppliersWithBalance() {
  const [suppliers, setSuppliers] = useState<(ThirdParty & { balance: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.getSuppliersWithBalance()
      .then(setSuppliers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { suppliers, loading, error }
}

export function useCustomers() {
  const [customers, setCustomers] = useState<ThirdParty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.getCustomers()
      .then(setCustomers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { customers, loading, error }
}

export function useInvoices(type?: 'customer' | 'supplier') {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    supabaseService.getInvoices(type)
      .then(setInvoices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [type])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { invoices, loading, error, refetch }
}

export function useSupplierInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    supabaseService.getSupplierInvoices()
      .then(setInvoices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { invoices, loading, error, refetch }
}

export function useCustomerInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    supabaseService.getCustomerInvoices()
      .then(setInvoices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { invoices, loading, error, refetch }
}

export function useChartOfAccounts() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.getChartOfAccounts()
      .then(setAccounts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { accounts, loading, error }
}

export function useTransactionCategories() {
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.getTransactionCategories()
      .then(setCategories)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, error }
}

export function useConnectionTest() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseService.testConnection()
      .then(result => {
        setConnected(result.connected)
        if (result.error) setError(result.error)
      })
      .catch(err => {
        setConnected(false)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  return { connected, loading, error }
}
