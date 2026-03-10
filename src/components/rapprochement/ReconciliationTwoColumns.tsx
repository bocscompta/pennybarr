/**
 * Reconciliation Two Columns View (Dolibarr-style)
 * Left: Bank statement lines
 * Right: Unreconciled accounting entries (512)
 */
import { useState, useMemo } from 'react'
import {
  Check,
  Link2,
  Link2Off,
  Zap,
  AlertTriangle,
  ArrowRight,
  FileText,
  Banknote,
} from 'lucide-react'
import type { BankTransaction, AccountingEntry } from '../../types/database'
import {
  autoMatchTransactions,
  getMatchColorClasses,
  type ImportedBankLine,
  type MatchSuggestion,
  type MatchedPair,
} from '../../services/rapprochementService'

interface ReconciliationTwoColumnsProps {
  bankLines: (BankTransaction | ImportedBankLine)[]
  accountingEntries: AccountingEntry[]
  matchedPairs: MatchedPair[]
  isInProgress: boolean
  onMatch: (bankLineId: string, entryId: string) => void
  onUnmatch: (pairId: string) => void
  onAutoMatch: (suggestions: MatchSuggestion[]) => void
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// Helper to normalize bank line to common format
function normalizeAmount(item: BankTransaction | ImportedBankLine | AccountingEntry): number {
  if ('amount' in item) {
    return Number(item.amount)
  }
  // AccountingEntry: credit - debit
  return Number(item.credit) - Number(item.debit)
}

export default function ReconciliationTwoColumns({
  bankLines,
  accountingEntries,
  matchedPairs,
  isInProgress,
  onMatch,
  onUnmatch,
  onAutoMatch,
}: ReconciliationTwoColumnsProps) {
  const [selectedBankLine, setSelectedBankLine] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)

  // Get matched IDs for quick lookup
  const matchedBankLineIds = useMemo(() =>
    new Set(matchedPairs.map(p => p.bankLineId)),
    [matchedPairs]
  )
  const matchedEntryIds = useMemo(() =>
    new Set(matchedPairs.map(p => p.entryId)),
    [matchedPairs]
  )

  // Get pair by bank line ID for color lookup
  const pairByBankLine = useMemo(() => {
    const map = new Map<string, MatchedPair>()
    matchedPairs.forEach(p => map.set(p.bankLineId, p))
    return map
  }, [matchedPairs])

  const pairByEntry = useMemo(() => {
    const map = new Map<string, MatchedPair>()
    matchedPairs.forEach(p => map.set(p.entryId, p))
    return map
  }, [matchedPairs])

  // Unmatched items
  const unmatchedBankLines = useMemo(() =>
    bankLines.filter(l => !matchedBankLineIds.has(l.id)),
    [bankLines, matchedBankLineIds]
  )
  const unmatchedEntries = useMemo(() =>
    accountingEntries.filter(e => !matchedEntryIds.has(e.id)),
    [accountingEntries, matchedEntryIds]
  )

  // Generate auto-match suggestions
  const suggestions = useMemo(() => {
    const bankLinesForMatching: ImportedBankLine[] = unmatchedBankLines.map(l => ({
      id: l.id,
      date: l.date,
      label: l.label,
      amount: normalizeAmount(l),
    }))
    return autoMatchTransactions(bankLinesForMatching, unmatchedEntries)
  }, [unmatchedBankLines, unmatchedEntries])

  // Handle click on bank line
  const handleBankLineClick = (lineId: string) => {
    if (!isInProgress) return

    // If already matched, select it to highlight the pair
    if (matchedBankLineIds.has(lineId)) {
      setSelectedBankLine(lineId)
      const pair = pairByBankLine.get(lineId)
      if (pair) setSelectedEntry(pair.entryId)
      return
    }

    // If clicking same line, deselect
    if (selectedBankLine === lineId) {
      setSelectedBankLine(null)
      return
    }

    setSelectedBankLine(lineId)

    // If an entry is already selected, match them
    if (selectedEntry && !matchedEntryIds.has(selectedEntry)) {
      onMatch(lineId, selectedEntry)
      setSelectedBankLine(null)
      setSelectedEntry(null)
    }
  }

  // Handle click on accounting entry
  const handleEntryClick = (entryId: string) => {
    if (!isInProgress) return

    // If already matched, select it to highlight the pair
    if (matchedEntryIds.has(entryId)) {
      setSelectedEntry(entryId)
      const pair = pairByEntry.get(entryId)
      if (pair) setSelectedBankLine(pair.bankLineId)
      return
    }

    // If clicking same entry, deselect
    if (selectedEntry === entryId) {
      setSelectedEntry(null)
      return
    }

    setSelectedEntry(entryId)

    // If a bank line is already selected, match them
    if (selectedBankLine && !matchedBankLineIds.has(selectedBankLine)) {
      onMatch(selectedBankLine, entryId)
      setSelectedBankLine(null)
      setSelectedEntry(null)
    }
  }

  // Handle unmatch
  const handleUnmatch = (lineId: string) => {
    const pair = pairByBankLine.get(lineId)
    if (pair) {
      onUnmatch(pair.id)
      setSelectedBankLine(null)
      setSelectedEntry(null)
    }
  }

  // Apply high-confidence suggestions
  const handleAutoMatch = () => {
    const highConfidence = suggestions.filter(s => s.confidence === 'high')
    if (highConfidence.length > 0) {
      onAutoMatch(highConfidence)
    }
  }

  const highConfidenceCount = suggestions.filter(s => s.confidence === 'high').length

