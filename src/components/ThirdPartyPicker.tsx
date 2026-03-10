// ThirdPartyPicker - Composant de sélection de tiers avec recherche et création
import { useState, useRef, useEffect } from 'react'
import type { ThirdParty } from '../types/database'

interface ThirdPartyPickerProps {
  thirdParties: ThirdParty[]
  value: string  // Third party name (for display and new creation)
  selectedId: string | null  // ID of selected third party
  type: 'supplier' | 'customer'
  onChange: (name: string, id: string | null, thirdParty?: ThirdParty) => void
  onTypeChange?: (type: 'supplier' | 'customer') => void
  onCreateNew?: () => void  // Callback pour créer un nouveau client
  placeholder?: string
  disabled?: boolean
}

export default function ThirdPartyPicker({
  thirdParties,
  value,
  selectedId,
  type,
  onChange,
  onTypeChange,
  onCreateNew,
  placeholder = 'Rechercher un tiers...',
  disabled = false,
}: ThirdPartyPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter third parties by type and search
  const filteredThirdParties = thirdParties.filter(tp => {
    // Filter by type
    if (type === 'supplier' && tp.type !== 'supplier' && tp.type !== 'both') {
      return false
    }
    if (type === 'customer' && tp.type !== 'customer' && tp.type !== 'both') {
      return false
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase()
      return tp.name.toLowerCase().includes(searchLower)
    }

    return true
  }).slice(0, 20)

  // Get selected third party
  const selectedThirdParty = selectedId
    ? thirdParties.find(tp => tp.id === selectedId)
    : null

  // Display value
  const displayValue = selectedThirdParty?.name || value

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        // If search doesn't match any, keep as new name
        if (search && !selectedThirdParty) {
          onChange(search.toUpperCase(), null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [search, selectedThirdParty, onChange])

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
        setHighlightedIndex(i => Math.min(i + 1, filteredThirdParties.length))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex === filteredThirdParties.length && search) {
          // Create new
          onChange(search.toUpperCase(), null)
          setIsOpen(false)
          setSearch('')
        } else if (filteredThirdParties[highlightedIndex]) {
          selectThirdParty(filteredThirdParties[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearch('')
        break
    }
  }

  const selectThirdParty = (tp: ThirdParty) => {
    onChange(tp.name, tp.id, tp)
    setIsOpen(false)
    setSearch('')
  }

  const clearSelection = () => {
    onChange('', null)
    setSearch('')
  }

  // Get type badge color
  const getTypeBadge = (tpType: string) => {
    switch (tpType) {
      case 'supplier': return { bg: '#FEF3C7', text: '#92400E', label: 'Fournisseur' }
      case 'customer': return { bg: '#D1FAE5', text: '#065F46', label: 'Client' }
      case 'both': return { bg: '#E0E7FF', text: '#3730A3', label: 'Client & Fournisseur' }
      default: return { bg: '#F3F4F6', text: '#374151', label: tpType }
    }
  }

  return (
    <div className="flex gap-2">
      {/* Type selector */}
      {onTypeChange && (
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value as 'supplier' | 'customer')}
          disabled={disabled}
          className="px-2.5 py-1.5 border rounded text-sm"
          style={{ borderColor: '#D6D9DB', minWidth: '120px' }}
        >
          <option value="supplier">Fournisseur</option>
          <option value="customer">Client</option>
        </select>
      )}

      {/* Third party picker */}
      <div className="relative flex-1" ref={dropdownRef}>
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
            className="flex-1 px-2.5 py-1.5 border rounded-l text-sm font-medium"
            style={{ borderColor: '#D6D9DB' }}
          />
          {displayValue && (
            <button
              type="button"
              onClick={clearSelection}
              className="px-2 border border-l-0 hover:bg-gray-50"
              style={{ borderColor: '#D6D9DB' }}
              disabled={disabled}
            >
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
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
            {/* Create new option (always first) */}
            {onCreateNew && (
              <div
                onClick={() => {
                  setIsOpen(false)
                  onCreateNew()
                }}
                className="px-3 py-2.5 cursor-pointer border-b flex items-center gap-2 hover:bg-gray-50"
                style={{ borderColor: '#E4E5E7' }}
              >
                <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-sm font-semibold" style={{ color: '#006666' }}>
                  Créer {type === 'supplier' ? 'un fournisseur' : 'un client'}
                </span>
              </div>
            )}

            {/* Existing third parties */}
            {filteredThirdParties.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-gray-50" style={{ color: '#6C767F' }}>
                  {type === 'supplier' ? 'Fournisseurs existants' : 'Clients existants'}
                </div>
                {filteredThirdParties.map((tp, idx) => {
                  const isHighlighted = idx === highlightedIndex
                  const badge = getTypeBadge(tp.type)

                  return (
                    <div
                      key={tp.id}
                      onClick={() => selectThirdParty(tp)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                        isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {tp.name}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Create new option */}
            {search && (
              <div
                onClick={() => {
                  onChange(search.toUpperCase(), null)
                  setIsOpen(false)
                  setSearch('')
                }}
                onMouseEnter={() => setHighlightedIndex(filteredThirdParties.length)}
                className={`px-3 py-2.5 cursor-pointer border-t flex items-center gap-2 ${
                  highlightedIndex === filteredThirdParties.length ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                style={{ borderColor: '#E4E5E7' }}
              >
                <svg className="w-4 h-4" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-sm" style={{ color: '#006666' }}>
                  Créer "<span className="font-medium">{search.toUpperCase()}</span>"
                </span>
              </div>
            )}

            {/* Empty state */}
            {filteredThirdParties.length === 0 && !search && (
              <div className="px-3 py-3 text-sm text-center" style={{ color: '#6C767F' }}>
                Aucun {type === 'supplier' ? 'fournisseur' : 'client'} trouvé
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
