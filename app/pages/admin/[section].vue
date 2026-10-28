<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { useSalesDraftStore } from '~/stores/salesDraft'
import { downloadCsv } from '~/utils/csv'
import type { ManagementField, ManagementRow, ViveroSection } from '~/utils/vivero'
import { viveroModules } from '~/utils/vivero'

interface ManagementApiResponse {
  section: string
  source: 'database' | 'demo'
  data?: ManagementRow[]
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface CategoriesApiResponse {
  data: Array<{ id: string, nombre: string }>
}

interface SelectOption {
  label: string
  value: string
}

interface ReceiptData {
  nonFiscal: boolean
  id: string
  date: string
  time: string | null
  customer: string
  email: string
  address: string
  taxId: string
  ivaCondition: string
  seller: string
  total: number
  status: string
  invoiceType: number
  invoiceNumber: string
  items: Array<{
    productId: number
    name: string
    size: string
    quantity: number
    price: number
    subtotal: number
  }>
}

const databaseSections: ViveroSection[] = [
  'productos',
  'clientes',
  'ventas',
  'facturas',
  'categorias',
  'proveedores',
  'vendedores',
  'accesos',
  'compras',
  'precios-proveedor',
  'precios-maceta',
  'ubicaciones',
  'zonas'
]
const editableSections: ViveroSection[] = [
  'productos',
  'clientes',
  'ventas',
  'proveedores',
  'compras',
  'precios-proveedor',
  'precios-maceta',
  'ubicaciones',
  'zonas',
  'accesos'
]
const archiveSections: ViveroSection[] = [
  'productos',
  'clientes',
  'accesos',
  'proveedores',
  'compras',
  'precios-proveedor',
  'precios-maceta',
  'ubicaciones',
  'zonas'
]
const dbFields: Partial<Record<ViveroSection, string[]>> = {
  'productos': ['imageUrl', 'nombre', 'categoria', 'sku', 'stock', 'precio', 'estado'],
  'clientes': ['nombre', 'email', 'telefono', 'localidad', 'compras'],
  'ventas': ['fecha', 'cliente', 'vendedor', 'total', 'estado', 'tipo', 'numero', 'items'],
  'facturas': ['fecha', 'cliente', 'tipo', 'total', 'numero', 'estadoFactura'],
  'categorias': ['nombre', 'productos'],
  'proveedores': ['nombre'],
  'vendedores': ['nombre', 'ventas'],
  'accesos': ['nombre', 'email', 'rol'],
  'compras': ['fecha', 'producto', 'proveedor', 'cantidad', 'precio'],
  'precios-proveedor': ['producto', 'proveedor', 'precio', 'desde', 'hasta'],
  'precios-maceta': ['producto', 'medida', 'precio'],
  'ubicaciones': ['nombre', 'area', 'monitoreada', 'estado'],
  'zonas': ['nombre', 'ancho', 'alto', 'color']
}
const displayFieldLabels: Record<string, string> = {
  imageUrl: 'Imagen',
  total: 'Total',
  tipo: 'Comprobante',
  numero: 'Número',
  items: 'Artículos',
  estadoFactura: 'Estado del comprobante',
  compras: 'Compras',
  productos: 'Productos',
  fecha: 'Fecha',
  producto: 'Producto',
  proveedor: 'Proveedor',
  cantidad: 'Cantidad',
  precio: 'Precio',
  desde: 'Válido desde',
  hasta: 'Válido hasta',
  medida: 'Tamaño de maceta',
  area: 'Área',
  monitoreada: 'Monitoreada',
  ancho: 'Ancho',
  alto: 'Alto'
}

const route = useRoute()
const toast = useToast()
const salesDraftStore = useSalesDraftStore()
const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UInputComponent = resolveComponent('UInput')
const USelectComponent = resolveComponent('USelect')
const section = computed(() => String(route.params.section) as ViveroSection)
const managementModule = computed(() => viveroModules[section.value])
const isDatabaseSection = computed(() => databaseSections.includes(section.value))
const isEditable = computed(() => editableSections.includes(section.value))
const supportsArchive = computed(() => archiveSections.includes(section.value))

const page = ref(1)
const pageSize = ref('20')
const searchInput = ref('')
const search = ref('')
const statusFilter = ref('Todos')
const archivedView = ref(false)
watchDebounced(searchInput, (value) => {
  search.value = value.trim()
  page.value = 1
}, { debounce: 300 })

const { data: managementResponse, status: managementStatus, error: managementError, refresh } = await useFetch<ManagementApiResponse>(
  () => `/api/management/${section.value}`,
  {
    query: computed(() => ({
      page: page.value,
      limit: Number(pageSize.value),
      q: search.value || undefined,
      status: statusFilter.value === 'Todos' ? undefined : statusFilter.value,
      archived: supportsArchive.value ? String(archivedView.value) : undefined
    }))
  }
)
const isLoading = computed(() => managementStatus.value === 'pending')
const canExportData = computed(() => ['productos', 'ventas', 'facturas', 'categorias'].includes(section.value))
const isExporting = ref(false)
const togglingProductId = ref<string | null>(null)

watch(managementError, (error) => {
  if (!error) return
  toast.add({
    title: 'No se pudieron cargar los datos',
    description: 'Verifica la conexión e inténtalo nuevamente.',
    color: 'error'
  })
})

const demoRecords = useState<Record<ViveroSection, ManagementRow[]>>('vivero-demo-records', () => {
  const records = {} as Record<ViveroSection, ManagementRow[]>
  for (const [key, module] of Object.entries(viveroModules) as Array<[ViveroSection, typeof viveroModules[ViveroSection]]>) {
    records[key] = module.rows.map(row => ({ ...row }))
  }
  return records
})

const moduleRows = computed(() => {
  if (isDatabaseSection.value) {
    if (managementError.value || managementResponse.value?.section !== section.value) return []
    return managementResponse.value.data ?? []
  }
  return demoRecords.value[section.value] ?? []
})

const visibleFields = computed(() => managementModule.value?.fields ?? [])
const tableFields = computed(() => {
  const fields = managementModule.value?.fields ?? []
  const keys = dbFields[section.value]
  if (!isDatabaseSection.value || !keys) return fields
  return keys.map((key) => {
    const field = fields.find(item => item.key === key)
    if (field) return field
    return {
      key,
      label: displayFieldLabels[key] ?? key,
      format: ['total', 'precio'].includes(key) ? 'currency' as const : undefined
    }
  })
})

const rows = computed(() => {
  if (isDatabaseSection.value) return moduleRows.value
  const normalizedSearch = search.value.toLocaleLowerCase('es')
  return moduleRows.value.filter((row) => {
    const matchesSearch = !normalizedSearch || Object.values(row)
      .some(value => String(value).toLocaleLowerCase('es').includes(normalizedSearch))
    const matchesStatus = statusFilter.value === 'Todos' || String(row.estado ?? '') === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

const totalRows = computed(() => isDatabaseSection.value
  ? managementResponse.value?.meta?.total ?? 0
  : rows.value.length)
const totalPages = computed(() => isDatabaseSection.value
  ? managementResponse.value?.meta?.totalPages ?? 0
  : Math.max(1, Math.ceil(rows.value.length / Number(pageSize.value))))
const displayRows = computed(() => isDatabaseSection.value
  ? rows.value
  : rows.value.slice((page.value - 1) * Number(pageSize.value), page.value * Number(pageSize.value)))
const statusOptions = computed(() => tableFields.value.find(field => field.key === 'estado')?.options ?? [])
const showStatusFilter = computed(() => statusOptions.value.length > 0)
const rangeStart = computed(() => totalRows.value === 0 ? 0 : (page.value - 1) * Number(pageSize.value) + 1)
const rangeEnd = computed(() => Math.min(page.value * Number(pageSize.value), totalRows.value))

watch(section, () => {
  page.value = 1
  searchInput.value = ''
  search.value = ''
  statusFilter.value = 'Todos'
  archivedView.value = false
})
watch(pageSize, () => {
  page.value = 1
})
watch([statusFilter, archivedView], () => {
  page.value = 1
})
watch(totalPages, (value) => {
  if (page.value > value) page.value = Math.max(value, 1)
})

const modalOpen = ref(false)
const categoryModalOpen = ref(false)
const isCreatingCategory = ref(false)
const newCategoryName = ref('')
const priceAdjustmentModalOpen = ref(false)
const isApplyingPriceAdjustment = ref(false)
const priceAdjustmentMode = ref<'percentage' | 'fixed'>('percentage')
const priceAdjustmentAmount = ref('')
const selectedPriceCategoryId = ref('')
const archiveModalOpen = ref(false)
const completeSaleModalOpen = ref(false)
const editingRecord = ref<ManagementRow | null>(null)
const recordToArchive = ref<ManagementRow | null>(null)
const saleToComplete = ref<ManagementRow | null>(null)
const isSaving = ref(false)
const isArchiving = ref(false)
const isCompletingSale = ref(false)
const saleComposerKey = ref(0)
const form = reactive<Record<string, string>>({})
const productOptions = ref<SelectOption[]>([])
const supplierOptions = ref<SelectOption[]>([])
const categoryOptions = ref<SelectOption[]>([])
const customerOptions = ref<SelectOption[]>([{ label: 'Consumidor final', value: 'consumer-final' }])
const isUploadingProductImage = ref(false)
const imageUploadError = ref('')
const imageInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)
const focusedProductImage = ref<{ src: string, alt: string } | null>(null)
const failedProductImages = ref<Record<string, boolean>>({})
const localDateTime = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

function triggerImagePicker() {
  const el = Array.isArray(imageInputRef.value) ? imageInputRef.value[0] : imageInputRef.value
  const input = el || (typeof document !== 'undefined' ? (document.getElementById('product-image-file-input') as HTMLInputElement | null) : null)
  input?.click()
}

watch(() => form.imageUrl, (newUrl) => {
  if (newUrl && failedProductImages.value[newUrl]) {
    failedProductImages.value[newUrl] = false
  }
})

watch(modalOpen, (isOpen) => {
  if (!isOpen) salesDraftStore.cancelEditDraft()
})

function currency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value)
}

function recordValue(value: ManagementRow[keyof ManagementRow] | undefined): string {
  return value === undefined || value === null ? '' : String(value)
}

function fieldValue(field: ManagementField, value: ManagementRow[keyof ManagementRow] | undefined): string {
  if (field.key === 'monitoreada') return value === true || value === 'true' ? 'Sí' : 'No'
  if (field.type === 'datetime-local' && value) return localDateTime(new Date(String(value)))
  return recordValue(value)
}

function formatCell(field: ManagementField, value: ManagementRow[keyof ManagementRow] | undefined): string {
  if (field.format === 'currency') return currency(Number(value ?? 0))
  if (field.key === 'monitoreada') return value ? 'Sí' : 'No'
  if (section.value === 'accesos' && field.key === 'rol') {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      encargado: 'Encargado',
      vendedor: 'Vendedor',
      operario: 'Operario',
      user: 'Usuario'
    }
    return labels[String(value ?? '')] ?? 'Sin rol'
  }
  return recordValue(value) || '—'
}

function isSaleEditable(row: ManagementRow): boolean {
  return section.value !== 'ventas'
    || (row.editable === true && row.estado !== 'Cancelada' && row.estado !== 'Anulada')
}

function canArchiveRecord(row: ManagementRow): boolean {
  if (section.value === 'ventas') return row.estado !== 'Cancelada' && row.estado !== 'Anulada'
  return supportsArchive.value && !isRecordArchived(row)
}

function canCompleteSale(row: ManagementRow): boolean {
  return section.value === 'ventas'
    && row.estado === 'Pendiente'
    && !row.cae
    && row.estadoFactura !== 'billed'
}

function updateProductStatus(id: string, status: string): void {
  const data = managementResponse.value?.data
  if (!data) return
  const index = data.findIndex(row => row.id === id)
  if (index !== -1) data[index] = { ...data[index]!, estado: status }
}

async function toggleProductVisibility(row: ManagementRow): Promise<void> {
  if (togglingProductId.value) return
  const previousStatus = recordValue(row.estado)
  const isPublished = previousStatus !== 'Borrador'
  const nextStatus = isPublished
    ? 'Borrador'
    : Number(row.stock ?? 0) > 0 ? 'Publicado' : 'Sin stock'
  togglingProductId.value = row.id
  updateProductStatus(row.id, nextStatus)

  try {
    await $fetch(`/api/management/productos/${row.id}`, {
      method: 'PUT',
      body: { estado: isPublished ? 'Borrador' : 'Publicado' }
    })
    toast.add({
      title: nextStatus === 'Borrador' ? 'Producto oculto' : 'Producto visible',
      description: 'El cambio se guardó correctamente.',
      color: 'success'
    })
    try {
      await refresh()
    } catch {
      toast.add({
        title: 'No se pudo actualizar la lista',
        description: 'El cambio sí se guardó. Recarga la página para ver los datos más recientes.',
        color: 'warning'
      })
    }
  } catch (error) {
    updateProductStatus(row.id, previousStatus)
    toast.add({
      title: 'No se pudo cambiar la visibilidad',
      description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      color: 'error'
    })
  } finally {
    togglingProductId.value = null
  }
}

function confirmCompleteSale(row: ManagementRow) {
  saleToComplete.value = row
  completeSaleModalOpen.value = true
}

async function completeSale() {
  if (!saleToComplete.value || isCompletingSale.value) return
  isCompletingSale.value = true
  try {
    await $fetch(`/api/management/ventas/${saleToComplete.value.id}`, {
      method: 'PUT',
      body: { estado: 'Completada' }
    })
    completeSaleModalOpen.value = false
    toast.add({
      title: 'Venta completada',
      description: 'Se actualizó el estado y se descontó el stock de forma segura.',
      color: 'success'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'No se pudo completar la venta',
      description: error instanceof Error ? error.message : 'Verifica el stock e inténtalo nuevamente.',
      color: 'error'
    })
  } finally {
    isCompletingSale.value = false
  }
}

function isRecordArchived(row: ManagementRow): boolean {
  return row.archivado === true
}

function openProductImage(row: ManagementRow) {
  const src = recordValue(row.imageUrl)
  if (!src || failedProductImages.value[src]) return
  focusedProductImage.value = { src, alt: recordValue(row.nombre) || 'Imagen del producto' }
}

function markProductImageFailed(src: string) {
  failedProductImages.value[src] = true
}

const columns = computed<TableColumn<ManagementRow>[]>(() => {
  const dataColumns: TableColumn<ManagementRow>[] = tableFields.value.map((field) => {
    const column: TableColumn<ManagementRow> = {
      accessorKey: field.key,
      header: field.label,
      cell: ({ row }) => {
        const value = row.original[field.key]
        if (section.value === 'productos' && field.key === 'imageUrl') {
          const imageUrl = recordValue(row.original.imageUrl)
          return imageUrl && !failedProductImages.value[imageUrl]
            ? h('button', {
                'type': 'button',
                'class': 'block rounded-lg focus-visible:outline-2 focus-visible:outline-primary',
                'aria-label': `Ampliar imagen de ${recordValue(row.original.nombre)}`,
                'onClick': () => openProductImage(row.original)
              }, [h('img', {
                src: imageUrl,
                alt: recordValue(row.original.nombre),
                loading: 'lazy',
                onError: () => markProductImageFailed(imageUrl),
                class: 'size-14 rounded-lg object-cover'
              })])
            : h('div', { class: 'flex size-14 items-center justify-center rounded-lg bg-elevated text-muted' }, [
                h(resolveComponent('UIcon'), { name: 'i-lucide-image-off', class: 'size-5' })
              ])
        }
        if (field.key === 'estado' || field.key === 'estadoFactura') {
          const label = String(value ?? '—')
          const color = ['Completada', 'Pagada', 'Emitida', 'Publicado', 'Activa'].includes(label)
            ? 'success'
            : ['Pendiente', 'unbilled'].includes(label)
                ? 'warning'
                : ['Cancelada', 'Anulada', 'Borrador'].includes(label)
                    ? 'error'
                    : 'neutral'
          return h(UBadge, { color, variant: 'subtle' }, () => label)
        }
        const fieldConfig = tableFields.value.find(item => item.key === field.key)
        return formatCell(fieldConfig ?? field, value)
      }
    }
    return column
  })

  if (isEditable.value || section.value === 'facturas') {
    dataColumns.push({
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => h('div', { class: 'flex min-w-max justify-end gap-1' }, [
        section.value === 'productos' && !isRecordArchived(row.original)
          ? h(UButton, {
              'icon': row.original.estado === 'Borrador' ? 'i-lucide-eye' : 'i-lucide-eye-off',
              'color': row.original.estado === 'Borrador' ? 'success' : 'neutral',
              'variant': 'ghost',
              'size': 'sm',
              'class': 'min-h-10 min-w-10',
              'aria-label': row.original.estado === 'Borrador' ? 'Publicar producto' : 'Ocultar producto',
              'title': row.original.estado === 'Borrador' ? 'Publicar' : 'Ocultar',
              'loading': togglingProductId.value === row.original.id,
              'disabled': togglingProductId.value !== null,
              'onClick': () => toggleProductVisibility(row.original)
            })
          : null,
        canCompleteSale(row.original)
          ? h(UButton, {
              'icon': 'i-lucide-check',
              'color': 'success',
              'variant': 'ghost',
              'size': 'sm',
              'class': 'min-h-10 min-w-10',
              'aria-label': 'Completar venta pendiente',
              'title': 'Completar venta',
              'onClick': () => confirmCompleteSale(row.original)
            })
          : null,
        section.value === 'facturas' || section.value === 'ventas'
          ? h(UButton, {
              'icon': 'i-lucide-share-2',
              'color': 'primary',
              'variant': 'ghost',
              'size': 'sm',
              'class': 'min-h-10 min-w-10',
              'aria-label': 'Compartir comprobante PDF',
              'title': 'Compartir PDF',
              'onClick': () => shareReceipt(row.original)
            })
          : null,
        isEditable.value && !isRecordArchived(row.original) && isSaleEditable(row.original)
          ? h(UButton, {
              'icon': 'i-lucide-pencil',
              'color': 'neutral',
              'variant': 'ghost',
              'size': 'sm',
              'class': 'min-h-10 min-w-10',
              'aria-label': 'Editar registro',
              'title': 'Editar',
              'onClick': () => openEditModal(row.original)
            })
          : null,
        isEditable.value && canArchiveRecord(row.original)
          ? h(UButton, {
              'icon': section.value === 'ventas' ? 'i-lucide-ban' : 'i-lucide-archive',
              'color': 'error',
              'variant': 'ghost',
              'size': 'sm',
              'class': 'min-h-10 min-w-10',
              'aria-label': section.value === 'ventas' ? 'Cancelar venta' : 'Archivar registro',
              'title': section.value === 'ventas' ? 'Cancelar venta' : 'Archivar',
              'onClick': () => confirmArchive(row.original)
            })
          : null,
        supportsArchive.value && isRecordArchived(row.original)
          ? h(UButton, {
              'icon': 'i-lucide-archive-restore',
              'color': 'primary',
              'variant': 'ghost',
              'size': 'sm',
              'class': 'min-h-10 min-w-10',
              'aria-label': 'Restaurar registro',
              'title': 'Restaurar',
              'onClick': () => restoreRecord(row.original)
            })
          : null
      ])
    })
  }
  return dataColumns
})

function resetForm(record?: ManagementRow) {
  for (const key of Object.keys(form)) form[key] = ''
  for (const field of visibleFields.value) form[field.key] = fieldValue(field, record?.[field.key])
  if (section.value === 'productos') {
    form.sku = recordValue(record?.sku) || 'Se asigna al guardar'
    form.categoryId = recordValue(record?.categoryId)
  }
  if (section.value === 'productos' && !record) form.estado = 'Publicado'
  if (section.value === 'productos' && record?.estado === 'Sin stock') form.estado = 'Publicado'
  if (section.value === 'compras') form.fecha = recordValue(record?.fecha) || localDateTime()
  if (section.value === 'precios-proveedor') {
    form.desde = fieldValue({ key: 'desde', label: 'Desde', type: 'datetime-local' }, record?.desde)
    form.hasta = fieldValue({ key: 'hasta', label: 'Hasta', type: 'datetime-local' }, record?.hasta)
  }
}

async function loadFormOptions() {
  const [productsResponse, suppliersResponse, customersResponse, sessionResponse, categoriesResponse] = await Promise.all([
    ['compras', 'precios-proveedor', 'precios-maceta'].includes(section.value)
      ? $fetch<ManagementApiResponse>('/api/management/productos?limit=100')
      : Promise.resolve(null),
    ['compras', 'precios-proveedor'].includes(section.value)
      ? $fetch<ManagementApiResponse>('/api/management/proveedores?limit=100')
      : Promise.resolve(null),
    section.value === 'ventas'
      ? $fetch<ManagementApiResponse>('/api/management/clientes?limit=100')
      : Promise.resolve(null),
    section.value === 'ventas'
      ? $fetch<{ user: { name: string } | null }>('/api/auth/session')
      : Promise.resolve(null),
    section.value === 'productos'
      ? $fetch<CategoriesApiResponse>('/api/categories')
      : Promise.resolve(null)
  ])
  if (section.value === 'ventas' && !editingRecord.value && sessionResponse?.user) {
    salesDraftStore.draft.seller = sessionResponse.user.name
  }
  productOptions.value = (productsResponse?.data ?? []).map(row => ({
    label: `${recordValue(row.nombre)} · ${recordValue(row.sku)}`,
    value: row.id
  }))
  supplierOptions.value = (suppliersResponse?.data ?? []).map(row => ({
    label: recordValue(row.nombre),
    value: row.id
  }))
  customerOptions.value = [
    { label: 'Consumidor final', value: 'consumer-final' },
    ...(customersResponse?.data ?? []).map(row => ({ label: recordValue(row.nombre), value: row.id }))
  ]
  if (categoriesResponse) {
    categoryOptions.value = categoriesResponse.data.map(category => ({
      label: category.nombre,
      value: category.id
    }))
  }
}

async function createCategoryFromProductForm() {
  const nombre = newCategoryName.value.trim()
  if (!nombre || isCreatingCategory.value) return
  isCreatingCategory.value = true
  try {
    const response = await $fetch<{ data: { id: string, nombre: string } }>('/api/categories', {
      method: 'POST',
      body: { nombre }
    })
    categoryOptions.value = [...categoryOptions.value, {
      label: response.data.nombre,
      value: response.data.id
    }].sort((a, b) => a.label.localeCompare(b.label, 'es'))
    form.categoryId = response.data.id
    newCategoryName.value = ''
    categoryModalOpen.value = false
    toast.add({ title: 'Categoría creada', description: 'Se seleccionó para este producto.', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'No se pudo crear la categoría',
      description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      color: 'error'
    })
  } finally {
    isCreatingCategory.value = false
  }
}

async function openCreateModal() {
  editingRecord.value = null
  resetForm()
  if (section.value === 'ventas') {
    salesDraftStore.startNewDraft()
    saleComposerKey.value += 1
  }
  modalOpen.value = true
  try {
    await loadFormOptions()
    if (section.value === 'ventas' && salesDraftStore.draft.lines.length) {
      await salesDraftStore.hydrateDraft()
    }
  } catch {
    toast.add({ title: 'No se pudieron cargar las opciones', description: 'Revisa la conexión e inténtalo nuevamente.', color: 'error' })
  }
}

async function openEditModal(record: ManagementRow) {
  editingRecord.value = record
  resetForm(record)
  if (section.value === 'ventas') saleComposerKey.value += 1
  try {
    await loadFormOptions()
    if (section.value === 'ventas') {
      const receipt = await $fetch<ReceiptData>(`/api/management/ventas/${record.id}/receipt`)
      salesDraftStore.startEditDraft({
        customerId: recordValue(record.clienteId),
        date: recordValue(record.fecha),
        seller: recordValue(record.vendedor),
        status: recordValue(record.estado) === 'Pendiente' ? 'Pendiente' : 'Completada',
        inventoryApplied: record.inventoryManaged === true,
        items: receipt.items.map(item => ({
          productId: String(item.productId),
          size: item.size,
          quantity: item.quantity
        }))
      })
      await salesDraftStore.hydrateDraft()
    }
    modalOpen.value = true
  } catch {
    toast.add({ title: 'No se pudo cargar el registro', description: 'Revisa la conexión e inténtalo nuevamente.', color: 'error' })
    if (section.value === 'ventas') salesDraftStore.cancelEditDraft()
    editingRecord.value = null
  }
}

function payloadFromForm(): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of visibleFields.value) {
    if (field.readonly) continue
    if (section.value === 'productos' && field.key === 'categoria') continue
    const value = form[field.key] ?? ''
    if (section.value === 'accesos' && field.key === 'password' && !String(value).trim()) continue
    if (field.type === 'number') payload[field.key] = Number(value || 0)
    else if (field.type === 'datetime-local') payload[field.key] = value ? new Date(value).toISOString() : ''
    else payload[field.key] = value
  }
  if (section.value === 'productos') payload.categoryId = Number(form.categoryId || 0)
  if (section.value === 'ubicaciones') payload.monitoreada = form.monitoreada === 'Sí'
  return payload
}

