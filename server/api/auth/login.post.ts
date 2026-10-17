import { readBody, setResponseHeader } from 'h3'
import {
  assertLoginAllowed,
  canAccessPanel,
  clearLoginFailures,
  recordLoginFailure,
  setAuthSession,
  verifyCredentials
} from '../../utils/auth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const body: unknown = await readBody(event)
  if (
    typeof body !== 'object'
    || body === null
    || !('email' in body)
    || !('password' in body)
    || typeof body.email !== 'string'
    || typeof body.password !== 'string'
    || body.email.length > 320
    || body.password.length > 1024
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ingresa un correo y una contraseña válidos.'
    })
  }

  let user
  try {
    await assertLoginAllowed(event, body.email)
    user = await verifyCredentials(event, body.email, body.password)
    if (!user) {
      await recordLoginFailure(body.email)
      throw createError({
        statusCode: 401,
        statusMessage: 'Correo o contraseña incorrectos.'
      })
    }
    await clearLoginFailures(body.email)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
      throw error
    }
    console.error('Error al validar el inicio de sesión:', error)
    throw createError({
      statusCode: 503,
      statusMessage: 'No se pudo validar el acceso con la base de datos. Inténtalo nuevamente.'
    })
  }

  if (!canAccessPanel(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Tu cuenta no tiene permisos para ingresar al panel.'
    })
  }

  await setAuthSession(event, user)
  return {
    authenticated: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  }
})
