// GED Breadcrumb - Navigation path (e.g. "Dossier annuel > Exercice 2024-2025 > ...")
import type { GedFolder } from '../../types/database'

interface GedBreadcrumbProps {
  breadcrumb: GedFolder[]
  onNavigate: (folderId: string) => void
}

export default function GedBreadcrumb({ breadcrumb, onNavigate }: GedBreadcrumbProps) {
  if (breadcrumb.length === 0) return null

  return (
    <div className="flex items-center gap-2 mb-4 text-sm flex-wrap" style={{ color: '#141A1F' }}>
      {breadcrumb.map((folder, index) => (
        <div key={folder.id} className="flex items-center gap-2">
          {index > 0 && (
            <svg className="w-3 h-3" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          <button
            className="hover:underline font-medium"
            style={{ color: '#141A1F' }}
            onClick={() => onNavigate(folder.id)}
          >
            {folder.name}
          </button>
        </div>
      ))}
      {/* Trailing arrow */}
      <svg className="w-3 h-3" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  )
}