  return (
    <div className="space-y-4">
      {/* Auto-match button */}
      {isInProgress && highConfidenceCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-stone-700">
            <Zap className="w-4 h-4" />
            <span>
              {highConfidenceCount} correspondance(s) automatique(s) detectee(s)
            </span>
          </div>
          <button
            onClick={handleAutoMatch}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-stone-600 rounded-lg hover:bg-stone-700"
          >
            <Link2 className="w-4 h-4" />
            Rapprocher automatiquement
          </button>
        </div>
      )}

      {/* Selection hint */}
      {isInProgress && (selectedBankLine || selectedEntry) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <ArrowRight className="w-4 h-4" />
          {selectedBankLine && !selectedEntry && (
            <span>Cliquez sur une ecriture comptable pour rapprocher</span>
          )}
          {selectedEntry && !selectedBankLine && (
            <span>Cliquez sur une ligne du releve pour rapprocher</span>
          )}
          {selectedBankLine && selectedEntry && matchedBankLineIds.has(selectedBankLine) && (
            <span>Paire selectionnee - cliquez sur le lien pour dissocier</span>
          )}
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Bank statement lines */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Releve bancaire
                </h3>
              </div>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                {unmatchedBankLines.length} non pointees
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {/* Unmatched lines first */}
            {unmatchedBankLines.map((line) => {
              const suggestion = suggestions.find(s => s.bankLineId === line.id)
              const isSelected = selectedBankLine === line.id
              const amount = normalizeAmount(line)

              return (
                <div
                  key={line.id}
                  onClick={() => handleBankLineClick(line.id)}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {line.label}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{formatDate(line.date)}</span>
                        {suggestion && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            suggestion.confidence === 'high'
                              ? 'bg-stone-100 text-stone-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {suggestion.confidence === 'high' ? 'Match auto' : 'Suggestion'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold whitespace-nowrap ml-2 ${
                      amount > 0 ? 'text-stone-600' : 'text-gray-700'
                    }`}>
                      {amount > 0 ? '+' : ''}{formatCurrency(amount)}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Matched lines */}
            {bankLines.filter(l => matchedBankLineIds.has(l.id)).map((line) => {
              const pair = pairByBankLine.get(line.id)!
              const colors = getMatchColorClasses(pair.colorIndex)
              const isSelected = selectedBankLine === line.id
              const amount = normalizeAmount(line)

              return (
                <div
                  key={line.id}
                  onClick={() => handleBankLineClick(line.id)}
                  className={`p-3 cursor-pointer transition-all ${colors.bg} ${
                    isSelected ? 'ring-2 ring-inset ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Check className={`w-4 h-4 flex-shrink-0 ${colors.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${colors.text}`}>
                          {line.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDate(line.date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${
                        amount > 0 ? 'text-stone-600' : 'text-gray-700'
                      }`}>
                        {amount > 0 ? '+' : ''}{formatCurrency(amount)}
                      </span>
                      {isInProgress && isSelected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnmatch(line.id); }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Dissocier"
                        >
                          <Link2Off className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {pair.difference && Math.abs(pair.difference) > 0.01 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                      <AlertTriangle className="w-3 h-3" />
                      Ecart: {formatCurrency(pair.difference)}
                    </div>
                  )}
                </div>
              )
            })}

            {bankLines.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucune ligne de releve</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Accounting entries */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Ecritures comptables (512)
                </h3>
              </div>
              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                {unmatchedEntries.length} non pointees
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {/* Unmatched entries first */}
            {unmatchedEntries.map((entry) => {
              const suggestion = suggestions.find(s => s.entryId === entry.id)
              const isSelected = selectedEntry === entry.id
              const amount = normalizeAmount(entry)

              return (
                <div
                  key={entry.id}
                  onClick={() => handleEntryClick(entry.id)}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {entry.label}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{formatDate(entry.date)}</span>
                        <span className="text-xs text-gray-400">{entry.account_code}</span>
                        {entry.piece_number && (
                          <span className="text-xs text-gray-400">#{entry.piece_number}</span>
                        )}
                        {suggestion && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            suggestion.confidence === 'high'
                              ? 'bg-stone-100 text-stone-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            Score: {Math.round(suggestion.score)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold whitespace-nowrap ml-2 ${
                      amount > 0 ? 'text-stone-600' : 'text-gray-700'
                    }`}>
                      {amount > 0 ? '+' : ''}{formatCurrency(amount)}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Matched entries */}
            {accountingEntries.filter(e => matchedEntryIds.has(e.id)).map((entry) => {
              const pair = pairByEntry.get(entry.id)!
              const colors = getMatchColorClasses(pair.colorIndex)
              const isSelected = selectedEntry === entry.id
              const amount = normalizeAmount(entry)

              return (
                <div
                  key={entry.id}
                  onClick={() => handleEntryClick(entry.id)}
                  className={`p-3 cursor-pointer transition-all ${colors.bg} ${
                    isSelected ? 'ring-2 ring-inset ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Check className={`w-4 h-4 flex-shrink-0 ${colors.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${colors.text}`}>
                          {entry.label}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{formatDate(entry.date)}</span>
                          <span className="text-xs text-gray-400">{entry.account_code}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${
                      amount > 0 ? 'text-stone-600' : 'text-gray-700'
                    }`}>
                      {amount > 0 ? '+' : ''}{formatCurrency(amount)}
                    </span>
                  </div>
                </div>
              )
            })}

            {accountingEntries.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Banknote className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucune ecriture non pointee</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
