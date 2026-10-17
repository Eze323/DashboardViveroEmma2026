<script setup lang="ts">
import { format } from 'date-fns'
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { DashboardData, DashboardSale, Range } from '~/types'

const props = defineProps<{
  range: Range
}>()

const UBadge = resolveComponent('UBadge')

const { data: dashboard, error } = await useFetch<DashboardData>('/api/dashboard', {
  query: computed(() => ({
    from: format(props.range.start, 'yyyy-MM-dd'),
    to: format(props.range.end, 'yyyy-MM-dd')
  }))
})

const data = computed(() => dashboard.value?.recentSales ?? [])

const columns: TableColumn<DashboardSale>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => `#${row.getValue('id')}`
  },
  {
    accessorKey: 'date',
    header: 'Fecha',
    cell: ({ row }) => {
      const sale = row.original
      return new Date(`${sale.date}T${sale.time ?? '00:00:00'}`).toLocaleString('es-AR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(',', ' · ')
    }
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ row }) => {
      const color = {
        Pagada: 'success' as const,
        Pendiente: 'warning' as const,
        Anulada: 'error' as const
      }[row.original.status] ?? 'neutral'

      return h(UBadge, { variant: 'subtle', color }, () =>
        row.getValue('status')
      )
    }
  },
  {
    accessorKey: 'clientName',
    header: 'Cliente'
  },
  {
    accessorKey: 'amount',
    header: () => h('div', { class: 'text-right' }, 'Total'),
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue('amount'))

      const formatted = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
      }).format(amount)

      return h('div', { class: 'text-right font-medium' }, formatted)
    }
  }
]
</script>

<template>
  <div>
    <UAlert
      v-if="error"
      color="error"
      title="No se pudieron cargar las ventas"
      description="Verifica la conexión con PostgreSQL e inténtalo nuevamente."
      class="mb-3"
    />
    <UTable
      :data="data"
      :columns="columns"
      class="shrink-0"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default'
      }"
    />
  </div>
</template>
