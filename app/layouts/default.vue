<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)

const mainLinks: NavigationMenuItem[] = [{
  label: 'Resumen',
  icon: 'i-lucide-house',
  to: '/'
}, {
  label: 'Ventas',
  icon: 'i-lucide-shopping-bag',
  to: '/admin/ventas'
}, {
  label: 'Productos',
  icon: 'i-lucide-flower-2',
  to: '/admin/productos'
}, {
  label: 'Clientes',
  icon: 'i-lucide-users',
  to: '/admin/clientes'
}, {
  label: 'Facturas',
  icon: 'i-lucide-receipt-text',
  to: '/admin/facturas'
}]

const managementLinks: NavigationMenuItem[] = [{
  label: 'Categorías',
  icon: 'i-lucide-folders',
  to: '/admin/categorias'
}, {
  label: 'Ingreso de reposiciones',
  icon: 'i-lucide-package-plus',
  to: '/dashboard/inventory/replenish'
}, {
  label: 'Proveedores',
  icon: 'i-lucide-truck',
  to: '/admin/proveedores'
}, {
  label: 'Compras',
  icon: 'i-lucide-package-plus',
  to: '/admin/compras'
}, {
  label: 'Precios por maceta',
  icon: 'i-lucide-ruler',
  to: '/admin/precios-maceta'
}, {
  label: 'Precios de proveedores',
  icon: 'i-lucide-tags',
  to: '/admin/precios-proveedor'
}, {
  label: 'Vendedores',
  icon: 'i-lucide-contact-round',
  to: '/admin/vendedores'
}, {
  label: 'Ubicaciones',
  icon: 'i-lucide-map-pin',
  to: '/admin/ubicaciones'
}, {
  label: 'Zonas',
  icon: 'i-lucide-map',
  to: '/admin/zonas'
}, {
  label: 'Premios',
  icon: 'i-lucide-gift',
  to: '/admin/premios'
}, {
  label: 'Embalaje',
  icon: 'i-lucide-package',
  to: '/admin/embalaje'
}]

const settingsLinks: NavigationMenuItem[] = [{
  label: 'Usuarios y accesos',
  icon: 'i-lucide-shield-check',
  to: '/admin/accesos'
}, {
  label: 'Configuración',
  icon: 'i-lucide-settings-2',
  to: '/admin/configuracion'
}]

const searchLinks = [...mainLinks, ...managementLinks, ...settingsLinks].map(item => ({
  label: item.label,
  icon: item.icon,
  to: item.to
}))

const groups = computed(() => [{
  label: 'Secciones',
  id: 'sections',
  items: searchLinks
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="mainLinks"
          orientation="vertical"
          tooltip
          popover
        />

        <p v-if="!collapsed" class="px-2 pt-5 pb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Gestión
        </p>
        <UNavigationMenu
          :collapsed="collapsed"
          :items="managementLinks"
          orientation="vertical"
          tooltip
          popover
        />

        <p v-if="!collapsed" class="px-2 pt-5 pb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Administración
        </p>
        <UNavigationMenu
          :collapsed="collapsed"
          :items="settingsLinks"
          orientation="vertical"
          tooltip
          popover
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />

    <NotificationsSlideover />
  </UDashboardGroup>
</template>
