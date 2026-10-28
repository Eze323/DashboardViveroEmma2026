<script setup lang="ts">
import type { ManagementRow } from '~/utils/vivero'

interface ProductSearchResponse {
  data: ManagementRow[]
}

interface ReplenishmentLine {
  productId: string
  nombre: string
  categoria: string
  stock: number
  precioActual: number
  cantidadEntrante: string
  nuevoPrecio: string
}

const toast = useToast()
const searchInput = ref('')
const searchResults = ref<ManagementRow[]>([])
const searchError = ref('')
const isSearching = ref(false)
const isSaving = ref(false)
const lines = ref<ReplenishmentLine[]>([])

watchDebounced(searchInput, async (value) => {
  const search = value.trim()
  searchError.value = ''
  if (search.length < 2) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    const response = await $fetch<ProductSearchResponse>('/api/management/productos', {
      query: { q: search, limit: 50, archived: 'false' }
    })
    searchResults.value = response.data.filter(product => !lines.value.some(line => line.productId === product.id))
  } catch (error) {
    searchError.value = error instanceof Error ? error.message : 'No se pudieron buscar productos.'
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}, { debounce: 250 })

function addProduct(product: ManagementRow): void {
  if (lines.value.some(line => line.productId === product.id)) return
  lines.value.push({
    productId: product.id,
    nombre: String(product.nombre ?? ''),
    categoria: String(product.categoria ?? ''),
    stock: Number(product.stock ?? 0),
    precioActual: Number(product.precio ?? 0),
    cantidadEntrante: '',
    nuevoPrecio: ''
  })
  searchInput.value = ''
  searchResults.value = []
}

function removeProduct(productId: string): void {
  lines.value = lines.value.filter(line => line.productId !== productId)
}

async function confirmReplenishment(): Promise<void> {
  if (isSaving.value || !lines.value.length) return
  const invalidLine = lines.value.find((line) => {
    const quantity = Number(line.cantidadEntrante)
    const price = line.nuevoPrecio.trim() ? Number(line.nuevoPrecio) : undefined
    return !Number.isSafeInteger(quantity)
      || quantity <= 0
      || (price !== undefined && (!Number.isFinite(price) || price < 0))
  })
  if (invalidLine) {
    toast.add({
      title: 'Revisa la cantidad y el nuevo precio',
      description: `Los datos de "${invalidLine.nombre}" no son válidos.`,
      color: 'error'
    })
    return
  }

  isSaving.value = true
  try {
    await $fetch('/api/stock/replenish', {
      method: 'POST',
      body: lines.value.map(line => ({
        productId: Number(line.productId),
        addedQuantity: Number(line.cantidadEntrante),
        ...(line.nuevoPrecio.trim() ? { newPrice: Number(line.nuevoPrecio) } : {})
      }))
    })
    toast.add({
      title: 'Reposición confirmada',
      description: `Se actualizaron ${lines.value.length} productos.`,
      color: 'success'
    })
    lines.value = []
  } catch (error) {
    toast.add({
      title: 'No se pudo confirmar la reposición',
      description: error instanceof Error ? error.message : 'La operación no se aplicó. Inténtalo nuevamente.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

function currency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(value)
}
</script>

<template>
  <UDashboardPanel id="inventory-replenish">
    <template #header>
      <UDashboardNavbar title="Ingreso de reposiciones">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Volver a productos"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="subtle"
            to="/admin/productos"
            class="min-h-11"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 class="text-xl font-semibold text-highlighted">
            Ingreso de reposiciones
          </h1>
          <p class="mt-1 text-sm text-muted">
            Selecciona productos, indica las unidades recibidas y actualiza opcionalmente su precio de venta.
          </p>
        </div>

        <UFormField label="Buscar productos" :error="searchError || undefined">
          <UInput
            v-model="searchInput"
            icon="i-lucide-search"
            placeholder="Escribe el nombre o SKU (mínimo 2 caracteres)"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>

        <div v-if="isSearching" class="space-y-2" aria-busy="true">
          <USkeleton class="h-14 w-full" />
          <USkeleton class="h-14 w-full" />
        </div>
        <div v-else-if="searchResults.length" class="overflow-hidden rounded-xl border border-default">
          <button
            v-for="product in searchResults"
            :key="product.id"
            type="button"
            class="flex min-h-14 w-full items-center justify-between gap-4 border-b border-default px-4 py-3 text-left last:border-b-0 hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
            @click="addProduct(product)"
          >
            <span>
              <span class="block font-medium text-highlighted">{{ product.nombre }}</span>
              <span class="text-xs text-muted">{{ product.categoria }} · {{ product.sku }}</span>
            </span>
            <span class="shrink-0 text-sm text-muted">Stock: {{ product.stock }}</span>
          </button>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="font-semibold text-highlighted">
                Productos para reponer
              </h2>
              <span class="text-sm text-muted">{{ lines.length }} seleccionados</span>
            </div>
          </template>

          <div v-if="!lines.length" class="py-8 text-center text-sm text-muted">
            Busca y selecciona los productos que llegaron en esta reposición.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="line in lines"
              :key="line.productId"
              class="grid gap-3 rounded-lg border border-default p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_8rem_9rem_9rem_2.5rem] lg:items-end"
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ line.nombre }}
                </p>
                <p class="text-xs text-muted">
                  {{ line.categoria }} · Stock actual: {{ line.stock }}
                </p>
              </div>
              <UFormField label="Cantidad entrante" required>
                <UInput
                  v-model="line.cantidadEntrante"
                  type="number"
                  min="1"
                  step="1"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Precio actual">
                <UInput :model-value="currency(line.precioActual)" readonly class="w-full" />
              </UFormField>
              <UFormField label="Nuevo precio (opcional)">
                <UInput
                  v-model="line.nuevoPrecio"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full"
                />
              </UFormField>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                aria-label="Quitar producto de la reposición"
                class="min-h-11 min-w-11"
                :disabled="isSaving"
                @click="removeProduct(line.productId)"
              />
            </div>
          </div>

          <template #footer>
            <div class="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <UButton
                label="Limpiar lista"
                color="neutral"
                variant="subtle"
                class="min-h-11"
                :disabled="!lines.length || isSaving"
                @click="lines = []"
              />
              <UButton
                label="Confirmar Reposición"
                icon="i-lucide-package-check"
                class="min-h-11"
                :loading="isSaving"
                :disabled="!lines.length"
                @click="confirmReplenishment"
              />
            </div>
          </template>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
