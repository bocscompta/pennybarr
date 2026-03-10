import { useState, useEffect, useMemo } from 'react'
import { getAgingReport, type AgingEntry } from '../services/balanceService'

// Format number with French locale
const formatNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

// Format date for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Get today's date in YYYY-MM-DD format
const getTodayISO = () => {
  return new Date().toISOString().split('T')[0]
}

interface BalanceAgeePageProps {
  onNavigate?: (page: string) => void
}

export default function BalanceAgeePage({ onNavigate: _onNavigate }: BalanceAgeePageProps) {
  const [viewType, setViewType] = useState<'customer' | 'supplier'>('customer')
  const [referenceDate, setReferenceDate] = useState(getTodayISO())
  const [agingData, setAgingData] = useState<AgingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Fetch aging data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const data = await getAgingReport(viewType, referenceDate)
        setAgingData(data)
      } catch (err) {
        console.error('Error fetching aging report:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setAgingData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [viewType, referenceDate])

  // Calculate totals
  const totals = useMemo(() => {
    return agingData.reduce((acc, entry) => ({
      notDue: acc.notDue + entry.notDue,
      days0to30: acc.days0to30 + entry.days0to30,
      days30to60: acc.days30to60 + entry.days30to60,
      days60to90: acc.days60to90 + entry.days60to90,
      daysOver90: acc.daysOver90 + entry.daysOver90,
      total: acc.total + entry.total,
    }), {
      notDue: 0,
      days0to30: 0,
      days30to60: 0,
      days60to90: 0,
      daysOver90: 0,
      total: 0,
    })
  }, [agingData])

  // Export handlers
  const handleExportCSV = () => {
    setExporting(true)
    setShowExportDropdown(false)

    try {
      const headers = [
        'Tiers',
        'Non echu',
        '0-30 jours',
        '30-60 jours',
        '60-90 jours',
        '> 90 jours',
        'Total'
      ]

      const rows = agingData.map(entry => [
        entry.thirdPartyName,
        entry.notDue.toFixed(2),
        entry.days0to30.toFixed(2),
        entry.days30to60.toFixed(2),
        entry.days60to90.toFixed(2),
        entry.daysOver90.toFixed(2),
        entry.total.toFixed(2),
      ])

      // Add totals row
      rows.push([
        'TOTAL',
        totals.notDue.toFixed(2),
        totals.days0to30.toFixed(2),
        totals.days30to60.toFixed(2),
        totals.days60to90.toFixed(2),
        totals.daysOver90.toFixed(2),
        totals.total.toFixed(2),
      ])

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n')

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `balance-agee-${viewType === 'customer' ? 'clients' : 'fournisseurs'}-${referenceDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur export CSV:', err)
      alert('Erreur lors de l\'export CSV: ' + (err instanceof Error ? err.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    setShowExportDropdown(false)

    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape' })

      const title = viewType === 'customer' ? 'Balance Agee Clients' : 'Balance Agee Fournisseurs'
      doc.setFontSize(16)
      doc.text(title, 14, 20)

      doc.setFontSize(10)
      doc.text(`Date de reference: ${formatDate(new Date(referenceDate))}`, 14, 28)

      const tableData = agingData.map(entry => [
        entry.thirdPartyName,
        formatNumber(entry.notDue),
        formatNumber(entry.days0to30),
        formatNumber(entry.days30to60),
        formatNumber(entry.days60to90),
        formatNumber(entry.daysOver90),
        formatNumber(entry.total),
      ])

      // Add totals row
      tableData.push([
        'TOTAL',
        formatNumber(totals.notDue),
        formatNumber(totals.days0to30),
        formatNumber(totals.days30to60),
        formatNumber(totals.days60to90),
        formatNumber(totals.daysOver90),
        formatNumber(totals.total),
      ])

      autoTable(doc, {
        startY: 35,
        head: [[
          'Tiers',
          'Non echu',
          '0-30 j',
          '30-60 j',
          '60-90 j',
          '> 90 j',
          'Total'
        ]],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [120, 113, 108] }, // stone-500
        footStyles: { fillColor: [245, 245, 244], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'right', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'right', cellWidth: 30 },
          6: { halign: 'right', cellWidth: 30 },
        },
      })

      doc.save(`balance-agee-${viewType === 'customer' ? 'clients' : 'fournisseurs'}-${referenceDate}.pdf`)
    } catch (err) {
      console.error('Erreur export PDF:', err)
      alert('Erreur lors de l\'export PDF: ' + (err instanceof Error ? err.message : 'Erreur inconnue'))
    } finally {
      setExporting(false)
    }
  }

  // Get cell background color based on aging bucket
  const getCellColor = (bucket: 'notDue' | 'days0to30' | 'days30to60' | 'days60to90' | 'daysOver90', value: number) => {
    if (value === 0) return 'transparent'
    switch (bucket) {
      case 'notDue':
        return '#F5F5F4' // stone-100 (neutral)
      case 'days0to30':
        return '#FEF3C7' // amber-100
      case 'days30to60':
        return '#FFEDD5' // orange-100
      case 'days60to90':
        return '#FEE2E2' // red-100
      case 'daysOver90':
        return '#FECDD3' // rose-200
      default:
        return 'transparent'
    }
  }

  // Get text color based on aging bucket
  const getTextColor = (bucket: 'notDue' | 'days0to30' | 'days30to60' | 'days60to90' | 'daysOver90', value: number) => {
    if (value === 0) return '#D6D9DB'
    switch (bucket) {
      case 'notDue':
        return '#57534E' // stone-600
      case 'days0to30':
        return '#B45309' // amber-700
      case 'days30to60':
        return '#C2410C' // orange-700
      case 'days60to90':
        return '#B91C1C' // red-700
      case 'daysOver90':
        return '#9F1239' // rose-800
      default:
        return '#141A1F'
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>Balance agee</h1>

            {/* View type toggle */}
            <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: '#D6D9DB' }}>
              <button
                onClick={() => setViewType('customer')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  viewType === 'customer'
                    ? 'bg-stone-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Clients
              </button>
              <button
                onClick={() => setViewType('supplier')}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  viewType === 'supplier'
                    ? 'bg-stone-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Fournisseurs
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Reference date picker */}
            <div className="flex items-center gap-2">
              <label className="text-sm" style={{ color: '#6C767F' }}>Date de reference:</label>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting || agingData.length === 0}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
                style={{ borderColor: '#78716C', color: '#78716C' }}
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                Exporter
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50" style={{ borderColor: '#E4E5E7' }}>
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 border-b"
                    style={{ borderColor: '#F2F2F3', color: '#141A1F' }}
                  >
                    <span className="text-lg">PDF</span>
                    PDF (.pdf)
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                    style={{ color: '#141A1F' }}
                  >
                    <span className="text-lg">CSV</span>
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Legend */}
      <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium" style={{ color: '#6C767F' }}>Legende:</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F5F5F4' }} />
              <span className="text-sm" style={{ color: '#57534E' }}>Non echu</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FEF3C7' }} />
              <span className="text-sm" style={{ color: '#B45309' }}>0-30j</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FFEDD5' }} />
              <span className="text-sm" style={{ color: '#C2410C' }}>30-60j</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FEE2E2' }} />
              <span className="text-sm" style={{ color: '#B91C1C' }}>60-90j</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FECDD3' }} />
              <span className="text-sm" style={{ color: '#9F1239' }}>&gt; 90j</span>
            </div>
          </div>
          <div className="flex-1" />
          <span className="text-sm" style={{ color: '#6C767F' }}>
            {agingData.length} tiers
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* Table Header */}
          <div className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
            <div className="grid grid-cols-12 gap-2 px-6 py-3">
              <div className="col-span-4 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                {viewType === 'customer' ? 'Client' : 'Fournisseur'}
              </div>
              <div className="col-span-1 text-xs font-medium uppercase text-right" style={{ color: '#57534E' }}>
                Non echu
              </div>
              <div className="col-span-1 text-xs font-medium uppercase text-right" style={{ color: '#B45309' }}>
                0-30j
              </div>
              <div className="col-span-1 text-xs font-medium uppercase text-right" style={{ color: '#C2410C' }}>
                30-60j
              </div>
              <div className="col-span-1 text-xs font-medium uppercase text-right" style={{ color: '#B91C1C' }}>
                60-90j
              </div>
              <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#9F1239' }}>
                &gt; 90j
              </div>
              <div className="col-span-2 text-xs font-medium uppercase text-right" style={{ color: '#141A1F' }}>
                Total
              </div>
            </div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#78716C' }} />
            </div>
          ) : agingData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-16 h-16 mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium" style={{ color: '#6C767F' }}>
                Aucune facture impayee
              </p>
              <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                {viewType === 'customer'
                  ? 'Tous les clients sont a jour de leurs paiements'
                  : 'Toutes les factures fournisseurs sont reglees'
                }
              </p>
            </div>
          ) : (
            <div>
              {agingData.map((entry, index) => (
                <div
                  key={entry.thirdPartyId || index}
                  className="grid grid-cols-12 gap-2 px-6 py-3 hover:bg-gray-50 border-t"
                  style={{ borderColor: '#F2F2F3' }}
                >
                  <div className="col-span-4">
                    <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                      {entry.thirdPartyName}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: getCellColor('notDue', entry.notDue),
                      color: getTextColor('notDue', entry.notDue)
                    }}
                  >
                    <span className="text-sm font-mono">
                      {entry.notDue > 0 ? formatNumber(entry.notDue) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: getCellColor('days0to30', entry.days0to30),
                      color: getTextColor('days0to30', entry.days0to30)
                    }}
                  >
                    <span className="text-sm font-mono">
                      {entry.days0to30 > 0 ? formatNumber(entry.days0to30) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: getCellColor('days30to60', entry.days30to60),
                      color: getTextColor('days30to60', entry.days30to60)
                    }}
                  >
                    <span className="text-sm font-mono">
                      {entry.days30to60 > 0 ? formatNumber(entry.days30to60) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: getCellColor('days60to90', entry.days60to90),
                      color: getTextColor('days60to90', entry.days60to90)
                    }}
                  >
                    <span className="text-sm font-mono">
                      {entry.days60to90 > 0 ? formatNumber(entry.days60to90) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-2 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: getCellColor('daysOver90', entry.daysOver90),
                      color: getTextColor('daysOver90', entry.daysOver90)
                    }}
                  >
                    <span className="text-sm font-mono">
                      {entry.daysOver90 > 0 ? formatNumber(entry.daysOver90) : '—'}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-mono font-semibold" style={{ color: '#141A1F' }}>
                      {formatNumber(entry.total)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Totals footer */}
              <div className="sticky bottom-0 bg-white border-t-2" style={{ borderColor: '#78716C' }}>
                <div className="grid grid-cols-12 gap-2 px-6 py-4">
                  <div className="col-span-4">
                    <span className="font-semibold" style={{ color: '#141A1F' }}>Total</span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: totals.notDue > 0 ? '#F5F5F4' : 'transparent',
                      color: '#57534E'
                    }}
                  >
                    <span className="text-sm font-mono font-bold">
                      {totals.notDue > 0 ? formatNumber(totals.notDue) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: totals.days0to30 > 0 ? '#FEF3C7' : 'transparent',
                      color: '#B45309'
                    }}
                  >
                    <span className="text-sm font-mono font-bold">
                      {totals.days0to30 > 0 ? formatNumber(totals.days0to30) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: totals.days30to60 > 0 ? '#FFEDD5' : 'transparent',
                      color: '#C2410C'
                    }}
                  >
                    <span className="text-sm font-mono font-bold">
                      {totals.days30to60 > 0 ? formatNumber(totals.days30to60) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-1 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: totals.days60to90 > 0 ? '#FEE2E2' : 'transparent',
                      color: '#B91C1C'
                    }}
                  >
                    <span className="text-sm font-mono font-bold">
                      {totals.days60to90 > 0 ? formatNumber(totals.days60to90) : '—'}
                    </span>
                  </div>
                  <div
                    className="col-span-2 text-right rounded px-2 py-0.5"
                    style={{
                      backgroundColor: totals.daysOver90 > 0 ? '#FECDD3' : 'transparent',
                      color: '#9F1239'
                    }}
                  >
                    <span className="text-sm font-mono font-bold">
                      {totals.daysOver90 > 0 ? formatNumber(totals.daysOver90) : '—'}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-mono font-bold" style={{ color: '#78716C' }}>
                      {formatNumber(totals.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
