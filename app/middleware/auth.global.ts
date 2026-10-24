export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { authenticated, user } = await $fetch<{
    authenticated: boolean
    user: { role: string | null } | null
  }>('/api/auth/session')

  if (to.path === '/login') {
    if (authenticated) return navigateTo(user?.role === 'admin' ? '/' : '/admin/ventas')
    return
  }

  if (!authenticated) return navigateTo('/login')
  if (to.path === '/' && user?.role !== 'admin') return navigateTo('/admin/ventas')
})
