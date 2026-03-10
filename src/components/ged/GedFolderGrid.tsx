// GED Folder Grid - Folder cards with actions menu (Pennylane style)
import { useState, useRef, useEffect } from 'react'
import type { GedFolder } from '../../types/database'

interface GedFolderGridProps {
  folders: GedFolder[]
  folderCounts: Map<string, number>
  folderTree: GedFolder[]
  onFolderClick: (folderId: string) => void
  onRenameFolder?: (folderId: string, newName: string) => void
  onDeleteFolder?: (folderId: string) => void
  onMoveFolder?: (folderId: string, targetFolderId: string | null) => void
}

export default function GedFolderGrid({
  folders,
  folderCounts,
  folderTree,
  onFolderClick,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder
}: GedFolderGridProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [moveSearch, setMoveSearch] = useState('')
  const [expandedMoveItems, setExpandedMoveItems] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
        setShowMoveMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (folders.length === 0) return null

  const handleRename = (folderId: string, currentName: string) => {
    const newName = prompt('Nouveau nom du dossier :', currentName)
    if (newName && newName !== currentName && onRenameFolder) {
      onRenameFolder(folderId, newName)
    }
    setOpenMenuId(null)
  }

  const handleDelete = (folderId: string) => {
    if (onDeleteFolder && confirm('Voulez-vous déplacer ce dossier vers la corbeille ?')) {
      onDeleteFolder(folderId)
    }
    setOpenMenuId(null)
  }

  const handleMove = (folderId: string, targetId: string | null) => {
    if (onMoveFolder) {
      onMoveFolder(folderId, targetId)
    }
    setOpenMenuId(null)
    setShowMoveMenu(false)
  }

  const toggleMoveExpand = (id: string) => {
    setExpandedMoveItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatFileCount = (count: number) => {
    return count === 1 ? '1 Fichier' : `${count} Fichiers`
  }

  const renderMoveTreeItem = (folder: GedFolder, depth: number = 0, currentFolderId: string) => {
    const hasChildren = folder.children && folder.children.length > 0
    const isExpanded = expandedMoveItems.has(folder.id)
    const isSelf = folder.id === currentFolderId

    if (isSelf) return null

    return (
      <div key={folder.id}>
        <button
          className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${
            isExpanded ? 'bg-teal-50' : ''
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => hasChildren ? toggleMoveExpand(folder.id) : handleMove(currentFolderId, folder.id)}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <span>{folder.name}</span>
          </div>
          {hasChildren && (
            <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
        </button>
        {isExpanded && hasChildren && folder.children!.map(child => renderMoveTreeItem(child, depth + 1, currentFolderId))}
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-3" style={{ color: '#141A1F' }}>Dossiers</h3>
      <div className="border-t mb-4" style={{ borderColor: '#E4E5E7' }} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map(folder => {
          const count = folderCounts.get(folder.id) ?? 0
          const isMenuOpen = openMenuId === folder.id

          return (
            <div
              key={folder.id}
              className="relative flex items-center gap-4 p-4 bg-white rounded-xl border text-left hover:border-gray-300 transition-colors cursor-pointer"
              style={{ borderColor: '#E4E5E7' }}
              onClick={() => onFolderClick(folder.id)}
            >
              {/* Folder icon - gray */}
              <div className="flex-shrink-0">
                <svg className="w-12 h-12" viewBox="0 0 48 48">
                  <path
                    d="M6 14 L6 38 L42 38 L42 14 L24 14 L21 8 L9 8 L6 14Z"
                    fill="#D6D9DB"
                    stroke="#B0B5B9"
                    strokeWidth="1"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#141A1F' }}>{folder.name}</p>
                <p className="text-xs" style={{ color: '#6C767F' }}>
                  {formatFileCount(count)}
                </p>
              </div>

              {/* Actions button or lock icon */}
              {folder.is_locked ? (
                <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ) : (
                <button
                  className="p-2 rounded-lg border flex-shrink-0 hover:bg-gray-50"
                  style={{ borderColor: '#006666', color: '#006666' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(isMenuOpen ? null : folder.id)
                    setShowMoveMenu(false)
                  }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 12a2 2 0 11-4 0 2 2 0 014 0zM14 12a2 2 0 11-4 0 2 2 0 014 0zM22 12a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>
              )}

              {/* Actions dropdown menu */}
              {isMenuOpen && !showMoveMenu && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border z-50"
                  style={{ borderColor: '#E4E5E7' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2">
                    <p className="px-3 py-2 text-sm font-medium" style={{ color: '#141A1F' }}>Actions</p>

                    {/* Renommer */}
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                      style={{ color: '#141A1F' }}
                      onClick={() => handleRename(folder.id, folder.name)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                      Renommer
                    </button>

                    {/* Déplacer vers la corbeille */}
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                      style={{ color: '#141A1F' }}
                      onClick={() => handleDelete(folder.id)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Déplacer vers la corbeille
                    </button>

                    {/* Déplacer */}
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                      style={{ color: '#141A1F' }}
                      onClick={() => setShowMoveMenu(true)}
                    >
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Déplacer
                      </div>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>

                  {/* Buttons */}
                  <div className="border-t p-3 flex gap-2" style={{ borderColor: '#E4E5E7' }}>
                    <button
                      className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border"
                      style={{ borderColor: '#006666', color: '#006666' }}
                      onClick={() => setOpenMenuId(null)}
                    >
                      Annuler
                    </button>
                    <button
                      className="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white"
                      style={{ backgroundColor: '#006666' }}
                      onClick={() => setShowMoveMenu(true)}
                    >
                      Déplacer
                    </button>
                  </div>
                </div>
              )}

              {/* Move submenu */}
              {isMenuOpen && showMoveMenu && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border z-50"
                  style={{ borderColor: '#E4E5E7' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2">
                    {/* Back button */}
                    <button
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-gray-50 rounded-lg w-full"
                      style={{ color: '#141A1F' }}
                      onClick={() => setShowMoveMenu(false)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                      Déplacer
                    </button>

                    {/* Search */}
                    <div className="relative px-2 py-2">
                      <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Rechercher un dossier"
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                        style={{ borderColor: '#D6D9DB' }}
                        value={moveSearch}
                        onChange={(e) => setMoveSearch(e.target.value)}
                      />
                    </div>

                    {/* Documents à classer */}
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => handleMove(folder.id, null)}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.108c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 0111.048 0c1.131.094 1.976 1.057 1.976 2.192V13.5m-17.5 0v6.25c0 1.242 1.008 2.25 2.25 2.25h13.5c1.242 0 2.25-1.008 2.25-2.25V13.5" />
                        </svg>
                        <span>Documents à classer</span>
                      </div>
                      <svg className="w-4 h-4" style={{ color: '#6C767F' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>

                    {/* Folder tree */}
                    <div className="max-h-48 overflow-y-auto">
                      {folderTree.map(f => renderMoveTreeItem(f, 0, folder.id))}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="border-t p-3 flex gap-2" style={{ borderColor: '#E4E5E7' }}>
                    <button
                      className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border"
                      style={{ borderColor: '#006666', color: '#006666' }}
                      onClick={() => {
                        setOpenMenuId(null)
                        setShowMoveMenu(false)
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      className="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white"
                      style={{ backgroundColor: '#006666' }}
                      onClick={() => handleMove(folder.id, null)}
                    >
                      Déplacer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
