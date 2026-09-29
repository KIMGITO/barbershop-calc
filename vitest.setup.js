// IndexedDB is a browser API, so Node gets a real in-memory implementation of
// it before anything under test is imported. `auto` installs the globals
// (indexedDB, IDBKeyRange, …) the way a browser exposes them.
import 'fake-indexeddb/auto'

// The app decides whether to touch the network by reading `navigator.onLine`.
// Node's `navigator` has no such property, so it is defined here as "offline":
// every store action then takes the cached, offline-first path, which is the
// deterministic one to assert on. Tests that want to exercise an upload set it
// to true themselves — hence `writable`.
Object.defineProperty(globalThis.navigator, 'onLine', {
  value: false,
  writable: true,
  configurable: true,
})
