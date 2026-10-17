<script setup lang="ts">
import type { SaleCatalogProduct, SaleDraft, SaleDraftLine } from '~/stores/salesDraft'
import { useSalesDraftStore } from '~/stores/salesDraft'

interface CustomerOption {
  label: string
  value: string
}

const props = defineProps<{
  customers: CustomerOption[]
}>()

const draft = defineModel<SaleDraft>({ required: true })
const store = useSalesDraftStore()
const toast = useToast()
const searchInput = ref('')
const search = ref('')
const searchErrorMessage = ref('')
const productRequest = ref(0)

watchDebounced(searchInput, async (value) => {
  search.value = value.trim()
  searchErrorMessage.value = ''
  const request = ++productRequest.value
  try {
    await store.searchProducts(search.value)
  } catch (error) {
    if (request === productRequest.value) {
      searchErrorMessage.value = error instanceof Error ? error.message : 'No se pudieron buscar productos.'
    }
  }
}, { debounce: 250 })

function currency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}

function productFor(line: SaleDraftLine): SaleCatalogProduct | undefined {
  return store.productFor(line.productId)
}

function lineSubtotal(line: SaleDraftLine): number {
  return store.priceFor(line.productId, line.size) * line.quantity
}

async function addProduct(product: SaleCatalogProduct) {
  try {
    await store.addProduct(product)
    searchInput.value = ''
    search.value = ''
    store.searchResults = []
  } catch (error) {
    toast.add({
      title: 'No se pudo agregar el producto',
      description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      color: 'error'
    })
  }
}

function removeLine(lineId: string) {
  store.removeLine(lineId)
}

