import { useState, useCallback } from 'react'
import { useBankAccounts } from '../hooks/useSupabase'
import { parseFile, toSupabaseFormat } from '../services/bankImportParser'
import type { ParseResult } from '../services/bankImportParser'
import type { BankAccount } from '../types/database'
import { createBankTransactions, createBankAccount } from '../services/supabaseService'

interface BankImportPageProps {
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

export default function BankImportPage({ onNavigate }: BankImportPageProps) {
  const { accounts: bankAccounts, loading: loadingAccounts, error: accountsError, refetch: refetchAccounts } = useBankAccounts()

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; duplicates: number; errors: string[] } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBank, setNewAccountBank] = useState('')
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [newAccountIBAN, setNewAccountIBAN] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)

  // Handle file drop/select
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const result = parseFile(content, file.name)

      // Redirect to Pennylane migration if it's a Pennylane file
      if (result.format === 'PENNYLANE' && onNavigate) {
        alert('Ce fichier semble être un export Pennylane. Utilisez Paramètres → Migration depuis Pennylane.')
        return
      }

      setParseResult(result)
      setSelectedTransactions(new Set(result.transactions.map((_, i) => i)))
      setImportResult(null)
    }
    reader.onerror = () => {
      setParseResult({
        transactions: [],
        format: 'unknown',
        errors: [`Erreur lecture fichier: ${file.name}`],
      })
    }
    reader.readAsText(file)
  }, [onNavigate])

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

  // Import selected transactions
  const handleImport = async () => {
    if (!selectedAccountId || !parseResult || selectedTransactions.size === 0) return

    setImporting(true)
    setImportResult(null)

    const transactionsToImport = parseResult.transactions
      .filter((_, i) => selectedTransactions.has(i))
      .map(tx => toSupabaseFormat(tx, selectedAccountId))

    try {
      const result = await createBankTransactions(transactionsToImport)
      setImportResult(result)
      if (result.success > 0 && onNavigate) {
        setTimeout(() => {
          onNavigate('transactions')
        }, 1500)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Erreur inconnue'
      setImportResult({ success: 0, duplicates: 0, errors: [error] })
    } finally {
      setImporting(false)
    }
  }

  // Handle account creation
  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return

    setCreatingAccount(true)
    try {
      const newAccount = await createBankAccount({
        name: newAccountName,
        bank_name: newAccountBank || undefined,
        account_number: newAccountNumber || undefined,
        iban: newAccountIBAN || undefined,
        currency: 'EUR',
        initial_balance: 0,
        current_balance: 0,
        is_active: true,
      })
      setSelectedAccountId(newAccount.id)
      setShowCreateAccount(false)
      setNewAccountName('')
      setNewAccountBank('')
      setNewAccountNumber('')
      setNewAccountIBAN('')
      refetchAccounts()
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Erreur création compte'
      setImportResult({ success: 0, duplicates: 0, errors: [error] })
    } finally {
      setCreatingAccount(false)
    }
  }

  // Calculate totals
  const selectedTotal = parseResult?.transactions
    .filter((_, i) => selectedTransactions.has(i))
    .reduce((sum, tx) => sum + tx.amount, 0) || 0

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Import bancaire</h1>
        <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
          Importez vos relevés bancaires (OFX, CSV, QIF)
        </p>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Step 1: Select Bank Account */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <h2 className="font-medium mb-4" style={{ color: '#141A1F' }}>
              1. Sélectionner le compte bancaire
            </h2>
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#6C767F' }}>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                Chargement des comptes...
              </div>
            ) : accountsError ? (
              <div className="text-red-600 text-sm">{accountsError}</div>
            ) : bankAccounts && bankAccounts.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
                >
                  <option value="">-- Choisir un compte --</option>
                  {bankAccounts.map((account: BankAccount) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.bank_name} ({account.iban || account.account_number || 'N/A'})
                    </option>
                  ))}
                </select>
                {!showCreateAccount && (
                  <button
                    onClick={() => setShowCreateAccount(true)}
                    className="text-sm font-medium"
                    style={{ color: '#006666' }}
                  >
                    + Ajouter un autre compte
                  </button>
                )}
              </div>
            ) : !showCreateAccount ? (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Aucun compte bancaire. Créez-en un pour importer vos transactions.
                </p>
                <button
                  onClick={() => setShowCreateAccount(true)}
                  className="px-4 py-2 rounded-lg text-white font-medium text-sm"
                  style={{ backgroundColor: '#006666' }}
                >
                  + Créer un compte bancaire
                </button>
              </div>
            ) : null}

            {/* Account creation form */}
            {showCreateAccount && (
              <div className="space-y-4 max-w-md mt-4 p-4 border rounded-lg" style={{ borderColor: '#E4E5E7', backgroundColor: '#F8F9FA' }}>
                <h3 className="font-medium text-sm" style={{ color: '#141A1F' }}>Nouveau compte bancaire</h3>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Nom du compte *</label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Ex: CIC Compte Pro"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    style={{ borderColor: '#E4E5E7' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Nom de la banque</label>
                  <input
                    type="text"
                    value={newAccountBank}
                    onChange={(e) => setNewAccountBank(e.target.value)}
                    placeholder="Ex: CIC"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    style={{ borderColor: '#E4E5E7' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>Numéro de compte</label>
                  <input
                    type="text"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    placeholder="Ex: 00012345678"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    style={{ borderColor: '#E4E5E7' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>IBAN</label>
                  <input
                    type="text"
                    value={newAccountIBAN}
                    onChange={(e) => setNewAccountIBAN(e.target.value)}
                    placeholder="Ex: FR7600000000000000000000000"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    style={{ borderColor: '#E4E5E7' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateAccount}
                    disabled={!newAccountName.trim() || creatingAccount}
                    className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                    style={{ backgroundColor: '#006666' }}
                  >
                    {creatingAccount ? 'Création...' : 'Créer le compte'}
                  </button>
                  <button
                    onClick={() => setShowCreateAccount(false)}
                    className="px-4 py-2 rounded-lg border text-sm font-medium bg-white"
                    style={{ borderColor: '#E4E5E7', color: '#6C767F' }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Upload File */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <h2 className="font-medium mb-4" style={{ color: '#141A1F' }}>2. Charger le fichier</h2>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-teal-500 bg-teal-50' : ''}`}
              style={{ borderColor: dragActive ? '#006666' : '#E4E5E7' }}
            >
              <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mb-2" style={{ color: '#141A1F' }}>
                Glissez votre fichier ici ou{' '}
                <label className="cursor-pointer font-medium" style={{ color: '#006666' }}>
                  parcourir
                  <input type="file" accept=".ofx,.qif,.csv" onChange={handleFileInput} className="hidden" />
                </label>
              </p>
              <p className="text-sm" style={{ color: '#6C767F' }}>Formats supportés : OFX, QIF, CSV (CIC, Crédit Mutuel)</p>
            </div>

            {parseResult && (
              <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#F8F9FA' }}>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium" style={{ color: '#141A1F' }}>Format : {parseResult.format}</span>
                  <span style={{ color: '#6C767F' }}>{parseResult.transactions.length} transaction(s)</span>
                  {parseResult.bankName && <span style={{ color: '#6C767F' }}>Banque : {parseResult.bankName}</span>}
                </div>
                {parseResult.errors.length > 0 && (
                  <div className="mt-2 text-sm text-amber-700">
                    {parseResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Preview & Select */}
          {parseResult && parseResult.transactions.length > 0 && (
            <div className="bg-white rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
                <h2 className="font-medium" style={{ color: '#141A1F' }}>3. Vérifier et sélectionner</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm" style={{ color: '#6C767F' }}>
                    {selectedTransactions.size} sélectionnée(s) • Total : {formatCurrency(selectedTotal)}
                  </span>
                  <button onClick={toggleAll} className="text-sm font-medium" style={{ color: '#006666' }}>
                    {selectedTransactions.size === parseResult.transactions.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-12 p-3 text-left">
                        <input type="checkbox" checked={selectedTransactions.size === parseResult.transactions.length} onChange={toggleAll} className="rounded" />
                      </th>
                      <th className="p-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Date</th>
                      <th className="p-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Libellé</th>
                      <th className="p-3 text-left text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Type</th>
                      <th className="p-3 text-right text-xs font-medium uppercase" style={{ color: '#6C767F' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.transactions.map((tx, index) => (
                      <tr key={index} className="border-t hover:bg-gray-50 cursor-pointer" style={{ borderColor: '#F2F2F3' }} onClick={() => toggleTransaction(index)}>
                        <td className="p-3">
                          <input type="checkbox" checked={selectedTransactions.has(index)} onChange={() => toggleTransaction(index)} className="rounded" onClick={(e) => e.stopPropagation()} />
                        </td>
                        <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{formatDate(tx.date)}</td>
                        <td className="p-3 text-sm" style={{ color: '#141A1F' }}><div className="max-w-md truncate">{tx.label}</div></td>
                        <td className="p-3">
                          <span className="px-2 py-1 text-xs font-medium rounded" style={{ backgroundColor: '#F0F9FF', color: '#0369A1' }}>{tx.type}</span>
                        </td>
                        <td className="p-3 text-sm text-right font-medium" style={{ color: tx.amount >= 0 ? '#059669' : '#DC2626' }}>{formatCurrency(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Import */}
          {parseResult && parseResult.transactions.length > 0 && (
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium" style={{ color: '#141A1F' }}>4. Importer</h2>
                  <p className="text-sm mt-1" style={{ color: '#6C767F' }}>Les transactions seront créées dans le compte sélectionné</p>
                </div>
                <button
                  onClick={handleImport}
                  disabled={!selectedAccountId || selectedTransactions.size === 0 || importing}
                  className="px-6 py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#006666' }}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Import en cours...
                    </span>
                  ) : `Importer ${selectedTransactions.size} transaction(s)`}
                </button>
              </div>

              {importResult && (
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: importResult.errors.length === 0 ? '#ECFDF5' : '#FEF2F2' }}>
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
                      {importResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Help */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <h3 className="font-medium mb-3" style={{ color: '#141A1F' }}>Comment obtenir votre relevé CIC ?</h3>
            <ol className="text-sm space-y-2" style={{ color: '#6C767F' }}>
              <li>1. Connectez-vous à <strong>CIC Filbanque</strong></li>
              <li>2. Allez dans <strong>Comptes → Historique des opérations</strong></li>
              <li>3. Sélectionnez la période souhaitée</li>
              <li>4. Cliquez sur <strong>Exporter</strong> et choisissez le format CSV ou OFX</li>
              <li>5. Téléchargez le fichier et importez-le ici</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  )
}
