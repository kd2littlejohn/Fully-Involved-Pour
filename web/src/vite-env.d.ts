/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_AUTH?: string
  readonly VITE_FIREBASE_EMULATORS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// See vite.config.ts `define`: true only in Scan Barcode preview builds.
declare const __FIP_BARCODE_POC__: boolean
