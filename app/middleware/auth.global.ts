export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { authenticated } = await $fetch<{ authenticated: boolean }>('/api/auth/session')

  if (to.path === '/login') {
    if (authenticated) return navigateTo('/')
    return
  }

  if (!authenticated) return navigateTo('/login')
})
