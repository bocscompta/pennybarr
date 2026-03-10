import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

// Types for Grand Livre data
interface GrandLivreRow {
  accountCode: string
  accountLabel: string
  date: Date
  journal: string
  pieceLabel: string
  lineLabel: string
  pieceNumber: string
  invoiceNumber: string
  vatRate: string | null
  lettering: string | null
  currency: string
  exchangeRate: string
  debit: number
  credit: number
  balance: number
  analyticalCategory: string | null
  thirdPartyId: string | null
  thirdPartyName: string | null
  siren: string | null
  registrationDate: Date | null
  author: string | null
  debitOriginal: number
  creditOriginal: number
  dueDate: Date | null
}

interface ImportStats {
  totalRows: number
  accounts: { new: number; existing: number }
  thirdParties: { new: number; existing: number }
  entries: { imported: number; skipped: number }
  journals: { new: number; existing: number }
}

interface ParsedData {
  rows: GrandLivreRow[]
  accounts: Map<string, { code: string; label: string }>
  thirdParties: Map<string, { id: string; name: string; siren: string | null }>
  journals: Set<string>
}

// Convert Excel serial date to JS Date
function excelDateToJSDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  return new Date(utc_value * 1000)
}

// Parse the Grand Livre XLSX file
function parseGrandLivre(workbook: XLSX.WorkBook): ParsedData {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  const accounts = new Map<string, { code: string; label: string }>()
  const thirdParties = new Map<string, { id: string; name: string; siren: string | null }>()
  const journals = new Set<string>()
  const rows: GrandLivreRow[] = []

  // Skip header row
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[]
    if (!row || row.length < 15) continue

    const accountCode = String(row[0] || '')
    const accountLabel = String(row[1] || '')
    const dateRaw = row[2] as number
    const journal = String(row[3] || '')
    const pieceLabel = String(row[4] || '')
    const lineLabel = String(row[5] || '')
    const pieceNumber = String(row[6] || '')
    const invoiceNumber = String(row[7] || '')
    const vatRate = row[8] ? String(row[8]) : null
    const lettering = row[9] ? String(row[9]) : null
    const currency = String(row[10] || 'EUR')
    const exchangeRate = String(row[11] || '')
    const debit = Number(row[12]) || 0
    const credit = Number(row[13]) || 0
    const balance = Number(row[14]) || 0
    const analyticalCategory = row[15] ? String(row[15]) : null
    const thirdPartyId = row[16] ? String(row[16]) : null
    const thirdPartyName = row[17] ? String(row[17]) : null
    const siren = row[18] ? String(row[18]) : null
    const registrationDateRaw = row[19] as number | undefined
    const author = row[20] ? String(row[20]) : null
    const debitOriginal = Number(row[21]) || 0
    const creditOriginal = Number(row[22]) || 0
    const dueDateRaw = row[23] as number | undefined

    // Convert dates
    const date = dateRaw ? excelDateToJSDate(dateRaw) : new Date()
    const registrationDate = registrationDateRaw ? excelDateToJSDate(registrationDateRaw) : null
    const dueDate = dueDateRaw ? excelDateToJSDate(dueDateRaw) : null

    // Collect unique accounts
    if (accountCode && accountLabel) {
      accounts.set(accountCode, { code: accountCode, label: accountLabel })
    }

    // Collect unique third parties
    if (thirdPartyId && thirdPartyName) {
      thirdParties.set(thirdPartyId, { id: thirdPartyId, name: thirdPartyName, siren })
    }

    // Collect unique journals
    if (journal) {
      journals.add(journal)
    }

    rows.push({
      accountCode,
      accountLabel,
      date,
      journal,
      pieceLabel,
      lineLabel,
      pieceNumber,
      invoiceNumber,
      vatRate,
      lettering,
      currency,
      exchangeRate,
      debit,
      credit,
      balance,
      analyticalCategory,
      thirdPartyId,
      thirdPartyName,
      siren,
      registrationDate,
      author,
      debitOriginal,
      creditOriginal,
      dueDate,
    })
  }

  return { rows, accounts, thirdParties, journals }
}

// Determine account type from PCG code
function getAccountType(code: string): 'asset' | 'liability' | 'equity' | 'income' | 'expense' {
  const firstDigit = code.charAt(0)
  switch (firstDigit) {
    case '1': return 'equity'
    case '2': return 'asset'
    case '3': return 'asset'
    case '4': return code.startsWith('41') ? 'asset' : 'liability'
    case '5': return 'asset'
    case '6': return 'expense'
    case '7': return 'income'
    default: return 'asset'
  }
}