function validationMessage(field: ManagementField): string | undefined {
  if (!field.required || String(form[field.key] ?? '').trim()) return
  return `Completa “${field.label}” para continuar.`
}

async function uploadProductImage(file: File | null, fromUrl?: string) {
  if (!file && !fromUrl) return undefined

  const formData = new FormData()
  if (file) {
    formData.append('image', file)
    formData.append('source', 'upload')
  }
  if (fromUrl) {
    formData.append('url', fromUrl)
    formData.append('source', 'url')
  }

  isUploadingProductImage.value = true
  imageUploadError.value = ''

  try {
    const response = await $fetch<{ data?: { url?: string } }>('/api/upload/imgbb', {
      method: 'POST',
      body: formData
    })

    const uploadedUrl = response.data?.url?.trim()
    if (!uploadedUrl) {
      throw new Error('La respuesta de imgbb no devolvió una URL válida.')
    }

    form.imageUrl = uploadedUrl
    if (failedProductImages.value[uploadedUrl]) {
      failedProductImages.value[uploadedUrl] = false
    }
    return uploadedUrl
  } catch (error: unknown) {
    const responseMessage = typeof error === 'object' && error !== null && 'data' in error
      && typeof error.data === 'object' && error.data !== null
      && 'statusMessage' in error.data && typeof error.data.statusMessage === 'string'
      ? error.data.statusMessage
      : undefined
    const statusMessage = typeof error === 'object' && error !== null
      && 'statusMessage' in error && typeof error.statusMessage === 'string'
      ? error.statusMessage
      : undefined
    const message = responseMessage
      || statusMessage
      || (error instanceof Error ? error.message : 'No se pudo subir la imagen.')
    imageUploadError.value = message
    toast.add({
      title: 'No se pudo guardar la imagen',
      description: message,
      color: 'error'
    })
    return undefined
  } finally {
    isUploadingProductImage.value = false
  }
}

