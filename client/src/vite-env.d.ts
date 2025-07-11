/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SOCKET_URL: string
  readonly VITE_VERSION: string
  readonly VITE_BUILD_DATE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 