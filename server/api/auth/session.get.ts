import { setResponseHeader } from 'h3'
import { canAccessPanel, getAuthSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const session = await getAuthSession(event)
  const authenticated = session !== null && canAccessPanel(session.role)
  return {
    authenticated,
    user: authenticated && event.context.user
      ? {
          id: event.context.user.id,
          name: event.context.user.name,
          email: event.context.user.email,
          role: event.context.user.role
        }
      : null
  }
})
