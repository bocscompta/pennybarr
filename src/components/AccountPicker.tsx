// AccountPicker - Composant de sélection de compte comptable avec recherche
import { useState, useRef, useEffect } from 'react'
import type { ChartOfAccount } from '../types/database'

interface AccountPickerProps {
  accounts: ChartOfAccount[]
  value: string
  onChange: (code: string, label?: string) => void
  placeholder?: string
  filterClass?: string  // Filter by account class (e.g., '6' for expenses)
  disabled?: boolean
}

export default function AccountPicker({
  accounts,
  value,
  onChange,
  placeholder = 'Rechercher un compte...',
  filterClass,
  disabled = false,
}: AccountPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter accounts by class and search, prioritizing accounts that start with search
  const filteredAccounts = accounts
    .filter(account => {
      // Filter by class if specified
      if (filterClass && !account.code.startsWith(filterClass)) {
        return false
      }

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase()
        return (
          account.code.toLowerCase().includes(searchLower) ||
          account.label.toLowerCase().includes(searchLower)
        )
      }

      return true
    })
    .sort((a, b) => {
      // Sort: accounts starting with search first, then alphabetically
      if (search) {
        const searchLower = search.toLowerCase()
        const aStartsWithCode = a.code.toLowerCase().startsWith(searchLower)
        const bStartsWithCode = b.code.toLowerCase().startsWith(searchLower)

        if (aStartsWithCode && !bStartsWithCode) return -1
        if (!aStartsWithCode && bStartsWithCode) return 1
      }
      return a.code.localeCompare(b.code)
    })
    .slice(0, 50) // Limit to 50 results for performance

  // Get selected account
  const selectedAccount = accounts.find(a => a.code === value)

  // Display value
  const displayValue = selectedAccount
    ? `${selectedAccount.code} - ${selectedAccount.label}`
    : value

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [search])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(i => Math.min(i + 1, filteredAccounts.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredAccounts[highlightedIndex]) {
          selectAccount(filteredAccounts[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearch('')
        break
    }
  }

  const selectAccount = (account: ChartOfAccount) => {
    onChange(account.code, account.label)
    setIsOpen(false)
    setSearch('')
  }

  // Get account type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'expense': return { bg: '#FEF3C7', text: '#92400E' }
      case 'income': return { bg: '#D1FAE5', text: '#065F46' }
      case 'asset': return { bg: '#DBEAFE', text: '#1E40AF' }
      case 'liability': return { bg: '#FCE7F3', text: '#9D174D' }
      case 'equity': return { bg: '#E0E7FF', text: '#3730A3' }
      default: return { bg: '#F3F4F6', text: '#374151' }
    }
  }

  // Get account class name
  const getClassName = (code: string): string => {
    const firstDigit = code.charAt(0)
    switch (firstDigit) {
      case '1': return 'Capitaux'
      case '2': return 'Immobilisations'
      case '3': return 'Stocks'
      case '4': return 'Tiers'
      case '5': return 'Financiers'
      case '6': return 'Charges'
      case '7': return 'Produits'
      default: return ''
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Input */}
      <div className="flex">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-2.5 py-1.5 border rounded-l text-sm"
          style={{ borderColor: '#D6D9DB' }}
        />
        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen)
              if (!isOpen) inputRef.current?.focus()
            }
          }}
          className="px-2 border border-l-0 rounded-r hover:bg-gray-50"
          style={{ borderColor: '#D6D9DB' }}
          disabled={disabled}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: '#6C767F' }}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-auto"
          style={{ borderColor: '#E4E5E7' }}
        >
          {filteredAccounts.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Aucun compte trouvé
            </div>
          ) : (
            <>
              {/* Group by class */}
              {['6', '7', '4', '5', '2', '3', '1'].map(classDigit => {
                const classAccounts = filteredAccounts.filter(a => a.code.startsWith(classDigit))
                if (classAccounts.length === 0) return null

                return (
                  <div key={classDigit}>
                    <div
                      className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-gray-50"
                      style={{ color: '#6C767F' }}
                    >
                      Classe {classDigit} - {getClassName(classDigit)}
                    </div>
                    {classAccounts.map((account) => {
                      const globalIndex = filteredAccounts.indexOf(account)
                      const isHighlighted = globalIndex === highlightedIndex
                      const typeColor = getTypeColor(account.type)

                      return (
                        <div
                          key={account.id}
                          onClick={() => selectAccount(account)}
                          onMouseEnter={() => setHighlightedIndex(globalIndex)}
                          className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                            isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono text-sm font-medium"
                              style={{ color: '#141A1F' }}
                            >
                              {account.code}
                            </span>
                            <span className="text-sm" style={{ color: '#6C767F' }}>
                              {account.label}
                            </span>
                          </div>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                          >
                            {account.type === 'expense' ? 'Charge' :
                             account.type === 'income' ? 'Produit' :
                             account.type === 'asset' ? 'Actif' :
                             account.type === 'liability' ? 'Passif' :
                             account.type === 'equity' ? 'Capitaux' : account.type}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

