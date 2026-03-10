import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Package,
  Briefcase,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  AlertTriangle,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  X,
  Folder,
  Archive,
} from 'lucide-react'
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory,
  deleteCategory,
  getLowStockProducts,
} from '../services/produitsService'
import type { Product, ProductCategory, ProductFormData } from '../types/commercial'

// ============ MAIN PAGE COMPONENT ============

interface ProduitsServicesPageProps {
  onNavigate?: (page: string) => void
}

export default function ProduitsServicesPage({ onNavigate: _onNavigate }: ProduitsServicesPageProps) {
  // Data state
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [showLowStock, setShowLowStock] = useState(false)

  // UI state
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [actionMenuProduct, setActionMenuProduct] = useState<string | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [productsData, categoriesData, lowStockData] = await Promise.all([
        listProducts({ isActive: true }),
        listCategories(),
        getLowStockProducts(),
      ])
      setProducts(productsData)
      setCategories(categoriesData)
      setLowStockProducts(lowStockData)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered products
  const filteredProducts = useMemo(() => {
    let result = showLowStock ? lowStockProducts : products

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(p => p.type === typeFilter)
    }

    // Category filter
    if (selectedCategoryId) {
      result = result.filter(p => p.category_id === selectedCategoryId)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        p =>
          p.code.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      )
    }

    return result
  }, [products, lowStockProducts, typeFilter, selectedCategoryId, searchQuery, showLowStock])

  // Stats
  const stats = useMemo(() => {
    const productCount = products.filter(p => p.type === 'product').length
    const serviceCount = products.filter(p => p.type === 'service').length
    const lowStockCount = lowStockProducts.length

    return { productCount, serviceCount, lowStockCount, totalCount: products.length }
  }, [products, lowStockProducts])

  // Handlers
  const handleCreateProduct = async (data: ProductFormData) => {
    try {
      const newProduct = await createProduct(data)
      setProducts(prev => [...prev, newProduct])
      setShowProductModal(false)
      if (newProduct.type === 'product' && newProduct.track_stock) {
        const newLowStock = await getLowStockProducts()
        setLowStockProducts(newLowStock)
      }
    } catch (err) {
      console.error('Error creating product:', err)
      throw err
    }
  }

  const handleUpdateProduct = async (data: ProductFormData) => {
    if (!editingProduct) return
    try {
      const updated = await updateProduct(editingProduct.id, data)
      setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      setEditingProduct(null)
      const newLowStock = await getLowStockProducts()
      setLowStockProducts(newLowStock)
    } catch (err) {
      console.error('Error updating product:', err)
      throw err
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Supprimer ce produit ?')) return
    try {
      await deleteProduct(productId)
      setProducts(prev => prev.filter(p => p.id !== productId))
      setLowStockProducts(prev => prev.filter(p => p.id !== productId))
      setActionMenuProduct(null)
    } catch (err) {
      console.error('Error deleting product:', err)
      alert(err instanceof Error ? err.message : 'Erreur de suppression')
    }
  }

  const handleCreateCategory = async (name: string, parentId?: string) => {
    try {
      const newCategory = await createCategory(name, parentId)
      // Refresh categories to get proper hierarchy
      const updatedCategories = await listCategories()
      setCategories(updatedCategories)
      setShowCategoryModal(false)
      return newCategory
    } catch (err) {
      console.error('Error creating category:', err)
      throw err
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Supprimer cette categorie ?')) return
    try {
      await deleteCategory(categoryId)
      const updatedCategories = await listCategories()
      setCategories(updatedCategories)
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null)
      }
    } catch (err) {
      console.error('Error deleting category:', err)
      alert(err instanceof Error ? err.message : 'Erreur de suppression')
    }
  }

  const toggleCategoryExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="flex-1 flex overflow-hidden min-w-0" style={{ backgroundColor: '#FAFAFB' }}>
      {/* Sidebar Categories */}
      <aside className="w-64 bg-white border-r flex-shrink-0 flex flex-col" style={{ borderColor: '#E4E5E7' }}>
        <div className="p-4 border-b" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold" style={{ color: '#141A1F' }}>
              Categories
            </h3>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Nouvelle categorie"
            >
              <FolderPlus className="w-4 h-4" style={{ color: '#6C767F' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* All products */}
          <button
            onClick={() => {
              setSelectedCategoryId(null)
              setShowLowStock(false)
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              !selectedCategoryId && !showLowStock ? 'bg-gray-100' : 'hover:bg-gray-50'
            }`}
            style={{ color: '#141A1F' }}
          >
            <Archive className="w-4 h-4" style={{ color: '#6C767F' }} />
            Tous les produits
            <span className="ml-auto text-xs" style={{ color: '#6C767F' }}>
              {stats.totalCount}
            </span>
          </button>

          {/* Low stock alert */}
          {stats.lowStockCount > 0 && (
            <button
              onClick={() => {
                setSelectedCategoryId(null)
                setShowLowStock(true)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mt-1 ${
                showLowStock ? 'bg-amber-50' : 'hover:bg-amber-50'
              }`}
              style={{ color: '#B45309' }}
            >
              <AlertTriangle className="w-4 h-4" />
              Stock bas
              <span
                className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}
              >
                {stats.lowStockCount}
              </span>
            </button>
          )}

          {/* Categories tree */}
          <div className="mt-4">
            <p className="px-3 py-1 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
              Categories
            </p>
            {categories.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: '#6C767F' }}>
                Aucune categorie
              </p>
            ) : (
              categories.map(category => (
                <CategoryTreeItem
                  key={category.id}
                  category={category}
                  selectedId={selectedCategoryId}
                  expandedIds={expandedCategories}
                  onSelect={id => {
                    setSelectedCategoryId(id)
                    setShowLowStock(false)
                  }}
                  onToggle={toggleCategoryExpand}
                  onDelete={handleDeleteCategory}
                  products={products}
                />
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
                Produits & Services
              </h1>
              <p className="text-sm" style={{ color: '#6C767F' }}>
                {filteredProducts.length} element{filteredProducts.length > 1 ? 's' : ''}
                {showLowStock && ' en alerte stock'}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProduct(null)
                setShowProductModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#006666' }}
            >
              <Plus className="w-4 h-4" />
              Nouveau produit
            </button>
          </div>
        </header>

        {/* Stats cards */}
        <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E4E5E7' }}>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4" style={{ color: '#6C767F' }} />
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Produits
                </p>
              </div>
              <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
                {stats.productCount}
              </p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4" style={{ color: '#6C767F' }} />
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Services
                </p>
              </div>
              <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
                {stats.serviceCount}
              </p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: '#E4E5E7' }}>
              <div className="flex items-center gap-2 mb-1">
                <Folder className="w-4 h-4" style={{ color: '#6C767F' }} />
                <p className="text-sm" style={{ color: '#6C767F' }}>
                  Categories
                </p>
              </div>
              <p className="text-2xl font-semibold" style={{ color: '#141A1F' }}>
                {categories.length}
              </p>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                borderColor: stats.lowStockCount > 0 ? '#FCD34D' : '#E4E5E7',
                backgroundColor: stats.lowStockCount > 0 ? '#FFFBEB' : 'transparent',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle
                  className="w-4 h-4"
                  style={{ color: stats.lowStockCount > 0 ? '#B45309' : '#6C767F' }}
                />
                <p className="text-sm" style={{ color: stats.lowStockCount > 0 ? '#B45309' : '#6C767F' }}>
                  Stock bas
                </p>
              </div>
              <p
                className="text-2xl font-semibold"
                style={{ color: stats.lowStockCount > 0 ? '#B45309' : '#141A1F' }}
              >
                {stats.lowStockCount}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b px-6 py-3" style={{ borderColor: '#E4E5E7' }}>
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#6C767F' }}
              />
              <input
                type="text"
                placeholder="Rechercher par code, nom..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" style={{ color: '#6C767F' }} />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as 'all' | 'product' | 'service')}
                className="px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                <option value="all">Tous les types</option>
                <option value="product">Produits uniquement</option>
                <option value="service">Services uniquement</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="w-12 h-12 mb-4" style={{ color: '#EF4444' }} />
              <p className="text-lg font-medium mb-1" style={{ color: '#141A1F' }}>
                Erreur de chargement
              </p>
              <p className="text-sm mb-4" style={{ color: '#6C767F' }}>
                {error}
              </p>
              <button
                onClick={fetchData}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ backgroundColor: '#006666' }}
              >
                Reessayer
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: '#006666' }}
              />
            </div>
          ) : (
            <div className="min-w-[1000px]">
              {/* Table header */}
              <div className="sticky top-0 bg-white border-b z-10" style={{ borderColor: '#E4E5E7' }}>
                <div className="grid grid-cols-12 gap-4 px-6 py-3">
                  <div className="col-span-1 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                    Code
                  </div>
                  <div className="col-span-3 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                    Designation
                  </div>
                  <div className="col-span-1 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                    Type
                  </div>
                  <div
                    className="col-span-2 text-xs font-medium uppercase text-right"
                    style={{ color: '#6C767F' }}
                  >
                    Prix HT
                  </div>
                  <div
                    className="col-span-1 text-xs font-medium uppercase text-center"
                    style={{ color: '#6C767F' }}
                  >
                    TVA
                  </div>
                  <div className="col-span-2 text-xs font-medium uppercase" style={{ color: '#6C767F' }}>
                    Categorie
                  </div>
                  <div
                    className="col-span-1 text-xs font-medium uppercase text-center"
                    style={{ color: '#6C767F' }}
                  >
                    Stock
                  </div>
                  <div className="col-span-1"></div>
                </div>
              </div>

              {/* Table body */}
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Package className="w-16 h-16 mb-4" style={{ color: '#D6D9DB' }} />
                  <p className="text-lg font-medium mb-1" style={{ color: '#141A1F' }}>
                    Aucun produit trouve
                  </p>
                  <p className="text-sm" style={{ color: '#6C767F' }}>
                    {searchQuery || typeFilter !== 'all' || selectedCategoryId
                      ? 'Modifiez vos filtres'
                      : 'Commencez par ajouter des produits'}
                  </p>
                </div>
              ) : (
                <div>
                  {filteredProducts.map(product => {
                    const isLowStock =
                      product.track_stock &&
                      product.stock_alert_threshold !== null &&
                      product.stock_alert_threshold !== undefined &&
                      (product.stock_quantity || 0) <= product.stock_alert_threshold

                    return (
                      <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 border-b cursor-pointer transition-colors"
                        style={{ borderColor: '#F2F2F3' }}
                      >
                        <div className="col-span-1">
                          <span className="text-sm font-medium" style={{ color: '#006666' }}>
                            {product.code}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <p className="text-sm font-medium truncate" style={{ color: '#141A1F' }}>
                            {product.name}
                          </p>
                          {product.description && (
                            <p className="text-xs truncate" style={{ color: '#6C767F' }}>
                              {product.description}
                            </p>
                          )}
                        </div>
                        <div className="col-span-1">
                          <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{
                              backgroundColor: product.type === 'product' ? '#E6F2F2' : '#F3E8FF',
                              color: product.type === 'product' ? '#006666' : '#7C3AED',
                            }}
                          >
                            {product.type === 'product' ? 'Produit' : 'Service'}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm font-mono" style={{ color: '#141A1F' }}>
                            {formatPrice(product.sale_price_ht)} EUR
                          </span>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-sm" style={{ color: '#6C767F' }}>
                            {product.vat_rate}%
                          </span>
                        </div>
                        <div className="col-span-2">
                          {product.category ? (
                            <span
                              className="text-xs px-2 py-1 rounded"
                              style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                            >
                              {product.category.name}
                            </span>
                          ) : (
                            <span className="text-sm" style={{ color: '#D6D9DB' }}>
                              -
                            </span>
                          )}
                        </div>
                        <div className="col-span-1 text-center">
                          {product.type === 'product' && product.track_stock ? (
                            <span
                              className={`text-sm font-medium ${isLowStock ? 'text-amber-600' : ''}`}
                              style={{ color: isLowStock ? '#B45309' : '#141A1F' }}
                            >
                              {product.stock_quantity ?? 0}
                              {isLowStock && (
                                <AlertTriangle className="w-3 h-3 inline ml-1" style={{ color: '#B45309' }} />
                              )}
                            </span>
                          ) : (
                            <span className="text-sm" style={{ color: '#D6D9DB' }}>
                              -
                            </span>
                          )}
                        </div>
                        <div className="col-span-1 flex justify-end relative">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setActionMenuProduct(actionMenuProduct === product.id ? null : product.id)
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded"
                          >
                            <MoreHorizontal className="w-4 h-4" style={{ color: '#6C767F' }} />
                          </button>

                          {/* Action menu */}
                          {actionMenuProduct === product.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={e => {
                                  e.stopPropagation()
                                  setActionMenuProduct(null)
                                }}
                              />
                              <div
                                className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg z-30 py-1 min-w-[140px]"
                                style={{ borderColor: '#E4E5E7' }}
                              >
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    setEditingProduct(product)
                                    setShowProductModal(true)
                                    setActionMenuProduct(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                                  style={{ color: '#141A1F' }}
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Modifier
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    handleDeleteProduct(product.id)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50"
                                  style={{ color: '#EF4444' }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Supprimer
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setShowProductModal(false)
            setEditingProduct(null)
          }}
          onSave={editingProduct ? handleUpdateProduct : handleCreateProduct}
        />
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onSave={handleCreateCategory}
        />
      )}

      {/* Product Detail Panel */}
      {selectedProduct && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedProduct(null)} />
          <ProductDetailPanel
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onEdit={() => {
              setEditingProduct(selectedProduct)
              setShowProductModal(true)
              setSelectedProduct(null)
            }}
          />
        </>
      )}
    </div>
  )
}