// Determine journal type from code
function getJournalType(code: string): 'purchase' | 'sales' | 'bank' | 'misc' | 'opening' {
  const upperCode = code.toUpperCase()
  if (upperCode.startsWith('HA') || upperCode.startsWith('AC')) return 'purchase'
  if (upperCode.startsWith('VE') || upperCode.startsWith('VT')) return 'sales'
  if (upperCode.startsWith('BQ') || upperCode.startsWith('BA') || upperCode.startsWith('TR')) return 'bank'
  if (upperCode.startsWith('AN') || upperCode.startsWith('OUV') || upperCode.startsWith('RAN')) return 'opening'
  return 'misc'
}

interface GrandLivreImportPageProps {
  onNavigate: (page: string) => void
}

export default function GrandLivreImportPage({ onNavigate }: GrandLivreImportPageProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [importing, setImporting] = useState(false)
  const [importStats, setImportStats] = useState<ImportStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setParsedData(null)
    setImportStats(null)

    try {
      setProgress('Lecture du fichier...')
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })

      setProgress('Analyse des données...')
      const data = parseGrandLivre(workbook)
      setParsedData(data)
      setProgress('')
    } catch (err) {
      setError(`Erreur lors de la lecture du fichier: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
      setProgress('')
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!parsedData) return

    setImporting(true)
    setError(null)
    const stats: ImportStats = {
      totalRows: parsedData.rows.length,
      accounts: { new: 0, existing: 0 },
      thirdParties: { new: 0, existing: 0 },
      entries: { imported: 0, skipped: 0 },
      journals: { new: 0, existing: 0 },
    }

    try {
      // Get company ID (assuming first company for now)
      setProgress('Récupération de l\'entreprise...')
      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .single()

      if (companyError || !companies) {
        throw new Error('Aucune entreprise trouvée. Veuillez d\'abord créer une entreprise.')
      }

      const companyId = companies.id

      // 1. Import journals
      setProgress('Import des journaux...')
      const { data: existingJournals } = await supabase
        .from('journals')
        .select('code')
        .eq('company_id', companyId)

      const existingJournalCodes = new Set(existingJournals?.map(j => j.code) || [])

      for (const journalCode of parsedData.journals) {
        if (existingJournalCodes.has(journalCode)) {
          stats.journals.existing++
        } else {
          const { error: journalError } = await supabase
            .from('journals')
            .insert({
              company_id: companyId,
              code: journalCode,
              name: `Journal ${journalCode}`,
              type: getJournalType(journalCode),
            })

          if (!journalError) {
            stats.journals.new++
          }
        }
      }

      // 2. Import accounts
      setProgress('Import du plan comptable...')
      const { data: existingAccounts } = await supabase
        .from('chart_of_accounts')
        .select('code')
        .eq('company_id', companyId)

      const existingAccountCodes = new Set(existingAccounts?.map(a => a.code) || [])

      const newAccounts = []
      for (const [code, account] of parsedData.accounts) {
        if (existingAccountCodes.has(code)) {
          stats.accounts.existing++
        } else {
          newAccounts.push({
            company_id: companyId,
            code: account.code,
            label: account.label,
            type: getAccountType(account.code),
            is_active: true,
          })
          stats.accounts.new++
        }
      }

      if (newAccounts.length > 0) {
        const { error: accountsError } = await supabase
          .from('chart_of_accounts')
          .insert(newAccounts)

        if (accountsError) {
          console.error('Error inserting accounts:', accountsError)
        }
      }

      // 3. Import third parties
      setProgress('Import des tiers...')
      const { data: existingThirdParties } = await supabase
        .from('third_parties')
        .select('code, name')
        .eq('company_id', companyId)

      const existingThirdPartyCodes = new Set(existingThirdParties?.map(t => t.code) || [])

      const newThirdParties = []
      for (const [id, tp] of parsedData.thirdParties) {
        if (existingThirdPartyCodes.has(id)) {
          stats.thirdParties.existing++
        } else {
          // Determine type based on account code patterns in the data
          const relatedRows = parsedData.rows.filter(r => r.thirdPartyId === id)
          const hasCustomerAccount = relatedRows.some(r => r.accountCode.startsWith('411'))
          const hasSupplierAccount = relatedRows.some(r => r.accountCode.startsWith('401'))

          let type: 'customer' | 'supplier' | 'both' = 'supplier'
          if (hasCustomerAccount && hasSupplierAccount) type = 'both'
          else if (hasCustomerAccount) type = 'customer'

          newThirdParties.push({
            company_id: companyId,
            code: id,
            name: tp.name,
            siren: tp.siren && tp.siren !== 'RESTAURANT' && tp.siren !== 'FRAIS_KILOMETRIQUES' && tp.siren !== 'AUTRE' ? tp.siren : null,
            type,
          })
          stats.thirdParties.new++
        }
      }

      if (newThirdParties.length > 0) {
        const { error: thirdPartiesError } = await supabase
          .from('third_parties')
          .insert(newThirdParties)

        if (thirdPartiesError) {
          console.error('Error inserting third parties:', thirdPartiesError)
        }
      }

      // 4. Import accounting entries with duplicate detection
      setProgress('Vérification des écritures existantes...')

      // Fetch existing entries to check for duplicates
      const { data: existingEntries } = await supabase
        .from('accounting_entries')
        .select('date, journal, account_code, debit, credit, piece_number')
        .eq('company_id', companyId)

      // Create a Set of existing entry signatures for fast lookup
      const existingSignatures = new Set(
        (existingEntries || []).map(e =>
          `${e.date}|${e.journal}|${e.account_code}|${e.debit}|${e.credit}|${e.piece_number || ''}`
        )
      )

      setProgress('Import des écritures comptables...')
      const batchSize = 100

      // Filter out duplicates
      const newEntries = parsedData.rows
        .map(row => {
          const dateStr = row.date.toISOString().split('T')[0]
          const pieceNum = row.pieceNumber || row.invoiceNumber || null
          const signature = `${dateStr}|${row.journal}|${row.accountCode}|${row.debit}|${row.credit}|${pieceNum || ''}`

          return {
            entry: {
              company_id: companyId,
              journal: row.journal,
              date: dateStr,
              piece_number: pieceNum,
              label: row.pieceLabel || row.lineLabel || 'Écriture importée',
              account_code: row.accountCode,
              debit: row.debit,
              credit: row.credit,
              is_validated: true,
            },
            signature,
            isDuplicate: existingSignatures.has(signature)
          }
        })

      const entriesToInsert = newEntries.filter(e => !e.isDuplicate).map(e => e.entry)
      const duplicateCount = newEntries.filter(e => e.isDuplicate).length

      if (duplicateCount > 0) {
        setProgress(`${duplicateCount} écritures déjà existantes (ignorées)...`)
      }

      for (let i = 0; i < entriesToInsert.length; i += batchSize) {
        const batch = entriesToInsert.slice(i, i + batchSize)
        setProgress(`Import des écritures... ${Math.min(i + batchSize, entriesToInsert.length)}/${entriesToInsert.length}`)

        const { error: entriesError } = await supabase
          .from('accounting_entries')
          .insert(batch)

        if (entriesError) {
          console.error('Error inserting entries batch:', entriesError)
          stats.entries.skipped += batch.length
        } else {
          stats.entries.imported += batch.length
        }
      }

      // Add duplicates to skipped count
      stats.entries.skipped += duplicateCount

      setImportStats(stats)
      setProgress('Import terminé !')
    } catch (err) {
      setError(`Erreur lors de l'import: ${err instanceof Error ? err.message : 'Erreur inconnue'}`)
    } finally {
      setImporting(false)
    }
  }, [parsedData])

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('parametres')}
            className="flex items-center gap-2 text-sm"
            style={{ color: '#6C767F' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Retour aux paramètres
          </button>
          <div className="h-6 w-px" style={{ backgroundColor: '#E4E5E7' }} />
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
            Import du Grand Livre
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Info Card */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E3F2FD' }}>
                <svg className="w-5 h-5" style={{ color: '#1976D2' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <h2 className="font-medium mb-2" style={{ color: '#141A1F' }}>
                  Format attendu
                </h2>
                <p className="text-sm mb-3" style={{ color: '#6C767F' }}>
                  Importez un fichier Excel (.xlsx) du Grand Livre exporté depuis Pennylane. Le fichier doit contenir les colonnes suivantes :
                </p>
                <div className="flex flex-wrap gap-2">
                  {['N° de compte', 'Libellé de compte', 'Date', 'Journal', 'Débit', 'Crédit', 'Tiers'].map(col => (
                    <span
                      key={col}
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Upload Zone */}
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
            <h3 className="font-medium mb-4" style={{ color: '#141A1F' }}>
              1. Sélectionner le fichier
            </h3>
            <label
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#D6D9DB' }}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-10 h-10 mb-3" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="mb-2 text-sm" style={{ color: '#6C767F' }}>
                  <span className="font-semibold" style={{ color: '#006666' }}>Cliquez pour sélectionner</span> ou glissez-déposez
                </p>
                <p className="text-xs" style={{ color: '#6C767F' }}>
                  Fichier Excel (.xlsx) uniquement
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
            </label>

            {file && (
              <div className="mt-4 flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F8FAFA' }}>
                <svg className="w-8 h-8" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="flex-1">
                  <p className="font-medium text-sm" style={{ color: '#141A1F' }}>{file.name}</p>
                  <p className="text-xs" style={{ color: '#6C767F' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <svg className="w-5 h-5" style={{ color: '#23A84B' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
          </div>

          {/* Parsed Data Preview */}
          {parsedData && (
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="font-medium mb-4" style={{ color: '#141A1F' }}>
                2. Aperçu des données
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#F8FAFA' }}>
                  <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{parsedData.rows.length}</p>
                  <p className="text-sm" style={{ color: '#6C767F' }}>Écritures</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#F8FAFA' }}>
                  <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{parsedData.accounts.size}</p>
                  <p className="text-sm" style={{ color: '#6C767F' }}>Comptes</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#F8FAFA' }}>
                  <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{parsedData.thirdParties.size}</p>
                  <p className="text-sm" style={{ color: '#6C767F' }}>Tiers</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#F8FAFA' }}>
                  <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>{parsedData.journals.size}</p>
                  <p className="text-sm" style={{ color: '#6C767F' }}>Journaux</p>
                </div>
              </div>

              {/* Sample rows */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                      <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Date</th>
                      <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Journal</th>
                      <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Compte</th>
                      <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Libellé</th>
                      <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>Débit</th>
                      <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b" style={{ borderColor: '#E4E5E7' }}>
                        <td className="p-2" style={{ color: '#141A1F' }}>{row.date.toLocaleDateString('fr-FR')}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
                            {row.journal}
                          </span>
                        </td>
                        <td className="p-2" style={{ color: '#141A1F' }}>{row.accountCode}</td>
                        <td className="p-2 max-w-[200px] truncate" style={{ color: '#6C767F' }} title={row.pieceLabel}>
                          {row.pieceLabel || row.lineLabel}
                        </td>
                        <td className="p-2 text-right font-mono" style={{ color: row.debit > 0 ? '#141A1F' : '#6C767F' }}>
                          {row.debit > 0 ? row.debit.toFixed(2) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono" style={{ color: row.credit > 0 ? '#141A1F' : '#6C767F' }}>
                          {row.credit > 0 ? row.credit.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.rows.length > 10 && (
                  <p className="text-sm text-center py-2" style={{ color: '#6C767F' }}>
                    ... et {parsedData.rows.length - 10} autres écritures
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="bg-white rounded-lg border p-4" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: '#006666' }} />
                <p className="text-sm" style={{ color: '#6C767F' }}>{progress}</p>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importStats && (
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E8F5E9' }}>
                  <svg className="w-5 h-5" style={{ color: '#2E7D32' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="font-medium" style={{ color: '#141A1F' }}>Import terminé</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Journaux</p>
                  <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                    {importStats.journals.new} <span className="text-sm font-normal" style={{ color: '#6C767F' }}>nouveaux</span>
                  </p>
                  <p className="text-xs" style={{ color: '#6C767F' }}>{importStats.journals.existing} existants</p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Comptes</p>
                  <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                    {importStats.accounts.new} <span className="text-sm font-normal" style={{ color: '#6C767F' }}>nouveaux</span>
                  </p>
                  <p className="text-xs" style={{ color: '#6C767F' }}>{importStats.accounts.existing} existants</p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Tiers</p>
                  <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                    {importStats.thirdParties.new} <span className="text-sm font-normal" style={{ color: '#6C767F' }}>nouveaux</span>
                  </p>
                  <p className="text-xs" style={{ color: '#6C767F' }}>{importStats.thirdParties.existing} existants</p>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#6C767F' }}>Écritures</p>
                  <p className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                    {importStats.entries.imported} <span className="text-sm font-normal" style={{ color: '#6C767F' }}>importées</span>
                  </p>
                  {importStats.entries.skipped > 0 && (
                    <p className="text-xs" style={{ color: '#6C767F' }}>{importStats.entries.skipped} doublons ignorés</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Import Button */}
          {parsedData && !importStats && (
            <div className="bg-white rounded-lg border p-6" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="font-medium mb-4" style={{ color: '#141A1F' }}>
                3. Lancer l'import
              </h3>
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#006666' }}
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Importer {parsedData.rows.length} écritures
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
