import { useState, useRef, useEffect, useCallback } from 'react'
import { createSupplierInvoice, uploadInvoiceDocument, findOrCreateThirdParty } from '../services/invoiceService'
import { generateInvoiceEntries } from '../services/accountingService'
import { suggestCounterpartAccount, searchExpenseAccounts, type AccountSuggestion } from '../services/accountClassificationService'
import { getSuppliers, getCustomers } from '../services/supabaseService'
import type { InvoiceFormData, ThirdParty } from '../types/database'

interface InvoiceUploadModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'supplier' | 'customer'
  onSuccess?: () => void
}

interface UploadedFile {
  file: File
  url: string
}

export default function InvoiceUploadModal({ isOpen, onClose, type, onSuccess }: InvoiceUploadModalProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [showDetailView, setShowDetailView] = useState(false)
  const [currentPage, _setCurrentPage] = useState(1)
  const [totalPages] = useState(2)
  const [zoom, setZoom] = useState(86)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [tierType, setTierType] = useState<'fournisseur' | 'client'>(type === 'supplier' ? 'fournisseur' : 'client')
  const [tierName, setTierName] = useState('')
  const [tierId, setTierId] = useState<string | null>(null)
  const [tierSearch, setTierSearch] = useState('')
  const [showTierDropdown, setShowTierDropdown] = useState(false)
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [emissionDate, setEmissionDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [counterpart, setCounterpart] = useState('')
  const [entryLabel, setEntryLabel] = useState('')
  const [totalTTC, setTotalTTC] = useState('')
  const [amountHT, setAmountHT] = useState('')
  const [amountTVA, setAmountTVA] = useState('')
  const [vatRate, setVatRate] = useState('20')
  const [hasCCA, setHasCCA] = useState(false)
  const [hasFNP, setHasFNP] = useState(false)
  const [reconciliationMode, setReconciliationMode] = useState('')
  const [accountSuggestion, setAccountSuggestion] = useState<AccountSuggestion | null>(null)
  const [accountSearchResults, setAccountSearchResults] = useState<{ code: string; label: string }[]>([])
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const accountInputRef = useRef<HTMLDivElement>(null)
  const tierInputRef = useRef<HTMLDivElement>(null)

  // Load third parties based on tier type
  useEffect(() => {
    const loadThirdParties = async () => {
      try {
        const data = tierType === 'fournisseur' ? await getSuppliers() : await getCustomers()
        setThirdParties(data)
      } catch (err) {
        console.error('Error loading third parties:', err)
      }
    }
    if (isOpen) {
      loadThirdParties()
    }
  }, [isOpen, tierType])

  // Close tier dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tierInputRef.current && !tierInputRef.current.contains(e.target as Node)) {
        setShowTierDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter third parties based on search
  const filteredThirdParties = thirdParties.filter(tp =>
    tp.name.toLowerCase().includes(tierSearch.toLowerCase())
  )

  const selectThirdParty = (tp: ThirdParty) => {
    setTierId(tp.id)
    setTierName(tp.name)
    setTierSearch(tp.name)
    setShowTierDropdown(false)
    // Trigger account classification
    classifyAccount(tp.name, entryLabel)
  }

  // Auto-classify when supplier name changes (debounced)
  const classifyAccount = useCallback(async (name: string, label: string) => {
    if (!name.trim() || name.trim().length < 2) {
      setAccountSuggestion(null)
      return
    }
    setClassifying(true)
    try {
      console.log('[Modal] Classification en cours pour:', name)
      const suggestion = await suggestCounterpartAccount(name, label)
      console.log('[Modal] Résultat classification:', suggestion)
      if (suggestion) {
        setAccountSuggestion(suggestion)
        // Always auto-fill the counterpart with the suggestion
        setCounterpart(`${suggestion.code} - ${suggestion.label}`)
      } else {
        setAccountSuggestion(null)
      }
    } catch (err) {
      console.error('[Modal] Classification error:', err)
    } finally {
      setClassifying(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tierName.trim().length >= 2) {
        classifyAccount(tierName, entryLabel)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [tierName, entryLabel, classifyAccount])

  // Search accounts when typing in counterpart field
  const handleAccountSearch = useCallback(async (query: string) => {
    setCounterpart(query)
    if (query.trim().length < 1) {
      setAccountSearchResults([])
      setShowAccountDropdown(false)
      return
    }
    try {
      const results = await searchExpenseAccounts(query)
      setAccountSearchResults(results)
      setShowAccountDropdown(results.length > 0)
    } catch (err) {
      console.error('Account search error:', err)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountInputRef.current && !accountInputRef.current.contains(e.target as Node)) {
        setShowAccountDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' o'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
  }

  const parseAmount = (val: string): number => {
    const cleaned = val.replace(/\s/g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    if (isNaN(num)) return 0
    return num
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile)
      setUploadedFile({ file: selectedFile, url })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.type.startsWith('image/'))) {
      const url = URL.createObjectURL(droppedFile)
      setUploadedFile({ file: droppedFile, url })
    }
  }

  const removeFile = () => {
    if (uploadedFile) {
      URL.revokeObjectURL(uploadedFile.url)
      setUploadedFile(null)
    }
  }

  const calculateTVA = () => {
    const ttc = parseAmount(totalTTC)
    const ht = parseAmount(amountHT)
    const tva = ttc - ht
    setAmountTVA(tva.toFixed(2).replace('.', ','))
  }

  const resetForm = () => {
    setTierType(type === 'supplier' ? 'fournisseur' : 'client')
    setTierName('')
    setTierId(null)
    setTierSearch('')
    setInvoiceNumber('')
    setEmissionDate('')
    setDueDate('')
    setCounterpart('')
    setEntryLabel('')
    setTotalTTC('')
    setAmountHT('')
    setAmountTVA('')
    setVatRate('20')
    setHasCCA(false)
    setHasFNP(false)
    setReconciliationMode('')
    setSaveError(null)
    setAccountSuggestion(null)
    setAccountSearchResults([])
    setShowAccountDropdown(false)
  }

  const handleClose = () => {
    setShowDetailView(false)
    setUploadedFile(null)
    resetForm()
    onClose()
  }

  const handleValidate = async () => {
    setSaving(true)
    setSaveError(null)

    try {
      // Validate required fields
      const thirdPartyName = tierName.trim() || tierSearch.trim()
      if (!thirdPartyName) {
        throw new Error('Le nom du fournisseur/client est requis')
      }
      if (!invoiceNumber.trim()) {
        throw new Error('Le numéro de facture est requis')
      }
      if (!emissionDate) {
        throw new Error('La date d\'émission est requise')
      }

      if (!counterpart.trim()) {
        throw new Error('Le compte de contrepartie est requis')
      }

      const ttcAmount = parseAmount(totalTTC)
      const htAmount = parseAmount(amountHT)
      const vatAmount = parseAmount(amountTVA)

      if (ttcAmount <= 0) {
        throw new Error('Le montant TTC doit être supérieur à 0')
      }

      // Upload document if present
      let documentUrl: string | undefined
      if (uploadedFile) {
        // Use a temp ID for naming the file
        const tempId = crypto.randomUUID()
        documentUrl = await uploadInvoiceDocument(uploadedFile.file, tempId)
      }

      // Build InvoiceFormData matching the service interface
      const formData: InvoiceFormData = {
        thirdPartyType: tierType === 'fournisseur' ? 'supplier' : 'customer',
        thirdPartyId: tierId,
        thirdPartyName: tierName.trim() || tierSearch.trim(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: emissionDate,
        dueDate: dueDate || emissionDate,
        accountingCode: counterpart.split(' ')[0], // Extract code from "6135 - Locations mobilières"
        entryLabel: entryLabel || `Facture ${tierName.trim()} - ${invoiceNumber.trim()}`,
        totalTTC: ttcAmount,
        totalHT: htAmount,
        totalVAT: vatAmount,
        vatRate: vatRate,
        currency: 'EUR',
        hasCCA: hasCCA,
        hasFNP: hasFNP,
        paymentMethod: reconciliationMode || undefined,
      }

      // Find or create third party to get the ID
      const thirdParty = await findOrCreateThirdParty(
        formData.thirdPartyName,
        formData.thirdPartyType
      )
      formData.thirdPartyId = thirdParty.id

      // Create the invoice in DB
      const invoice = await createSupplierInvoice(formData, crypto.randomUUID(), documentUrl)

      // Generate accounting entries
      await generateInvoiceEntries(invoice, formData)

      console.log(`Invoice ${invoice.number} created and entries generated`)

      // Notify parent and close
      onSuccess?.()
      handleClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue lors de la sauvegarde'
      console.error('Error saving invoice:', message)
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  // Vue détaillée split-screen (formulaire facture)
  if (showDetailView) {
    return (
      <div className="fixed inset-0 z-50 flex">
        {/* Left Panel - PDF Preview (only if file uploaded) */}
        {uploadedFile && (
          <div className="w-1/2 flex flex-col" style={{ backgroundColor: '#525659' }}>
            {/* PDF Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: '#141A1F' }}>
                  {uploadedFile.file.name}
                </span>
                <div className="flex items-center gap-1 text-sm" style={{ color: '#6C767F' }}>
                  <span>{currentPage}</span>
                  <span>/</span>
                  <span>{totalPages}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1 rounded hover:bg-gray-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                  </svg>
                </button>
                <span className="text-sm min-w-[40px] text-center" style={{ color: '#6C767F' }}>{zoom}%</span>
                <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 rounded hover:bg-gray-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
              <div
                className="bg-white shadow-lg"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
              >
                {uploadedFile.file.type === 'application/pdf' ? (
                  <iframe
                    src={uploadedFile.url}
                    className="w-[595px] h-[842px]"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={uploadedFile.url}
                    alt="Document preview"
                    className="max-w-[595px] max-h-[842px] object-contain"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right Panel - Form (full width if no file) */}
        <div className={`${uploadedFile ? 'w-1/2' : 'w-full max-w-2xl mx-auto'} bg-white flex flex-col`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: '#141A1F' }}>Facture 1 / 1</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleValidate}
                disabled={saving}
                className="px-3 py-1.5 text-sm rounded text-white flex items-center gap-1 disabled:opacity-50"
                style={{ backgroundColor: '#006666' }}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Valider
                  </>
                )}
              </button>
              <button onClick={handleClose} className="p-1.5 rounded hover:bg-gray-100 ml-2">
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Error banner */}
          {saveError && (
            <div className="mx-6 mt-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{saveError}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center justify-between px-6 pt-4 border-b" style={{ borderColor: '#E4E5E7' }}>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-lg" style={{ color: '#141A1F' }}>Informations</span>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-auto p-6">
            {/* Type de tiers & Tiers */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Type de tiers</label>
                <select
                  value={tierType}
                  onChange={(e) => setTierType(e.target.value as 'fournisseur' | 'client')}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                >
                  <option value="fournisseur">Fournisseur</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div className="relative" ref={tierInputRef}>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Tiers *</label>
                <input
                  type="text"
                  value={tierSearch}
                  onChange={(e) => {
                    setTierSearch(e.target.value)
                    setShowTierDropdown(true)
                    if (!e.target.value) {
                      setTierId(null)
                      setTierName('')
                    }
                  }}
                  onFocus={() => setShowTierDropdown(true)}
                  placeholder={tierType === 'fournisseur' ? 'Rechercher un fournisseur...' : 'Rechercher un client...'}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />

                {/* Dropdown */}
                {showTierDropdown && (
                  <div
                    className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    style={{ borderColor: '#D6D9DB' }}
                  >
                    {filteredThirdParties.length > 0 ? (
                      filteredThirdParties.map((tp) => (
                        <button
                          key={tp.id}
                          type="button"
                          onClick={() => selectThirdParty(tp)}
                          className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm"
                          style={{
                            color: '#141A1F',
                            backgroundColor: tierId === tp.id ? '#D9EFEB' : undefined
                          }}
                        >
                          {tp.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm" style={{ color: '#6C767F' }}>
                        {tierSearch ? 'Aucun résultat' : 'Tapez pour rechercher...'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Numéro, Émission, Échéance */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>N° facture *</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Émission *</label>
                <input
                  type="date"
                  value={emissionDate}
                  onChange={(e) => setEmissionDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Échéance</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>

            {/* Contrepartie & Libellé */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div ref={accountInputRef} className="relative">
                <label className="block text-sm mb-1 flex items-center gap-1" style={{ color: '#6C767F' }}>
                  Contrepartie *
                  {classifying && (
                    <div className="animate-spin rounded-full h-3 w-3 border border-gray-300 border-t-teal-600" />
                  )}
                  {accountSuggestion && !classifying && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: accountSuggestion.confidence === 'high' ? '#D9EFEB' : accountSuggestion.confidence === 'medium' ? '#FEF3C7' : '#F3F4F6',
                        color: accountSuggestion.confidence === 'high' ? '#006666' : accountSuggestion.confidence === 'medium' ? '#92400E' : '#6B7280',
                      }}
                    >
                      {accountSuggestion.confidence === 'high' ? 'Historique' : accountSuggestion.reason}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={counterpart}
                  onChange={(e) => handleAccountSearch(e.target.value)}
                  onFocus={() => { if (accountSearchResults.length > 0) setShowAccountDropdown(true) }}
                  placeholder="Rechercher un compte (6xxx)..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
                {showAccountDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto" style={{ borderColor: '#D6D9DB' }}>
                    {accountSearchResults.map((acc) => (
                      <button
                        key={acc.code}
                        type="button"
                        onClick={() => {
                          setCounterpart(`${acc.code} - ${acc.label}`)
                          setShowAccountDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="font-mono font-medium" style={{ color: '#006666' }}>{acc.code}</span>
                        <span style={{ color: '#141A1F' }}>{acc.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Libellé de l'écriture</label>
                <input
                  type="text"
                  value={entryLabel}
                  onChange={(e) => setEntryLabel(e.target.value)}
                  placeholder="Facture FOURNISSEUR - 000073501"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>

            {/* Montants */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Total TTC *</label>
                <div className="flex">
                  <input
                    type="text"
                    value={totalTTC}
                    onChange={(e) => setTotalTTC(e.target.value)}
                    onBlur={calculateTVA}
                    placeholder="12,00"
                    className="w-full px-3 py-2 border rounded-l-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <span className="px-3 py-2 border border-l-0 rounded-r-lg text-sm bg-gray-50" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Montant HT</label>
                <div className="flex">
                  <input
                    type="text"
                    value={amountHT}
                    onChange={(e) => setAmountHT(e.target.value)}
                    onBlur={calculateTVA}
                    placeholder="10,00"
                    className="w-full px-3 py-2 border rounded-l-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <span className="px-3 py-2 border border-l-0 rounded-r-lg text-sm bg-gray-50" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Montant TVA</label>
                <div className="flex">
                  <input
                    type="text"
                    value={amountTVA}
                    onChange={(e) => setAmountTVA(e.target.value)}
                    placeholder="2,00"
                    className="w-full px-3 py-2 border rounded-l-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <span className="px-3 py-2 border border-l-0 rounded-r-lg text-sm bg-gray-50" style={{ borderColor: '#D6D9DB', color: '#6C767F' }}>€</span>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Taux TVA</label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                >
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                  <option value="5.5">5,5%</option>
                  <option value="2.1">2,1%</option>
                  <option value="0">0%</option>
                  <option value="autoliq-20">Autoliquidation 20%</option>
                  <option value="autoliq-10">Autoliquidation 10%</option>
                </select>
              </div>
            </div>

            {/* Options d'imputation */}
            <div className="mb-6">
              <h3 className="font-medium mb-3" style={{ color: '#141A1F' }}>Options d'imputation et de cut-offs</h3>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasCCA}
                    onChange={(e) => setHasCCA(e.target.checked)}
                    className="rounded w-4 h-4"
                    style={{ accentColor: '#006666' }}
                  />
                  <span className="text-sm" style={{ color: '#141A1F' }}>CCA</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasFNP}
                    onChange={(e) => setHasFNP(e.target.checked)}
                    className="rounded w-4 h-4"
                    style={{ accentColor: '#006666' }}
                  />
                  <span className="text-sm" style={{ color: '#141A1F' }}>FNP</span>
                </label>
              </div>
            </div>

            <hr className="mb-6" style={{ borderColor: '#E4E5E7' }} />

            {/* Réconciliation */}
            <div className="mb-6">
              <h3 className="font-medium mb-3" style={{ color: '#141A1F' }}>Réconciliation</h3>
              <div className="mb-3">
                <label className="block text-sm mb-1" style={{ color: '#6C767F' }}>Mode de règlement</label>
                <select
                  value={reconciliationMode}
                  onChange={(e) => setReconciliationMode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB', color: '#6C767F' }}
                >
                  <option value="">Non spécifié</option>
                  <option value="virement">Virement bancaire</option>
                  <option value="cheque">Chèque</option>
                  <option value="cb">Carte bancaire</option>
                  <option value="prelevement">Prélèvement</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Vue initiale - Panneau latéral pour upload
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleClose} />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white z-50 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            {type === 'supplier' ? 'Facture fournisseur' : 'Facture client'}
          </h2>
          <button onClick={handleClose} className="p-1.5 rounded hover:bg-gray-100">
            <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Fournisseur / Client */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold" style={{ color: '#141A1F' }}>Fournisseur / Client</h3>
            </div>
            <p className="text-sm" style={{ color: '#6C767F' }}>Aucun tiers associé</p>
          </div>

          {/* Justificatif */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold" style={{ color: '#141A1F' }}>Justificatif</h3>
            </div>

            {uploadedFile ? (
              /* Fichier uploadé - cliquable pour ouvrir la vue détaillée */
              <div className="space-y-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowDetailView(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setShowDetailView(true)
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-teal-500 transition-all text-left group"
                  style={{ borderColor: '#E4E5E7' }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                    <svg className="w-6 h-6" style={{ color: '#DC2626' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#141A1F' }}>{uploadedFile.file.name}</p>
                    <p className="text-xs" style={{ color: '#6C767F' }}>{formatFileSize(uploadedFile.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#006666' }}>
                      Ouvrir
                    </span>
                    <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="flex items-center gap-1 text-xs hover:text-red-600 transition-colors"
                  style={{ color: '#6C767F' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Supprimer ce fichier
                </button>
              </div>
            ) : (
              /* Zone de drop */
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging ? 'border-teal-500 bg-teal-50' : ''}`}
                style={{ borderColor: isDragging ? '#006666' : '#D6D9DB' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <svg className="w-10 h-10 mx-auto mb-3" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm mb-2" style={{ color: '#141A1F' }}>Glissez votre fichier ici</p>
                <p className="text-xs mb-3" style={{ color: '#6C767F' }}>ou</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: '#006666', color: '#006666' }}
                >
                  Parcourir
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}

            {/* Séparateur "ou" */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 border-t" style={{ borderColor: '#E4E5E7' }} />
              <span className="text-sm" style={{ color: '#6C767F' }}>ou</span>
              <div className="flex-1 border-t" style={{ borderColor: '#E4E5E7' }} />
            </div>

            {/* Saisie rapide sans justificatif */}
            <button
              onClick={() => setShowDetailView(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
            >
              <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Saisir manuellement
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={() => setShowDetailView(true)}
            disabled={!uploadedFile}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#006666' }}
          >
            Continuer
          </button>
        </div>
      </div>
    </>
  )
}
