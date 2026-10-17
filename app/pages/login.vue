<script setup lang="ts">
definePageMeta({
  layout: false
})

const credentials = reactive({
  email: '',
  password: ''
})
const isSubmitting = ref(false)
const errorMessage = ref('')

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    if (error.statusCode === 401) return 'El correo o la contraseña no son correctos.'
    if (error.statusCode === 403) return 'Tu cuenta no tiene permisos para acceder a este panel.'
    if (error.statusCode === 429) return 'Se alcanzó el límite de intentos. Espera 15 minutos antes de volver a intentar.'
    if (error.statusCode === 503) return 'El acceso aún no está configurado en el servidor.'
  }

  return 'No se pudo iniciar sesión. Inténtalo nuevamente.'
}

async function login() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials
    })
    await navigateTo('/')
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-default px-4 py-12">
    <UCard class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <UIcon name="i-lucide-flower-2" class="mb-3 size-9 text-primary" />
        <h1 class="text-2xl font-semibold text-highlighted">
          Vivero Emma
        </h1>
        <p class="mt-1 text-sm text-muted">
          Inicia sesión para acceder al panel de gestión.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="login">
        <UFormField label="Correo electrónico" name="email" required>
          <UInput
            v-model="credentials.email"
            type="email"
            autocomplete="email"
            placeholder="Tu correo electrónico"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField label="Contraseña" name="password" required>
          <UInput
            v-model="credentials.password"
            type="password"
            autocomplete="current-password"
            placeholder="Tu contraseña"
            class="w-full"
            required
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :description="errorMessage"
        />

        <UButton
          type="submit"
          label="Iniciar sesión"
          icon="i-lucide-log-in"
          class="w-full justify-center"
          :loading="isSubmitting"
          :disabled="isSubmitting"
        />
      </form>
    </UCard>
  </main>
</template>
