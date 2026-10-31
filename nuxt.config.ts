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
    'pinia-plugin-persistedstate/nuxt'
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
  }
})
