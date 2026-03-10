import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSuppliers } from '../hooks/useSupabase'
import * as ordersService from '../services/commandesFournisseursService'
import type {
  SupplierOrder,
  SupplierOrderStatus,
  SupplierOrderFilters,
  SupplierOrderFormData,
  SupplierOrderLineFormData,
  GoodsReceiptFormData,
  ThreeWayMatchSummary,
} from '../types/achats'
import type { ThirdParty } from '../types/database'

// ============ Helper Functions ============

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

const getStatusLabel = (status: SupplierOrderStatus): string => {
  const labels: Record<SupplierOrderStatus, string> = {
    draft: 'Brouillon',
    validated: 'Validee',
    sent: 'Envoyee',
    received: 'Recue',
    invoiced: 'Facturee',
    cancelled: 'Annulee',
  }
  return labels[status] || status
}

const getStatusColor = (status: SupplierOrderStatus): { bg: string; text: string; border?: string } => {
  const colors: Record<SupplierOrderStatus, { bg: string; text: string; border?: string }> = {
    draft: { bg: '#F2F2F3', text: '#141A1F', border: '#D6D9DB' },
    validated: { bg: '#D9EFEB', text: '#006666' },
    sent: { bg: '#E3F2FD', text: '#1565C0' },
    received: { bg: '#E8F5E9', text: '#2E7D32' },
    invoiced: { bg: '#FFF3E0', text: '#E65100' },
    cancelled: { bg: '#FFEBEE', text: '#C62828' },
  }
  return colors[status] || { bg: '#F2F2F3', text: '#141A1F' }
}

// ============ Status Badge Component ============

function StatusBadge({ status }: { status: SupplierOrderStatus }) {
  const colors = getStatusColor(status)
  return (
    <span
      className="px-2 py-1 rounded text-xs font-medium"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: colors.border ? `1px solid ${colors.border}` : undefined,
      }}
    >
      {getStatusLabel(status)}
    </span>
  )
}

// ============ Order Modal Component ============

interface OrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SupplierOrderFormData) => Promise<void>
  order?: SupplierOrder | null
  suppliers: ThirdParty[]
}