async function saveDatabaseRecord() {
  if (section.value === 'ventas') {
    await salesDraftStore.hydrateDraft()
    const draft = salesDraftStore.draft
    if (!draft.date || !draft.seller.trim()) throw new Error('Completa la fecha y el vendedor.')
    if (!draft.lines.length) throw new Error('Agrega al menos un producto al carrito.')
    if (salesDraftStore.hasUnpricedLines) throw new Error('Selecciona un tamaño con precio para cada producto.')
    if (salesDraftStore.hasStockIssues) throw new Error('Revisa las cantidades: el stock disponible no alcanza.')

    const customer = customerOptions.value.find(option => option.value === draft.customerId)
    const payload = salesDraftStore.payload(customer?.label ?? 'Consumidor Final')
    const url = editingRecord.value
      ? `/api/management/ventas/${editingRecord.value.id}`
      : '/api/management/ventas'
    if (editingRecord.value) await $fetch(url, { method: 'PUT', body: payload })
    else await $fetch(url, { method: 'POST', body: payload })
    return
  }

  const payload = payloadFromForm()
  if (section.value === 'accesos') {
    const password = String(form.password ?? '')
    if ((!editingRecord.value || password) && password.length < 12) {
      throw new Error('La contraseña debe tener al menos 12 caracteres.')
    }
  }
  for (const field of visibleFields.value) {
    if (section.value === 'productos' && field.key === 'categoria') continue
    const message = validationMessage(field)
    if (message) throw new Error(message)
  }
  if (section.value === 'productos' && !form.categoryId) throw new Error('Selecciona una categoría para el producto.')
  if (section.value === 'proveedores' && !String(form.nombre ?? '').trim()) throw new Error('Ingresa el nombre del proveedor.')
  if (section.value === 'productos') {
    const imageUrl = String(form.imageUrl ?? '').trim()
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      throw new Error('La URL de imagen debe empezar con http:// o https://.')
    }
  }
  const url = editingRecord.value
    ? `/api/management/${section.value}/${editingRecord.value.id}`
    : `/api/management/${section.value}`
  if (editingRecord.value) await $fetch(url, { method: 'PUT', body: payload })
  else await $fetch(url, { method: 'POST', body: payload })
}

