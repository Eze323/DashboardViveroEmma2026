import { Buffer } from 'node:buffer'
import { readFormData } from 'h3'
import { z } from 'zod'
import { getServerEnvironment } from '../../utils/server-environment'

const imgbbUploadSchema = z.object({
  image: z.string().trim().min(1).optional(),
  url: z.string().url().optional(),
  source: z.enum(['upload', 'url']).optional()
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const environment = getServerEnvironment()
  const apiKey = config.imgbbApiKey
    || environment.NUXT_IMGBB_API_KEY
    || environment.IMGBB_API_KEY

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Falta la variable IMGBB_API_KEY.'
    })
  }

  const form = await readFormData(event)
  const rawImage = form.get('image')
  const rawUrl = form.get('url')
  const source = String(form.get('source') ?? 'upload')

  const base64Image = typeof rawImage === 'string'
    ? rawImage
    : rawImage && typeof (rawImage as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function'
      ? Buffer.from(await (rawImage as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()).toString('base64')
      : undefined

  const payload = imgbbUploadSchema.parse({
    image: base64Image,
    url: typeof rawUrl === 'string' ? rawUrl : undefined,
    source: source === 'url' ? 'url' : 'upload'
  })

  if (!payload.image && !payload.url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No se recibió ninguna imagen o URL válida para subir.'
    })
  }

  const requestBody = new URLSearchParams({
    key: apiKey,
    ...(payload.source === 'url' && payload.url ? { image: payload.url } : {}),
    ...(payload.source !== 'url' && payload.image ? { image: payload.image } : {})
  })

  const response = await $fetch<{ data?: { url?: string; display_url?: string; thumb?: string; medium?: string } }>('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: requestBody,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  if (!response.data?.url) {
    throw createError({
      statusCode: 502,
      statusMessage: 'La respuesta de imgbb no incluyó una URL válida.'
    })
  }

  return {
    success: true,
    data: {
      url: response.data.url,
      displayUrl: response.data.display_url ?? response.data.url,
      thumb: response.data.thumb ?? response.data.url,
      medium: response.data.medium ?? response.data.url
    }
  }
})
