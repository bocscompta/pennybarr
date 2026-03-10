import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  Loan,
  LoanFormData,
  LoanPayment,
  LoanAmortizationEntry,
  LoanType,
  LoanStatus,
  LoanFilters,
} from '../types/immobilisations'
import type { LoanSummary } from '../services/empruntsService'
import {
  listLoans,
  createLoan,
  deleteLoan,
  getLoanSummary,
  getLoanAmortizationTable,
  getLoanPayments,
  recordLoanPayment,
  getUpcomingPayments,
} from '../services/empruntsService'

// ============ Utilitaires ============

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

const formatPercent = (rate: number): string => {
  return `${rate.toFixed(2)} %`
}

const getLoanTypeLabel = (type: LoanType): string => {
  const labels: Record<LoanType, string> = {
    bank: 'Emprunt bancaire',
    shareholder: 'Compte courant associe',
    leasing: 'Credit-bail',
    other: 'Autre',
  }
  return labels[type]
}

const getLoanStatusLabel = (status: LoanStatus): string => {
  const labels: Record<LoanStatus, string> = {
    active: 'En cours',
    completed: 'Solde',
    early_repaid: 'Rembourse anticipe',
  }
  return labels[status]
}

const getFrequencyLabel = (frequency: 'monthly' | 'quarterly' | 'yearly'): string => {
  const labels = {
    monthly: 'Mensuelle',
    quarterly: 'Trimestrielle',
    yearly: 'Annuelle',
  }
  return labels[frequency]
}

// ============ Composants ============

