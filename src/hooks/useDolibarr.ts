import { useState, useEffect } from 'react'
import * as api from '../services/dolibarr'

export function useDashboardStats() {
  const [stats, setStats] = useState<{
    bankBalance: number
    totalInvoiced: number
    totalPurchases: number
    unpaidInvoicesCount: number
    totalUnpaid: number
    invoicesCount: number
    supplierInvoicesCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getDashboardStats()
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<api.Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getInvoices()
      .then(setInvoices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { invoices, loading, error }
}

export function useClients() {
  const [clients, setClients] = useState<api.ThirdParty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getClients()
      .then(setClients)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { clients, loading, error }
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<api.ThirdParty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSuppliers()
      .then(setSuppliers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { suppliers, loading, error }
}

export function useBankAccounts() {
  const [accounts, setAccounts] = useState<api.BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getBankAccounts()
      .then(setAccounts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { accounts, loading, error }
}

export function useProducts() {
  const [products, setProducts] = useState<api.Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getProducts()
      .then(setProducts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { products, loading, error }
}

export function useSupplierInvoices() {
  const [invoices, setInvoices] = useState<api.Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSupplierInvoices()
      .then(setInvoices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { invoices, loading, error, refetch: () => {
    setLoading(true)
    api.getSupplierInvoices()
      .then(setInvoices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }}
}

export function useBankTransactions(accountId: string | null) {
  const [transactions, setTransactions] = useState<api.BankTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) {
      setTransactions([])
      return
    }
    setLoading(true)
    api.getBankTransactions(accountId)
      .then(setTransactions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [accountId])

  return { transactions, loading, error }
}

export function useDocuments(modulepart?: string) {
  const [documents, setDocuments] = useState<api.DolibarrDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getDocuments(modulepart)
      .then(setDocuments)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [modulepart])

  return { documents, loading, error }
}

export function useExpenseReports() {
  const [reports, setReports] = useState<api.ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getExpenseReports()
      .then(setReports)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { reports, loading, error }
}

export function useProposals() {
  const [proposals, setProposals] = useState<api.Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getProposals()
      .then(setProposals)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { proposals, loading, error }
}

export function useLoans() {
  const [loans, setLoans] = useState<api.Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getLoans()
      .then(setLoans)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { loans, loading, error }
}
