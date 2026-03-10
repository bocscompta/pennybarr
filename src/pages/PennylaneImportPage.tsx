import { useState, useCallback, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useBankAccounts, useTransactionCategories } from '../hooks/useSupabase'
import { parseFile, toSupabaseFormat } from '../services/bankImportParser'
import type { ParseResult } from '../services/bankImportParser'
import type { BankAccount, TransactionCategory } from '../types/database'
import { createBankTransactions } from '../services/supabaseService'

// Normalize string for category matching (lowercase, remove accents, trim)
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim()
}

// Find matching category ID from Pennylane category name
function findCategoryId(pennylaneCat: string | undefined, categories: TransactionCategory[]): string | undefined {
  if (!pennylaneCat) return undefined

  const normalized = normalizeForMatch(pennylaneCat)

  // Try exact match first
  const exactMatch = categories.find(c => normalizeForMatch(c.name) === normalized)
  if (exactMatch) return exactMatch.id

  // Try partial match (Pennylane category contains or is contained by DB category)
  const partialMatch = categories.find(c => {
    const normDbCat = normalizeForMatch(c.name)
    return normalized.includes(normDbCat) || normDbCat.includes(normalized)
  })
  if (partialMatch) return partialMatch.id

  return undefined
}

interface PennylaneImportPageProps {
  onNavigate?: (page: string) => void
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

// Format date
const formatDate = (date: Date) => {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PennylaneImportPage({ onNavigate }: PennylaneImportPageProps) {
  const { accounts: bankAccounts, loading: loadingAccounts, error: accountsError } = useBankAccounts()
  const { categories, loading: loadingCategories } = useTransactionCategories()

  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; duplicates: number; errors: string[] } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [accountMapping, setAccountMapping] = useState<Record<string, string>>({})

  const pennylaneAccounts = parseResult?.accountsFound || []

  // Memoized category mapping for preview display
  const categoryMapping = useMemo(() => {
    if (!parseResult || categories.length === 0) return new Map<string, TransactionCategory | undefined>()

    const mapping = new Map<string, TransactionCategory | undefined>()
    for (const tx of parseResult.transactions) {
      if (tx.category && !mapping.has(tx.category)) {
        const catId = findCategoryId(tx.category, categories)
        const cat = catId ? categories.find(c => c.id === catId) : undefined
        mapping.set(tx.category, cat)
      }
    }
    return mapping
  }, [parseResult, categories])

  // Stats on category mapping
  const categoryStats = useMemo(() => {
    if (!parseResult) return { total: 0, mapped: 0, unmapped: 0 }

    const withCategory = parseResult.transactions.filter(tx => tx.category)
    const mapped = withCategory.filter(tx => tx.category && categoryMapping.get(tx.category))

    return {
      total: withCategory.length,
      mapped: mapped.length,
      unmapped: withCategory.length - mapped.length
    }
  }, [parseResult, categoryMapping])

  // Auto-map Pennylane accounts to existing bank accounts
  const autoMapAccounts = useCallback(() => {
    if (pennylaneAccounts.length === 0) return

    const mapping: Record<string, string> = {}
    for (const plAccount of pennylaneAccounts) {
      const match = bankAccounts.find(ba => {
        const plLower = plAccount.toLowerCase()
        const baNameLower = ba.name.toLowerCase()
        return (plLower.includes('cic') && baNameLower.includes('cic')) ||
               (plLower.includes('pennylane') && baNameLower.includes('pennylane')) ||
               (plLower.includes('swan') && baNameLower.includes('swan')) ||
               plLower.includes(baNameLower) ||
               baNameLower.includes(plLower.replace('c/c ', ''))
      })
      if (match) {
        mapping[plAccount] = match.id
      }
    }
    setAccountMapping(mapping)
  }, [pennylaneAccounts, bankAccounts])

  // Auto-map when accounts change
  useEffect(() => {
    if (parseResult && bankAccounts.length > 0) {
      autoMapAccounts()
    }
  }, [parseResult, bankAccounts, autoMapAccounts])

  // Handle file
  const handleFile = useCallback((file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (!isExcel) {
      setParseResult({
        transactions: [],
        format: 'unknown',
        errors: ['Veuillez sélectionner un fichier Excel (.xlsx) exporté depuis Pennylane'],
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const csvContent = XLSX.utils.sheet_to_csv(worksheet)
        const result = parseFile(csvContent, file.name)

        if (result.format !== 'PENNYLANE') {
          setParseResult({
            transactions: [],
            format: 'unknown',
            errors: ['Ce fichier ne semble pas être un export Pennylane. Vérifiez que vous avez exporté les transactions bancaires depuis Pennylane.'],
          })
          return
        }

        setParseResult(result)
        setSelectedTransactions(new Set(result.transactions.map((_, i) => i)))
        setImportResult(null)
      } catch (err) {
        setParseResult({
          transactions: [],
          format: 'unknown',
          errors: [`Erreur lecture Excel: ${err instanceof Error ? err.message : 'Erreur inconnue'}`],
        })
      }
    }
    reader.onerror = () => {
      setParseResult({
        transactions: [],
        format: 'unknown',
        errors: [`Erreur lecture fichier: ${file.name}`],
      })
    }
    reader.readAsArrayBuffer(file)
  }, [])

  // Drag handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }, [handleFile])

  // Toggle transaction selection
  const toggleTransaction = (index: number) => {
    const newSelected = new Set(selectedTransactions)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedTransactions(newSelected)
  }

  // Toggle all
  const toggleAll = () => {
    if (!parseResult) return
    if (selectedTransactions.size === parseResult.transactions.length) {
      setSelectedTransactions(new Set())
    } else {
      setSelectedTransactions(new Set(parseResult.transactions.map((_, i) => i)))
    }
  }

  // Import
  const handleImport = async () => {
    if (!parseResult || selectedTransactions.size === 0) return

    // Check all accounts are mapped
    const unmappedAccounts = pennylaneAccounts.filter(pa => !accountMapping[pa])
    if (unmappedAccounts.length > 0) {
      setImportResult({
        success: 0,
        duplicates: 0,
        errors: [`Comptes non mappés: ${unmappedAccounts.join(', ')}`]
      })
      return
    }

    setImporting(true)
    setImportResult(null)

    const transactionsToImport = parseResult.transactions
      .filter((_, i) => selectedTransactions.has(i))
      .map(tx => {
        const accountId = tx.bankAccountName ? accountMapping[tx.bankAccountName] : ''
        const categoryId = findCategoryId(tx.category, categories)
        const mappedCat = categoryId ? categories.find(c => c.id === categoryId) : undefined
        return toSupabaseFormat(tx, accountId, categoryId, mappedCat?.name)
      })

    try {
      const result = await createBankTransactions(transactionsToImport)
      setImportResult(result)
      if (result.success > 0 && onNavigate) {
        setTimeout(() => {
          onNavigate('transactions')
        }, 2000)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Erreur inconnue'
      setImportResult({ success: 0, duplicates: 0, errors: [error] })
    } finally {
      setImporting(false)
    }
  }

  // Calculate totals
  const selectedTotal = parseResult?.transactions
    .filter((_, i) => selectedTransactions.has(i))
    .reduce((sum, tx) => sum + tx.amount, 0) || 0

  const allMapped = pennylaneAccounts.length > 0 && pennylaneAccounts.every(pa => accountMapping[pa])

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
          Migration depuis Pennylane
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
          Importez vos transactions bancaires depuis votre export Pennylane
        </p>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Step 1: Upload File */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <h2 className="font-medium mb-4" style={{ color: '#141A1F' }}>
              1. Charger le fichier Pennylane
            </h2>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-green-500 bg-green-50' : ''}`}
              style={{ borderColor: dragActive ? '#006666' : '#E4E5E7' }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm mb-2" style={{ color: '#141A1F' }}>
                Glissez votre fichier ici ou{' '}
                <label className="font-medium cursor-pointer" style={{ color: '#006666' }}>
                  parcourir
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleFileInput}
                  />
                </label>
              </p>
              <p className="text-xs" style={{ color: '#6C767F' }}>
                Format supporté : Excel (.xlsx) - Export "Transactions bancaires" depuis Pennylane
              </p>
            </div>

            {/* Parse errors */}
            {parseResult?.errors && parseResult.errors.length > 0 && parseResult.transactions.length === 0 && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg text-red-700 text-sm">
                {parseResult.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}

            {/* Success info */}
            {parseResult && parseResult.transactions.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#D9EFEB' }}>
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#006666' }}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {parseResult.transactions.length} transactions trouvées dans {pennylaneAccounts.length} compte(s)
                  </div>
                </div>

                {/* Category mapping stats */}
                {!loadingCategories && categoryStats.total > 0 && (
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                    <div className="text-sm">
                      <span className="font-medium" style={{ color: '#141A1F' }}>Catégories : </span>
                      {categoryStats.mapped > 0 && (
                        <span className="text-green-600">{categoryStats.mapped} mappée(s)</span>
                      )}
                      {categoryStats.mapped > 0 && categoryStats.unmapped > 0 && <span className="mx-1">•</span>}
                      {categoryStats.unmapped > 0 && (
                        <span className="text-amber-600">{categoryStats.unmapped} non trouvée(s)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Map accounts */}
          {parseResult && parseResult.transactions.length > 0 && (
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="font-medium mb-4" style={{ color: '#141A1F' }}>
                2. Associer les comptes
              </h2>

              {loadingAccounts ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#6C767F' }}>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  Chargement des comptes...
                </div>
              ) : accountsError ? (
                <div className="text-red-600 text-sm">{accountsError}</div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: '#6C767F' }}>
                    Associez chaque compte Pennylane à un compte bancaire existant dans Pennybarr.
                  </p>
                  {pennylaneAccounts.map((plAccount) => {
                    const txCount = parseResult.transactions.filter(tx => tx.bankAccountName === plAccount).length
                    return (
                      <div key={plAccount} className="flex items-center gap-4 p-3 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                        <div className="flex-1">
                          <div className="text-sm font-medium" style={{ color: '#141A1F' }}>
                            {plAccount}
                          </div>
                          <div className="text-xs" style={{ color: '#6C767F' }}>
                            {txCount} transaction{txCount > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#6C767F' }}>→</span>
                          <select
                            value={accountMapping[plAccount] || ''}
                            onChange={(e) => setAccountMapping(prev => ({ ...prev, [plAccount]: e.target.value }))}
                            className="w-64 px-3 py-2 border rounded-lg text-sm"
                            style={{
                              borderColor: accountMapping[plAccount] ? '#006666' : '#E4E5E7',
                              color: '#141A1F',
                              backgroundColor: 'white'
                            }}
                          >
                            <option value="">-- Choisir un compte --</option>
                            {bankAccounts.map((account: BankAccount) => (
                              <option key={account.id} value={account.id}>
                                {account.name} ({account.bank_name})
                              </option>
                            ))}
                          </select>
                          {accountMapping[plAccount] && (
                            <span className="text-green-600 text-lg">✓</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <button
                    onClick={autoMapAccounts}
                    className="text-sm font-medium"
                    style={{ color: '#006666' }}
                  >
                    Auto-détecter les correspondances
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview transactions */}
          {parseResult && parseResult.transactions.length > 0 && allMapped && (
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium" style={{ color: '#141A1F' }}>
                  3. Vérifier les transactions
                </h2>
                <div className="text-sm" style={{ color: '#6C767F' }}>
                  {selectedTransactions.size} sélectionnée(s) sur {parseResult.transactions.length}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.size === parseResult.transactions.length}
                            onChange={toggleAll}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: '#6C767F' }}>Date</th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: '#6C767F' }}>Compte</th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: '#6C767F' }}>Libellé</th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: '#6C767F' }}>Tiers</th>
                        <th className="px-3 py-2 text-left font-medium" style={{ color: '#6C767F' }}>Catégorie</th>
                        <th className="px-3 py-2 text-right font-medium" style={{ color: '#6C767F' }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.transactions.map((tx, index) => (
                        <tr
                          key={index}
                          className="border-t hover:bg-gray-50 cursor-pointer"
                          style={{ borderColor: '#E4E5E7' }}
                          onClick={() => toggleTransaction(index)}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedTransactions.has(index)}
                              onChange={() => toggleTransaction(index)}
                              className="rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-3 py-2" style={{ color: '#141A1F' }}>
                            {formatDate(tx.date)}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#6C767F' }}>
                            {tx.bankAccountName?.replace('C/C ', '').slice(0, 15)}...
                          </td>
                          <td className="px-3 py-2" style={{ color: '#141A1F' }}>
                            <div className="max-w-xs truncate" title={tx.label}>
                              {tx.label}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#6C767F' }}>
                            {tx.thirdParty || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {tx.category ? (
                              (() => {
                                const mappedCat = categoryMapping.get(tx.category)
                                return mappedCat ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                                    style={{ backgroundColor: `${mappedCat.color}20`, color: mappedCat.color }}
                                    title={`Mappé vers: ${mappedCat.name}`}
                                  >
                                    {mappedCat.name}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700"
                                    title="Catégorie non trouvée en base"
                                  >
                                    {tx.category}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                  </span>
                                )
                              })()
                            ) : (
                              <span style={{ color: '#6C767F' }}>-</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                <div>
                  <span className="text-sm" style={{ color: '#6C767F' }}>Total sélectionné : </span>
                  <span className={`font-semibold ${selectedTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(selectedTotal)}
                  </span>
                </div>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedTransactions.size === 0}
                  className="px-6 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#006666' }}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Import en cours...
                    </span>
                  ) : (
                    `Importer ${selectedTransactions.size} transaction(s)`
                  )}
                </button>
              </div>

              {/* Import Result */}
              {importResult && (
                <div
                  className="mt-4 p-4 rounded-lg"
                  style={{
                    backgroundColor: importResult.errors.length === 0 ? '#ECFDF5' : '#FEF2F2',
                  }}
                >
                  {importResult.success > 0 && (
                    <div className="flex items-center gap-2 text-green-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {importResult.success} transaction(s) importée(s) avec succès
                    </div>
                  )}
                  {importResult.duplicates > 0 && (
                    <div className="flex items-center gap-2 mt-1" style={{ color: '#6C767F' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {importResult.duplicates} doublon(s) ignoré(s)
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-red-700 text-sm">
                      <div className="font-medium">Erreurs :</div>
                      {importResult.errors.map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  )}
                  {importResult.success > 0 && (
                    <div className="mt-2 text-sm" style={{ color: '#6C767F' }}>
                      Redirection vers les transactions...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Help */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <h3 className="font-medium mb-3" style={{ color: '#141A1F' }}>
              Comment exporter depuis Pennylane ?
            </h3>
            <ol className="text-sm space-y-2" style={{ color: '#6C767F' }}>
              <li>1. Connectez-vous à <strong>Pennylane</strong></li>
              <li>2. Allez dans <strong>Banque → Transactions</strong></li>
              <li>3. Sélectionnez la période souhaitée (ou "Toutes")</li>
              <li>4. Cliquez sur <strong>Exporter</strong> (icône en haut à droite)</li>
              <li>5. Choisissez le format <strong>Excel (.xlsx)</strong></li>
              <li>6. Téléchargez le fichier et importez-le ici</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  )
}
