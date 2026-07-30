// Deliberately tiny and free of any fixture data — safe to import statically
// everywhere. `import.meta.env.DEV` is replaced with the literal `false` in
// a production build, so this folds to `false` and the mock-data modules
// (imported dynamically wherever this returns true) are never fetched by a
// real user's browser.
export function isMockAuthEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_MOCK_AUTH === 'true'
}
