import type { CrankHogBridge } from '../../src/shared/ipc/contract'

declare global {
  interface Window {
    crankhog: CrankHogBridge
  }
}

export {}
