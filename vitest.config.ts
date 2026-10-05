import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/App.tsx',
        'src/mocks/**',
        'src/test/**',
        'src/services/generatedApi.ts',
        'src/**/*.d.ts',
      ],
      // The floor, not the goal. Raise these as the suite grows; never lower them to pass.
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
})
