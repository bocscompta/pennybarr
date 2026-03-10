import type { InvoiceTotals } from '../../types/invoiceForm'

interface InvoiceTotalsBlockProps {
  totals: InvoiceTotals
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

export default function InvoiceTotalsBlock({ totals }: InvoiceTotalsBlockProps) {
  return (
    <div>
      {/* VAT breakdown */}
      {totals.vatBreakdown.length > 0 && (
        <div className="mb-2">
          {totals.vatBreakdown.map((vat) => (
            <div key={vat.rate} className="flex justify-between text-xs text-gray-500 py-0.5">
              <span>TVA {vat.rate}%</span>
              <span>{formatCurrency(vat.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="border-t border-gray-200 pt-2 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total HT</span>
          <span className="text-gray-900">{formatCurrency(totals.totalHT)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total TVA</span>
          <span className="text-gray-900">{formatCurrency(totals.totalVAT)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200">
          <span className="text-gray-900">Total TTC</span>
          <span className="text-gray-900">{formatCurrency(totals.totalTTC)}</span>
        </div>
      </div>
    </div>
  )
}
