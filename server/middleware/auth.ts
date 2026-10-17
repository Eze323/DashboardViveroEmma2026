import { getRequestURL, sendRedirect } from 'h3'
import { canAccessPanel, getAuthSession } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth/') || event.method === 'OPTIONS') return

    const session = await getAuthSession(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Debes iniciar sesión para continuar.'
      })
    }
    if (!canAccessPanel(session.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Tu cuenta no tiene permisos para esta operación.'
      })
    }
    return
  }

  if (pathname.startsWith('/_nuxt/') || pathname.startsWith('/__nuxt') || /\.[^/]+$/.test(pathname)) {
    return
  }

  const session = await getAuthSession(event)
  const authenticated = session !== null && canAccessPanel(session.role)
  if (pathname === '/login') {
    if (authenticated) return sendRedirect(event, '/', 302)
    return
  }

  if (!authenticated) return sendRedirect(event, '/login', 302)
})
