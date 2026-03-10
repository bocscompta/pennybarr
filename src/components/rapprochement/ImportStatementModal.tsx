/**
 * Import Statement Modal
 * Modal for importing bank statements (OFX, QIF, CSV)
 */
import { useState, useCallback } from 'react'
import {
  X,
  Upload,
  FileText,
  AlertTriangle,
  Check,
  Settings2,
} from 'lucide-react'
import {
  importBankStatement,
  confirmImport,
  BANK_PRESETS,
  type ImportPreview,
  type CSVMappingConfig,
} from '../../services/rapprochementService'

interface ImportStatementModalProps {
  isOpen: boolean
  onClose: () => void
  bankAccountId: string
  reconciliationId?: string
  onImportComplete: (count: number) => void
}

const DEFAULT_CSV_CONFIG: CSVMappingConfig = {
  dateColumn: 0,
  labelColumn: 1,
  amountColumn: 2,
  dateFormat: 'DD/MM/YYYY',
  skipRows: 1,
  delimiter: ';',
  decimalSeparator: ',',
  amountSignConvention: 'signed',
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ImportStatementModal({
  isOpen,
  onClose,
  bankAccountId,
  reconciliationId,
  onImportComplete,
}: ImportStatementModalProps) {
  const [step, setStep] = useState<'upload' | 'csv-config' | 'preview' | 'importing'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [csvConfig, setCsvConfig] = useState<CSVMappingConfig>(DEFAULT_CSV_CONFIG)
  const [showCsvConfig, setShowCsvConfig] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('')

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey)
    if (presetKey && BANK_PRESETS[presetKey]) {
      setCsvConfig({ ...BANK_PRESETS[presetKey].config })
    }
  }

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)

    const isCSV = selectedFile.name.toLowerCase().endsWith('.csv') ||
                  selectedFile.name.toLowerCase().endsWith('.txt')

    if (isCSV) {
      setStep('csv-config')
      setShowCsvConfig(true)
    } else {
      // OFX/QIF - parse directly
      setLoading(true)
      try {
        const result = await importBankStatement(selectedFile, bankAccountId)
        setPreview(result)
        setStep('preview')
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erreur inconnue'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
  }, [bankAccountId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleParseCSV = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const result = await importBankStatement(file, bankAccountId, csvConfig)
      setPreview(result)
      setStep('preview')
      setShowCsvConfig(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!preview) return

    setStep('importing')
    setLoading(true)
    setError(null)

    try {
      const result = await confirmImport(bankAccountId, preview.lines, reconciliationId, {
        format: preview.format,
        fileName: preview.fileName,
      })
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors)
      }
      onImportComplete(result.imported)
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(message)
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setStep('upload')
    setFile(null)
    setPreview(null)
    setError(null)
    setShowCsvConfig(false)
    setSelectedPreset('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Importer un releve bancaire
          </h2>
          <button
            onClick={() => { resetModal(); onClose(); }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">
                Glissez-deposez votre fichier ici
              </p>
              <p className="text-sm text-gray-500 mb-4">
                ou cliquez pour selectionner
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 bg-gray-100 rounded">OFX</span>
                <span className="px-2 py-1 bg-gray-100 rounded">QIF</span>
                <span className="px-2 py-1 bg-gray-100 rounded">CSV</span>
                <span className="px-2 py-1 bg-gray-100 rounded">CFONB</span>
              </div>
              <input
                id="file-input"
                type="file"
                accept=".ofx,.qfx,.qif,.csv,.txt,.cfonb"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          )}

          {/* Step: CSV Config */}
          {step === 'csv-config' && showCsvConfig && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <FileText className="w-4 h-4" />
                <span>{file?.name}</span>
              </div>

              {/* Bank Preset Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banque (preset)
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Autre / Personnalise</option>
                  {Object.entries(BANK_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colonne Date
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={csvConfig.dateColumn}
                    onChange={(e) => setCsvConfig({ ...csvConfig, dateColumn: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Format Date
                  </label>
                  <select
                    value={csvConfig.dateFormat}
                    onChange={(e) => setCsvConfig({ ...csvConfig, dateFormat: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colonne Libelle
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={csvConfig.labelColumn}
                    onChange={(e) => setCsvConfig({ ...csvConfig, labelColumn: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Convention Montant
                  </label>
                  <select
                    value={csvConfig.amountSignConvention}
                    onChange={(e) => setCsvConfig({
                      ...csvConfig,
                      amountSignConvention: e.target.value as 'signed' | 'debit_credit_columns' | 'debit_negative'
                    })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="signed">Colonne unique signee</option>
                    <option value="debit_credit_columns">Colonnes debit/credit</option>
                    <option value="debit_negative">Debit negatif</option>
                  </select>
                </div>
                {csvConfig.amountSignConvention === 'debit_credit_columns' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Colonne Debit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={csvConfig.debitColumn ?? 0}
                        onChange={(e) => setCsvConfig({ ...csvConfig, debitColumn: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Colonne Credit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={csvConfig.creditColumn ?? 0}
                        onChange={(e) => setCsvConfig({ ...csvConfig, creditColumn: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Colonne Montant
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={csvConfig.amountColumn ?? 0}
                      onChange={(e) => setCsvConfig({ ...csvConfig, amountColumn: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delimiteur
                  </label>
                  <select
                    value={csvConfig.delimiter}
                    onChange={(e) => setCsvConfig({ ...csvConfig, delimiter: e.target.value as ',' | ';' | '\t' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value=";">Point-virgule (;)</option>
                    <option value=",">Virgule (,)</option>
                    <option value="	">Tabulation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Separateur decimal
                  </label>
                  <select
                    value={csvConfig.decimalSeparator}
                    onChange={(e) => setCsvConfig({ ...csvConfig, decimalSeparator: e.target.value as '.' | ',' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value=",">Virgule (,)</option>
                    <option value=".">Point (.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lignes a ignorer
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={csvConfig.skipRows}
                    onChange={(e) => setCsvConfig({ ...csvConfig, skipRows: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Transactions</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {preview.lines.length}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Credits</div>
                  <div className="text-lg font-semibold text-stone-600">
                    +{formatCurrency(preview.totalCredits)}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Debits</div>
                  <div className="text-lg font-semibold text-gray-700">
                    -{formatCurrency(preview.totalDebits)}
                  </div>
                </div>
              </div>

              {/* Date range */}
              <div className="text-sm text-gray-600">
                Periode: {formatDate(preview.dateRange.start)} - {formatDate(preview.dateRange.end)}
              </div>

              {/* Duplicates warning */}
              {preview.duplicates.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {preview.duplicates.length} doublon(s) detecte(s)
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Ces transactions existent deja et seront ignorees.
                    </p>
                  </div>
                </div>
              )}

              {/* Transactions list */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Libelle</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.lines.slice(0, 50).map((line) => (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600">{formatDate(line.date)}</td>
                          <td className="px-4 py-2 text-gray-900 truncate max-w-[200px]">{line.label}</td>
                          <td className={`px-4 py-2 text-right font-medium ${line.amount > 0 ? 'text-stone-600' : 'text-gray-700'}`}>
                            {line.amount > 0 ? '+' : ''}{formatCurrency(line.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.lines.length > 50 && (
                    <div className="px-4 py-2 text-center text-sm text-gray-500 bg-gray-50">
                      ... et {preview.lines.length - 50} autres transactions
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => { resetModal(); onClose(); }}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Annuler
          </button>

          <div className="flex items-center gap-3">
            {step === 'csv-config' && (
              <button
                onClick={handleParseCSV}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-stone-600 rounded-lg hover:bg-stone-700 disabled:opacity-50"
              >
                <Settings2 className="w-4 h-4" />
                Analyser
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleConfirmImport}
                disabled={loading || preview?.lines.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-stone-600 rounded-lg hover:bg-stone-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Importer {preview?.lines.length} transactions
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