function saveDemoRecord() {
  const module = managementModule.value
  if (!module) return
  const missing = module.fields.find(field => field.required && !String(form[field.key] ?? '').trim())
  if (missing) throw new Error(`Completa “${missing.label}” para continuar.`)
  const nextRecord: ManagementRow = {
    id: editingRecord.value?.id ?? `${section.value.toUpperCase()}-${Date.now().toString().slice(-5)}`
  }
  for (const field of module.fields) {
    nextRecord[field.key] = field.type === 'number' ? Number(form[field.key] || 0) : form[field.key] ?? ''
  }
  const moduleRecords = demoRecords.value[section.value]
  if (editingRecord.value) {
    const index = moduleRecords.findIndex(row => row.id === editingRecord.value?.id)
    if (index !== -1) moduleRecords.splice(index, 1, nextRecord)
  } else {
    moduleRecords.unshift(nextRecord)
  }
}

async function saveRecord() {
  if (isSaving.value) return
  isSaving.value = true
  try {
    if (isDatabaseSection.value) await saveDatabaseRecord()
    else saveDemoRecord()
    toast.add({
      title: editingRecord.value ? 'Registro actualizado' : 'Registro creado',
      description: section.value === 'productos' && !editingRecord.value
        ? 'El SKU único se generó y guardó automáticamente.'
        : isDatabaseSection.value ? 'Los cambios se guardaron en PostgreSQL.' : 'El cambio solo está guardado en esta sesión de demostración.',
      color: 'success'
    })
    if (section.value === 'ventas') salesDraftStore.clearDraft()
    modalOpen.value = false
    if (isDatabaseSection.value) await refresh()
  } catch (error) {
    toast.add({
      title: 'No se pudo guardar',
      description: error instanceof Error ? error.message : 'Revisa los datos e inténtalo nuevamente.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

function confirmArchive(record: ManagementRow) {
  recordToArchive.value = record
  archiveModalOpen.value = true
}

async function archiveRecord() {
  if (!recordToArchive.value || isArchiving.value) return
  isArchiving.value = true
  try {
    if (isDatabaseSection.value) {
      await $fetch(`/api/management/${section.value}/${recordToArchive.value.id}`, { method: 'DELETE' })
      await refresh()
    } else {
      demoRecords.value[section.value] = demoRecords.value[section.value]
        .filter(row => row.id !== recordToArchive.value?.id)
    }
    toast.add({
      title: section.value === 'ventas' ? 'Venta cancelada' : 'Registro archivado',
      description: section.value === 'ventas'
        ? 'La venta se conserva en el historial y, si correspondía, el stock fue restituido.'
        : 'El registro se conserva y puede restaurarse desde los archivados.',
      color: 'success'
    })
    archiveModalOpen.value = false
    recordToArchive.value = null
  } catch (error) {
    toast.add({
      title: 'No se pudo archivar',
      description: error instanceof Error ? error.message : 'No se modificaron los datos.',
      color: 'error'
    })
  } finally {
    isArchiving.value = false
  }
}

async function restoreRecord(record: ManagementRow) {
  try {
    await $fetch(`/api/management/${section.value}/${record.id}/restore`, { method: 'POST' })
    toast.add({ title: 'Registro restaurado', color: 'success' })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'No se pudo restaurar',
      description: error instanceof Error ? error.message : 'No se modificaron los datos.',
      color: 'error'
    })
  }
}

async function loadAllExportRows(targetSection: ViveroSection): Promise<ManagementRow[]> {
  const request = (pageNumber: number) => $fetch<ManagementApiResponse>(`/api/management/${targetSection}`, {
    query: { page: pageNumber, limit: 100, archived: 'false' }
  })
  const firstPage = await request(1)
  if (!firstPage.data || !firstPage.meta) {
    throw new Error('La API no devolvió los datos necesarios para completar la exportación.')
  }

  const rows = [...firstPage.data]
  for (let pageNumber = 2; pageNumber <= firstPage.meta.totalPages; pageNumber++) {
    const response = await request(pageNumber)
    if (!response.data) {
      throw new Error(`No se pudieron cargar los registros de la página ${pageNumber}.`)
    }
    rows.push(...response.data)
  }
  return rows
}

async function exportCsv(): Promise<void> {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const targetSection = section.value
    const rows = await loadAllExportRows(targetSection)
    const exportColumns = targetSection === 'productos'
      ? [
          { key: 'nombre', label: 'Producto' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'sku', label: 'SKU' },
          { key: 'stock', label: 'Stock actual' },
          { key: 'precio', label: 'Precio de venta' },
          { key: 'estado', label: 'Estado' }
        ]
      : targetSection === 'categorias'
        ? [
            { key: 'nombre', label: 'Categoría' },
            { key: 'productos', label: 'Cantidad de productos' },
            { key: 'estado', label: 'Estado' }
          ]
        : [
            { key: 'fecha', label: 'Fecha' },
            { key: 'hora', label: 'Hora' },
            { key: 'cliente', label: 'Cliente' },
            { key: 'vendedor', label: 'Vendedor' },
            { key: 'total', label: 'Total' },
            { key: 'estado', label: 'Estado' },
            { key: 'tipo', label: 'Comprobante' },
            { key: 'numero', label: 'Número' },
            { key: 'items', label: 'Artículos' }
          ]
    const filename = targetSection === 'productos'
      ? 'inventario-vivero-emma.csv'
      : targetSection === 'categorias'
        ? 'categorias-vivero-emma.csv'
        : 'historial-ventas-vivero-emma.csv'

    downloadCsv(rows, exportColumns, filename)
    toast.add({
      title: 'CSV descargado',
      description: `Se exportaron ${rows.length} registros.`,
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'No se pudo exportar el CSV',
      description: error instanceof Error ? error.message : 'Verifica la conexión e inténtalo nuevamente.',
      color: 'error'
    })
  } finally {
    isExporting.value = false
  }
}

async function exportPriceListPdf(): Promise<void> {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const rows = await loadAllExportRows('productos')
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const margin = 16
    const pageWidth = pdf.internal.pageSize.getWidth()
    let y = 18

    const addLine = (text: string, size = 10, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      pdf.setFontSize(size)
      const wrapped = pdf.splitTextToSize(text, pageWidth - margin * 2)
      if (y + wrapped.length * 5 > 280) {
        pdf.addPage()
        y = 18
      }
      pdf.text(wrapped, margin, y)
      y += wrapped.length * 5 + 2
    }

    addLine('VIVERO EMMA · LISTA DE PRECIOS', 16, true)
    addLine(`Actualizada: ${new Date().toLocaleDateString('es-AR')}`)
    y += 3
    for (const row of rows) {
      addLine(`${recordValue(row.nombre)} · ${recordValue(row.categoria)} · SKU ${recordValue(row.sku)} · ${currency(Number(row.precio ?? 0))} · Stock: ${recordValue(row.stock)}`)
    }
    pdf.save('lista-precios-vivero-emma.pdf')
    toast.add({
      title: 'Lista de precios descargada',
      description: `Se incluyeron ${rows.length} productos e inventario actual.`,
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'No se pudo generar el PDF',
      description: error instanceof Error ? error.message : 'Verifica la conexión e inténtalo nuevamente.',
      color: 'error'
    })
  } finally {
    isExporting.value = false
  }
}

