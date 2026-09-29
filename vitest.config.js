import { defineConfig } from 'vitest/config'

// The offline store (src/lib/db.js) is the thing under test, so the smoke tests
// need IndexedDB but no DOM. `fake-indexeddb` supplies the former (see
// vitest.setup.js); jsdom would only slow the run down.
export default defineConfig({
  // The app is built by @vitejs/plugin-react, whose default is the *automatic*
  // JSX runtime — that is why no component imports React. Vitest does not load
  // that plugin, so esbuild would fall back to the classic runtime and every
  // component it rendered would throw "React is not defined". Asking for the
  // automatic runtime here keeps the tests compiling the app the same way the
  // build does.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.js'],
    include: ['smoke.test.js', 'src/**/*.test.js'],
  },
})
