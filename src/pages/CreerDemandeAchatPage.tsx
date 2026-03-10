// CreerDemandeAchatPage - Create Purchase Request form (Pennylane style)
import { useState, useRef, useEffect } from 'react'
import { createPurchaseRequest, getSuppliers } from '../services/supabaseService'
import type { ThirdParty } from '../types/database'

interface ProductLine {
  id: number
  product: string
  quantity: number
  unit: string
  priceHT: number
  tva: number
  description: string
}

interface CreerDemandeAchatPageProps {
  onNavigate?: (page: string) => void
}

export default function CreerDemandeAchatPage({ onNavigate }: CreerDemandeAchatPageProps) {
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [suppliers, setSuppliers] = useState<ThirdParty[]>([])
  const [motif, setMotif] = useState('')
  const [address, setAddress] = useState('1 RUE EXEMPLE, 75001 PARIS (FR)')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [selectedExpenseTypes, setSelectedExpenseTypes] = useState<{type: string, percentage: number}[]>([])
  const [showExpenseTypeDropdown, setShowExpenseTypeDropdown] = useState(false)
  const [percentageMode, setPercentageMode] = useState(true) // true = %, false = €
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ supplier?: boolean; motif?: boolean }>({})

  // Load suppliers on mount
  useEffect(() => {
    loadSuppliers()
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.supplier-dropdown-container')) {
        setShowSupplierDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (err) {
      console.error('Error loading suppliers:', err)
    }
  }

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  const selectSupplier = (supplier: ThirdParty) => {
    setSupplierId(supplier.id)
    setSupplierName(supplier.name)
    setSupplierSearch(supplier.name)
    setShowSupplierDropdown(false)
  }

  const expenseTypes = [
    '455000 - Associés – Comptes courants',
    'Subventions d\'investissement - Équipement',
    'Virement interne vers Compte Pro',
    'Apport en capital / Fonds propres',
    'Frais de représentation',
    'Notes de frais – IK',
    'Notes de frais – Repas',
    'Notes de frais – Hébergement',
    'Fournitures de bureau',
    'Abonnements et services',
    'Honoraires et prestations',
    'Déplacements professionnels'
  ]

  const addExpenseType = (type: string) => {
    if (!selectedExpenseTypes.find(t => t.type === type)) {
      setSelectedExpenseTypes(prev => [...prev, { type, percentage: 100 }])
    }
    setShowExpenseTypeDropdown(false)
  }

  const removeExpenseType = (type: string) => {
    setSelectedExpenseTypes(prev => prev.filter(t => t.type !== type))
  }

  const updateExpenseTypePercentage = (type: string, percentage: number) => {
    setSelectedExpenseTypes(prev =>
      prev.map(t => t.type === type ? { ...t, percentage: Math.min(100, Math.max(0, percentage)) } : t)
    )
  }
  const [productLines, setProductLines] = useState<ProductLine[]>([
    { id: 1, product: '', quantity: 1, unit: 'unités', priceHT: 0, tva: 20, description: '' }
  ])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newFiles = Array.from(files)
      setUploadedFiles(prev => [...prev, ...newFiles])
    }
    // Reset input value to allow selecting the same file again
    if (e.target) {
      e.target.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const addProductLine = () => {
    setProductLines([
      ...productLines,
      { id: Date.now(), product: '', quantity: 1, unit: 'unités', priceHT: 0, tva: 20, description: '' }
    ])
  }

  const updateProductLine = (id: number, field: keyof ProductLine, value: string | number) => {
    setProductLines(lines =>
      lines.map(line => line.id === id ? { ...line, [field]: value } : line)
    )
  }

  const removeProductLine = (id: number) => {
    if (productLines.length > 1) {
      setProductLines(lines => lines.filter(line => line.id !== id))
    }
  }

  // Calculate totals
  const totalHT = productLines.reduce((sum, line) => sum + (line.quantity * line.priceHT), 0)
  const totalTVA = productLines.reduce((sum, line) => sum + (line.quantity * line.priceHT * line.tva / 100), 0)
  const totalTTC = totalHT + totalTVA

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  }

  const handleSubmit = async () => {
    // Validate required fields
    const errors: { supplier?: boolean; motif?: boolean } = {}

    if (!supplierId) {
      errors.supplier = true
    }
    if (!motif.trim()) {
      errors.motif = true
    }

    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await createPurchaseRequest({
        supplier: supplierId,
        supplierName: supplierName || undefined,
        motif,
        deliveryAddress: address,
        estimatedDeliveryDate: deliveryDate || undefined,
        currency,
        products: productLines.map(line => ({
          id: line.id,
          product: line.product,
          quantity: line.quantity,
          unit: line.unit,
          priceHT: line.priceHT,
          tva: line.tva,
          description: line.description,
        })),
        analyticalCategories: selectedExpenseTypes,
        files: uploadedFiles,
      })

      // Navigate back to the list page
      onNavigate?.('demandes-achat')
    } catch (error) {
      console.error('Error submitting purchase request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la soumission'
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('purchase_requests')) {
        setSubmitError('La table des demandes d\'achat n\'existe pas encore. Veuillez exécuter la migration SQL dans Supabase.')
      } else {
        setSubmitError(errorMessage)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
          Faire une demande d'achat
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto flex gap-6">
          {/* Form */}
          <div className="flex-1 space-y-6">
            {/* Fournisseur */}
            <div className="relative supplier-dropdown-container">
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Fournisseur
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value)
                    setShowSupplierDropdown(true)
                    setFieldErrors(prev => ({ ...prev, supplier: false }))
                    if (!e.target.value) {
                      setSupplierId('')
                      setSupplierName('')
                    }
                  }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  placeholder="Choisir..."
                  className="w-full px-4 py-2.5 border rounded-lg text-sm bg-white pr-10"
                  style={{
                    borderColor: fieldErrors.supplier ? '#DC2626' : '#D6D9DB',
                    color: supplierSearch ? '#141A1F' : '#9CA3AF'
                  }}
                />
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Supplier dropdown */}
              {showSupplierDropdown && (
                <div
                  className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto"
                  style={{ borderColor: '#D6D9DB' }}
                >
                  {filteredSuppliers.length > 0 ? (
                    <>
                      <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: '#6C767F' }}>
                        Résultats de la recherche
                      </div>
                      {filteredSuppliers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectSupplier(s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors text-sm"
                          style={{
                            color: '#141A1F',
                            backgroundColor: supplierId === s.id ? '#D9EFEB' : undefined
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-4 py-3 text-sm" style={{ color: '#6C767F' }}>
                      Aucun fournisseur trouvé
                    </div>
                  )}
                </div>
              )}

              {/* Supplier error message */}
              {fieldErrors.supplier && (
                <div className="flex items-center gap-2 mt-2">
                  <svg className="w-4 h-4" style={{ color: '#DC2626' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm" style={{ color: '#DC2626' }}>Ce champ est requis</span>
                </div>
              )}
            </div>

            {/* Motif */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Motif
              </label>
              <textarea
                value={motif}
                onChange={(e) => {
                  setMotif(e.target.value)
                  setFieldErrors(prev => ({ ...prev, motif: false }))
                }}
                placeholder="Précisez ici les raisons de votre dépense..."
                rows={4}
                className="w-full px-4 py-3 border rounded-lg text-sm resize-y"
                style={{
                  borderColor: fieldErrors.motif ? '#DC2626' : '#D6D9DB',
                  color: '#141A1F'
                }}
              />
              {/* Motif error message */}
              {fieldErrors.motif && (
                <div className="flex items-center gap-2 mt-2">
                  <svg className="w-4 h-4" style={{ color: '#DC2626' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm" style={{ color: '#DC2626' }}>Ce champ est requis</span>
                </div>
              )}
            </div>

            {/* Adresse */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: '#141A1F' }}>
                  Adresse
                </label>
                <button className="text-sm font-medium" style={{ color: '#006666' }}>
                  Saisir une adresse manuellement
                </button>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 border rounded-lg" style={{ borderColor: '#D6D9DB' }}>
                <span className="flex-1 text-sm" style={{ color: '#141A1F' }}>{address}</span>
                <button className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Date de livraison */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Date de livraison estimée (optionnel)
              </label>
              <div className="relative w-64">
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  placeholder="JJ/MM/AAAA"
                  className="w-full px-4 py-2.5 border rounded-lg text-sm pl-10"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
            </div>

            {/* Devise */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Devise
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg text-sm bg-white"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                <option value="EUR">EUR - Euros</option>
                <option value="USD">USD - Dollars</option>
                <option value="GBP">GBP - Livres</option>
              </select>
            </div>

            {/* Produits */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: '#141A1F' }}>
                Produits
              </label>

              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-medium" style={{ color: '#6C767F' }}>
                <div className="col-span-3">Produit ou un service</div>
                <div className="col-span-2">Qté</div>
                <div className="col-span-2">Prix u. HT</div>
                <div className="col-span-2">TVA (%)</div>
                <div className="col-span-2">Total HT</div>
                <div className="col-span-1"></div>
              </div>

              {/* Product lines */}
              {productLines.map((line) => (
                <div key={line.id} className="mb-3">
                  <div className="grid grid-cols-12 gap-2 mb-2">
                    {/* Product name */}
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={line.product}
                        onChange={(e) => updateProductLine(line.id, 'product', e.target.value)}
                        placeholder="Produit ou un service"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                      />
                    </div>

                    {/* Quantity + Unit */}
                    <div className="col-span-2 flex gap-1">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateProductLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-2 border rounded-lg text-sm text-center"
                        style={{ borderColor: '#D6D9DB' }}
                        min="0"
                        step="0.01"
                      />
                      <select
                        value={line.unit}
                        onChange={(e) => updateProductLine(line.id, 'unit', e.target.value)}
                        className="flex-1 px-2 py-2 border rounded-lg text-sm bg-white"
                        style={{ borderColor: '#D6D9DB' }}
                      >
                        <option value="unités">unités</option>
                        <option value="heures">heures</option>
                        <option value="jours">jours</option>
                        <option value="kg">kg</option>
                        <option value="m">m</option>
                      </select>
                    </div>

                    {/* Price HT */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={line.priceHT || ''}
                        onChange={(e) => updateProductLine(line.id, 'priceHT', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                        className="w-full px-3 py-2 border rounded-lg text-sm text-right"
                        style={{ borderColor: '#D6D9DB' }}
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {/* TVA */}
                    <div className="col-span-2">
                      <select
                        value={line.tva}
                        onChange={(e) => updateProductLine(line.id, 'tva', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        style={{ borderColor: '#D6D9DB' }}
                      >
                        <option value="20">20%</option>
                        <option value="10">10%</option>
                        <option value="5.5">5,5%</option>
                        <option value="2.1">2,1%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>

                    {/* Total HT */}
                    <div className="col-span-2 flex items-center px-3 text-sm" style={{ color: '#6C767F' }}>
                      {(line.quantity * line.priceHT).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                    </div>

                    {/* Remove button */}
                    <div className="col-span-1 flex items-center">
                      {productLines.length > 1 && (
                        <button
                          onClick={() => removeProductLine(line.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateProductLine(line.id, 'description', e.target.value)}
                    placeholder="Description (optionnel)"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                </div>
              ))}

              {/* Add line button */}
              <button
                onClick={addProductLine}
                className="flex items-center gap-1 text-sm font-medium mt-2"
                style={{ color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter une ligne
              </button>
            </div>

            {/* Catégories analytiques */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Catégories analytiques (optionnel)
              </label>

              {/* Dropdown search */}
              <div className="relative">
                <div
                  className="w-full px-4 py-2.5 border rounded-lg text-sm flex items-center justify-between cursor-pointer"
                  style={{ borderColor: '#D6D9DB' }}
                  onClick={() => setShowExpenseTypeDropdown(!showExpenseTypeDropdown)}
                >
                  <span style={{ color: '#9CA3AF' }}>Rechercher une catégorie</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Dropdown list */}
                {showExpenseTypeDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{ borderColor: '#D6D9DB' }}>
                    <div className="p-2">
                      <p className="text-xs font-medium px-2 py-1 mb-1" style={{ color: '#6C767F' }}>
                        Types de dépenses / revenus
                      </p>
                      {expenseTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => addExpenseType(type)}
                          className="w-full text-left px-2 py-1.5 mb-1"
                        >
                          <span
                            className="inline-block px-3 py-1 rounded-full text-sm"
                            style={{ backgroundColor: '#FEE2E2', color: '#141A1F' }}
                          >
                            {type.length > 30 ? type.substring(0, 30) + '...' : type}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Montant total à répartir */}
              {selectedExpenseTypes.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                      <span className="text-sm" style={{ color: '#141A1F' }}>
                        Montant total à répartir : {formatCurrency(totalHT)}
                      </span>
                    </div>
                    <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: '#D6D9DB' }}>
                      <button
                        type="button"
                        onClick={() => setPercentageMode(true)}
                        className="px-3 py-1 text-sm"
                        style={{
                          backgroundColor: percentageMode ? '#D9EFEB' : 'white',
                          color: percentageMode ? '#006666' : '#6C767F'
                        }}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentageMode(false)}
                        className="px-3 py-1 text-sm border-l"
                        style={{
                          borderColor: '#D6D9DB',
                          backgroundColor: !percentageMode ? '#D9EFEB' : 'white',
                          color: !percentageMode ? '#006666' : '#6C767F'
                        }}
                      >
                        €
                      </button>
                    </div>
                  </div>

                  {/* Types de dépenses / revenus section */}
                  <div className="border rounded-lg p-4" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        Types de dépenses / revenus
                      </span>
                      <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>

                    {/* Selected expense types with sliders */}
                    <div className="space-y-3">
                      {selectedExpenseTypes.map((item) => (
                        <div key={item.type} className="flex items-center gap-3">
                          {/* Type label */}
                          <span
                            className="px-3 py-1.5 rounded-full text-sm flex-shrink-0"
                            style={{ backgroundColor: '#FEE2E2', color: '#141A1F' }}
                          >
                            {item.type.length > 15 ? item.type.substring(0, 15) + '...' : item.type}
                          </span>

                          {/* Slider */}
                          <div className="flex-1 relative">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={item.percentage}
                              onChange={(e) => updateExpenseTypePercentage(item.type, parseFloat(e.target.value))}
                              className="w-full h-2 rounded-full appearance-none cursor-pointer"
                              style={{
                                background: `linear-gradient(to right, #FEE2E2 0%, #FEE2E2 ${item.percentage}%, #E5E7EB ${item.percentage}%, #E5E7EB 100%)`
                              }}
                            />
                          </div>

                          {/* Percentage input */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.percentage.toFixed(2)}
                              onChange={(e) => updateExpenseTypePercentage(item.type, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded text-sm text-right"
                              style={{ borderColor: '#D6D9DB' }}
                              min="0"
                              max="100"
                              step="0.01"
                            />
                            <span className="text-sm" style={{ color: '#6C767F' }}>%</span>
                          </div>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => removeExpenseType(item.type)}
                            className="p-1 rounded-full"
                            style={{ backgroundColor: '#FEE2E2' }}
                          >
                            <svg className="w-4 h-4" style={{ color: '#DC2626' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedExpenseTypes.length === 0 && (
                <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                  Débloquez la catégorisation en ajoutant vos produits
                </p>
              )}
            </div>

            {/* Documents */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#141A1F' }}>
                Documents (optionnel)
              </label>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div
                className="border-2 border-dashed rounded-lg p-6 text-center"
                style={{ borderColor: '#D6D9DB' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium mb-2 hover:bg-teal-50 transition-colors"
                  style={{ borderColor: '#006666', color: '#006666' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Choisir des fichiers
                </button>
                <p className="text-xs" style={{ color: '#6C767F' }}>
                  ou le glisser/déposer ici (.pdf, .png, .jpg, .xls)
                </p>
              </div>

              {/* Uploaded files list - outside the dropzone */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 border rounded-lg divide-y" style={{ borderColor: '#E4E5E7' }}>
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-4 py-3 bg-white"
                    >
                      <div className="flex items-center gap-3">
                        {/* File icon */}
                        <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-sm font-medium" style={{ color: '#141A1F' }}>{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* View button */}
                        <button
                          type="button"
                          onClick={() => {
                            const url = URL.createObjectURL(file)
                            window.open(url, '_blank')
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Voir le fichier"
                        >
                          <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Supprimer le fichier"
                        >
                          <svg className="w-5 h-5" style={{ color: '#DC2626' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error message */}
            {submitError && (
              <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                {submitError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => onNavigate?.('demandes-achat')}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 border rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#006666' }}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Envoi en cours...
                  </>
                ) : (
                  'Soumettre'
                )}
              </button>
            </div>
          </div>

          {/* Récapitulatif sidebar */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-lg border p-5 sticky top-6" style={{ borderColor: '#E4E5E7' }}>
              <h3 className="font-semibold mb-4" style={{ color: '#141A1F' }}>
                Récapitulatif
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#6C767F' }}>Total HT</span>
                  <span style={{ color: '#141A1F' }}>{formatCurrency(totalHT)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#6C767F' }}>Total TVA</span>
                  <span style={{ color: '#141A1F' }}>{formatCurrency(totalTVA)}</span>
                </div>
                <div className="border-t pt-3" style={{ borderColor: '#E4E5E7' }}>
                  <div className="flex justify-between font-semibold">
                    <span style={{ color: '#141A1F' }}>Total TTC</span>
                    <span style={{ color: '#141A1F' }}>{formatCurrency(totalTTC)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
