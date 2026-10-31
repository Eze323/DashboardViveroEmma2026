<script setup lang="ts">
await navigateTo('/admin/productos', { replace: true })
</script>

<template>
  <div class="flex min-h-[50vh] items-center justify-center p-6 text-center text-muted">
    <UIcon name="i-lucide-flower-2" class="mr-2 size-6 animate-pulse text-primary" />
    <span>Redirigiendo al catálogo de productos...</span>
  </div>
</template>
