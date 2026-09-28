import { gzipSync } from 'node:zlib'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

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
  const { API_PROXY_TARGET, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = loadEnv(
    mode,
    process.cwd(),
    '',
  )
  // With SENTRY_AUTH_TOKEN set (deploy builds only), source maps are uploaded to Sentry and
  // then deleted from dist/, so stack traces are readable but the maps are never served.
  const uploadSourceMaps = Boolean(SENTRY_AUTH_TOKEN)
  if (uploadSourceMaps && !(SENTRY_ORG && SENTRY_PROJECT)) {
    throw new Error('SENTRY_AUTH_TOKEN is set, so SENTRY_ORG and SENTRY_PROJECT are required too')
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      bundleBudget(),
      uploadSourceMaps &&
        sentryVitePlugin({
          authToken: SENTRY_AUTH_TOKEN,
          org: SENTRY_ORG,
          project: SENTRY_PROJECT,
          sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
          telemetry: false,
        }),
    ],
    build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
    server: API_PROXY_TARGET
      ? { proxy: { '/api': { target: API_PROXY_TARGET, changeOrigin: true } } }
      : undefined,
  }
})
