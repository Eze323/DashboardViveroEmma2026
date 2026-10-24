import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export interface SaleDraftLine {
  id: string
  productId: string
  size: string
  quantity: number
}

export interface SaleDraftCustomer {
  nombre: string
  email: string
  telefono: string
}

export interface SaleDraft {
  customerId: string
  newCustomer?: SaleDraftCustomer
  date: string
  seller: string
  status: 'Completada' | 'Pendiente'
  lines: SaleDraftLine[]
}

export interface SaleCatalogProduct {
  id: string
  nombre: string
  sku: string
  stock: number
  precio: number
  imageUrl: string
}

export interface SaleVariant {
  size: string
  price: number
}

interface SaleVariantsResponse {
  product: SaleCatalogProduct
  variants: SaleVariant[]
}

interface SaleSearchResponse {
  data: Array<{
    id: string
    nombre: string
    sku: string
    stock: number
    precio: number
    imageUrl: string
  }>
}

interface CachedVariants {
  data: SaleVariantsResponse
  expiresAt: number
}

function today(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function emptyDraft(): SaleDraft {
  return {
    customerId: 'consumer-final',
    date: today(),
    seller: '',
    status: 'Completada',
    lines: []
  }
}

function copyDraft(draft: SaleDraft): SaleDraft {
  return { ...draft, lines: draft.lines.map(line => ({ ...line })) }
}

export const useSalesDraftStore = defineStore('sales-draft', () => {
  const draft = ref<SaleDraft>(emptyDraft())
  const savedNewDraft = ref<SaleDraft>(emptyDraft())
  const editingExistingSale = ref(false)
  const existingSaleQuantities = ref<Record<string, number>>({})
  const existingSaleInventoryApplied = ref(false)
  const searchResults = ref<SaleCatalogProduct[]>([])
  const searchLoading = ref(false)
  const searchError = ref('')
  const productDetails = ref<Record<string, SaleCatalogProduct>>({})
  const variantCache = ref<Record<string, CachedVariants>>({})
  let latestSearch = 0

  const itemCount = computed(() => draft.value.lines.reduce((total, line) => total + line.quantity, 0))
  const subtotal = computed(() => draft.value.lines.reduce((total, line) => {
    const variant = variantFor(line.productId, line.size)
    return total + (variant?.price ?? 0) * line.quantity
  }, 0))
  const hasUnpricedLines = computed(() => draft.value.lines.some((line) => {
    const variants = variantCache.value[line.productId]?.data.variants
    return !variants?.some(variant => variant.size === line.size)
  }))
  const hasStockIssues = computed(() => {
    if (draft.value.status !== 'Completada') return false
    const quantities = new Map<string, number>()
    for (const line of draft.value.lines) {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
    }
    return [...quantities].some(([productId, quantity]) => {
      const product = productDetails.value[productId]
      const returnedToStock = existingSaleInventoryApplied.value
        ? existingSaleQuantities.value[productId] ?? 0
        : 0
      return !product || product.stock + returnedToStock < quantity
    })
  })

  function variantFor(productId: string, size: string) {
    return variantCache.value[productId]?.data.variants.find(variant => variant.size === size)
  }

  async function searchProducts(query: string): Promise<void> {
    const normalized = query.trim()
    const requestId = ++latestSearch
    searchError.value = ''
    if (normalized.length < 2) {
      searchResults.value = []
      searchLoading.value = false
      return
    }

    searchLoading.value = true
    try {
      const response = await $fetch<SaleSearchResponse>('/api/management/productos', {
        query: { page: 1, limit: 8, q: normalized, status: 'Publicado' }
      })
      if (requestId !== latestSearch) return
      searchResults.value = response.data.filter(product => product.stock > 0).map(product => ({ ...product }))
      for (const product of searchResults.value) productDetails.value[product.id] = product
    } catch (error) {
      if (requestId === latestSearch) {
        searchError.value = error instanceof Error ? error.message : 'No se pudieron buscar productos.'
        throw error
      }
    } finally {
      if (requestId === latestSearch) searchLoading.value = false
    }
  }

  async function loadProduct(productId: string, force = false): Promise<SaleVariantsResponse> {
    const cached = variantCache.value[productId]
    if (!force && cached && cached.expiresAt > Date.now()) return cached.data

    const response = await $fetch<SaleVariantsResponse>(`/api/management/product-variants/${productId}`)
    variantCache.value[productId] = { data: response, expiresAt: Date.now() + 30_000 }
    productDetails.value[productId] = response.product
    return response
  }

  async function hydrateDraft(): Promise<void> {
    const productIds = [...new Set(draft.value.lines.map(line => line.productId))]
    const results = await Promise.allSettled(productIds.map(id => loadProduct(id, true)))
    const failedProducts = results.filter(result => result.status === 'rejected')
    if (failedProducts.length) {
      throw new Error('No se pudieron actualizar uno o más productos del borrador. Revisa la conexión o quita los productos que ya no estén disponibles.')
    }
  }

  function resetSearch(): void {
    latestSearch += 1
    searchResults.value = []
    searchLoading.value = false
    searchError.value = ''
  }

  async function addProduct(product: SaleCatalogProduct): Promise<void> {
    if (product.stock < 1) throw new Error('Este producto no tiene stock disponible.')
    const { variants } = await loadProduct(product.id)
    const selectedSize = variants.length === 1 ? variants[0]?.size ?? '' : ''
    if (selectedSize) {
      const existing = draft.value.lines.find(line => line.productId === product.id && line.size === selectedSize)
      if (existing) {
        existing.quantity += 1
        return
      }
    }

    draft.value.lines.push({
      id: crypto.randomUUID(),
      productId: product.id,
      size: selectedSize,
      quantity: 1
    })
  }

  function availableStock(productId: string): number {
    const product = productDetails.value[productId]
    const returnedToStock = existingSaleInventoryApplied.value
      ? existingSaleQuantities.value[productId] ?? 0
      : 0
    const inCart = draft.value.lines
      .filter(line => line.productId === productId)
      .reduce((quantity, line) => quantity + line.quantity, 0)
    return Math.max(0, (product?.stock ?? 0) + returnedToStock - inCart)
  }

  function setLineSize(lineId: string, size: string): void {
    const line = draft.value.lines.find(item => item.id === lineId)
    if (!line) return
    line.size = size
    const duplicate = draft.value.lines.find(item => item.id !== lineId && item.productId === line.productId && item.size === size)
    if (duplicate && size) {
      duplicate.quantity += line.quantity
      draft.value.lines = draft.value.lines.filter(item => item.id !== lineId)
    }
  }

  function setQuantity(lineId: string, quantity: number): void {
    const line = draft.value.lines.find(item => item.id === lineId)
    if (line) line.quantity = Math.max(1, Math.floor(quantity || 1))
  }

  function removeLine(lineId: string): void {
    draft.value.lines = draft.value.lines.filter(line => line.id !== lineId)
  }

  function startNewDraft(): void {
    resetSearch()
    editingExistingSale.value = false
    existingSaleQuantities.value = {}
    existingSaleInventoryApplied.value = false
    const restoredDraft = copyDraft(savedNewDraft.value)
    if (!restoredDraft.customerId) restoredDraft.customerId = 'consumer-final'
    draft.value = restoredDraft
  }

  function startEditDraft(data: {
    customerId: string
    date: string
    seller: string
    status: 'Completada' | 'Pendiente'
    inventoryApplied: boolean
    items: Array<{ productId: string, size: string, quantity: number }>
  }): void {
    resetSearch()
    editingExistingSale.value = true
    existingSaleInventoryApplied.value = data.inventoryApplied
    existingSaleQuantities.value = data.items.reduce<Record<string, number>>((totals, item) => {
      totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity
      return totals
    }, {})
    draft.value = {
      customerId: data.customerId || 'consumer-final',
      date: data.date,
      seller: data.seller,
      status: data.status,
      lines: data.items.map(item => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        size: item.size,
        quantity: item.quantity
      }))
    }
  }

  function clearDraft(): void {
    resetSearch()
    editingExistingSale.value = false
    existingSaleQuantities.value = {}
    existingSaleInventoryApplied.value = false
    draft.value = emptyDraft()
    savedNewDraft.value = emptyDraft()
  }

  function cancelEditDraft(): void {
    if (!editingExistingSale.value) return
    editingExistingSale.value = false
    existingSaleQuantities.value = {}
    existingSaleInventoryApplied.value = false
    draft.value = copyDraft(savedNewDraft.value)
  }

  function clearLines(): void {
    draft.value.lines = []
  }

  function productFor(productId: string): SaleCatalogProduct | undefined {
    return productDetails.value[productId]
  }

  function variantsFor(productId: string): SaleVariant[] {
    return variantCache.value[productId]?.data.variants ?? []
  }

  function priceFor(productId: string, size: string): number {
    return variantFor(productId, size)?.price ?? 0
  }

  watch(draft, (value) => {
    if (!editingExistingSale.value && JSON.stringify(savedNewDraft.value) !== JSON.stringify(value)) {
      savedNewDraft.value = copyDraft(value)
    }
  }, { deep: true })
  watch(savedNewDraft, (value) => {
    if (!editingExistingSale.value && JSON.stringify(draft.value) !== JSON.stringify(value)) {
      draft.value = copyDraft(value)
    }
  }, { deep: true })

  function payload(customerName: string) {
    return {
      clienteId: draft.value.customerId && draft.value.customerId !== 'consumer-final'
        && draft.value.customerId !== 'new-customer'
        ? Number(draft.value.customerId)
        : null,
      cliente: draft.value.newCustomer?.nombre || customerName || 'Consumidor Final',
      ...(draft.value.customerId === 'new-customer' && draft.value.newCustomer
        ? { clienteNuevo: draft.value.newCustomer }
        : {}),
      fecha: draft.value.date,
      vendedor: draft.value.seller,
      estado: draft.value.status,
      items: draft.value.lines.map(line => ({
        productoId: Number(line.productId),
        medida: line.size,
        cantidad: line.quantity
      }))
    }
  }

  return {
    draft,
    savedNewDraft,
    searchResults,
    searchLoading,
    searchError,
    itemCount,
    subtotal,
    hasUnpricedLines,
    hasStockIssues,
    editingExistingSale,
    searchProducts,
    loadProduct,
    hydrateDraft,
    resetSearch,
    addProduct,
    availableStock,
    setLineSize,
    setQuantity,
    removeLine,
    startNewDraft,
    startEditDraft,
    clearDraft,
    cancelEditDraft,
    clearLines,
    productFor,
    variantsFor,
    priceFor,
    payload
  }
}, {
  persist: {
    storage: piniaPluginPersistedstate.sessionStorage(),
    pick: ['savedNewDraft']
  }
})
