<script setup lang="ts">
const { isNotificationsSlideoverOpen } = useDashboard()

const notifications = [{
  id: 1,
  unread: true,
  sender: 'Lucía Pérez',
  initials: 'LP',
  body: 'registró una venta de Monstera deliciosa',
  timeLabel: 'Hace 10 min',
  date: '2026-10-16T09:32:00',
  to: '/admin/ventas'
}, {
  id: 2,
  unread: true,
  sender: 'Tomás Ruiz',
  initials: 'TR',
  body: 'actualizó el stock de macetas',
  timeLabel: 'Hace 1 h',
  date: '2026-10-16T08:42:00',
  to: '/admin/productos'
}, {
  id: 3,
  sender: 'Vivero Emma',
  initials: 'VE',
  body: 'hay materiales de embalaje para reponer',
  timeLabel: 'Ayer',
  date: '2026-10-15T15:10:00',
  to: '/admin/embalaje'
}]
</script>

<template>
  <USlideover
    v-model:open="isNotificationsSlideoverOpen"
    title="Notificaciones"
  >
    <template #body>
      <NuxtLink
        v-for="notification in notifications"
        :key="notification.id"
        :to="notification.to"
        class="px-3 py-2.5 rounded-md hover:bg-elevated/50 flex items-center gap-3 relative -mx-3 first:-mt-3 last:-mb-3"
      >
        <UChip
          color="error"
          :show="!!notification.unread"
          inset
        >
          <UAvatar
            :text="notification.initials"
            :alt="notification.sender"
            size="md"
          />
        </UChip>

        <div class="text-sm flex-1">
          <p class="flex items-center justify-between">
            <span class="text-highlighted font-medium">{{ notification.sender }}</span>

            <time
              :datetime="notification.date"
              class="text-muted text-xs"
            >{{ notification.timeLabel }}</time>
          </p>

          <p class="text-dimmed">
            {{ notification.body }}
          </p>
        </div>
      </NuxtLink>
    </template>
  </USlideover>
</template>
