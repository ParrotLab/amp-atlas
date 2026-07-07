import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    // jsdom provides browser globals (localStorage, window) for renderer tests.
    // Node built-ins (fs, child_process, simple-git) still work under jsdom, so
    // main-process tests run fine here too. (environmentMatchGlobs was removed in vitest 4.)
    environment: 'jsdom',
  },
})
