/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
