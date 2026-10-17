type ServerEnvironment = Record<string, string | undefined>

export function getServerEnvironment(): ServerEnvironment {
  return (globalThis as typeof globalThis & {
    process?: { env?: ServerEnvironment }
  }).process?.env ?? {}
}
