// DocumentsPage - GED (Gestion Electronique de Documents)
// Reproduces the Pennylane GED interface exactly

import { useState, useEffect, useCallback, useRef } from 'react'
import GedSidebar, { type GedView } from '../components/ged/GedSidebar'
import GedDropZone from '../components/ged/GedDropZone'
import GedFileTable from '../components/ged/GedFileTable'
import GedFolderGrid from '../components/ged/GedFolderGrid'
import GedBreadcrumb from '../components/ged/GedBreadcrumb'
import type { GedFolder, GedDocument } from '../types/database'
import {
  getFolderTree,
  listDocuments,
  listSubfolders,
  getDocumentCount,
  getFolderDocumentCount,
  getBreadcrumb,
  uploadDocument,
  softDeleteDocument,
  createFolder,
  renameFolder,
  deleteFolder,
  moveFolder,
} from '../services/gedService'

export default function DocumentsPage() {
  const [currentView, setCurrentView] = useState<GedView>('a_classer')
  const [folderTree, setFolderTree] = useState<GedFolder[]>([])
  const [documents, setDocuments] = useState<GedDocument[]>([])
  const [subfolders, setSubfolders] = useState<GedFolder[]>([])
  const [breadcrumb, setBreadcrumb] = useState<GedFolder[]>([])
  const [unfiledCount, setUnfiledCount] = useState(0)
  const [folderCounts, setFolderCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load folder tree + unfiled count
  const loadTree = useCallback(async () => {
    try {
      const [tree, count] = await Promise.all([
        getFolderTree(),
        getDocumentCount(null),
      ])
      setFolderTree(tree)
      setUnfiledCount(count)
    } catch (err) {
      console.error('[GED] Failed to load tree:', err)
    }
  }, [])

  // Load content for current view
  const loadContent = useCallback(async () => {
    setLoading(true)
    try {
      if (currentView === 'a_classer') {
        const docs = await listDocuments(null)
        setDocuments(docs)
        setSubfolders([])
        setBreadcrumb([])
      } else if (currentView === 'demandes') {
        setDocuments([])
        setSubfolders([])
        setBreadcrumb([])
      } else if (currentView === 'corbeille') {
        const docs = await listDocuments(null, { isDeleted: true })
        setDocuments(docs)
        setSubfolders([])
        setBreadcrumb([])
      } else {
        // Folder view
        const folderId = currentView.folderId
        const [docs, subs, bc] = await Promise.all([
          listDocuments(folderId),
          listSubfolders(folderId),
          getBreadcrumb(folderId),
        ])
        setDocuments(docs)
        setSubfolders(subs)
        setBreadcrumb(bc)

        // Load counts for subfolders
        const counts = new Map<string, number>()
        for (const sub of subs) {
          const count = await getFolderDocumentCount(sub.id)
          counts.set(sub.id, count)
        }
        setFolderCounts(counts)
      }
    } catch (err) {
      console.error('[GED] Failed to load content:', err)
    } finally {
      setLoading(false)
    }
  }, [currentView])

  useEffect(() => { loadTree() }, [loadTree])
  useEffect(() => { loadContent() }, [loadContent])

  const handleViewChange = (view: GedView) => {
    setCurrentView(view)
  }

  const handleUploadFiles = async (files: FileList) => {
    const targetFolderId = typeof currentView === 'object' ? currentView.folderId : null
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadDocument(targetFolderId, files[i])
      } catch (err) {
        console.error(`[GED] Upload failed for ${files[i].name}:`, err)
      }
    }
    await Promise.all([loadTree(), loadContent()])
  }

  const handleDelete = async (ids: string[]) => {
    for (const id of ids) {
      try {
        await softDeleteDocument(id)
      } catch (err) {
        console.error('[GED] Delete failed:', err)
      }
    }
    await Promise.all([loadTree(), loadContent()])
  }

  const handleDownload = (doc: GedDocument) => {
    const link = document.createElement('a')
    link.href = doc.file_path
    link.download = doc.name
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCreateFolder = async (parentId: string | null) => {
    const name = prompt('Nom du dossier :')
    if (!name) return
    try {
      await createFolder(parentId, name)
      await Promise.all([loadTree(), loadContent()])
    } catch (err) {
      console.error('[GED] Create folder failed:', err)
    }
  }

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await renameFolder(folderId, newName)
      await Promise.all([loadTree(), loadContent()])
    } catch (err) {
      console.error('[GED] Rename folder failed:', err)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId)
      await Promise.all([loadTree(), loadContent()])
    } catch (err) {
      console.error('[GED] Delete folder failed:', err)
    }
  }

  const handleMoveFolder = async (folderId: string, targetParentId: string | null) => {
    try {
      await moveFolder(folderId, targetParentId)
      await Promise.all([loadTree(), loadContent()])
    } catch (err) {
      console.error('[GED] Move folder failed:', err)
    }
  }

  const handleTriggerUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
      e.target.value = ''
    }
  }

  // View title
  const getViewTitle = (): string => {
    if (currentView === 'a_classer') return 'Documents à classer'
    if (currentView === 'demandes') return 'Documents demandés'
    if (currentView === 'corbeille') return 'Corbeille'
    return ''
  }

  // Whether to show the drop zone
  const showDropZone = currentView === 'a_classer'
    || (typeof currentView === 'object')

  // Whether to show file table
  const showFileTable = currentView === 'a_classer'
    || currentView === 'corbeille'
    || (typeof currentView === 'object' && subfolders.length === 0)
    || (typeof currentView === 'object' && documents.length > 0)

  // Whether to show folder grid
  const showFolderGrid = currentView === 'corbeille'
    || (typeof currentView === 'object' && subfolders.length > 0)

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Hidden file input for sidebar "Ajouter des fichiers" */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <GedSidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        folderTree={folderTree}
        unfiledCount={unfiledCount}
        onCreateFolder={handleCreateFolder}
        onUploadFiles={handleTriggerUpload}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFB' }}>
        {/* Title or breadcrumb */}
        {typeof currentView === 'object' && breadcrumb.length > 0 ? (
          <GedBreadcrumb
            breadcrumb={breadcrumb}
            onNavigate={(folderId) => setCurrentView({ folderId })}
          />
        ) : (
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#141A1F' }}>
            {getViewTitle()}
          </h2>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#006666' }} />
          </div>
        ) : (
          <>
            {/* Documents demandés - empty state */}
            {currentView === 'demandes' && (
              <div className="flex flex-col items-center justify-center py-20">
                <svg className="w-40 h-40 mb-6" viewBox="0 0 160 160">
                  {/* Green blobs */}
                  <ellipse cx="85" cy="130" rx="40" ry="14" fill="#A7E8BD" opacity="0.6" />
                  <ellipse cx="110" cy="122" rx="22" ry="12" fill="#6FD89C" opacity="0.5" />
                  {/* Folder with documents */}
                  <path d="M30 50 L30 120 L130 120 L130 50 L80 50 L73 36 L37 36 L30 50Z" fill="#E4E5E7" stroke="#B0B5B9" strokeWidth="1.5" />
                  <rect x="50" y="60" width="60" height="48" rx="3" fill="white" stroke="#B0B5B9" strokeWidth="1" />
                  <line x1="58" y1="72" x2="102" y2="72" stroke="#D6D9DB" strokeWidth="1.5" />
                  <line x1="58" y1="82" x2="95" y2="82" stroke="#D6D9DB" strokeWidth="1.5" />
                  <line x1="58" y1="92" x2="88" y2="92" stroke="#D6D9DB" strokeWidth="1.5" />
                  {/* Checkmark */}
                  <circle cx="115" cy="55" r="12" fill="#006666" />
                  <path d="M109 55 L113 59 L121 50" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#141A1F' }}>
                  Aucun document demandé
                </h3>
                <p className="text-sm text-center max-w-sm" style={{ color: '#6C767F' }}>
                  Votre cabinet n'a pas de nouvelle demande de document. Vous êtes à jour.
                </p>
              </div>
            )}

            {/* Drop zone */}
            {showDropZone && currentView !== 'demandes' && (
              <GedDropZone onUpload={handleUploadFiles} />
            )}

            {/* Folder grid */}
            {showFolderGrid && currentView !== 'demandes' && (
              <div className="mb-6">
                <GedFolderGrid
                  folders={typeof currentView === 'object' ? subfolders : []}
                  folderCounts={folderCounts}
                  folderTree={folderTree}
                  onFolderClick={(folderId) => setCurrentView({ folderId })}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onMoveFolder={handleMoveFolder}
                />
              </div>
            )}

            {/* File table */}
            {showFileTable && currentView !== 'demandes' && (
              <GedFileTable
                documents={documents}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onMove={() => {}}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
