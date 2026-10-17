import { setResponseHeader } from 'h3'
import { canAccessPanel, getAuthSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const session = await getAuthSession(event)
  return { authenticated: session !== null && canAccessPanel(session.role) }
})
