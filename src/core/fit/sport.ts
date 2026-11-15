// Plain names for the FIT sports CrankHog imports besides rides.

const SPORT: Record<string, string> = {
  running: 'Run',
  walking: 'Walk',
  hiking: 'Hike',
  swimming: 'Swim',
  training: 'Strength',
  fitness_equipment: 'Gym',
  rowing: 'Row',
  cross_country_skiing: 'Ski',
}

/** "running" → "Run"; an unknown FIT sport reads as itself ("e_biking" → "E biking"). */
export const sportLabel = (sport: string): string => SPORT[sport] ?? sport.charAt(0).toUpperCase() + sport.slice(1).replace(/_/g, ' ')

/** "Morning run", "Evening strength": by the local time it started. */
export function activityName(sport: string, startedAt: number): string {
  const h = new Date(startedAt).getHours()
  const part = h < 5 ? 'Night' : h < 11 ? 'Morning' : h < 14 ? 'Lunch' : h < 18 ? 'Afternoon' : 'Evening'
  return `${part} ${sportLabel(sport).toLowerCase()}`
}
