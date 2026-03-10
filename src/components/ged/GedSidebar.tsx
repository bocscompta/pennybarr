// GED Sidebar - Navigation with folders tree
import { useState, useRef, useEffect } from 'react'
import type { GedFolder } from '../../types/database'

export type GedView = 'a_classer' | 'demandes' | 'corbeille' | { folderId: string }

interface GedSidebarProps {
  currentView: GedView
  onViewChange: (view: GedView) => void
  folderTree: GedFolder[]
  unfiledCount: number
  onCreateFolder: (parentId: string | null) => void
  onUploadFiles: () => void
}

export default function GedSidebar({
  currentView,
  onViewChange,
  folderTree,
  unfiledCount,
  onCreateFolder,
  onUploadFiles,
}: GedSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const isActive = (view: GedView): boolean => {
    if (typeof currentView === 'string' && typeof view === 'string') return currentView === view
    if (typeof currentView === 'object' && typeof view === 'object') return currentView.folderId === view.folderId
    return false
  }

  const navItemClass = (view: GedView) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer ${
      isActive(view) ? 'font-medium' : ''
    }`

  const navItemStyle = (view: GedView) => ({
    backgroundColor: isActive(view) ? '#D9EFEB' : 'transparent',
    color: isActive(view) ? '#006666' : '#141A1F',
  })

  function renderFolderTree(folders: GedFolder[], depth: number = 0) {
    return folders.map(folder => {
      const isExpanded = expandedFolders.has(folder.id)
      const hasChildren = folder.children && folder.children.length > 0
      const isFolderActive = typeof currentView === 'object' && currentView.folderId === folder.id

      return (
        <div key={folder.id} style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
          <button
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
              isFolderActive ? 'font-medium' : ''
            }`}
            style={{
              backgroundColor: isFolderActive ? '#D9EFEB' : 'transparent',
              color: isFolderActive ? '#006666' : '#141A1F',
            }}
            onClick={() => {
              onViewChange({ folderId: folder.id })
              if (hasChildren) toggleExpand(folder.id)
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {hasChildren ? (
                <svg
                  className="w-3 h-3 flex-shrink-0 transition-transform"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', color: '#6C767F' }}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              ) : (
                <span className="w-3 flex-shrink-0" />
              )}
              {/* Folder icon */}
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <span className="truncate">{folder.name}</span>
            </div>
            {folder.is_locked && (
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </button>
          {isExpanded && hasChildren && renderFolderTree(folder.children!, depth + 1)}
        </div>
      )
    })
  }

  return (
    <aside className="w-64 bg-white border-r flex flex-col flex-shrink-0" style={{ borderColor: '#E4E5E7' }}>
      <div className="p-4 flex flex-col h-full overflow-y-auto">
        {/* Add button with dropdown */}
        <div className="relative mb-4" ref={menuRef}>
          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#006666' }}
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter
          </button>
          {showAddMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-20" style={{ borderColor: '#E4E5E7' }}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 rounded-t-lg"
                style={{ color: '#141A1F' }}
                onClick={() => {
                  setShowAddMenu(false)
                  const parentId = typeof currentView === 'object' ? currentView.folderId : null
                  onCreateFolder(parentId)
                }}
              >
                {/* Folder+ icon */}
                <svg className="w-5 h-5" style={{ color: '#006666' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                Ajouter un dossier
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 rounded-b-lg"
                style={{ color: '#141A1F' }}
                onClick={() => {
                  setShowAddMenu(false)
                  onUploadFiles()
                }}
              >
                <svg className="w-5 h-5" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Ajouter des fichiers
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un document..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: '#D6D9DB' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Nav items */}
        <nav className="space-y-1">
          {/* Documents à classer */}
          <button
            className={navItemClass('a_classer')}
            style={navItemStyle('a_classer')}
            onClick={() => onViewChange('a_classer')}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.108c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 0111.048 0c1.131.094 1.976 1.057 1.976 2.192V13.5m-17.5 0v6.25c0 1.242 1.008 2.25 2.25 2.25h13.5c1.242 0 2.25-1.008 2.25-2.25V13.5" />
              </svg>
              <span>Documents à classer</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#D9EFEB', color: '#006666' }}>
              {unfiledCount}
            </span>
          </button>

          {/* Documents demandés */}
          <button
            className={navItemClass('demandes')}
            style={navItemStyle('demandes')}
            onClick={() => onViewChange('demandes')}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>Documents demandés</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#F2F2F3', color: '#6C767F' }}>
              0
            </span>
          </button>

          {/* Corbeille */}
          <button
            className={navItemClass('corbeille')}
            style={navItemStyle('corbeille')}
            onClick={() => onViewChange('corbeille')}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span>Corbeille</span>
            </div>
          </button>
        </nav>

        {/* Folder tree */}
        <div className="mt-6 space-y-0">
          {renderFolderTree(folderTree)}
        </div>
      </div>
    </aside>
  )
}
