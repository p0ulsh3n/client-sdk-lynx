import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Replace @lynx-js/react with a minimal stub — the Lynx runtime is
      // unavailable in Node; we only test pure TypeScript logic here.
      '@lynx-js/react/jsx-dev-runtime': new URL('./src/__tests__/__mocks__/@lynx-js/jsx-runtime.ts', import.meta.url).pathname,
      '@lynx-js/react/jsx-runtime': new URL('./src/__tests__/__mocks__/@lynx-js/jsx-runtime.ts', import.meta.url).pathname,
      '@lynx-js/react': new URL('./src/__tests__/__mocks__/@lynx-js/react.ts', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
    },
  },
});