// ============ CATEGORY TREE ITEM ============

function CategoryTreeItem({
  category,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onDelete,
  products,
  depth = 0,
}: {
  category: ProductCategory
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  products: Product[]
  depth?: number
}) {
  const hasChildren = category.children && category.children.length > 0
  const isExpanded = expandedIds.has(category.id)
  const isSelected = selectedId === category.id
  const productCount = products.filter(p => p.category_id === category.id).length

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 rounded-lg transition-colors group ${
          isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => onToggle(category.id)} className="p-0.5">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" style={{ color: '#6C767F' }} />
            ) : (
              <ChevronRight className="w-3 h-3" style={{ color: '#6C767F' }} />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          onClick={() => onSelect(category.id)}
          className="flex-1 flex items-center gap-2 text-sm text-left truncate"
          style={{ color: '#141A1F' }}
        >
          <Folder className="w-4 h-4 flex-shrink-0" style={{ color: '#6C767F' }} />
          <span className="truncate">{category.name}</span>
          <span className="text-xs" style={{ color: '#6C767F' }}>
            {productCount}
          </span>
        </button>
        <button
          onClick={() => onDelete(category.id)}
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
          title="Supprimer"
        >
          <Trash2 className="w-3 h-3" style={{ color: '#EF4444' }} />
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {category.children!.map(child => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
              products={products}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============ PRODUCT MODAL ============

function ProductModal({
  product,
  categories,
  onClose,
  onSave,
}: {
  product: Product | null
  categories: ProductCategory[]
  onClose: () => void
  onSave: (data: ProductFormData) => Promise<void>
}) {
  const [code, setCode] = useState(product?.code || '')
  const [name, setName] = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const [type, setType] = useState<'product' | 'service'>(product?.type || 'product')
  const [categoryId, setCategoryId] = useState(product?.category_id || '')
  const [salePriceHT, setSalePriceHT] = useState(product?.sale_price_ht?.toString() || '')
  const [purchasePriceHT, setPurchasePriceHT] = useState(product?.purchase_price_ht?.toString() || '')
  const [vatRate, setVatRate] = useState(product?.vat_rate || '20')
  const [accountingCodeSale, setAccountingCodeSale] = useState(product?.accounting_code_sale || '706000')
  const [accountingCodePurchase, setAccountingCodePurchase] = useState(product?.accounting_code_purchase || '')
  const [trackStock, setTrackStock] = useState(product?.track_stock || false)
  const [stockAlertThreshold, setStockAlertThreshold] = useState(
    product?.stock_alert_threshold?.toString() || ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Flatten categories for select
  const flatCategories = useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = []
    const flatten = (cats: ProductCategory[], depth = 0) => {
      cats.forEach(cat => {
        result.push({ id: cat.id, name: cat.name, depth })
        if (cat.children) {
          flatten(cat.children, depth + 1)
        }
      })
    }
    flatten(categories)
    return result
  }, [categories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!code.trim() || !name.trim() || !accountingCodeSale.trim()) {
      setError('Veuillez remplir tous les champs obligatoires')
      return
    }

    const priceHT = parseFloat(salePriceHT)
    if (isNaN(priceHT) || priceHT < 0) {
      setError('Le prix de vente HT doit etre un nombre positif')
      return
    }

    setSaving(true)
    try {
      await onSave({
        code,
        name,
        description: description || undefined,
        type,
        categoryId: categoryId || undefined,
        salePriceHT: priceHT,
        purchasePriceHT: purchasePriceHT ? parseFloat(purchasePriceHT) : undefined,
        vatRate,
        accountingCodeSale,
        accountingCodePurchase: accountingCodePurchase || undefined,
        trackStock: type === 'product' ? trackStock : false,
        stockAlertThreshold: trackStock && stockAlertThreshold ? parseInt(stockAlertThreshold) : undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            {product ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" style={{ color: '#6C767F' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
            )}

            {/* Type selection */}
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: '#141A1F' }}>
                Type *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    checked={type === 'product'}
                    onChange={() => setType('product')}
                    className="w-4 h-4"
                    style={{ accentColor: '#006666' }}
                  />
                  <Package className="w-4 h-4" style={{ color: '#006666' }} />
                  <span className="text-sm" style={{ color: '#141A1F' }}>
                    Produit
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    checked={type === 'service'}
                    onChange={() => setType('service')}
                    className="w-4 h-4"
                    style={{ accentColor: '#006666' }}
                  />
                  <Briefcase className="w-4 h-4" style={{ color: '#7C3AED' }} />
                  <span className="text-sm" style={{ color: '#141A1F' }}>
                    Service
                  </span>
                </label>
              </div>
            </div>

            {/* Code and Name */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                  Code *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="PROD001"
                  className="w-full px-3 py-2 border rounded-lg text-sm uppercase"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                  Designation *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nom du produit ou service"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description detaillee..."
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                style={{ borderColor: '#D6D9DB' }}
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                Categorie
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
              >
                <option value="">-- Aucune categorie --</option>
                {flatCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {'  '.repeat(cat.depth)}
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                  Prix vente HT *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salePriceHT}
                    onChange={e => setSalePriceHT(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 pr-10 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: '#6C767F' }}
                  >
                    EUR
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                  Prix achat HT
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchasePriceHT}
                    onChange={e => setPurchasePriceHT(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 pr-10 border rounded-lg text-sm"
                    style={{ borderColor: '#D6D9DB' }}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: '#6C767F' }}
                  >
                    EUR
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                  Taux TVA *
                </label>
                <select
                  value={vatRate}
                  onChange={e => setVatRate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
                >
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                  <option value="5.5">5,5%</option>
                  <option value="0">0% (Exonere)</option>
                </select>
              </div>
            </div>

            {/* Accounting codes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                  Compte comptable vente *
                </label>
                <input
                  type="text"
                  value={accountingCodeSale}
                  onChange={e => setAccountingCodeSale(e.target.value)}
                  placeholder="706000"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
                <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                  Compte produits (classe 7)
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                  Compte comptable achat
                </label>
                <input
                  type="text"
                  value={accountingCodePurchase}
                  onChange={e => setAccountingCodePurchase(e.target.value)}
                  placeholder="607000"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: '#D6D9DB' }}
                />
                <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                  Compte charges (classe 6)
                </p>
              </div>
            </div>

            {/* Stock management (products only) */}
            {type === 'product' && (
              <div className="p-4 rounded-lg border" style={{ borderColor: '#E4E5E7', backgroundColor: '#F9FAFB' }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackStock}
                    onChange={e => setTrackStock(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#006666' }}
                  />
                  <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                    Activer la gestion de stock
                  </span>
                </label>

                {trackStock && (
                  <div className="mt-4">
                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
                      Seuil d'alerte stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stockAlertThreshold}
                      onChange={e => setStockAlertThreshold(e.target.value)}
                      placeholder="10"
                      className="w-32 px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: '#D6D9DB' }}
                    />
                    <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
                      Vous serez alerte quand le stock atteint ce seuil
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t" style={{ borderColor: '#E4E5E7' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border rounded-lg"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              {saving ? 'Enregistrement...' : product ? 'Mettre a jour' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ CATEGORY MODAL ============

function CategoryModal({
  categories,
  onClose,
  onSave,
}: {
  categories: ProductCategory[]
  onClose: () => void
  onSave: (name: string, parentId?: string) => Promise<ProductCategory>
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Flatten categories for select
  const flatCategories = useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = []
    const flatten = (cats: ProductCategory[], depth = 0) => {
      cats.forEach(cat => {
        result.push({ id: cat.id, name: cat.name, depth })
        if (cat.children) {
          flatten(cat.children, depth + 1)
        }
      })
    }
    flatten(categories)
    return result
  }, [categories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }

    setSaving(true)
    try {
      await onSave(name, parentId || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de creation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#141A1F' }}>
            Nouvelle categorie
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" style={{ color: '#6C767F' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Nom de la categorie *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Informatique"
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB' }}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#141A1F' }}>
              Categorie parente
            </label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#D6D9DB', color: '#141A1F' }}
            >
              <option value="">-- Categorie racine --</option>
              {flatCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {'  '.repeat(cat.depth)}
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: '#6C767F' }}>
              Laissez vide pour creer une categorie principale
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border rounded-lg"
              style={{ borderColor: '#E4E5E7', color: '#141A1F' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#006666' }}
            >
              {saving ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============ PRODUCT DETAIL PANEL ============

function ProductDetailPanel({
  product,
  onClose,
  onEdit,
}: {
  product: Product
  onClose: () => void
  onEdit: () => void
}) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const isLowStock =
    product.track_stock &&
    product.stock_alert_threshold !== null &&
    product.stock_alert_threshold !== undefined &&
    (product.stock_quantity || 0) <= product.stock_alert_threshold

  // Calculate TTC price
  const vatRate = parseFloat(product.vat_rate) / 100
  const priceTTC = product.sale_price_ht * (1 + vatRate)

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E4E5E7' }}>
        <div>
          <span
            className="text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: product.type === 'product' ? '#E6F2F2' : '#F3E8FF',
              color: product.type === 'product' ? '#006666' : '#7C3AED',
            }}
          >
            {product.type === 'product' ? 'Produit' : 'Service'}
          </span>
          <h2 className="text-lg font-semibold mt-2" style={{ color: '#141A1F' }}>
            {product.name}
          </h2>
          <p className="text-sm" style={{ color: '#006666' }}>
            {product.code}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" style={{ color: '#6C767F' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Price card */}
        <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: '#F8FAFA' }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs" style={{ color: '#6C767F' }}>
                Prix HT
              </p>
              <p className="text-xl font-semibold" style={{ color: '#141A1F' }}>
                {formatPrice(product.sale_price_ht)} EUR
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#6C767F' }}>
                Prix TTC
              </p>
              <p className="text-xl font-semibold" style={{ color: '#006666' }}>
                {formatPrice(priceTTC)} EUR
              </p>
            </div>
          </div>
        </div>

        {/* Stock alert */}
        {isLowStock && (
          <div
            className="flex items-center gap-3 p-3 rounded-lg mb-6"
            style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#B45309' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#B45309' }}>
                Stock bas
              </p>
              <p className="text-xs" style={{ color: '#92400E' }}>
                Quantite actuelle: {product.stock_quantity} (seuil: {product.stock_alert_threshold})
              </p>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="space-y-4">
          {product.description && (
            <div className="py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
              <span className="text-sm block mb-1" style={{ color: '#6C767F' }}>
                Description
              </span>
              <span className="text-sm" style={{ color: '#141A1F' }}>
                {product.description}
              </span>
            </div>
          )}

          {product.category && (
            <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
              <span className="text-sm" style={{ color: '#6C767F' }}>
                Categorie
              </span>
              <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                {product.category.name}
              </span>
            </div>
          )}

          <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>
              Taux TVA
            </span>
            <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
              {product.vat_rate}%
            </span>
          </div>

          <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
            <span className="text-sm" style={{ color: '#6C767F' }}>
              Compte comptable (vente)
            </span>
            <span className="text-sm font-mono" style={{ color: '#141A1F' }}>
              {product.accounting_code_sale}
            </span>
          </div>

          {product.accounting_code_purchase && (
            <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
              <span className="text-sm" style={{ color: '#6C767F' }}>
                Compte comptable (achat)
              </span>
              <span className="text-sm font-mono" style={{ color: '#141A1F' }}>
                {product.accounting_code_purchase}
              </span>
            </div>
          )}

          {product.purchase_price_ht !== null && product.purchase_price_ht !== undefined && (
            <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
              <span className="text-sm" style={{ color: '#6C767F' }}>
                Prix d'achat HT
              </span>
              <span className="text-sm font-mono" style={{ color: '#141A1F' }}>
                {formatPrice(product.purchase_price_ht)} EUR
              </span>
            </div>
          )}

          {product.type === 'product' && (
            <>
              <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
                <span className="text-sm" style={{ color: '#6C767F' }}>
                  Gestion de stock
                </span>
                <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                  {product.track_stock ? 'Activee' : 'Desactivee'}
                </span>
              </div>

              {product.track_stock && (
                <>
                  <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
                    <span className="text-sm" style={{ color: '#6C767F' }}>
                      Stock actuel
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: isLowStock ? '#B45309' : '#141A1F' }}
                    >
                      {product.stock_quantity ?? 0} unites
                    </span>
                  </div>

                  {product.stock_alert_threshold !== null && (
                    <div className="flex justify-between py-3 border-b" style={{ borderColor: '#F2F2F3' }}>
                      <span className="text-sm" style={{ color: '#6C767F' }}>
                        Seuil d'alerte
                      </span>
                      <span className="text-sm font-medium" style={{ color: '#141A1F' }}>
                        {product.stock_alert_threshold} unites
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="flex justify-between py-3">
            <span className="text-sm" style={{ color: '#6C767F' }}>
              Date de creation
            </span>
            <span className="text-sm" style={{ color: '#141A1F' }}>
              {new Date(product.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 border-t" style={{ borderColor: '#E4E5E7' }}>
        <button
          onClick={onEdit}
          className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#006666' }}
        >
          Modifier
        </button>
      </div>
    </div>
  )
}
