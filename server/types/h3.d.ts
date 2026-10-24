import type { AuthUser } from '../utils/auth'

declare module 'h3' {
  interface H3EventContext {
    user?: AuthUser
  }
}

export {}