async function openPriceAdjustment(): Promise<void> {
  try {
    const response = await $fetch<CategoriesApiResponse>('/api/categories')
    categoryOptions.value = response.data.map(category => ({
      label: category.nombre,
      value: category.id
    }))
    selectedPriceCategoryId.value = categoryOptions.value[0]?.value ?? ''
    priceAdjustmentMode.value = 'percentage'
    priceAdjustmentAmount.value = ''
    priceAdjustmentModalOpen.value = true
  } catch (error) {
    toast.add({
      title: 'No se pudieron cargar las categorías',
      description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      color: 'error'
    })
  }
}

async function applyCategoryPriceAdjustment(): Promise<void> {
  const amount = Number(priceAdjustmentAmount.value)
  if (!selectedPriceCategoryId.value || !priceAdjustmentAmount.value.trim() || !Number.isFinite(amount)) {
    toast.add({ title: 'Completa la categoría y el ajuste', color: 'error' })
    return
  }
  if (isApplyingPriceAdjustment.value) return

  isApplyingPriceAdjustment.value = true
  try {
    const response = await $fetch<{ data: { updated: number } }>('/api/stock/prices/bulk', {
      method: 'POST',
      body: {
        categoryId: Number(selectedPriceCategoryId.value),
        mode: priceAdjustmentMode.value,
        amount
      }
    })
    priceAdjustmentModalOpen.value = false
    toast.add({
      title: 'Precios actualizados',
      description: `Se actualizaron ${response.data.updated} productos de la categoría.`,
      color: 'success'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'No se pudieron actualizar los precios',
      description: error instanceof Error ? error.message : 'No se aplicaron cambios.',
      color: 'error'
    })
  } finally {
    isApplyingPriceAdjustment.value = false
  }
}

