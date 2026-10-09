/// <reference types="vite/client" />
import type { CrankHogBridge } from '@shared/ipc/contract'

declare global {
  interface Window {
    /** Provided by the Electron preload, or by platform/web-shim.ts in browser mode. */
    crankhog: CrankHogBridge
  }
  /** True in the browser-only build (vite.web.config.ts). */
  const __CRANKHOG_WEB__: boolean
  const __CRANKHOG_VERSION__: string
}

export {}
