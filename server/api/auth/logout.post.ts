import { setResponseHeader } from 'h3'
import { clearAuthSession } from '../../utils/auth'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  clearAuthSession(event)
  return { authenticated: false }
})
