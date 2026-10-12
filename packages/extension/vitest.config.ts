import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)

export default defineConfig({
  test: {
    // Enable test coverage
    coverage: {
      // Vitest's native provider import otherwise resolves the workspace's
      // hoisted provider, which belongs to a different Vitest version.
      provider: 'custom',
      customProviderModule: require.resolve('@vitest/coverage-v8'),
      enabled: false,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**/*'],
    },
    // Only run tests in src directory
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*'],
    // Setup test environment
    environment: 'jsdom',
  },
  plugins: [
    {
      name: 'plasmo-data-text-loader',
      resolveId(id: string) {
        if (id.startsWith('data-text:')) {
          return id
        }
      },
      load(id: string) {
        if (id.startsWith('data-text:')) {
          return `export default ''`
        }
      },
    },
  ],
})