function OrderModal({ isOpen, onClose, onSave, order, suppliers }: OrderModalProps) {
  const [formData, setFormData] = useState<SupplierOrderFormData>({
    supplierId: null,
    supplierName: '',
    date: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    notes: '',
    paymentTerms: '',
    deliveryAddress: '',
    lines: [{ productId: '', description: '', quantity: 1, unit: 'unite', unitPrice: 0, vatRate: 20 }],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (order) {
      setFormData({
        supplierId: order.supplier_id,
        supplierName: order.supplier?.name || '',
        date: order.date,
        expectedDeliveryDate: order.expected_delivery_date || '',
        notes: order.notes || '',
        paymentTerms: order.payment_terms || '',
        deliveryAddress: order.delivery_address || '',
        lines: order.lines?.map((l) => ({
          productId: l.product_id || '',
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unit_price,
          vatRate: l.vat_rate,
        })) || [],
      })
    } else {
      setFormData({
        supplierId: null,
        supplierName: '',
        date: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: '',
        notes: '',
        paymentTerms: '',
        deliveryAddress: '',
        lines: [{ productId: '', description: '', quantity: 1, unit: 'unite', unitPrice: 0, vatRate: 20 }],
      })
    }
  }, [order, isOpen])

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, { productId: '', description: '', quantity: 1, unit: 'unite', unitPrice: 0, vatRate: 20 }],
    }))
  }

  const removeLine = (index: number) => {
    if (formData.lines.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }))
  }

  const updateLine = (index: number, field: keyof SupplierOrderLineFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }))
  }

  const calculateLineTotals = (line: SupplierOrderLineFormData) => {
    const totalHT = line.quantity * line.unitPrice
    const totalVAT = (totalHT * line.vatRate) / 100
    return { totalHT, totalVAT, totalTTC: totalHT + totalVAT }
  }

  const totals = useMemo(() => {
    return formData.lines.reduce(
      (acc, line) => {
        const lineTotals = calculateLineTotals(line)
        return {
          totalHT: acc.totalHT + lineTotals.totalHT,
          totalVAT: acc.totalVAT + lineTotals.totalVAT,
          totalTTC: acc.totalTTC + lineTotals.totalTTC,
        }
      },
      { totalHT: 0, totalVAT: 0, totalTTC: 0 }
    )
  }, [formData.lines])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.supplierId) {
      alert('Veuillez selectionner un fournisseur')
      return
    }
    if (formData.lines.some((l) => !l.description || l.quantity <= 0)) {
      alert('Veuillez remplir toutes les lignes correctement')
      return
    }
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            {order ? `Modifier commande ${order.number}` : 'Nouvelle commande fournisseur'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Fournisseur *
              </label>
              <select
                value={formData.supplierId || ''}
                onChange={(e) => {
                  const supplier = suppliers.find((s) => s.id === e.target.value)
                  setFormData((prev) => ({
                    ...prev,
                    supplierId: e.target.value || null,
                    supplierName: supplier?.name || '',
                  }))
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                required
              >
                <option value="">Selectionner un fournisseur</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Date commande *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Date livraison prevue
              </label>
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Conditions de paiement
              </label>
              <input
                type="text"
                value={formData.paymentTerms}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="Ex: 30 jours fin de mois"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: '#141A1F' }}>
                Lignes de commande
              </label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-sm font-medium"
                style={{ color: '#006666' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter une ligne
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#FAFAFB' }}>
                    <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Description</th>
                    <th className="text-right p-2 font-medium w-20" style={{ color: '#6C767F' }}>Qte</th>
                    <th className="text-left p-2 font-medium w-24" style={{ color: '#6C767F' }}>Unite</th>
                    <th className="text-right p-2 font-medium w-28" style={{ color: '#6C767F' }}>Prix unit. HT</th>
                    <th className="text-right p-2 font-medium w-20" style={{ color: '#6C767F' }}>TVA %</th>
                    <th className="text-right p-2 font-medium w-28" style={{ color: '#6C767F' }}>Total HT</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.lines.map((line, index) => {
                    const lineTotals = calculateLineTotals(line)
                    return (
                      <tr key={index} className="border-t" style={{ borderColor: '#E4E5E7' }}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                            placeholder="Description article"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border rounded text-sm text-right"
                            style={{ borderColor: '#D6D9DB' }}
                            min="0.01"
                            step="0.01"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={line.unit}
                            onChange={(e) => updateLine(index, 'unit', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                          >
                            <option value="unite">Unite</option>
                            <option value="heure">Heure</option>
                            <option value="jour">Jour</option>
                            <option value="kg">Kg</option>
                            <option value="litre">Litre</option>
                            <option value="metre">Metre</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border rounded text-sm text-right"
                            style={{ borderColor: '#D6D9DB' }}
                            min="0"
                            step="0.01"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={line.vatRate}
                            onChange={(e) => updateLine(index, 'vatRate', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm"
                            style={{ borderColor: '#D6D9DB' }}
                          >
                            <option value="20">20%</option>
                            <option value="10">10%</option>
                            <option value="5.5">5.5%</option>
                            <option value="0">0%</option>
                          </select>
                        </td>
                        <td className="p-2 text-right font-medium" style={{ color: '#141A1F' }}>
                          {formatCurrency(lineTotals.totalHT)}
                        </td>
                        <td className="p-2">
                          {formData.lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              className="p-1 hover:bg-red-50 rounded text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-4">
            <div className="w-64 border rounded-lg p-3" style={{ borderColor: '#E4E5E7', backgroundColor: '#FAFAFB' }}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: '#6C767F' }}>Total HT</span>
                <span style={{ color: '#141A1F' }}>{formatCurrency(totals.totalHT)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: '#6C767F' }}>Total TVA</span>
                <span style={{ color: '#141A1F' }}>{formatCurrency(totals.totalVAT)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-2 border-t" style={{ borderColor: '#E4E5E7' }}>
                <span style={{ color: '#141A1F' }}>Total TTC</span>
                <span style={{ color: '#006666' }}>{formatCurrency(totals.totalTTC)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              rows={3}
              placeholder="Notes internes ou instructions pour le fournisseur"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#006666' }}
          >
            {saving ? 'Enregistrement...' : order ? 'Modifier' : 'Creer la commande'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Receipt Modal Component ============

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: GoodsReceiptFormData) => Promise<void>
  order: SupplierOrder
}

function ReceiptModal({ isOpen, onClose, onSave, order }: ReceiptModalProps) {
  const [formData, setFormData] = useState<GoodsReceiptFormData>({
    orderId: order.id,
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
    lines: order.lines?.map((l) => ({
      orderLineId: l.id,
      quantityReceived: Math.max(0, l.quantity - (l.received_quantity || 0)),
      notes: '',
    })) || [],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (order) {
      setFormData({
        orderId: order.id,
        date: new Date().toISOString().split('T')[0],
        reference: '',
        notes: '',
        lines: order.lines?.map((l) => ({
          orderLineId: l.id,
          quantityReceived: Math.max(0, l.quantity - (l.received_quantity || 0)),
          notes: '',
        })) || [],
      })
    }
  }, [order, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.lines.every((l) => l.quantityReceived === 0)) {
      alert('Veuillez saisir au moins une quantite recue')
      return
    }
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            Reception marchandises - {order.number}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Date de reception *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Ref. bon de livraison
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="Numero BL fournisseur"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="border rounded-lg overflow-hidden mb-4" style={{ borderColor: '#E4E5E7' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#FAFAFB' }}>
                  <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Article</th>
                  <th className="text-right p-2 font-medium w-24" style={{ color: '#6C767F' }}>Commande</th>
                  <th className="text-right p-2 font-medium w-24" style={{ color: '#6C767F' }}>Deja recu</th>
                  <th className="text-right p-2 font-medium w-28" style={{ color: '#6C767F' }}>A recevoir</th>
                </tr>
              </thead>
              <tbody>
                {order.lines?.map((orderLine, index) => {
                  const remainingQty = orderLine.quantity - (orderLine.received_quantity || 0)
                  return (
                    <tr key={orderLine.id} className="border-t" style={{ borderColor: '#E4E5E7' }}>
                      <td className="p-2" style={{ color: '#141A1F' }}>{orderLine.description}</td>
                      <td className="p-2 text-right" style={{ color: '#6C767F' }}>{orderLine.quantity}</td>
                      <td className="p-2 text-right" style={{ color: '#6C767F' }}>{orderLine.received_quantity || 0}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={formData.lines[index]?.quantityReceived || 0}
                          onChange={(e) => {
                            const newLines = [...formData.lines]
                            newLines[index] = {
                              ...newLines[index],
                              quantityReceived: parseFloat(e.target.value) || 0,
                            }
                            setFormData((prev) => ({ ...prev, lines: newLines }))
                          }}
                          className="w-full px-2 py-1 border rounded text-sm text-right"
                          style={{ borderColor: '#D6D9DB' }}
                          min="0"
                          max={remainingQty}
                          step="0.01"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              rows={2}
              placeholder="Observations sur la reception"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium"
            style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#2E7D32' }}
          >
            {saving ? 'Enregistrement...' : 'Valider la reception'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Three Way Match Modal ============

interface ThreeWayMatchModalProps {
  isOpen: boolean
  onClose: () => void
  matchData: ThreeWayMatchSummary | null
}

function ThreeWayMatchModal({ isOpen, onClose, matchData }: ThreeWayMatchModalProps) {
  if (!isOpen || !matchData) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
              Controle 3-Way Match - {matchData.orderNumber}
            </h2>
            <p className="text-sm" style={{ color: '#6C767F' }}>{matchData.supplierName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#E3F2FD' }}>
              <p className="text-sm font-medium mb-1" style={{ color: '#1565C0' }}>Commande</p>
              <p className="text-xl font-semibold" style={{ color: '#1565C0' }}>
                {formatCurrency(matchData.totalOrdered)}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#E8F5E9' }}>
              <p className="text-sm font-medium mb-1" style={{ color: '#2E7D32' }}>Recu</p>
              <p className="text-xl font-semibold" style={{ color: '#2E7D32' }}>
                {formatCurrency(matchData.totalReceived)}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#FFF3E0' }}>
              <p className="text-sm font-medium mb-1" style={{ color: '#E65100' }}>Facture</p>
              <p className="text-xl font-semibold" style={{ color: '#E65100' }}>
                {formatCurrency(matchData.totalInvoiced)}
              </p>
            </div>
          </div>

          {/* Status */}
          {matchData.hasDiscrepancy ? (
            <div className="p-3 rounded-lg mb-4 flex items-center gap-2" style={{ backgroundColor: '#FFEBEE' }}>
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-sm font-medium text-red-700">
                Des ecarts ont ete detectes entre commande, reception et facturation
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-lg mb-4 flex items-center gap-2" style={{ backgroundColor: '#E8F5E9' }}>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-green-700">
                Aucun ecart detecte - rapprochement OK
              </span>
            </div>
          )}

          {/* Detail lines */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#FAFAFB' }}>
                  <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>Article</th>
                  <th className="text-right p-2 font-medium w-24" style={{ color: '#6C767F' }}>Commande</th>
                  <th className="text-right p-2 font-medium w-24" style={{ color: '#6C767F' }}>Recu</th>
                  <th className="text-right p-2 font-medium w-24" style={{ color: '#6C767F' }}>Facture</th>
                  <th className="text-center p-2 font-medium w-28" style={{ color: '#6C767F' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {matchData.lines.map((line) => (
                  <tr
                    key={line.orderLineId}
                    className="border-t"
                    style={{
                      borderColor: '#E4E5E7',
                      backgroundColor: line.hasDiscrepancy ? '#FFF8E1' : undefined,
                    }}
                  >
                    <td className="p-2" style={{ color: '#141A1F' }}>{line.description}</td>
                    <td className="p-2 text-right" style={{ color: '#1565C0' }}>{line.orderedQuantity}</td>
                    <td className="p-2 text-right" style={{ color: '#2E7D32' }}>{line.receivedQuantity}</td>
                    <td className="p-2 text-right" style={{ color: '#E65100' }}>{line.invoicedQuantity}</td>
                    <td className="p-2 text-center">
                      {line.hasDiscrepancy ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                          Ecart
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t" style={{ borderColor: '#E4E5E7' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#006666' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Main Page Component ============

export default function CommandesFournisseursPage() {
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SupplierOrderFilters>({})
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [matchData, setMatchData] = useState<ThreeWayMatchSummary | null>(null)

  const { suppliers } = useSuppliers()

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ordersService.listOrders(filters)
      setOrders(data)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Handlers
  const handleCreateOrder = async (data: SupplierOrderFormData) => {
    await ordersService.createOrder(data)
    await fetchOrders()
  }

  const handleUpdateOrder = async (data: SupplierOrderFormData) => {
    if (!selectedOrder) return
    await ordersService.updateOrder(selectedOrder.id, data)
    await fetchOrders()
  }

  const handleDeleteOrder = async (order: SupplierOrder) => {
    if (!confirm(`Supprimer la commande ${order.number} ?`)) return
    try {
      await ordersService.deleteOrder(order.id)
      await fetchOrders()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleValidateOrder = async (order: SupplierOrder) => {
    try {
      await ordersService.validateOrder(order.id)
      await fetchOrders()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleSendOrder = async (order: SupplierOrder) => {
    try {
      await ordersService.sendOrder(order.id)
      await fetchOrders()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleReceiveGoods = async (data: GoodsReceiptFormData) => {
    await ordersService.receiveGoods(data)
    await fetchOrders()
  }

  const handleCancelOrder = async (order: SupplierOrder) => {
    const reason = prompt('Motif d\'annulation (optionnel):')
    if (reason === null) return // User cancelled
    try {
      await ordersService.cancelOrder(order.id, reason)
      await fetchOrders()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleShowMatch = async (order: SupplierOrder) => {
    try {
      const data = await ordersService.getThreeWayMatch(order.id)
      setMatchData(data)
      setIsMatchModalOpen(true)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  // Loading state
  if (loading && orders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des commandes fournisseurs...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && orders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="bg-white rounded-xl p-8 border text-center max-w-md" style={{ borderColor: '#E4E5E7' }}>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>Erreur de chargement</h3>
          <p className="text-sm mb-4" style={{ color: '#6C767F' }}>{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 rounded-lg text-white font-medium text-sm"
            style={{ backgroundColor: '#006666' }}
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>Commandes fournisseurs</h1>
        </div>
        <button
          onClick={() => {
            setSelectedOrder(null)
            setIsOrderModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
          style={{ backgroundColor: '#006666' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle commande
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as SupplierOrderStatus || undefined }))}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          style={{ borderColor: '#D6D9DB' }}
        >
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="validated">Validee</option>
          <option value="sent">Envoyee</option>
          <option value="received">Recue</option>
          <option value="invoiced">Facturee</option>
          <option value="cancelled">Annulee</option>
        </select>

        <select
          value={filters.supplierId || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, supplierId: e.target.value || undefined }))}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          style={{ borderColor: '#D6D9DB' }}
        >
          <option value="">Tous les fournisseurs</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value || undefined }))}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          style={{ borderColor: '#D6D9DB' }}
          placeholder="Date debut"
        />

        <input
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value || undefined }))}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
          style={{ borderColor: '#D6D9DB' }}
          placeholder="Date fin"
        />

        {(filters.status || filters.supplierId || filters.startDate || filters.endDate) && (
          <button
            onClick={() => setFilters({})}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium"
            style={{ color: '#006666' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Effacer filtres
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Numero</th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Fournisseur</th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Date</th>
              <th className="text-left p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Statut</th>
              <th className="text-right p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Total HT</th>
              <th className="text-right p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Total TTC</th>
              <th className="text-right p-3 text-sm font-medium" style={{ color: '#6C767F' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center">
                  <p style={{ color: '#6C767F' }}>Aucune commande fournisseur trouvee</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b hover:bg-gray-50"
                  style={{ borderColor: '#F2F2F3' }}
                >
                  <td className="p-3 text-sm font-medium" style={{ color: '#006666' }}>{order.number}</td>
                  <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{order.supplier?.name || '-'}</td>
                  <td className="p-3 text-sm" style={{ color: '#141A1F' }}>{formatDate(order.date)}</td>
                  <td className="p-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="p-3 text-sm text-right" style={{ color: '#141A1F' }}>{formatCurrency(order.total_ht)}</td>
                  <td className="p-3 text-sm text-right font-medium" style={{ color: '#141A1F' }}>{formatCurrency(order.total_ttc)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Actions based on status */}
                      {order.status === 'draft' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedOrder(order)
                              setIsOrderModalOpen(true)
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleValidateOrder(order)}
                            className="p-1.5 hover:bg-green-50 rounded"
                            title="Valider"
                          >
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="p-1.5 hover:bg-red-50 rounded"
                            title="Supprimer"
                          >
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </>
                      )}
                      {order.status === 'validated' && (
                        <>
                          <button
                            onClick={() => handleSendOrder(order)}
                            className="p-1.5 hover:bg-blue-50 rounded"
                            title="Envoyer"
                          >
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleCancelOrder(order)}
                            className="p-1.5 hover:bg-red-50 rounded"
                            title="Annuler"
                          >
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </>
                      )}
                      {(order.status === 'sent' || order.status === 'received') && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedOrder(order)
                              setIsReceiptModalOpen(true)
                            }}
                            className="p-1.5 hover:bg-green-50 rounded"
                            title="Reception"
                          >
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleShowMatch(order)}
                            className="p-1.5 hover:bg-yellow-50 rounded"
                            title="3-Way Match"
                          >
                            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          </button>
                          {order.status === 'sent' && (
                            <button
                              onClick={() => handleCancelOrder(order)}
                              className="p-1.5 hover:bg-red-50 rounded"
                              title="Annuler"
                            >
                              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                      {order.status === 'invoiced' && (
                        <button
                          onClick={() => handleShowMatch(order)}
                          className="p-1.5 hover:bg-yellow-50 rounded"
                          title="3-Way Match"
                        >
                          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                          </svg>
                        </button>
                      )}
                      {order.status === 'cancelled' && (
                        <button
                          onClick={() => handleDeleteOrder(order)}
                          className="p-1.5 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination info */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm" style={{ color: '#6C767F' }}>
          {orders.length} commande{orders.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Modals */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSave={selectedOrder ? handleUpdateOrder : handleCreateOrder}
        order={selectedOrder}
        suppliers={suppliers}
      />

      {selectedOrder && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          onSave={handleReceiveGoods}
          order={selectedOrder}
        />
      )}

      <ThreeWayMatchModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        matchData={matchData}
      />
    </div>
  )
}
