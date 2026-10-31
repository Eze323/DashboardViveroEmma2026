// https://nuxt.com/docs/api/configuration/nuxt-config
const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env ?? {}

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vite-pwa/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    jwtSecret: environment.NODE_ENV === 'development' ? environment.JWT_SECRET ?? '' : '',
    databaseUrl: environment.NODE_ENV === 'development' ? environment.DATABASE_URL ?? environment.DIRECT_URL ?? '' : '',
    imgbbApiKey: environment.IMGBB_API_KEY ?? ''
  },

  routeRules: {
    '/api/**': {
      cors: true
    },
    '/products': {
      redirect: '/admin/productos'
    }
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    preset: 'netlify'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Dashboard Vivero Emma',
      short_name: 'Vivero Emma',
      description: 'Gestión de Inventario y Ventas Vivero Emma',
      theme_color: '#059669',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'es',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: undefined,
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-resources',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 30
            }
          }
        },
        {
          urlPattern: ({ request }) => request.destination === 'image' || request.destination === 'font',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'images-and-fonts',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 60
            }
          }
        },
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 5,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 5
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: true,
      type: 'module'
    }
  }
})
