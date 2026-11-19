import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { GroupRideState } from '@shared/ipc/contract'
import { useNow } from '../ui/useNow'

/** One line on the connection: connecting, connected, or what went wrong and when it tries again. */
export function GroupRideStatus({ state, idle = 'Not connected.' }: { state: GroupRideState; idle?: string }) {
  const now = useNow(1000)
  switch (state.status) {
    case 'off':
      return <span>Ride with others is off.</span>
    case 'idle':
      return <span>{idle}</span>
    case 'connecting':
      return (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Connecting to the server…
        </span>
      )
    case 'connected':
      return state.problem ? (
        <span className="inline-flex items-center gap-1.5 text-warn">
          <AlertTriangle className="size-3.5" aria-hidden /> {state.problem}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-good" aria-hidden /> Connected
        </span>
      )
    case 'waiting': {
      const s = state.retryAt === null ? null : Math.max(0, Math.ceil((state.retryAt - now) / 1000))
      return (
        <span className="inline-flex items-center gap-1.5 text-warn">
          <AlertTriangle className="size-3.5" aria-hidden /> {state.problem ?? 'Not connected.'}
          {s !== null && ` Trying again ${s === 0 ? 'now' : `in ${s} s`}.`}
        </span>
      )
    }
  }
}
