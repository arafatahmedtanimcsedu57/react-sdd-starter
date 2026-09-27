import { gzipSync } from 'node:zlib'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Fail the build when any JS chunk grows past this (gzipped). Raise it deliberately, in a PR
// that says why — not to make a red build green.
const CHUNK_BUDGET_KB = 180

function bundleBudget(): Plugin {
  return {
    name: 'bundle-budget',
    apply: 'build',
    generateBundle(_, bundle) {
      const over = Object.values(bundle)
        .filter((file) => file.type === 'chunk')
        .map((chunk) => ({ name: chunk.fileName, kb: gzipSync(chunk.code).length / 1024 }))
        .filter(({ kb }) => kb > CHUNK_BUDGET_KB)
      if (over.length) {
        const list = over.map(({ name, kb }) => `${name} ${kb.toFixed(1)} kB`).join(', ')
        this.error(`Bundle budget (${CHUNK_BUDGET_KB} kB gzipped per chunk) exceeded: ${list}`)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // API_PROXY_TARGET (no VITE_ prefix, so it never reaches the browser): in dev, forward
  // /api/* to a real backend, e.g. http://localhost:8080. Unset → mocks or same origin.
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), bundleBudget()],
    server: API_PROXY_TARGET
      ? { proxy: { '/api': { target: API_PROXY_TARGET, changeOrigin: true } } }
      : undefined,
  }
})