function addQuantity(line: SaleDraftLine) {
  const product = productFor(line)
  if (product && store.availableStock(product.id) > 0) {
    store.setQuantity(line.id, line.quantity + 1)
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="grid gap-3 sm:grid-cols-2">
      <UFormField label="Cliente">
        <USelect v-model="draft.customerId" :items="props.customers" class="w-full" />
      </UFormField>
      <UFormField label="Fecha de venta" required>
        <UInput v-model="draft.date" type="date" class="w-full" />
      </UFormField>
      <UFormField label="Vendedor" required>
        <UInput v-model="draft.seller" maxlength="255" class="w-full" />
      </UFormField>
      <UFormField label="Estado">
        <USelect v-model="draft.status" :items="['Completada', 'Pendiente']" class="w-full" />
      </UFormField>
    </section>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-receipt-text"
      title="Comprobante interno"
      description="La venta crea un ticket interno no fiscal. Para emitir una factura fiscal, usa el sistema autorizado."
    />

    <section class="space-y-3">
      <div>
        <h3 class="font-semibold text-highlighted">
          Buscar productos
        </h3>
        <p class="mt-1 text-xs text-muted">
          Busca por nombre o SKU. El stock es compartido entre los tamaños de maceta.
        </p>
      </div>

      <UInput
        v-model="searchInput"
        icon="i-lucide-search"
        placeholder="Buscar planta o SKU..."
        aria-label="Buscar productos para la venta"
        class="w-full"
      />

      <UAlert
        v-if="searchErrorMessage"
        color="error"
        :description="searchErrorMessage"
        title="Error al buscar productos"
      />
      <div v-else-if="store.searchLoading" class="py-3 text-center text-sm text-muted">
        Buscando productos...
      </div>
      <div v-else-if="search.length >= 2 && !store.searchResults.length" class="rounded-xl border border-dashed border-default p-4 text-center text-sm text-muted">
        No se encontraron productos activos con stock para esa búsqueda.
      </div>
      <div v-else-if="store.searchResults.length" class="max-h-64 space-y-2 overflow-y-auto">
        <button
          v-for="product in store.searchResults"
          :key="product.id"
          type="button"
          class="flex min-h-16 w-full items-center gap-3 rounded-xl border border-default bg-default p-3 text-left transition hover:border-primary hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="product.stock < 1"
          @click="addProduct(product)"
        >
          <img
            v-if="product.imageUrl"
            :src="product.imageUrl"
            :alt="product.nombre"
            class="size-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
          >
          <div v-else class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
            <UIcon name="i-lucide-flower-2" class="size-6" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ product.nombre }}
            </p>
            <p class="text-xs text-muted">
              {{ product.sku }} · {{ product.stock }} disponibles
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-sm font-semibold text-highlighted">
              {{ currency(product.precio) }}
            </p>
            <span class="text-xs text-primary">Agregar</span>
          </div>
        </button>
      </div>
    </section>

    <section class="space-y-3 rounded-xl border border-default p-3 sm:p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold text-highlighted">
            Carrito
          </h3>
          <p class="text-xs text-muted">
            {{ store.itemCount }} {{ store.itemCount === 1 ? 'unidad' : 'unidades' }}
          </p>
        </div>
        <UButton
          v-if="draft.lines.length"
          label="Vaciar"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          class="min-h-10"
          @click="store.clearLines"
        />
      </div>

      <div v-if="!draft.lines.length" class="rounded-xl border border-dashed border-default bg-elevated/30 px-4 py-8 text-center">
        <UIcon name="i-lucide-shopping-cart" class="mx-auto size-9 text-muted" />
        <p class="mt-2 text-sm font-medium text-highlighted">
          El carrito está vacío
        </p>
        <p class="mt-1 text-xs text-muted">
          Busca una planta y agrégala para comenzar la venta.
        </p>
      </div>

      <div v-for="line in draft.lines" :key="line.id" class="space-y-3 rounded-xl bg-elevated/40 p-3">
        <div class="flex items-start gap-3">
          <img
            v-if="productFor(line)?.imageUrl"
            :src="productFor(line)?.imageUrl"
            :alt="productFor(line)?.nombre ?? 'Producto'"
            class="size-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
          >
          <div v-else class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
            <UIcon name="i-lucide-flower-2" class="size-6" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ productFor(line)?.nombre ?? `Producto ${line.productId}` }}
            </p>
            <p class="text-xs text-muted">
              SKU {{ productFor(line)?.sku || '—' }} · {{ productFor(line)?.stock ?? 0 }} en stock
            </p>
          </div>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="Quitar producto del carrito"
            class="min-h-10 min-w-10"
            @click="removeLine(line.id)"
          />
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <UFormField label="Tamaño de maceta" required>
            <USelect
              :model-value="line.size"
              :items="store.variantsFor(line.productId).map(variant => ({ label: `${variant.size} · ${currency(variant.price)}`, value: variant.size }))"
              placeholder="Selecciona un tamaño"
              class="w-full"
              @update:model-value="store.setLineSize(line.id, String($event))"
            />
          </UFormField>
          <UFormField label="Cantidad">
            <div class="flex min-h-10 items-center gap-2">
              <UButton
                icon="i-lucide-minus"
                color="neutral"
                variant="outline"
                aria-label="Disminuir cantidad"
                class="min-h-10 min-w-10"
                :disabled="line.quantity <= 1"
                @click="store.setQuantity(line.id, line.quantity - 1)"
              />
              <span class="min-w-8 text-center text-sm font-semibold">{{ line.quantity }}</span>
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                aria-label="Aumentar cantidad"
                class="min-h-10 min-w-10"
                :disabled="store.availableStock(line.productId) <= 0"
                @click="addQuantity(line)"
              />
            </div>
          </UFormField>
        </div>

        <div class="flex items-center justify-between border-t border-default pt-2 text-sm">
          <span class="text-muted">
            {{ currency(store.priceFor(line.productId, line.size)) }} c/u
          </span>
          <span class="font-semibold text-highlighted">
            {{ currency(lineSubtotal(line)) }}
          </span>
        </div>
        <p v-if="store.availableStock(line.productId) === 0 && draft.status === 'Completada'" class="text-xs font-medium text-error">
          Se alcanzó el stock disponible para este producto.
        </p>
      </div>

      <UAlert
        v-if="store.hasStockIssues"
        color="warning"
        title="Stock insuficiente"
        description="La venta no se puede completar con las cantidades seleccionadas. El stock se vuelve a validar al guardar."
      />
      <UAlert
        v-if="store.hasUnpricedLines"
        color="warning"
        title="Falta elegir un tamaño"
        description="Selecciona una medida con precio para cada producto antes de guardar."
      />
    </section>

    <section class="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Artículos</span>
        <span class="font-medium text-highlighted">{{ store.itemCount }}</span>
      </div>
      <div class="mt-2 flex items-center justify-between border-t border-primary/15 pt-3">
        <span class="font-semibold text-highlighted">Total de la venta</span>
        <span class="text-xl font-bold text-primary">{{ currency(store.subtotal) }}</span>
      </div>
      <p class="mt-2 text-xs text-muted">
        El precio final se calcula y confirma nuevamente en el servidor al guardar.
      </p>
    </section>
  </div>
</template>
