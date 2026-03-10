// GED File Table - Document list matching Pennylane design
import { useState } from 'react'
import type { GedDocument } from '../../types/database'
import { formatFileSize, formatDateFR } from '../../services/gedService'

interface GedFileTableProps {
  documents: GedDocument[]
  onDelete: (ids: string[]) => void
  onDownload: (doc: GedDocument) => void
  onMove: (ids: string[]) => void
}

export default function GedFileTable({ documents, onDelete, onDownload, onMove }: GedFileTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [sortAsc, setSortAsc] = useState(true)

  const filteredDocs = documents
    .filter(d => !searchFilter || d.name.toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => sortAsc
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name)
    )

  const toggleAll = () => {
    if (selectedIds.size === filteredDocs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredDocs.map(d => d.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'pdf'
    if (mimeType.includes('image')) return 'img'
    return 'file'
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Nom du fichier"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          Utilisateurs
        </button>
        <button className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#D6D9DB', color: '#141A1F' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          Date d'ajout
        </button>

        <div className="flex-1" />

        {/* Action buttons */}
        <button
          className="p-2 rounded-lg border"
          style={{ borderColor: selectedIds.size > 0 ? '#FCA5A5' : '#E4E5E7', color: selectedIds.size > 0 ? '#DC2626' : '#D6D9DB' }}
          disabled={selectedIds.size === 0}
          onClick={() => onDelete(Array.from(selectedIds))}
          title="Supprimer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
        <button
          className="p-2 rounded-lg border"
          style={{ borderColor: selectedIds.size > 0 ? '#D6D9DB' : '#E4E5E7', color: selectedIds.size > 0 ? '#141A1F' : '#D6D9DB' }}
          disabled={selectedIds.size === 0}
          title="Télécharger"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: selectedIds.size > 0 ? '#D6D9DB' : '#E4E5E7', color: selectedIds.size > 0 ? '#141A1F' : '#D6D9DB' }}
          disabled={selectedIds.size === 0}
          onClick={() => onMove(Array.from(selectedIds))}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          Déplacer
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E5E7' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#E4E5E7' }}>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={filteredDocs.length > 0 && selectedIds.size === filteredDocs.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="w-10" />
              <th
                className="text-left px-4 py-3 text-sm font-medium cursor-pointer select-none"
                style={{ color: '#6C767F' }}
                onClick={() => setSortAsc(!sortAsc)}
              >
                <div className="flex items-center gap-1">
                  Nom
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                  </svg>
                </div>
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: '#6C767F' }}>Ajouté par</th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: '#6C767F' }}>Date d'ajout</th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: '#6C767F' }}>Poids</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map(doc => (
              <tr
                key={doc.id}
                className="border-b hover:bg-gray-50"
                style={{ borderColor: '#F2F2F3' }}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleOne(doc.id)}
                  />
                </td>
                <td className="py-3">
                  {/* File type icon */}
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: '#F2F2F3' }}>
                    {getFileIcon(doc.mime_type) === 'pdf' ? (
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm truncate block max-w-xs" style={{ color: '#141A1F' }} title={doc.name}>
                    {doc.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                      style={{ backgroundColor: '#006666' }}
                    >
                      {getInitials(doc.added_by_name)}
                    </div>
                    <span className="text-sm" style={{ color: '#141A1F' }}>{doc.added_by_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: '#141A1F' }}>{formatDateFR(doc.created_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: '#141A1F' }}>{formatFileSize(doc.file_size)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 rounded hover:bg-gray-100"
                      onClick={() => onDownload(doc)}
                      title="Télécharger"
                    >
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-gray-100"
                      onClick={() => window.open(doc.file_path, '_blank')}
                      title="Ouvrir"
                    >
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredDocs.length === 0 && (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4" style={{ color: '#D6D9DB' }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h3 className="font-medium mb-2" style={{ color: '#141A1F' }}>Aucun document</h3>
            <p className="text-sm" style={{ color: '#6C767F' }}>
              Déposez vos premiers documents pour commencer
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
