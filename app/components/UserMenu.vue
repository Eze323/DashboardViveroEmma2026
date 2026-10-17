<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const toast = useToast()
const user = {
  name: 'Administrador',
  avatar: {
    text: 'VE',
    alt: 'Vivero Emma'
  }
}

const items = computed<DropdownMenuItem[][]>(() => [[{
  type: 'label',
  label: user.name,
  avatar: user.avatar
}], [{
  label: 'Perfil',
  icon: 'i-lucide-user-round',
  to: '/settings'
}, {
  label: 'Configuración',
  icon: 'i-lucide-settings-2',
  to: '/admin/configuracion'
}], [{
  label: 'Apariencia',
  icon: 'i-lucide-sun-moon',
  children: [{
    label: 'Claro',
    icon: 'i-lucide-sun',
    type: 'checkbox',
    checked: colorMode.value === 'light',
    onSelect(event: Event) {
      event.preventDefault()
      colorMode.preference = 'light'
    }
  }, {
    label: 'Oscuro',
    icon: 'i-lucide-moon',
    type: 'checkbox',
    checked: colorMode.value === 'dark',
    onSelect(event: Event) {
      event.preventDefault()
      colorMode.preference = 'dark'
    }
  }]
}, {
  label: 'Cerrar sesión',
  icon: 'i-lucide-log-out',
  onSelect: logout
}]])

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login')
  } catch {
    toast.add({
      title: 'No se pudo cerrar la sesión',
      description: 'Inténtalo nuevamente.',
      color: 'error'
    })
  }
}
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      :avatar="user.avatar"
      :label="collapsed ? undefined : user.name"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
    />
  </UDropdownMenu>
</template>
