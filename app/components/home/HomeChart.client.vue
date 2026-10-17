<script setup lang="ts">
import { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, format, startOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import type { DashboardData, Period, Range } from '~/types'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

const props = defineProps<{
  period: Period
  range: Range
}>()

type DataRecord = {
  date: Date
  amount: number
}

const { width } = useElementSize(cardRef)

const data = ref<DataRecord[]>([])
const { data: dashboard, error } = await useFetch<DashboardData>('/api/dashboard', {
  query: computed(() => ({
    from: format(props.range.start, 'yyyy-MM-dd'),
    to: format(props.range.end, 'yyyy-MM-dd')
  }))
})

watch([() => props.period, () => props.range.start, () => props.range.end, () => dashboard.value?.salesByDate], () => {
  const dates = ({
    daily: eachDayOfInterval,
    weekly: eachWeekOfInterval,
    monthly: eachMonthOfInterval
  } as Record<Period, typeof eachDayOfInterval>)[props.period](props.range)

  const amountsByDate = new Map<string, number>()
  for (const sale of dashboard.value?.salesByDate ?? []) {
    const date = new Date(`${sale.date}T00:00:00`)
    const bucket = props.period === 'daily'
      ? date
      : props.period === 'weekly'
        ? startOfWeek(date)
        : startOfMonth(date)
    const key = format(bucket, 'yyyy-MM-dd')
    amountsByDate.set(key, (amountsByDate.get(key) ?? 0) + sale.amount)
  }

  data.value = dates.map(date => ({
    date,
    amount: amountsByDate.get(format(date, 'yyyy-MM-dd')) ?? 0
  }))
}, { immediate: true })

const x = (_: DataRecord, i: number) => i
const y = (d: DataRecord) => d.amount

const total = computed(() => data.value.reduce((acc: number, { amount }) => acc + amount, 0))

const formatNumber = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

const formatDate = (date: Date): string => {
  return ({
    daily: format(date, 'd MMM', { locale: es }),
    weekly: format(date, 'd MMM', { locale: es }),
    monthly: format(date, 'MMM yyyy', { locale: es })
  })[props.period]
}

const xTicks = (i: number) => {
  if (i === 0 || i === data.value.length - 1 || !data.value[i]) {
    return ''
  }

  return formatDate(data.value[i].date)
}

const template = (d: DataRecord) => `${formatDate(d.date)}: ${formatNumber(d.amount)}`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          Ventas
        </p>
        <p class="text-3xl text-highlighted font-semibold">
          {{ formatNumber(total) }}
        </p>
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      title="No se pudieron cargar las ventas"
      description="Verifica la conexión con PostgreSQL e inténtalo nuevamente."
      class="mx-4 mb-3"
    />

    <VisXYContainer
      :data="data"
      :padding="{ top: 40 }"
      :margin="{ left: -5, right: -5 }"
      class="h-96"
      :width="width"
    >
      <VisLine
        :x="x"
        :y="y"
        color="var(--ui-primary)"
      />
      <VisArea
        :x="x"
        :y="y"
        color="var(--ui-primary)"
        :opacity="0.1"
      />

      <VisAxis
        type="x"
        :x="x"
        :tick-format="xTicks"
      />

      <VisCrosshair
        :x="x"
        :y="y"
        color="var(--ui-primary)"
        :template="template"
      />

      <VisTooltip />
    </VisXYContainer>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
