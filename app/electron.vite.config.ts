import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react()],
    // Mermaid is imported lazily (see MermaidBlockView), so Vite would otherwise only discover it
    // when someone first opens a file containing a diagram — then optimize it mid-session and
    // force a full page reload, losing the open file and any in-flight autosave. Pre-bundling at
    // dev-server start avoids that. It stays a separate async chunk in production either way.
    optimizeDeps: {
      include: ['mermaid']
    }
  }
})
