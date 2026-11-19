import type { GroupRideState } from '@shared/ipc/contract'

/** Why the rider isn't on the track although they're riding it, in their words. */
export function holdText(hold: GroupRideState['hold'], problem: string | null): string | null {
  switch (hold) {
    case 'simulated':
      return 'Simulated rides stay off the public server: nobody else sees this one.'
    case 'name':
      return 'Choose your name on the track in Settings → Ride with others to join the others.'
    case 'refused':
      return problem ?? "The server didn't take your rider."
    default:
      return null
  }
}
