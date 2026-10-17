<script setup lang="ts">
import { format } from 'date-fns'
import type { DashboardData, Range } from '~/types'

const props = defineProps<{
  range: Range
}>()

const { data: dashboard, error } = await useFetch<DashboardData>('/api/dashboard', {
  query: computed(() => ({
    from: format(props.range.start, 'yyyy-MM-dd'),
    to: format(props.range.end, 'yyyy-MM-dd')
  }))
})

function formatCurrency(value: number | undefined): string {
  return (value ?? 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  })
}

const stats = computed(() => [{
  title: 'Ventas de hoy',
  icon: 'i-lucide-shopping-bag',
  value: dashboard.value?.stats.todaySales ?? '—',
  to: '/admin/ventas'
}, {
  title: 'Productos',
  icon: 'i-lucide-flower-2',
  value: dashboard.value?.stats.products ?? '—',
  to: '/admin/productos'
}, {
  title: 'Facturación del mes',
  icon: 'i-lucide-circle-dollar-sign',
  value: formatCurrency(dashboard.value?.stats.monthlyRevenue),
  to: '/admin/facturas'
}, {
  title: 'Clientes',
  icon: 'i-lucide-users-round',
  value: dashboard.value?.stats.customers ?? '—',
  to: '/admin/clientes'
}])
</script>

<template>
  <div>
    <UAlert
      v-if="error"
      color="error"
      title="No se pudo cargar el resumen"
      description="Verifica la conexión con PostgreSQL e inténtalo nuevamente."
      class="mb-4"
    />
    <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
      <UPageCard
        v-for="(stat, index) in stats"
        :key="index"
        :icon="stat.icon"
        :title="stat.title"
        :to="stat.to"
        variant="subtle"
        :ui="{
          container: 'gap-y-1.5',
          wrapper: 'items-start',
          leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
          title: 'font-normal text-muted text-xs uppercase'
        }"
        class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
      >
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>
      </UPageCard>
    </UPageGrid>
  </div>
</template>
