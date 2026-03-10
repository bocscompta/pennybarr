import { useState, useRef, useEffect } from 'react'
import type { InvoiceLineFormData, InvoiceSection } from '../../types/invoiceForm'
import { UNIT_OPTIONS, VAT_RATE_OPTIONS } from '../../types/invoiceForm'
import { calculateLineTotals } from '../../services/invoiceCreationService'
import type { Product } from '../../types/database'

interface InvoiceLinesTableProps {
  lines: InvoiceLineFormData[]
  products: Product[]
  sections: InvoiceSection[]
  onLinesChange: (lines: InvoiceLineFormData[]) => void
  onSectionsChange: (sections: InvoiceSection[]) => void
}

const formatNumber = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function generateSectionId(): string {
  return `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyLine(sectionId?: string): InvoiceLineFormData {
  return {
    id: generateLineId(),
    description: '',
    quantity: 1,
    unit: 'unite',
    unitPriceHT: 0,
    vatRate: '20',
    accountingCode: '706000',
    sectionId
  }
}

export default function InvoiceLinesTable({ lines, products, sections, onLinesChange, onSectionsChange }: InvoiceLinesTableProps) {
  // Utiliser la dernière section ajoutée
  const currentSection = sections.length > 0 ? sections[sections.length - 1] : null

  const handleAddSection = () => {
    const newSection: InvoiceSection = {
      id: generateSectionId(),
      title: '',
      description: undefined
    }
    onSectionsChange([...sections, newSection])
  }

  const handleUpdateSection = (id: string, updates: Partial<InvoiceSection>) => {
    onSectionsChange(sections.map(s => (s.id === id ? { ...s, ...updates } : s)))
  }

  const handleRemoveSection = (id: string) => {
    onSectionsChange(sections.filter(s => s.id !== id))
    // Retirer le sectionId des lignes de cette section
    onLinesChange(lines.map(l => (l.sectionId === id ? { ...l, sectionId: undefined } : l)))
  }

  const handleAddSectionDescription = (sectionId: string) => {
    handleUpdateSection(sectionId, { description: '' })
  }

  const handleRemoveSectionDescription = (sectionId: string) => {
    handleUpdateSection(sectionId, { description: undefined })
  }

  return (
    <div>
      {/* Section title */}
      {currentSection ? (
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <input
                type="text"
                value={currentSection.title}
                onChange={e => handleUpdateSection(currentSection.id, { title: e.target.value })}
                placeholder="Titre de la section"
                className="text-sm font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-gray-500 w-full"
              />
              {currentSection.description !== undefined ? (
                <div className="flex items-center gap-2 mt-1">
                  <textarea
                    value={currentSection.description}
                    onChange={e =>
                      handleUpdateSection(currentSection.id, { description: e.target.value })
                    }
                    placeholder="Description de la section"
                    rows={2}
                    className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400 flex-1"
                  />
                  <button
                    onClick={() => handleRemoveSectionDescription(currentSection.id)}
                    className="p-1 hover:bg-gray-100 rounded self-start"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAddSectionDescription(currentSection.id)}
                  className="text-xs text-gray-400 mt-0.5 hover:text-gray-600"
                >
                  + Ajouter une description
                </button>
              )}
            </div>
            <button
              onClick={() => handleRemoveSection(currentSection.id)}
              className="p-1 hover:bg-gray-100 rounded ml-2"
            >
              <svg
                className="w-4 h-4 text-red-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-2">
          <div>
            <button
              onClick={handleAddSection}
              className="text-sm font-bold text-gray-900 hover:text-gray-700 block"
            >
              + Ajouter un titre de section
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-6"></th>
            <th className="text-left py-2 text-xs font-medium text-gray-500 pl-2">Produits</th>
            <th className="text-center py-2 text-xs font-medium text-gray-500 w-16">Qte</th>
            <th className="w-16"></th>
            <th className="text-right py-2 text-xs font-medium text-gray-500 w-24">Prix u. HT</th>
            <th className="text-center py-2 text-xs font-medium text-gray-500 w-20">TVA (%)</th>
            <th className="text-right py-2 text-xs font-medium text-gray-500 w-24">Total HT</th>
            <th className="text-right py-2 text-xs font-medium text-gray-500 w-24">Total TTC</th>
            <th className="w-14"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <InvoiceLineRow
              key={line.id}
              line={line}
              products={products}
              onChange={(updated) => {
                const newLines = [...lines]
                newLines[index] = updated
                onLinesChange(newLines)
              }}
              onRemove={() => {
                if (lines.length <= 1) return
                onLinesChange(lines.filter((_, i) => i !== index))
              }}
              canRemove={lines.length > 1}
            />
          ))}
        </tbody>
      </table>

      {/* Add line */}
      <button
        type="button"
        onClick={() => onLinesChange([...lines, createEmptyLine()])}
        className="mt-3 text-sm font-semibold text-gray-900 hover:text-gray-700"
      >
        + Ajouter une ligne
      </button>
    </div>
  )
}

// ============ Line Row ============

interface InvoiceLineRowProps {
  line: InvoiceLineFormData
  products: Product[]
  onChange: (line: InvoiceLineFormData) => void
  onRemove: () => void
  canRemove: boolean
}

function InvoiceLineRow({ line, products, onChange, onRemove, canRemove }: InvoiceLineRowProps) {
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const totals = calculateLineTotals(line)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false)
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10)

  const selectProduct = (product: Product) => {
    onChange({
      ...line,
      productId: product.id,
      description: product.name,
      unitPriceHT: product.sale_price_ht,
      vatRate: product.vat_rate,
      unit: product.unit || 'unite',
      accountingCode: product.accounting_code_sale || '706000',
    })
    setShowProductDropdown(false)
    setProductSearch('')
  }

  return (
    <>
      <tr className="border-b border-gray-100 group">
        {/* Drag handle */}
        <td className="py-2">
        <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 cursor-grab">
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="w-1 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="w-1 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="w-1 h-1 rounded-full bg-gray-300" />
          </div>
        </div>
      </td>

      {/* Product */}
      <td className="py-2 pl-2">
        <div className="relative" ref={dropdownRef}>
          <div
            className="flex items-center border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer bg-white"
            onClick={() => setShowProductDropdown(true)}
          >
            <span className={`text-sm flex-1 ${line.description ? 'text-gray-700' : 'text-gray-400'}`}>
              {line.description || 'Choisir...'}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {showProductDropdown && (
            <div className="absolute z-20 top-full left-0 w-72 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full px-3 py-2 text-sm border-b border-gray-100 focus:outline-none"
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                  >
                    <span className="text-gray-900">{product.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{product.code}</span>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">Aucun produit</div>
                )}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Qty */}
      <td className="py-2">
        <input
          type="number"
          value={line.quantity}
          onChange={(e) => onChange({ ...line, quantity: parseFloat(e.target.value) || 0 })}
          className="w-full text-center text-sm border border-gray-200 rounded-md px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
          min="0"
          step="1"
        />
      </td>

      {/* Unit */}
      <td className="py-2">
        <select
          value={line.unit}
          onChange={(e) => onChange({ ...line, unit: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-md px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-gray-600"
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>{u.label.toLowerCase()}</option>
          ))}
        </select>
      </td>

      {/* Prix u. HT */}
      <td className="py-2">
        <input
          type="text"
          value={formatNumber(line.unitPriceHT)}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
            onChange({ ...line, unitPriceHT: parseFloat(val) || 0 })
          }}
          className="w-full text-right text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </td>

      {/* TVA */}
      <td className="py-2">
        <select
          value={line.vatRate}
          onChange={(e) => onChange({ ...line, vatRate: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-md px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white text-center"
        >
          {VAT_RATE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </td>

      {/* Total HT */}
      <td className="py-2 text-right text-sm text-gray-600 px-2">
        {formatNumber(totals.totalHT)}
      </td>

      {/* Total TTC */}
      <td className="py-2 text-right text-sm text-gray-700 font-medium px-2">
        {formatNumber(totals.totalTTC)}
      </td>

      {/* Actions */}
      <td className="py-2">
        <div className="flex items-center gap-1" ref={menuRef}>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-gray-100"
            >
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute z-20 right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button
                  onClick={() => {
                    onChange({ ...line, detailedDescription: line.detailedDescription !== undefined ? undefined : '' })
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {line.detailedDescription !== undefined ? 'Retirer la description' : 'Ajouter une description'}
                </button>
                <button
                  onClick={() => {
                    onChange({ ...line, discountPercent: line.discountPercent !== undefined ? undefined : 0 })
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {line.discountPercent !== undefined ? 'Retirer la remise' : 'Ajouter une remise'}
                </button>
              </div>
            )}
          </div>
          {canRemove && (
            <button
              onClick={onRemove}
              className="p-1 rounded hover:bg-gray-100"
            >
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>

    {/* Description détaillée (si activée) */}
    {line.detailedDescription !== undefined && (
      <tr className="border-b border-gray-100">
        <td></td>
        <td colSpan={8} className="py-2 pl-2">
          <textarea
            value={line.detailedDescription}
            onChange={(e) => onChange({ ...line, detailedDescription: e.target.value })}
            placeholder="Description"
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-gray-50"
          />
        </td>
      </tr>
    )}
  </>
  )
}
