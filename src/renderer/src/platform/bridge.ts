import type { CrankHogBridge } from '@shared/ipc/contract'
import { createWebShim } from './web-shim'

/**
 * Returns the platform bridge. In Electron the preload has already installed
 * `window.crankhog`; in the browser-only build we install the web shim so the
 * renderer runs unchanged (simulated devices, IndexedDB-backed services).
 */
export function ensureBridge(): CrankHogBridge {
  if (!window.crankhog) {
    window.crankhog = createWebShim()
  }
  return window.crankhog
}

export const bridge = (): CrankHogBridge => window.crankhog