// Cards de resume
function SummaryCards({ summary }: { summary: LoanSummary | null }) {
  if (!summary) return null

  const cards = [
    {
      label: 'Total emprunte',
      value: formatCurrency(summary.totalBorrowed),
      color: '#006666',
    },
    {
      label: 'Capital rembourse',
      value: formatCurrency(summary.totalRepaid),
      color: '#23A84B',
    },
    {
      label: 'Interets payes',
      value: formatCurrency(summary.totalInterestPaid),
      color: '#F59E0B',
    },
    {
      label: 'Reste a rembourser',
      value: formatCurrency(summary.remainingPrincipal),
      color: '#EF4444',
    },
    {
      label: 'Emprunts actifs',
      value: summary.activeLoans.toString(),
      color: '#6366F1',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border p-4"
          style={{ borderColor: '#E4E5E7' }}
        >
          <p className="text-sm mb-1" style={{ color: '#6C767F' }}>
            {card.label}
          </p>
          <p className="text-xl font-semibold" style={{ color: card.color }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// Modal creation emprunt
function CreateLoanModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: LoanFormData) => Promise<void>
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState<LoanFormData>({
    name: '',
    reference: '',
    loanType: 'bank',
    lender: '',
    principalAmount: 0,
    interestRate: 0,
    startDate: new Date().toISOString().split('T')[0],
    durationMonths: 60,
    paymentFrequency: 'monthly',
    paymentDay: 5,
    accountCodeLoan: '164',
    accountCodeInterest: '6611',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const handleTypeChange = (type: LoanType) => {
    let accountCode = '164'
    if (type === 'shareholder') accountCode = '455'
    else if (type === 'leasing') accountCode = '167'
    setFormData({ ...formData, loanType: type, accountCodeLoan: accountCode })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
              Nouvel emprunt
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Identification */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Nom / Libelle *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="Emprunt vehicule"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Reference / N contrat
              </label>
              <input
                type="text"
                value={formData.reference || ''}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="PRET-2024-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Type d emprunt *
              </label>
              <select
                required
                value={formData.loanType}
                onChange={(e) => handleTypeChange(e.target.value as LoanType)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                style={{ borderColor: '#D6D9DB' }}
              >
                <option value="bank">Emprunt bancaire (164)</option>
                <option value="shareholder">Compte courant associe (455)</option>
                <option value="leasing">Credit-bail (167)</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Banque / Organisme *
              </label>
              <input
                type="text"
                required
                value={formData.lender}
                onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="BNP Paribas"
              />
            </div>
          </div>

          {/* Montants */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Montant emprunte *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.principalAmount || ''}
                onChange={(e) =>
                  setFormData({ ...formData, principalAmount: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Taux d interet annuel (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.interestRate || ''}
                onChange={(e) =>
                  setFormData({ ...formData, interestRate: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="3.5"
              />
            </div>
          </div>

          {/* Duree */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Date de debut *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Duree (mois) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.durationMonths || ''}
                onChange={(e) =>
                  setFormData({ ...formData, durationMonths: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="60"
              />
            </div>
          </div>

          {/* Periodicite */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Periodicite *
              </label>
              <select
                required
                value={formData.paymentFrequency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    paymentFrequency: e.target.value as 'monthly' | 'quarterly' | 'yearly',
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                style={{ borderColor: '#D6D9DB' }}
              >
                <option value="monthly">Mensuelle</option>
                <option value="quarterly">Trimestrielle</option>
                <option value="yearly">Annuelle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Jour de prelevement
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.paymentDay || ''}
                onChange={(e) =>
                  setFormData({ ...formData, paymentDay: parseInt(e.target.value) || undefined })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="5"
              />
            </div>
          </div>

          {/* Comptes comptables */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Compte emprunt
              </label>
              <input
                type="text"
                value={formData.accountCodeLoan}
                onChange={(e) => setFormData({ ...formData, accountCodeLoan: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="164"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
                Compte interets
              </label>
              <input
                type="text"
                value={formData.accountCodeInterest}
                onChange={(e) => setFormData({ ...formData, accountCodeInterest: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
                placeholder="6611"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              rows={3}
              placeholder="Informations complementaires..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm font-medium"
              style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              {isSubmitting ? 'Creation...' : 'Creer l emprunt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal tableau d amortissement
function AmortizationModal({
  isOpen,
  onClose,
  loan,
  schedule,
}: {
  isOpen: boolean
  onClose: () => void
  loan: Loan | null
  schedule: (LoanAmortizationEntry & { isPaid: boolean; paymentDate?: string })[]
}) {
  if (!isOpen || !loan) return null

  const handleExportCSV = () => {
    const headers = ['N', 'Date echeance', 'Capital', 'Interets', 'Total', 'CRD', 'Paye']
    const rows = schedule.map((entry) => [
      entry.number,
      entry.dueDate,
      entry.principal.toFixed(2),
      entry.interest.toFixed(2),
      entry.total.toFixed(2),
      entry.remainingPrincipal.toFixed(2),
      entry.isPaid ? 'Oui' : 'Non',
    ])

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `amortissement_${loan.name.replace(/\s+/g, '_')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
                Tableau d amortissement
              </h2>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                {loan.name} - {loan.lender}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm"
                style={{ borderColor: '#006666', color: '#006666' }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Export CSV
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs" style={{ color: '#6C767F' }}>
                Capital emprunte
              </p>
              <p className="font-semibold" style={{ color: '#141A1F' }}>
                {formatCurrency(loan.principal_amount)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs" style={{ color: '#6C767F' }}>
                Taux
              </p>
              <p className="font-semibold" style={{ color: '#141A1F' }}>
                {formatPercent(loan.interest_rate)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs" style={{ color: '#6C767F' }}>
                Duree
              </p>
              <p className="font-semibold" style={{ color: '#141A1F' }}>
                {loan.duration_months} mois
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs" style={{ color: '#6C767F' }}>
                Echeance
              </p>
              <p className="font-semibold" style={{ color: '#141A1F' }}>
                {formatCurrency(loan.payment_amount)}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>
                  N
                </th>
                <th className="text-left p-2 font-medium" style={{ color: '#6C767F' }}>
                  Echeance
                </th>
                <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>
                  Capital
                </th>
                <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>
                  Interets
                </th>
                <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>
                  Total
                </th>
                <th className="text-right p-2 font-medium" style={{ color: '#6C767F' }}>
                  CRD
                </th>
                <th className="text-center p-2 font-medium" style={{ color: '#6C767F' }}>
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => (
                <tr
                  key={entry.number}
                  className={`border-b ${entry.isPaid ? 'bg-green-50' : ''}`}
                  style={{ borderColor: '#F2F2F3' }}
                >
                  <td className="p-2" style={{ color: '#141A1F' }}>
                    {entry.number}
                  </td>
                  <td className="p-2" style={{ color: '#141A1F' }}>
                    {formatDate(entry.dueDate)}
                  </td>
                  <td className="p-2 text-right" style={{ color: '#141A1F' }}>
                    {formatCurrency(entry.principal)}
                  </td>
                  <td className="p-2 text-right" style={{ color: '#141A1F' }}>
                    {formatCurrency(entry.interest)}
                  </td>
                  <td className="p-2 text-right font-medium" style={{ color: '#141A1F' }}>
                    {formatCurrency(entry.total)}
                  </td>
                  <td className="p-2 text-right" style={{ color: '#6C767F' }}>
                    {formatCurrency(entry.remainingPrincipal)}
                  </td>
                  <td className="p-2 text-center">
                    {entry.isPaid ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Paye
                      </span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                      >
                        A payer
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Modal enregistrement paiement
function RecordPaymentModal({
  isOpen,
  onClose,
  loan,
  nextPayment,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean
  onClose: () => void
  loan: Loan | null
  nextPayment: LoanPayment | null
  onSubmit: (loanId: string, date: string, amount: number) => Promise<void>
  isSubmitting: boolean
}) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState(0)

  useEffect(() => {
    if (nextPayment) {
      setAmount(nextPayment.total_amount)
    }
  }, [nextPayment])

  if (!isOpen || !loan || !nextPayment) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(loan.id, paymentDate, amount)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
              Enregistrer un paiement
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium" style={{ color: '#141A1F' }}>
              {loan.name}
            </p>
            <p className="text-xs" style={{ color: '#6C767F' }}>
              {loan.lender}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p style={{ color: '#6C767F' }}>Echeance prevue</p>
                <p className="font-medium" style={{ color: '#141A1F' }}>
                  {formatDate(nextPayment.due_date)}
                </p>
              </div>
              <div>
                <p style={{ color: '#6C767F' }}>Montant prevu</p>
                <p className="font-medium" style={{ color: '#141A1F' }}>
                  {formatCurrency(nextPayment.total_amount)}
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4 text-xs" style={{ color: '#6C767F' }}>
              <div>Capital: {formatCurrency(nextPayment.principal_amount)}</div>
              <div>Interets: {formatCurrency(nextPayment.interest_amount)}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
              Date du paiement *
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#141A1F' }}>
              Montant paye *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-sm" style={{ color: '#1E40AF' }}>
            <p className="font-medium">Ecritures generees :</p>
            <ul className="mt-1 space-y-1 text-xs">
              <li>Debit {loan.account_code_loan} (capital): {formatCurrency(nextPayment.principal_amount)}</li>
              <li>Debit {loan.account_code_interest} (interets): {formatCurrency(nextPayment.interest_amount)}</li>
              <li>Credit 512 (banque): {formatCurrency(amount)}</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E4E5E7' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm font-medium"
              style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ Composant principal ============

interface EmpruntsPageProps {
  onNavigate?: (page: string) => void
}

export default function EmpruntsPage({ onNavigate: _onNavigate }: EmpruntsPageProps) {
  // Etats
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<LoanSummary | null>(null)
  const [upcomingPayments, setUpcomingPayments] = useState<LoanPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtres
  const [filters, setFilters] = useState<LoanFilters>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAmortizationModal, setShowAmortizationModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Selection
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<
    (LoanAmortizationEntry & { isPaid: boolean; paymentDate?: string })[]
  >([])
  const [nextPayment, setNextPayment] = useState<LoanPayment | null>(null)

  // Onglet actif
  const [activeTab, setActiveTab] = useState<'list' | 'upcoming'>('list')

  // Chargement des donnees
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [loansData, summaryData, upcomingData] = await Promise.all([
        listLoans(filters),
        getLoanSummary(),
        getUpcomingPayments(90),
      ])

      setLoans(loansData)
      setSummary(summaryData)
      setUpcomingPayments(upcomingData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Error loading loans data:', message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtrage local
  const filteredLoans = useMemo(() => {
    if (!searchTerm) return loans
    const term = searchTerm.toLowerCase()
    return loans.filter(
      (loan) =>
        loan.name.toLowerCase().includes(term) ||
        loan.lender.toLowerCase().includes(term) ||
        (loan.reference && loan.reference.toLowerCase().includes(term))
    )
  }, [loans, searchTerm])

  // Handlers
  const handleCreateLoan = async (data: LoanFormData) => {
    try {
      setIsSubmitting(true)
      await createLoan(data)
      setShowCreateModal(false)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur creation emprunt'
      console.error('Error creating loan:', message)
      throw new Error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLoan = async (loanId: string) => {
    if (!confirm('Supprimer cet emprunt ? Cette action est irreversible.')) return
    try {
      await deleteLoan(loanId)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur suppression'
      console.error('Error deleting loan:', message)
      alert(message)
    }
  }

  const handleViewAmortization = async (loan: Loan) => {
    try {
      const { schedule } = await getLoanAmortizationTable(loan.id)
      setSelectedLoan(loan)
      setSelectedSchedule(schedule)
      setShowAmortizationModal(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur chargement'
      console.error('Error loading amortization:', message)
      alert(message)
    }
  }

  const handleOpenPaymentModal = async (loan: Loan) => {
    try {
      const payments = await getLoanPayments(loan.id)
      const unpaid = payments.find((p) => !p.is_paid)
      if (!unpaid) {
        alert('Toutes les echeances de cet emprunt sont payees')
        return
      }
      setSelectedLoan(loan)
      setNextPayment(unpaid)
      setShowPaymentModal(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur chargement'
      console.error('Error loading payments:', message)
      alert(message)
    }
  }

  const handleRecordPayment = async (loanId: string, date: string, amount: number) => {
    try {
      setIsSubmitting(true)
      await recordLoanPayment(loanId, date, amount)
      setShowPaymentModal(false)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur enregistrement'
      console.error('Error recording payment:', message)
      throw new Error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p style={{ color: '#6C767F' }}>Chargement des emprunts...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#FAFAFB' }}>
        <div
          className="bg-white rounded-xl p-8 border text-center max-w-md"
          style={{ borderColor: '#E4E5E7' }}
        >
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h3 className="font-semibold mb-2" style={{ color: '#141A1F' }}>
            Erreur de chargement
          </h3>
          <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
            {error}
          </p>
          <button
            onClick={() => loadData()}
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
          <h1 className="text-xl font-semibold" style={{ color: '#141A1F' }}>
            Emprunts
          </h1>
          <span
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: '#D9EFEB', color: '#006666' }}
          >
            {loans.length} emprunt{loans.length > 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
          style={{ backgroundColor: '#006666' }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvel emprunt
        </button>
      </div>

      {/* Summary cards */}
      <SummaryCards summary={summary} />

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-4 border-b" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'list'
              ? 'border-current'
              : 'border-transparent'
          }`}
          style={{ color: activeTab === 'list' ? '#006666' : '#6C767F' }}
        >
          Liste des emprunts
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'upcoming'
              ? 'border-current'
              : 'border-transparent'
          }`}
          style={{ color: activeTab === 'upcoming' ? '#006666' : '#6C767F' }}
        >
          Prochaines echeances
          {upcomingPayments.length > 0 && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
            >
              {upcomingPayments.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'list' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: '#6C767F' }}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>
            <select
              value={filters.loanType || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  loanType: e.target.value ? (e.target.value as LoanType) : undefined,
                })
              }
              className="px-3 py-2 border rounded-lg text-sm bg-white"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option value="">Tous les types</option>
              <option value="bank">Bancaire</option>
              <option value="shareholder">CCA</option>
              <option value="leasing">Credit-bail</option>
            </select>
            <select
              value={filters.status || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value ? (e.target.value as LoanStatus) : undefined,
                })
              }
              className="px-3 py-2 border rounded-lg text-sm bg-white"
              style={{ borderColor: '#D6D9DB' }}
            >
              <option value="">Tous les statuts</option>
              <option value="active">En cours</option>
              <option value="completed">Solde</option>
              <option value="early_repaid">Rembourse</option>
            </select>
          </div>

          {/* Table */}
          <div
            className="bg-white rounded-xl border overflow-hidden"
            style={{ borderColor: '#E4E5E7' }}
          >
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
                  <th
                    className="text-left p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Nom
                  </th>
                  <th
                    className="text-left p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Banque
                  </th>
                  <th
                    className="text-left p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Type
                  </th>
                  <th
                    className="text-right p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Capital
                  </th>
                  <th
                    className="text-right p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Taux
                  </th>
                  <th
                    className="text-center p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Duree
                  </th>
                  <th
                    className="text-right p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Reste du
                  </th>
                  <th
                    className="text-center p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Statut
                  </th>
                  <th
                    className="text-center p-3 text-sm font-medium"
                    style={{ color: '#6C767F' }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center">
                      <p style={{ color: '#6C767F' }}>Aucun emprunt trouve</p>
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => (
                    <tr
                      key={loan.id}
                      className="border-b hover:bg-gray-50"
                      style={{ borderColor: '#F2F2F3' }}
                    >
                      <td className="p-3">
                        <p className="font-medium text-sm" style={{ color: '#141A1F' }}>
                          {loan.name}
                        </p>
                        {loan.reference && (
                          <p className="text-xs" style={{ color: '#6C767F' }}>
                            {loan.reference}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-sm" style={{ color: '#141A1F' }}>
                        {loan.lender}
                      </td>
                      <td className="p-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                        >
                          {getLoanTypeLabel(loan.loan_type)}
                        </span>
                      </td>
                      <td
                        className="p-3 text-sm text-right font-medium"
                        style={{ color: '#141A1F' }}
                      >
                        {formatCurrency(loan.principal_amount)}
                      </td>
                      <td className="p-3 text-sm text-right" style={{ color: '#141A1F' }}>
                        {formatPercent(loan.interest_rate)}
                      </td>
                      <td className="p-3 text-sm text-center" style={{ color: '#6C767F' }}>
                        {loan.duration_months} mois
                      </td>
                      <td
                        className="p-3 text-sm text-right font-medium"
                        style={{ color: loan.remaining_principal > 0 ? '#EF4444' : '#22C55E' }}
                      >
                        {formatCurrency(loan.remaining_principal)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            loan.status === 'active'
                              ? 'bg-blue-100 text-blue-700'
                              : loan.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {getLoanStatusLabel(loan.status)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewAmortization(loan)}
                            className="p-1.5 hover:bg-gray-100 rounded"
                            title="Voir l echeancier"
                          >
                            <svg
                              className="w-4 h-4"
                              style={{ color: '#6C767F' }}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
                              />
                            </svg>
                          </button>
                          {loan.status === 'active' && (
                            <button
                              onClick={() => handleOpenPaymentModal(loan)}
                              className="p-1.5 hover:bg-gray-100 rounded"
                              title="Enregistrer un paiement"
                            >
                              <svg
                                className="w-4 h-4"
                                style={{ color: '#006666' }}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                                />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteLoan(loan.id)}
                            className="p-1.5 hover:bg-red-50 rounded"
                            title="Supprimer"
                          >
                            <svg
                              className="w-4 h-4 text-red-500"
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'upcoming' && (
        <div
          className="bg-white rounded-xl border overflow-hidden"
          style={{ borderColor: '#E4E5E7' }}
        >
          <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
            <h3 className="font-medium" style={{ color: '#141A1F' }}>
              Echeances des 90 prochains jours
            </h3>
          </div>
          {upcomingPayments.length === 0 ? (
            <div className="p-8 text-center">
              <svg
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: '#D6D9DB' }}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
                />
              </svg>
              <p style={{ color: '#6C767F' }}>Aucune echeance a venir</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F2F2F3' }}>
              {upcomingPayments.map((payment) => {
                const loan = (payment as unknown as { loan: Loan }).loan
                const dueDate = new Date(payment.due_date)
                const today = new Date()
                const daysUntil = Math.ceil(
                  (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                )
                const isUrgent = daysUntil <= 7

                return (
                  <div
                    key={payment.id}
                    className={`p-4 flex items-center justify-between ${
                      isUrgent ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isUrgent ? 'bg-red-100' : 'bg-gray-100'
                        }`}
                      >
                        <svg
                          className={`w-5 h-5 ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-sm" style={{ color: '#141A1F' }}>
                          {loan?.name || 'Emprunt'}
                        </p>
                        <p className="text-xs" style={{ color: '#6C767F' }}>
                          {loan?.lender || ''} - {getFrequencyLabel(loan?.payment_frequency || 'monthly')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium" style={{ color: '#141A1F' }}>
                          {formatCurrency(payment.total_amount)}
                        </p>
                        <p className="text-xs" style={{ color: '#6C767F' }}>
                          Capital: {formatCurrency(payment.principal_amount)} | Interets:{' '}
                          {formatCurrency(payment.interest_amount)}
                        </p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p
                          className={`text-sm font-medium ${
                            isUrgent ? 'text-red-600' : ''
                          }`}
                          style={{ color: isUrgent ? undefined : '#141A1F' }}
                        >
                          {formatDate(payment.due_date)}
                        </p>
                        <p
                          className={`text-xs ${isUrgent ? 'text-red-500' : ''}`}
                          style={{ color: isUrgent ? undefined : '#6C767F' }}
                        >
                          {daysUntil === 0
                            ? "Aujourd hui"
                            : daysUntil === 1
                            ? 'Demain'
                            : `Dans ${daysUntil} jours`}
                        </p>
                      </div>
                      <button
                        onClick={() => loan && handleOpenPaymentModal(loan)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                        style={{ backgroundColor: '#006666' }}
                      >
                        Payer
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateLoanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateLoan}
        isSubmitting={isSubmitting}
      />

      <AmortizationModal
        isOpen={showAmortizationModal}
        onClose={() => setShowAmortizationModal(false)}
        loan={selectedLoan}
        schedule={selectedSchedule}
      />

      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        loan={selectedLoan}
        nextPayment={nextPayment}
        onSubmit={handleRecordPayment}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
