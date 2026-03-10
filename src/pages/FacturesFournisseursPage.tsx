import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSupplierInvoices, useSuppliers } from '../hooks/useSupabase'
import { updateInvoice } from '../services/supabaseService'
import type { Invoice, ThirdParty } from '../types/database'
import InvoiceUploadModal from '../components/InvoiceUploadModal'
import TransactionSearchModal from '../components/TransactionSearchModal'

interface FacturesFournisseursPageProps {
  openImportModal?: boolean
  onImportModalOpened?: () => void
  onNavigate?: (page: string) => void
}

// Invoice Detail Panel Component
function InvoiceDetailPanel({
  invoice,
  suppliers,
  onClose,
  onUpdate,
  onNavigate
}: {
  invoice: Invoice
  suppliers: ThirdParty[]
  onClose: () => void
  onUpdate: () => void
  onNavigate?: (page: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    total_ttc: invoice.total_ttc,
    total_ht: invoice.total_ht,
    total_vat: invoice.total_vat,
    vat_rate: invoice.total_ht > 0 ? Math.round((invoice.total_vat / invoice.total_ht) * 100) : 0,
    third_party_id: invoice.third_party_id || '',
    date: invoice.date,
    due_date: invoice.due_date || invoice.date,
    number: invoice.number,
    status: invoice.status
  })
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paymentExpanded, setPaymentExpanded] = useState(true)
  const [showPlusActions, setShowPlusActions] = useState(false)
  const [categorizationExpanded, setCategorizationExpanded] = useState(true)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [expenseTags, setExpenseTags] = useState<string[]>(['Déplacements'])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [comments, setComments] = useState<{ id: string; author: string; initials: string; date: string; text: string; color: string }[]>([])
  const [newComment, setNewComment] = useState('')
  const [showTransactionSearch, setShowTransactionSearch] = useState(false)

  const supplierDropdownRef = useRef<HTMLDivElement>(null)
  const plusActionsRef = useRef<HTMLDivElement>(null)
  const categoryMenuRef = useRef<HTMLDivElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  // Available categories
  const availableCategories = [
    '455000 - Associés - Comptes courants',
    'Subventions d\'investissement',
    'Virement interne vers Compte Principal',
    'Apport en capital / Fonds propres',
    'Frais de représentation',
    'Notes de frais - IK',
    'Notes de frais - Repas',
    'Notes de frais - Hébergement',
    'Achats de marchandises',
    'Déplacements',
    'Frais bancaires',
    'Honoraires',
    'Locations',
    'Services bancaires',
  ]

  const filteredCategories = availableCategories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase()) &&
    !expenseTags.includes(cat)
  )

  const supplierName = invoice.third_party?.name || suppliers.find(s => s.id === invoice.third_party_id)?.name || 'Fournisseur inconnu'

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  // Reset state when invoice changes
  useEffect(() => {
    setExpenseTags(['Déplacements'])
    setComments([])
    setNewComment('')
    setIsEditing(false)
    setPaymentExpanded(true)
    setCategorizationExpanded(true)
    setEditData({
      total_ttc: invoice.total_ttc,
      total_ht: invoice.total_ht,
      total_vat: invoice.total_vat,
      vat_rate: invoice.total_ht > 0 ? Math.round((invoice.total_vat / invoice.total_ht) * 100) : 0,
      third_party_id: invoice.third_party_id || '',
      date: invoice.date,
      due_date: invoice.due_date || invoice.date,
      number: invoice.number,
      status: invoice.status
    })
  }, [invoice.id])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setShowSupplierDropdown(false)
      }
      if (plusActionsRef.current && !plusActionsRef.current.contains(event.target as Node)) {
        setShowPlusActions(false)
      }
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setShowCategoryMenu(false)
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleVatRateChange = (rate: number) => {
    const newVat = editData.total_ht * (rate / 100)
    setEditData({
      ...editData,
      vat_rate: rate,
      total_vat: newVat,
      total_ttc: editData.total_ht + newVat
    })
  }

  const handleTotalHTChange = (value: number) => {
    const newVat = value * (editData.vat_rate / 100)
    setEditData({
      ...editData,
      total_ht: value,
      total_vat: newVat,
      total_ttc: value + newVat
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await updateInvoice(invoice.id, {
        total_ttc: editData.total_ttc,
        total_ht: editData.total_ht,
        total_vat: editData.total_vat,
        third_party_id: editData.third_party_id || null,
        date: editData.date,
        due_date: editData.due_date,
        number: editData.number,
        status: editData.status as Invoice['status']
      })
      setIsEditing(false)
      onUpdate()
    } catch (err) {
      console.error('Error updating invoice:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return
    const now = new Date()
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const newCommentObj = {
      id: Date.now().toString(),
      author: 'Utilisateur',
      initials: 'U',
      date: dateStr,
      text: newComment.trim(),
      color: '#3B82F6'
    }
    setComments([...comments, newCommentObj])
    setNewComment('')
  }

  const handleDeleteComment = (commentId: string) => {
    setComments(comments.filter(c => c.id !== commentId))
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDateInput = (dateStr: string) => {
    if (!dateStr) return ''
    return dateStr.split('T')[0]
  }

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const selectedSupplierName = suppliers.find(s => s.id === editData.third_party_id)?.name || ''

  return (
    <div className="w-96 bg-white border-l flex flex-col h-full flex-shrink-0" style={{ borderColor: '#E4E5E7' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: '#6C767F' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Archiver
          </button>
          <button className="flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: '#6C767F' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Historique
          </button>
          <button className="flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: '#6C767F' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
            Actions
          </button>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
          <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Amount Section */}
        <div className="mb-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-3xl font-semibold" style={{ color: '#141A1F' }}>
                {formatCurrency(invoice.total_ttc)} €
              </span>
              <p className="text-sm mt-1" style={{ color: '#6C767F' }}>
                dont {formatCurrency(invoice.total_vat)} € de TVA ({invoice.total_vat === 0 ? 'Aucune' : `${Math.round((invoice.total_vat / invoice.total_ht) * 100)}%`})
              </p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
          </div>
        </div>

        {/* Supplier Info */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <span className="text-sm block mb-1" style={{ color: '#6C767F' }}>Fournisseur</span>
          <a href="#" className="text-sm font-medium flex items-center gap-1" style={{ color: '#006666' }}>
            {supplierName}
          </a>

          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <span className="text-sm block" style={{ color: '#6C767F' }}>Date d'émission</span>
              <p className="text-sm" style={{ color: '#141A1F' }}>{formatDateDisplay(invoice.date)}</p>
            </div>
            <div>
              <span className="text-sm block" style={{ color: '#6C767F' }}>Date d'échéance</span>
              <p className="text-sm" style={{ color: '#141A1F' }}>{formatDateDisplay(invoice.due_date || invoice.date)}</p>
            </div>
          </div>

          <div className="mt-3">
            <span className="text-sm block" style={{ color: '#6C767F' }}>Numéro de facture (Optionnel)</span>
            <p className="text-sm" style={{ color: '#141A1F' }}>{invoice.number}</p>
          </div>
        </div>

        {/* Status */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Statut</span>
            <select
              value={invoice.status}
              className="px-3 py-1.5 rounded-lg text-sm text-white font-medium"
              style={{ backgroundColor: '#006666' }}
            >
              <option value="draft">Brouillon</option>
              <option value="sent">À payer</option>
              <option value="paid">Payée</option>
            </select>
          </div>
        </div>

        {/* Payment Section */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setPaymentExpanded(!paymentExpanded)}
          >
            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Paiement</span>
            <svg
              className={`w-4 h-4 transition-transform ${paymentExpanded ? 'rotate-180' : ''}`}
              style={{ color: '#6C767F' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {paymentExpanded && (
            <div className="mt-4">
              {/* Suggestion indicator */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: '#FEF3C7' }}>
                <svg className="w-5 h-5" style={{ color: '#D97706' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: '#92400E' }}>1 suggestion de transaction</span>
              </div>

              {/* Transaction Card */}
              <div className="p-3 border rounded-lg mb-3" style={{ borderColor: '#E4E5E7' }}>
                <div className="flex items-start justify-between mb-1">
                  <span className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                    -{formatCurrency(invoice.total_ttc)} €
                  </span>
                  <div className="w-8 h-5 rounded flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#1E3A5F' }}>
                    CIC
                  </div>
                </div>
                <p className="text-sm" style={{ color: '#6C767F' }}>{formatDateDisplay(invoice.date)}</p>
                <p className="text-sm" style={{ color: '#141A1F' }}>VIR INST BPMED {invoice.number}</p>

                {/* Buttons */}
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
                    Rejeter
                  </button>
                  <button className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#006666' }}>
                    Confirmer
                  </button>
                </div>
              </div>

              {/* Plus d'actions Button */}
              <div className="relative" ref={plusActionsRef}>
                <button
                  onClick={() => setShowPlusActions(!showPlusActions)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border"
                  style={{ borderColor: '#006666', color: '#006666', backgroundColor: 'white' }}
                >
                  Plus d'actions
                  <svg className={`w-4 h-4 transition-transform ${showPlusActions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showPlusActions && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg" style={{ borderColor: '#E4E5E7' }}>
                    <button
                      onClick={() => {
                        setShowTransactionSearch(true)
                        setShowPlusActions(false)
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                      style={{ color: '#141A1F' }}
                    >
                      Chercher une transaction
                    </button>
                    <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t" style={{ color: '#141A1F', borderColor: '#E4E5E7' }}>
                      Déclarer un moyen de paiement
                    </button>
                    <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t" style={{ color: '#141A1F', borderColor: '#E4E5E7' }}>
                      Lier un avoir
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Categorization Section */}
        <div className="mb-4 pb-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setCategorizationExpanded(!categorizationExpanded)}
          >
            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Catégorisation</span>
            <svg
              className={`w-4 h-4 transition-transform ${categorizationExpanded ? 'rotate-180' : ''}`}
              style={{ color: '#6C767F' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {categorizationExpanded && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm" style={{ color: '#141A1F' }}>Associez à vos catégories</span>
                <div className="relative" ref={categoryMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowCategoryMenu(!showCategoryMenu)
                    }}
                    className="p-1.5 rounded"
                    style={{ backgroundColor: '#D9EFEB' }}
                  >
                    <svg className="w-4 h-4" style={{ color: '#006666' }} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 12a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
                    </svg>
                  </button>

                  {showCategoryMenu && (
                    <div className="absolute right-0 z-10 mt-1 w-56 bg-white border rounded-lg shadow-lg" style={{ borderColor: '#E4E5E7' }}>
                      <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50" style={{ color: '#141A1F' }}>
                        Ajuster les pourcentages...
                      </button>
                      <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-t flex items-center gap-2" style={{ color: '#006666', borderColor: '#E4E5E7' }}>
                        Paramétrer
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Category Tags */}
              {expenseTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {expenseTags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: '#FEE2E2', color: '#141A1F' }}
                      onClick={() => setExpenseTags(expenseTags.filter((_, i) => i !== index))}
                      title="Cliquer pour supprimer"
                    >
                      {tag.length > 30 ? tag.substring(0, 30) + '...' : tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Category Search Dropdown */}
              <div className="relative" ref={categoryDropdownRef}>
                <div
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm flex items-center justify-between cursor-pointer bg-white"
                  style={{ borderColor: showCategoryDropdown ? '#006666' : '#D6D9DB', color: '#6C767F' }}
                >
                  <span>Rechercher une catégorie</span>
                  <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {showCategoryDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg" style={{ borderColor: '#E4E5E7' }}>
                    <div className="p-2 border-b" style={{ borderColor: '#E4E5E7' }}>
                      <input
                        type="text"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCategories.map((category) => (
                        <div
                          key={category}
                          onClick={() => {
                            setExpenseTags([...expenseTags, category])
                            setShowCategoryDropdown(false)
                            setCategorySearch('')
                          }}
                          className="px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50"
                          style={{ color: '#141A1F' }}
                        >
                          {category}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Types de dépenses / revenus */}
              <div className="mt-4">
                <span className="text-sm" style={{ color: '#6C767F' }}>Types de dépenses / revenus</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {expenseTags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
                      style={{ backgroundColor: '#FEE2E2', color: '#141A1F' }}
                    >
                      {tag}
                      <button
                        onClick={() => setExpenseTags(expenseTags.filter((_, i) => i !== index))}
                        className="hover:opacity-70"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Link to Centre de règles */}
              <button
                onClick={() => onNavigate?.('centre-regles')}
                className="mt-4 text-sm underline flex items-center gap-1 hover:opacity-80"
                style={{ color: '#006666' }}
              >
                Créer des règles de catégorisation
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div>
          <span className="text-sm font-medium block mb-3" style={{ color: '#141A1F' }}>
            Commentaires{comments.length > 0 ? ` (${comments.length})` : ''}
          </span>

          {comments.length > 0 && (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                    style={{ backgroundColor: comment.color }}
                  >
                    {comment.initials}
                  </div>
                  <div className="flex-1 p-3 rounded-lg" style={{ backgroundColor: '#F0F9F7' }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{comment.author}</span>
                        <span className="text-xs" style={{ color: '#6C767F' }}>le {comment.date}</span>
                      </div>
                      <button onClick={() => handleDeleteComment(comment.id)} className="p-1 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm" style={{ color: '#141A1F' }}>{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Laisser une note ou notifier @quelqu'un..."
            className="w-full px-3 py-3 border rounded-lg text-sm resize-none"
            style={{ borderColor: '#D6D9DB', minHeight: '80px' }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: newComment.trim() ? '#006666' : '#9CACA9' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              Envoyer
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Search Modal */}
      <TransactionSearchModal
        isOpen={showTransactionSearch}
        onClose={() => setShowTransactionSearch(false)}
        invoice={invoice}
        onReconcile={(transactionIds) => {
          console.log('Reconcile transactions:', transactionIds)
        }}
      />
    </div>
  )
}

// PDF Viewer Component
function PDFViewer({ invoice, onBack }: { invoice: Invoice | null; onBack?: () => void }) {
  const [viewMode, setViewMode] = useState<'pdf' | 'details'>('pdf')

  // Reset to PDF view when invoice changes
  useEffect(() => {
    setViewMode('pdf')
  }, [invoice?.id])

  if (!invoice) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <p style={{ color: '#6C767F' }}>Sélectionnez une facture pour voir l'aperçu</p>
      </div>
    )
  }

  const hasPdf = !!invoice.pdf_url

  return (
    <div className="flex-1 flex flex-col bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onBack ? onBack() : setViewMode('pdf')}
            className={`flex items-center gap-1.5 text-sm hover:opacity-70 ${viewMode === 'pdf' ? 'text-white' : 'text-gray-400'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Écran principal
          </button>
          <button
            onClick={() => setViewMode('details')}
            className={`flex items-center gap-1.5 text-sm hover:opacity-70 ml-4 ${viewMode === 'details' ? 'text-white' : 'text-gray-400'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
            Suivant
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-600 rounded px-2 py-1">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </div>
          <span className="text-white text-sm">1 / 1</span>
          <button className="text-white hover:opacity-70">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>
          <button className="text-white hover:opacity-70">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15" />
            </svg>
          </button>
          {/* Additional toolbar buttons */}
          <button className="text-white hover:opacity-70">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
          </button>
          <button className="text-white hover:opacity-70">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
          <button className="text-white hover:opacity-70">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
            </svg>
          </button>
          {hasPdf && (
            <a href={invoice.pdf_url!} target="_blank" rel="noopener noreferrer" className="text-white hover:opacity-70">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          )}
          <button className="text-white hover:opacity-70">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
          </button>
          <button className="text-white hover:opacity-70">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {viewMode === 'pdf' && hasPdf ? (
          /* Real PDF viewer using iframe */
          <iframe
            src={invoice.pdf_url!}
            className="w-full h-full bg-white"
            style={{ minHeight: '100%' }}
            title="Invoice PDF"
          />
        ) : (
          /* Fallback: Generated invoice view */
          <div className="bg-white shadow-lg p-8 max-w-2xl w-full" style={{ minHeight: '800px' }}>
            {/* Simulated invoice */}
            <div className="border-b pb-4 mb-4" style={{ borderColor: '#E4E5E7' }}>
              <h2 className="text-xl font-bold text-center" style={{ color: '#006666' }}>FACTURE</h2>
            </div>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm font-semibold mb-2">De:</p>
                <p className="text-sm">{invoice.third_party?.name || 'Fournisseur'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">À:</p>
                <p className="text-sm">MON_ENTREPRISE</p>
              </div>
            </div>
            <div className="mb-8">
              <p className="text-sm"><span className="font-semibold">N° Facture:</span> {invoice.number}</p>
              <p className="text-sm"><span className="font-semibold">Date:</span> {new Date(invoice.date).toLocaleDateString('fr-FR')}</p>
            </div>
            <table className="w-full mb-8">
              <thead>
                <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                  <th className="text-left py-2 text-sm font-semibold">Désignation</th>
                  <th className="text-right py-2 text-sm font-semibold">Montant HT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 text-sm">Prestation de services</td>
                  <td className="py-2 text-sm text-right">{invoice.total_ht.toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
            <div className="text-right">
              <p className="text-sm">Total HT: {invoice.total_ht.toFixed(2)} €</p>
              <p className="text-sm">TVA: {invoice.total_vat.toFixed(2)} €</p>
              <p className="text-lg font-bold mt-2" style={{ color: '#006666' }}>Total TTC: {invoice.total_ttc.toFixed(2)} €</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    draft: { label: 'Boite de réception', bg: '#E4E5E7', color: '#141A1F' },
    sent: { label: 'À payer', bg: '#FEE2E2', color: '#991B1B' },
    paid: { label: 'Payée', bg: '#D1FAE5', color: '#065F46' },
    incomplete: { label: 'À compléter', bg: 'transparent', color: '#DC2626' },
  }
  const { label, bg, color } = config[status] || config.draft

  return (
    <span
      className="px-2 py-1 rounded text-xs font-medium"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}

export default function FacturesFournisseursPage({ openImportModal, onImportModalOpened, onNavigate }: FacturesFournisseursPageProps = {}) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'inbox' | 'to_pay' | 'paid'>('all')
  const [searchText, setSearchText] = useState('')
  const [perPage, setPerPage] = useState(50)

  const { invoices, loading, error, refetch } = useSupplierInvoices()
  const { suppliers } = useSuppliers()

  // Auto-open modal if requested via props
  useEffect(() => {
    if (openImportModal) {
      setIsModalOpen(true)
      onImportModalOpened?.()
    }
  }, [openImportModal, onImportModalOpened])

  const handleInvoiceSaved = useCallback(() => {
    refetch()
    setIsModalOpen(false)
  }, [refetch])

  // Filter invoices by tab and search
  const filteredInvoices = useMemo(() => {
    let filtered = invoices

    // Filter by tab
    if (activeTab === 'inbox') {
      filtered = filtered.filter(i => i.status === 'draft')
    } else if (activeTab === 'to_pay') {
      filtered = filtered.filter(i => i.status === 'sent')
    } else if (activeTab === 'paid') {
      filtered = filtered.filter(i => i.status === 'paid')
    }

    // Filter by search
    if (searchText) {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(i =>
        i.number?.toLowerCase().includes(search) ||
        i.third_party?.name?.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [invoices, activeTab, searchText])

  // Tab counts
  const counts = useMemo(() => ({
    all: invoices.length,
    inbox: invoices.filter(i => i.status === 'draft').length,
    to_pay: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
  }), [invoices])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des factures fournisseurs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: '#006666' }}>
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Left Panel - Invoice List */}
      <div className="w-[420px] flex-shrink-0 bg-white border-r flex flex-col" style={{ borderColor: '#E4E5E7' }}>
        {/* Header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold" style={{ color: '#141A1F' }}>Factures fournisseurs</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#006666' }}
            >
              Importer
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Rechercher une facture..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              1 Filtre
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-2 font-medium ${activeTab === 'all' ? 'border-b-2' : ''}`}
              style={{ borderColor: activeTab === 'all' ? '#006666' : 'transparent', color: activeTab === 'all' ? '#006666' : '#6C767F' }}
            >
              Toutes <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#E4E5E7' }}>{counts.all}</span>
            </button>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`pb-2 font-medium ${activeTab === 'inbox' ? 'border-b-2' : ''}`}
              style={{ borderColor: activeTab === 'inbox' ? '#006666' : 'transparent', color: activeTab === 'inbox' ? '#006666' : '#6C767F' }}
            >
              Boite de réception <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#E4E5E7' }}>{counts.inbox}</span>
            </button>
            <button
              onClick={() => setActiveTab('to_pay')}
              className={`pb-2 font-medium ${activeTab === 'to_pay' ? 'border-b-2' : ''}`}
              style={{ borderColor: activeTab === 'to_pay' ? '#006666' : 'transparent', color: activeTab === 'to_pay' ? '#006666' : '#6C767F' }}
            >
              À payer <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#E4E5E7' }}>{counts.to_pay}</span>
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`pb-2 font-medium ${activeTab === 'paid' ? 'border-b-2' : ''}`}
              style={{ borderColor: activeTab === 'paid' ? '#006666' : 'transparent', color: activeTab === 'paid' ? '#006666' : '#6C767F' }}
            >
              Payées <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#E4E5E7' }}>{counts.paid}</span>
            </button>
          </div>
        </div>

        {/* Invoice List */}
        <div className="flex-1 overflow-y-auto">
          {/* Select all */}
          <div className="px-4 py-2 border-b flex items-center gap-3" style={{ borderColor: '#E4E5E7' }}>
            <input type="checkbox" className="rounded" />
            <span className="text-sm" style={{ color: '#6C767F' }}>Toutes les factures</span>
          </div>

          {/* Invoice items */}
          {filteredInvoices.map((invoice) => {
            const isSelected = selectedInvoice?.id === invoice.id
            const supplierName = invoice.third_party?.name || 'Fournisseur inconnu'

            return (
              <div
                key={invoice.id}
                onClick={() => setSelectedInvoice(invoice)}
                className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                style={{ borderColor: '#E4E5E7' }}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{supplierName}</span>
                  <span className="text-sm font-semibold" style={{ color: '#141A1F' }}>{formatCurrency(invoice.total_ttc)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#6C767F' }}>{formatDate(invoice.date)}</span>
                  <StatusBadge status={invoice.status} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center gap-1">
            {[50, 100, 200].map((num) => (
              <button
                key={num}
                onClick={() => setPerPage(num)}
                className={`px-2 py-1 rounded text-sm ${perPage === num ? 'text-white' : ''}`}
                style={{
                  backgroundColor: perPage === num ? '#006666' : 'transparent',
                  color: perPage === num ? 'white' : '#6C767F'
                }}
              >
                {num}
              </button>
            ))}
            <span className="text-sm ml-2" style={{ color: '#6C767F' }}>éléments par page</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: '#6C767F' }}>1-{Math.min(perPage, filteredInvoices.length)} sur {filteredInvoices.length}</span>
            <div className="flex items-center gap-1">
              <button className="p-1 rounded border" style={{ borderColor: '#D6D9DB' }}>
                <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button className="px-3 py-1 rounded text-sm text-white" style={{ backgroundColor: '#006666' }}>1</button>
              <button className="p-1 rounded border" style={{ borderColor: '#D6D9DB' }}>
                <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Panel - PDF Viewer */}
      <PDFViewer invoice={selectedInvoice} onBack={() => setSelectedInvoice(null)} />

      {/* Right Panel - Invoice Details */}
      {selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          suppliers={suppliers}
          onClose={() => setSelectedInvoice(null)}
          onUpdate={() => {
            refetch()
            setSelectedInvoice(null)
          }}
          onNavigate={onNavigate}
        />
      )}

      {/* Import Modal */}
      <InvoiceUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type="supplier"
        onSuccess={handleInvoiceSaved}
      />
    </div>
  )
}
