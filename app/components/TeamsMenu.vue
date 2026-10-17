<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <NuxtLink
    to="/"
    class="flex min-w-0 items-center gap-3 rounded-md p-2 text-highlighted transition-colors hover:bg-elevated"
    :class="{ 'justify-center': collapsed }"
    aria-label="Vivero Emma, ir al resumen"
  >
    <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
      <UIcon name="i-lucide-flower-2" class="size-5" />
    </span>
    <span v-if="!collapsed" class="truncate font-semibold">
      Vivero Emma
    </span>
  </NuxtLink>
</template>