async function shareReceipt(row: ManagementRow) {
  try {
    const receipt = await $fetch<ReceiptData>(`/api/management/facturas/${row.id}/receipt`)
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 16
    let y = 18
    const addLine = (text: string, size = 10, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      pdf.setFontSize(size)
      const wrapped = pdf.splitTextToSize(text, pageWidth - margin * 2)
      if (y + wrapped.length * 5 > 280) {
        pdf.addPage()
        y = 18
      }
      pdf.text(wrapped, margin, y)
      y += wrapped.length * 5 + 2
    }

    addLine('VIVERO EMMA', 18, true)
    addLine('COMPROBANTE INTERNO · NO FISCAL', 12, true)
    addLine(`Comprobante: ${receipt.invoiceNumber || `#${receipt.id}`}`)
    addLine(`Fecha: ${receipt.date}${receipt.time ? ` ${receipt.time}` : ''}`)
    addLine(`Estado: ${receipt.status}`)
    y += 3
    addLine(`Cliente: ${receipt.customer}`, 11, true)
    if (receipt.taxId) addLine(`CUIT / DNI: ${receipt.taxId}`)
    if (receipt.ivaCondition) addLine(`Condición IVA: ${receipt.ivaCondition}`)
    if (receipt.address) addLine(`Domicilio: ${receipt.address}`)
    if (receipt.email) addLine(`Correo: ${receipt.email}`)
    y += 5
    addLine('DETALLE', 11, true)
    for (const item of receipt.items) {
      addLine(`${item.quantity} × ${item.name}${item.size ? ` · Maceta ${item.size}` : ''} · ${currency(item.price)} = ${currency(item.subtotal)}`)
    }
    y += 3
    addLine(`TOTAL: ${currency(receipt.total)}`, 14, true)
    addLine(`Atendido por: ${receipt.seller}`)
    y += 6
    addLine('Este documento es un comprobante interno y no reemplaza una factura fiscal autorizada por ARCA.', 9)

    const file = new File([pdf.output('blob')], `comprobante-${receipt.id}.pdf`, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        files: [file],
        title: `Comprobante ${receipt.id} · Vivero Emma`,
        text: 'Comprobante interno no fiscal de Vivero Emma.'
      })
      return
    }

    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
    toast.add({ title: 'PDF descargado', description: 'Puedes adjuntarlo desde Descargas a WhatsApp, correo u otra aplicación.', color: 'success' })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    toast.add({
      title: 'No se pudo compartir el comprobante',
      description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      color: 'error'
    })
  }
}

function visibleCardFields(row: ManagementRow) {
  return tableFields.value.filter(field => field.key !== 'archivado' && field.key !== 'imageUrl' && row[field.key] !== undefined).slice(0, 4)
}
</script>

