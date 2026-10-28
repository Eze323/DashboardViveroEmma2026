import { useStorage } from 'nitropack/runtime'

const categoryCachePrefixes = [
  '/cache:nitro/handlers:management-categories:',
  '/cache:nitro/handlers:categories:'
]

export async function invalidateManagementCategoriesCache(): Promise<void> {
  const storage = useStorage()
  const keys = (await Promise.all(categoryCachePrefixes.map(prefix => storage.getKeys(prefix)))).flat()
  await Promise.all(keys.map(key => storage.removeItem(key)))
}
