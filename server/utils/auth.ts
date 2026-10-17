import { getCookie, setCookie, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { compare } from 'bcryptjs'
import { authLoginAttempts, users } from '../../src/db/schema'
import { useDrizzle } from './drizzle'

const AUTH_COOKIE = 'vivero_session'
const SESSION_DURATION_SECONDS = 60 * 60 * 8
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_LOCK_MS = 15 * 60 * 1000
const LOGIN_MAX_FAILURES = 5

export interface AuthUser {
  id: number
  name: string
  email: string
  role: 'admin' | 'encargado' | 'operario' | 'user' | null
}

interface SessionPayload {
  userId: number
  email: string
  role: AuthUser['role']
  expiresAt: number
}

export function canAccessPanel(role: AuthUser['role']): boolean {
  return role === 'admin' || role === 'encargado'
}

function getSessionSecret(event: H3Event): string {
  const config = useRuntimeConfig(event)
  if (typeof config.jwtSecret !== 'string' || config.jwtSecret.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: 'La autenticación del panel no está configurada.'
    })
  }

  return config.jwtSecret
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function getLoginAttemptKey(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase()
  const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`vivero-login:${normalizedEmail}`)
  ))
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function assertLoginAllowed(event: H3Event, email: string): Promise<void> {
  const key = await getLoginAttemptKey(email)
  const db = useDrizzle()
  await db.delete(authLoginAttempts)
    .where(sql`${authLoginAttempts.updatedAt} <= now() - interval '24 hours'`)
  const [attempt] = await db.select({ lockedUntil: authLoginAttempts.lockedUntil })
    .from(authLoginAttempts)
    .where(eq(authLoginAttempts.key, key))
    .limit(1)

  if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
    const retryAfter = Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 1000)
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.'
    })
  }
}

export async function recordLoginFailure(email: string): Promise<void> {
  const key = await getLoginAttemptKey(email)
  const db = useDrizzle()
  const now = new Date()
  const windowExpired = new Date(now.getTime() - LOGIN_WINDOW_MS)
  const lockedUntil = new Date(now.getTime() + LOGIN_LOCK_MS)
  await db.insert(authLoginAttempts).values({
    key,
    failureCount: 1,
    windowStartedAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: authLoginAttempts.key,
    set: {
      failureCount: sql`CASE WHEN ${authLoginAttempts.windowStartedAt} <= ${windowExpired} THEN 1 ELSE ${authLoginAttempts.failureCount} + 1 END`,
      windowStartedAt: sql`CASE WHEN ${authLoginAttempts.windowStartedAt} <= ${windowExpired} THEN ${now} ELSE ${authLoginAttempts.windowStartedAt} END`,
      lockedUntil: sql`CASE
        WHEN ${authLoginAttempts.windowStartedAt} <= ${windowExpired} THEN NULL
        WHEN ${authLoginAttempts.failureCount} + 1 >= ${LOGIN_MAX_FAILURES} THEN ${lockedUntil}
        ELSE ${authLoginAttempts.lockedUntil}
      END`,
      updatedAt: now
    }
  })
}

export async function clearLoginFailures(email: string): Promise<void> {
  const key = await getLoginAttemptKey(email)
  const db = useDrizzle()
  await db.delete(authLoginAttempts).where(eq(authLoginAttempts.key, key))
}

export async function verifyCredentials(event: H3Event, email: string, password: string): Promise<AuthUser | null> {
  getSessionSecret(event)
  const normalizedEmail = email.trim().toLowerCase()
  const db = useDrizzle()
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      password: users.password,
      role: users.role
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1)

  if (!user) return null

  const compatiblePasswordHash = user.password.replace(/^\$2y\$/, '$2b$')
  if (!await compare(password, compatiblePasswordHash)) return null

  const id = Number(user.id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError({
      statusCode: 500,
      statusMessage: 'La cuenta tiene un identificador inválido.'
    })
  }

  return { id, name: user.name, email: user.email, role: user.role }
}

export async function setAuthSession(event: H3Event, user: AuthUser): Promise<void> {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000
  }
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await getHmacKey(getSessionSecret(event))
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload)))
  const signature = encodeBase64Url(signed)

  setCookie(event, AUTH_COOKIE, `${encodedPayload}.${signature}`, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS
  })
}

export function clearAuthSession(event: H3Event): void {
  setCookie(event, AUTH_COOKIE, '', {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'strict',
    path: '/',
    maxAge: 0
  })
}

export async function getAuthSession(event: H3Event): Promise<SessionPayload | null> {
  let secret: string
  try {
    secret = getSessionSecret(event)
  } catch {
    return null
  }

  const token = getCookie(event, AUTH_COOKIE)
  if (!token) return null

  const [encodedPayload, providedSignature, extraPart] = token.split('.')
  if (!encodedPayload || !providedSignature || extraPart !== undefined) return null

  let signature: Uint8Array<ArrayBuffer>
  try {
    signature = decodeBase64Url(providedSignature)
  } catch {
    return null
  }

  const key = await getHmacKey(secret)
  const isSignatureValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(encodedPayload)
  )
  if (!isSignatureValid) return null

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload)))
  } catch {
    return null
  }

  if (
    typeof payload === 'object'
    && payload !== null
    && 'userId' in payload
    && typeof payload.userId === 'number'
    && Number.isSafeInteger(payload.userId)
    && payload.userId > 0
    && 'email' in payload
    && typeof payload.email === 'string'
    && payload.email.length > 0
    && 'role' in payload
    && (payload.role === 'admin' || payload.role === 'encargado' || payload.role === 'operario' || payload.role === 'user' || payload.role === null)
    && 'expiresAt' in payload
    && typeof payload.expiresAt === 'number'
    && payload.expiresAt > Date.now()
  ) {
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      expiresAt: payload.expiresAt
    }
  }

  return null
}