<template>
  <UDashboardPanel id="vivero-management">
    <template #header>
      <UDashboardNavbar :title="managementModule?.title ?? 'Gestión'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="isEditable && !archivedView"
            :label="`Nuevo ${managementModule?.singular ?? 'registro'}`"
            icon="i-lucide-plus"
            class="min-h-11"
            @click="openCreateModal"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <template v-if="managementModule">
        <div class="mb-5 flex items-start gap-3">
          <UIcon :name="managementModule.icon" class="mt-1 size-5 shrink-0 text-primary" />
          <div>
            <h2 class="text-lg font-semibold text-highlighted">
              {{ managementModule.title }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ managementModule.description }}
            </p>
          </div>
        </div>

        <UAlert
          v-if="managementError"
          color="error"
          title="No se pudieron cargar los datos"
          description="Verifica la conexión con PostgreSQL e inténtalo nuevamente."
          class="mb-4"
        />
        <UAlert
          v-else-if="isDatabaseSection && isEditable"
          color="success"
          variant="subtle"
          icon="i-lucide-database"
          title="Datos conectados"
          description="Los cambios se guardan en PostgreSQL. Los registros relacionados se archivan para conservar el historial."
          class="mb-4"
        />
        <UAlert
          v-else-if="isDatabaseSection"
          color="neutral"
          variant="subtle"
          icon="i-lucide-database"
          title="Vista derivada o de solo lectura"
          description="Esta información se calcula desde los registros existentes o se conserva como comprobante."
          class="mb-4"
        />
        <UAlert
          v-else
          color="warning"
          variant="subtle"
          icon="i-lucide-flask-conical"
          title="Vista de demostración"
          description="Esta sección todavía no está conectada a una tabla de negocio de PostgreSQL."
          class="mb-4"
        />

        <div class="mb-4 grid gap-3 sm:grid-cols-2">
          <UInput
            v-model="searchInput"
            icon="i-lucide-search"
            placeholder="Buscar..."
            aria-label="Buscar registros"
            class="w-full"
          />
          <div class="grid grid-cols-2 gap-2">
            <USelect
              v-if="showStatusFilter"
              v-model="statusFilter"
              :items="['Todos', ...statusOptions]"
              aria-label="Filtrar por estado"
              class="w-full"
            />
            <USelect
              v-model="pageSize"
              :items="[{ label: '20 por página', value: '20' }, { label: '50 por página', value: '50' }]"
              aria-label="Registros por página"
              class="w-full"
            />
            <UButton
              v-if="supportsArchive"
              :label="archivedView ? 'Ver activos' : 'Ver archivados'"
              :icon="archivedView ? 'i-lucide-list' : 'i-lucide-archive'"
              color="neutral"
              variant="subtle"
              class="col-span-2 min-h-11"
              @click="archivedView = !archivedView"
            />
          </div>
        </div>

        <div v-if="canExportData" class="mb-4 flex flex-wrap justify-end gap-2">
          <UButton
            v-if="section === 'productos'"
            label="Ingresar reposición"
            icon="i-lucide-package-plus"
            color="primary"
            variant="subtle"
            to="/dashboard/inventory/replenish"
            class="min-h-11"
          />
          <UButton
            v-if="section === 'productos'"
            label="Ajuste masivo de precios"
            icon="i-lucide-tags"
            color="neutral"
            variant="subtle"
            class="min-h-11"
            @click="openPriceAdjustment"
          />
          <UButton
            label="Exportar CSV"
            icon="i-lucide-file-spreadsheet"
            color="neutral"
            variant="subtle"
            :loading="isExporting"
            :disabled="isExporting"
            class="min-h-11"
            @click="exportCsv"
          />
          <UButton
            v-if="section === 'productos'"
            label="Lista de precios PDF"
            icon="i-lucide-file-text"
            color="neutral"
            variant="subtle"
            :loading="isExporting"
            :disabled="isExporting"
            class="min-h-11"
            @click="exportPriceListPdf"
          />
        </div>

        <UAlert
          v-if="section === 'ventas'"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="Ventas y comprobantes"
          description="Las ventas completadas descuentan stock compartido por planta. Las medidas elegidas y sus precios quedan guardados en el detalle. Los comprobantes PDF son internos, no fiscales."
          class="mb-4"
        />

        <div class="mb-3 flex items-center justify-between gap-2 text-sm text-muted">
          <span>{{ totalRows }} registros</span>
          <span>{{ rangeStart }}–{{ rangeEnd }} de {{ totalRows }}</span>
        </div>

        <div v-if="isLoading" aria-busy="true" aria-label="Cargando registros">
          <div class="space-y-3 md:hidden">
            <UCard v-for="card in 3" :key="card">
              <div class="space-y-3">
                <USkeleton class="h-5 w-2/3" />
                <USkeleton class="h-4 w-full" />
                <USkeleton class="h-4 w-4/5" />
                <USkeleton class="h-4 w-1/2" />
              </div>
            </UCard>
          </div>
          <div class="hidden space-y-3 md:block">
            <div class="grid grid-cols-6 gap-4 rounded-lg bg-elevated/50 px-4 py-3">
              <USkeleton v-for="column in 6" :key="column" class="h-4 w-3/4" />
            </div>
            <div v-for="row in 6" :key="row" class="grid grid-cols-6 gap-4 border-b border-default px-4 py-4">
              <USkeleton v-for="column in 6" :key="column" class="h-5 w-full" />
            </div>
          </div>
        </div>

        <div v-else-if="displayRows.length" class="grid gap-3 md:hidden">
          <UCard v-for="row in displayRows" :key="row.id">
            <div class="space-y-3">
              <button
                v-if="section === 'productos' && row.imageUrl && !failedProductImages[recordValue(row.imageUrl)]"
                type="button"
                class="flex min-h-20 w-full items-center gap-3 rounded-lg bg-elevated/40 p-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
                :aria-label="`Ampliar imagen de ${recordValue(row.nombre)}`"
                @click="openProductImage(row)"
              >
                <img
                  :src="recordValue(row.imageUrl)"
                  :alt="recordValue(row.nombre)"
                  class="size-16 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                  @error="markProductImageFailed(recordValue(row.imageUrl))"
                >
                <span class="text-xs font-medium text-muted">Toca la imagen para verla ampliada</span>
              </button>
              <div
                v-else-if="section === 'productos'"
                class="flex size-16 items-center justify-center rounded-lg bg-elevated text-muted"
                aria-label="Producto sin imagen"
              >
                <UIcon name="i-lucide-image-off" class="size-6" />
              </div>
              <div v-for="field in visibleCardFields(row)" :key="field.key" class="flex items-start justify-between gap-4">
                <span class="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">
                  {{ field.label }}
                </span>
                <span class="break-words text-right text-sm font-medium text-highlighted">
                  {{ formatCell(field, row[field.key]) }}
                </span>
              </div>
              <div v-if="isEditable || section === 'facturas'" class="flex flex-wrap justify-end gap-2 border-t border-default pt-3">
                <UButton
                  v-if="section === 'productos' && !isRecordArchived(row)"
                  :label="row.estado === 'Borrador' ? 'Publicar' : 'Ocultar'"
                  :icon="row.estado === 'Borrador' ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                  :color="row.estado === 'Borrador' ? 'success' : 'neutral'"
                  variant="subtle"
                  class="min-h-11"
                  :loading="togglingProductId === row.id"
                  :disabled="togglingProductId !== null"
                  @click="toggleProductVisibility(row)"
                />
                <UButton
                  v-if="section === 'ventas' && canCompleteSale(row)"
                  label="Completar venta"
                  icon="i-lucide-check"
                  color="success"
                  variant="subtle"
                  class="min-h-11"
                  @click="confirmCompleteSale(row)"
                />
                <UButton
                  v-if="section === 'ventas' || section === 'facturas'"
                  label="Compartir PDF"
                  icon="i-lucide-share-2"
                  color="primary"
                  variant="subtle"
                  class="min-h-11"
                  @click="shareReceipt(row)"
                />
                <UButton
                  v-if="isEditable && !isRecordArchived(row) && isSaleEditable(row)"
                  label="Editar"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="subtle"
                  class="min-h-11"
                  @click="openEditModal(row)"
                />
                <UButton
                  v-if="isEditable && canArchiveRecord(row)"
                  :label="section === 'ventas' ? 'Cancelar venta' : 'Archivar'"
                  :icon="section === 'ventas' ? 'i-lucide-ban' : 'i-lucide-archive'"
                  color="error"
                  variant="subtle"
                  class="min-h-11"
                  @click="confirmArchive(row)"
                />
                <UButton
                  v-if="supportsArchive && isRecordArchived(row)"
                  label="Restaurar"
                  icon="i-lucide-archive-restore"
                  color="primary"
                  variant="subtle"
                  class="min-h-11"
                  @click="restoreRecord(row)"
                />
              </div>
            </div>
          </UCard>
        </div>
        <div v-else class="rounded-xl border border-dashed border-default p-8 text-center">
          <UIcon name="i-lucide-inbox" class="mx-auto size-8 text-muted" />
          <p class="mt-2 font-medium text-highlighted">
            No hay registros para mostrar
          </p>
          <p class="mt-1 text-sm text-muted">
            Ajusta la búsqueda o agrega un registro nuevo.
          </p>
        </div>

        <div v-if="!isLoading" class="hidden overflow-x-auto md:block">
          <UTable
            :data="displayRows"
            :columns="columns"
            class="min-w-[760px] shrink-0"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'py-3 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default',
              separator: 'h-0'
            }"
          />
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <UButton
            label="Anterior"
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="subtle"
            :disabled="page <= 1"
            class="min-h-11"
            @click="page--"
          />
          <span class="text-sm text-muted">
            Página {{ page }} de {{ Math.max(totalPages, 1) }}
          </span>
          <UButton
            label="Siguiente"
            trailing-icon="i-lucide-chevron-right"
            color="neutral"
            variant="subtle"
            :disabled="page >= totalPages"
            class="min-h-11"
            @click="page++"
          />
        </div>
      </template>
      <UAlert
        v-else
        color="error"
        title="Sección no encontrada"
        description="La sección solicitada no existe."
      />
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="modalOpen"
    :title="`${editingRecord ? 'Editar' : 'Nuevo'} ${managementModule?.singular ?? 'registro'}`"
    :description="section === 'productos' ? 'El SKU se genera de forma automática y no se puede modificar.' : managementModule?.description"
    :ui="{ content: 'max-h-[90dvh] overflow-y-auto sm:max-w-xl' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="saveRecord">
        <ManagementSaleComposer
          v-if="section === 'ventas'"
          :key="saleComposerKey"
          v-model="salesDraftStore.draft"
          :customers="customerOptions"
          :allow-new-customer="!editingRecord"
          :is-editing="Boolean(editingRecord)"
        />

        <template v-else>
          <template v-for="formField in visibleFields" :key="formField.key">
            <UFormField
              :label="formField.label"
              :name="formField.key"
              :required="formField.required || (section === 'accesos' && formField.key === 'password' && !editingRecord)"
              :description="formField.help"
            >
              <template #default>
                <div v-if="section === 'productos' && formField.key === 'imageUrl'" class="space-y-3">
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <UInput
                      v-model="form.imageUrl"
                      type="url"
                      placeholder="https://... o pega una URL"
                      class="w-full"
                    />
                    <UButton
                      label="Subir imagen"
                      icon="i-lucide-upload"
                      color="primary"
                      variant="subtle"
                      class="min-h-11 shrink-0"
                      :loading="isUploadingProductImage"
                      :disabled="!form.imageUrl || isUploadingProductImage"
                      @click="uploadProductImage(null, form.imageUrl)"
                    />
                  </div>
                  <div class="flex items-center gap-3">
                    <input
                      id="product-image-file-input"
                      ref="imageInputRef"
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="async (event) => {
                        const file = (event.target as HTMLInputElement).files?.[0] ?? null
                        if (!file) return
                        await uploadProductImage(file)
                        ;(event.target as HTMLInputElement).value = ''
                      }"
                    >
                    <UButton
                      label="Elegir archivo"
                      icon="i-lucide-image"
                      color="neutral"
                      variant="subtle"
                      class="min-h-11"
                      @click="triggerImagePicker"
                    />
                    <span v-if="imageUploadError" class="text-xs text-error">{{ imageUploadError }}</span>
                  </div>
                  <button
                    v-if="form.imageUrl && !failedProductImages[form.imageUrl]"
                    type="button"
                    class="block max-w-full rounded-xl border border-default p-1 focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label="Ampliar vista previa de la imagen"
                    @click="focusedProductImage = { src: form.imageUrl, alt: form.nombre || 'Vista previa del producto' }"
                  >
                    <img
                      :src="form.imageUrl"
                      :alt="form.nombre || 'Vista previa del producto'"
                      class="max-h-48 max-w-full rounded-lg object-contain"
                      loading="lazy"
                      @error="markProductImageFailed(form.imageUrl)"
                    >
                  </button>
                  <p v-else class="text-xs text-muted">
                    {{ form.imageUrl ? 'No se pudo cargar la imagen desde esa URL.' : 'Puedes pegar una URL o elegir un archivo para cargarla en imgbb.' }}
                  </p>
                </div>
                <div v-else-if="section === 'productos' && formField.key === 'categoria'" class="flex gap-2">
                  <USelect
                    v-model="form.categoryId"
                    :items="categoryOptions"
                    :disabled="categoryOptions.length === 0"
                    placeholder="Selecciona una categoría"
                    class="w-full"
                  />
                  <UButton
                    label="+ Nueva categoría"
                    color="neutral"
                    variant="subtle"
                    class="min-h-11 shrink-0"
                    @click="categoryModalOpen = true"
                  />
                </div>
                <component
                  :is="formField.type === 'select' ? USelectComponent : UInputComponent"
                  v-else
                  v-model="form[formField.key]"
                  :items="formField.type === 'select'
                    ? formField.key === 'productoId' ? productOptions : formField.key === 'proveedorId' ? supplierOptions : formField.options ?? []
                    : undefined"
                  :type="formField.type === 'select' ? undefined : formField.type ?? 'text'"
                  :min="formField.type === 'number' ? 0 : undefined"
                  :step="formField.format === 'currency' ? '0.01' : formField.type === 'number' ? '1' : undefined"
                  :disabled="formField.readonly"
                  :placeholder="section === 'productos' && formField.key === 'imageUrl' ? 'https://...' : undefined"
                  class="w-full"
                />
              </template>
            </UFormField>
          </template>
        </template>

        <div class="grid grid-cols-2 gap-2 border-t border-default pt-4">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            class="min-h-11"
            @click="modalOpen = false"
          />
          <UButton
            :label="section === 'ventas' ? editingRecord ? 'Guardar cambios' : 'Cobrar venta' : editingRecord ? 'Guardar cambios' : 'Crear registro'"
            :icon="section === 'ventas' ? 'i-lucide-banknote' : 'i-lucide-check'"
            type="submit"
            :loading="isSaving"
            :disabled="section === 'ventas' && (
              !salesDraftStore.draft.lines.length
              || salesDraftStore.hasUnpricedLines
              || salesDraftStore.hasStockIssues
            )"
            class="min-h-11"
          />
        </div>
      </form>
    </template>
  </UModal>

  <UModal
    v-model:open="categoryModalOpen"
    title="Nueva categoría"
    description="La categoría se guardará y quedará seleccionada en el producto actual."
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="createCategoryFromProductForm">
        <UFormField label="Nombre" required>
          <UInput
            v-model="newCategoryName"
            maxlength="50"
            autofocus
            placeholder="Ej.: Plantas de interior"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            class="min-h-11"
            :disabled="isCreatingCategory"
            @click="categoryModalOpen = false"
          />
          <UButton
            label="Crear categoría"
            type="submit"
            :loading="isCreatingCategory"
            class="min-h-11"
          />
        </div>
      </form>
    </template>
  </UModal>

  <UModal
    v-model:open="priceAdjustmentModalOpen"
    title="Ajuste masivo de precios"
    description="El ajuste se aplicará a todos los productos activos de la categoría seleccionada."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="applyCategoryPriceAdjustment">
        <UFormField label="Categoría" required>
          <USelect
            v-model="selectedPriceCategoryId"
            :items="categoryOptions"
            placeholder="Selecciona una categoría"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tipo de ajuste" required>
          <USelect
            v-model="priceAdjustmentMode"
            :items="[
              { label: 'Porcentaje (%)', value: 'percentage' },
              { label: 'Importe fijo ($)', value: 'fixed' }
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="priceAdjustmentMode === 'percentage' ? 'Porcentaje (usa negativo para descontar)' : 'Importe (usa negativo para descontar)'" required>
          <UInput
            v-model="priceAdjustmentAmount"
            type="number"
            step="0.01"
            :min="priceAdjustmentMode === 'percentage' ? -100 : -99999999.99"
            :max="priceAdjustmentMode === 'percentage' ? 10000 : 99999999.99"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            class="min-h-11"
            :disabled="isApplyingPriceAdjustment"
            @click="priceAdjustmentModalOpen = false"
          />
          <UButton
            label="Aplicar a la categoría"
            type="submit"
            :loading="isApplyingPriceAdjustment"
            class="min-h-11"
          />
        </div>
      </form>
    </template>
  </UModal>

  <UModal
    :open="focusedProductImage !== null"
    :title="focusedProductImage?.alt ?? 'Imagen del producto'"
    :ui="{ content: 'max-h-[95dvh] sm:max-w-4xl' }"
    @update:open="(open) => { if (!open) focusedProductImage = null }"
  >
    <template #body>
      <div class="flex max-h-[80dvh] items-center justify-center overflow-auto">
        <img
          v-if="focusedProductImage"
          :src="focusedProductImage.src"
          :alt="focusedProductImage.alt"
          class="max-h-[78dvh] max-w-full rounded-lg object-contain"
        >
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="archiveModalOpen"
    :title="section === 'ventas' ? 'Cancelar venta' : 'Archivar registro'"
    :description="section === 'ventas'
      ? 'La venta no se borrará. Si fue registrada por este panel, el stock compartido se restituirá una sola vez. Los comprobantes fiscales emitidos no pueden cancelarse aquí.'
      : section === 'compras'
        ? 'La compra se conservará en el historial y se intentará revertir su cantidad del stock. No podrá archivarse si deja el stock por debajo de cero.'
        : 'El registro no se borrará físicamente y podrá restaurarse después.'"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="grid grid-cols-2 gap-2">
        <UButton
          label="Volver"
          color="neutral"
          variant="subtle"
          class="min-h-11"
          @click="archiveModalOpen = false"
        />
        <UButton
          :label="section === 'ventas' ? 'Cancelar venta' : 'Archivar'"
          :icon="section === 'ventas' ? 'i-lucide-ban' : 'i-lucide-archive'"
          color="error"
          :loading="isArchiving"
          class="min-h-11"
          @click="archiveRecord"
        />
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="completeSaleModalOpen"
    title="Completar venta pendiente"
    :description="saleToComplete
      ? `Venta #${saleToComplete.id} · ${recordValue(saleToComplete.cliente)} · ${currency(Number(saleToComplete.total ?? 0))}`
      : 'Confirma la finalización de esta venta.'"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-package-minus"
          title="Se actualizará el inventario"
          description="Al confirmar, la venta pasará a Completada y se descontarán del stock las cantidades guardadas. Los productos y precios de la venta no se modificarán."
        />
        <div class="grid grid-cols-2 gap-2">
          <UButton
            label="Volver"
            color="neutral"
            variant="subtle"
            class="min-h-11"
            :disabled="isCompletingSale"
            @click="completeSaleModalOpen = false"
          />
          <UButton
            label="Confirmar y descontar stock"
            icon="i-lucide-check"
            color="success"
            class="min-h-11"
            :loading="isCompletingSale"
            @click="completeSale"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
