// GED (Gestion Electronique de Documents) Service
// CRUD for folders and documents, Supabase Storage integration

import { supabase, COMPANY_ID } from '../lib/supabase'
import type { GedFolder, GedDocument } from '../types/database'

const GED_BUCKET = 'invoice-documents'
const GED_STORAGE_PREFIX = `${COMPANY_ID}/ged`

// ============ Folders ============

export async function listRootFolders(): Promise<GedFolder[]> {
  const { data, error } = await supabase
    .from('ged_folders')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .is('parent_id', null)
    .order('sort_order')

  if (error) throw new Error(`Erreur chargement dossiers racine: ${error.message}`)
  return data as GedFolder[]
}

export async function listSubfolders(parentId: string): Promise<GedFolder[]> {
  const { data, error } = await supabase
    .from('ged_folders')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('parent_id', parentId)
    .order('sort_order')
    .order('name')

  if (error) throw new Error(`Erreur chargement sous-dossiers: ${error.message}`)
  return data as GedFolder[]
}

export async function getFolderTree(): Promise<GedFolder[]> {
  const { data, error } = await supabase
    .from('ged_folders')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('sort_order')
    .order('name')

  if (error) throw new Error(`Erreur chargement arborescence: ${error.message}`)

  const folders = data as GedFolder[]
  const rootFolders = folders.filter(f => !f.parent_id)

  function buildTree(parent: GedFolder): GedFolder {
    const children = folders
      .filter(f => f.parent_id === parent.id)
      .map(f => buildTree(f))
    return { ...parent, children }
  }

  return rootFolders.map(f => buildTree(f))
}

export async function getBreadcrumb(folderId: string): Promise<GedFolder[]> {
  // Walk up from folder to root
  const breadcrumb: GedFolder[] = []
  let currentId: string | null = folderId

  while (currentId) {
    const { data, error } = await supabase
      .from('ged_folders')
      .select('*')
      .eq('id', currentId)
      .single()

    if (error) throw new Error(`Erreur chargement dossier: ${error.message}`)
    const folder = data as GedFolder
    breadcrumb.unshift(folder)
    currentId = folder.parent_id
  }

  return breadcrumb
}

export async function createFolder(parentId: string | null, name: string): Promise<GedFolder> {
  const { data, error } = await supabase
    .from('ged_folders')
    .insert({
      company_id: COMPANY_ID,
      parent_id: parentId,
      name,
      folder_type: 'user',
      is_locked: false,
      sort_order: 0,
    })
    .select()
    .single()

  if (error) throw new Error(`Erreur création dossier: ${error.message}`)
  return data as GedFolder
}

export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('ged_folders')
    .delete()
    .eq('id', folderId)

  if (error) throw new Error(`Erreur suppression dossier: ${error.message}`)
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('ged_folders')
    .update({ name: newName })
    .eq('id', folderId)

  if (error) throw new Error(`Erreur renommage dossier: ${error.message}`)
}

export async function moveFolder(folderId: string, targetParentId: string | null): Promise<void> {
  const { error } = await supabase
    .from('ged_folders')
    .update({ parent_id: targetParentId })
    .eq('id', folderId)

  if (error) throw new Error(`Erreur déplacement dossier: ${error.message}`)
}

// ============ Documents ============

export async function listDocuments(
  folderId: string | null,
  options?: { search?: string; isDeleted?: boolean }
): Promise<GedDocument[]> {
  let query = supabase
    .from('ged_documents')
    .select('*')
    .eq('company_id', COMPANY_ID)

  if (options?.isDeleted) {
    query = query.eq('is_deleted', true)
  } else {
    query = query.eq('is_deleted', false)
    if (folderId === null) {
      query = query.is('folder_id', null)
    } else {
      query = query.eq('folder_id', folderId)
    }
  }

  if (options?.search) {
    query = query.ilike('name', `%${options.search}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur chargement documents: ${error.message}`)
  return data as GedDocument[]
}

export async function getDocumentCount(folderId: string | null): Promise<number> {
  let query = supabase
    .from('ged_documents')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('is_deleted', false)

  if (folderId === null) {
    query = query.is('folder_id', null)
  } else {
    query = query.eq('folder_id', folderId)
  }

  const { count, error } = await query
  if (error) throw new Error(`Erreur comptage documents: ${error.message}`)
  return count ?? 0
}

export async function getFolderDocumentCount(folderId: string): Promise<number> {
  // Count docs in this folder AND all subfolders (recursive)
  // For simplicity, count direct children only + subfolder counts
  const { data: subfolders } = await supabase
    .from('ged_folders')
    .select('id')
    .eq('parent_id', folderId)

  let total = await getDocumentCount(folderId)

  if (subfolders) {
    for (const sub of subfolders) {
      total += await getFolderDocumentCount(sub.id)
    }
  }

  return total
}

export async function uploadDocument(
  folderId: string | null,
  file: File,
  addedByName: string = 'Utilisateur'
): Promise<GedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const timestamp = Date.now()
  const storagePath = `${GED_STORAGE_PREFIX}/${timestamp}_${file.name}`

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from(GED_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/pdf',
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw new Error(`Erreur upload fichier: ${uploadError.message}`)

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(GED_BUCKET)
    .getPublicUrl(storagePath)

  // Insert DB record
  const { data, error } = await supabase
    .from('ged_documents')
    .insert({
      company_id: COMPANY_ID,
      folder_id: folderId,
      name: file.name,
      file_path: urlData.publicUrl,
      file_size: file.size,
      mime_type: file.type || `application/${ext}`,
      added_by_name: addedByName,
    })
    .select()
    .single()

  if (error) throw new Error(`Erreur insertion document: ${error.message}`)
  return data as GedDocument
}

export async function softDeleteDocument(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('ged_documents')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', documentId)

  if (error) throw new Error(`Erreur suppression document: ${error.message}`)
}

export async function restoreDocument(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('ged_documents')
    .update({ is_deleted: false, deleted_at: null })
    .eq('id', documentId)

  if (error) throw new Error(`Erreur restauration document: ${error.message}`)
}

export async function moveDocument(documentId: string, targetFolderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('ged_documents')
    .update({ folder_id: targetFolderId })
    .eq('id', documentId)

  if (error) throw new Error(`Erreur déplacement document: ${error.message}`)
}

export async function searchDocuments(query: string): Promise<GedDocument[]> {
  return listDocuments(null, { search: query })
}

// ============ Helpers ============

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  const ko = bytes / 1024
  if (ko < 1024) return `${ko.toFixed(1).replace('.', ',')} ko`
  const mo = ko / 1024
  return `${mo.toFixed(1).replace('.', ',')} Mo`
}

export function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
