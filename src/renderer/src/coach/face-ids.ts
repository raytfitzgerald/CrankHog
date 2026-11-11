/** The built-in coaches drawn as cartoon faces (faces.tsx); the real people (and the animals) have photo caricatures. */
export const FACE_IDS = [
  'drill-sergeant',
  'roast-comic',
  'disappointed-dad',
  'the-overlord',
  'hype-coach',
  'data-nerd',
  'zen',
  'professional',
  'fat-guy',
  'shrek',
  'slender-man',
  'the-thing',
  'linkedin-guy',
  'infomercial-host',
  'nature-narrator',
  'gen-z-intern',
] as const

export function hasFace(personaId: string): boolean {
  return (FACE_IDS as readonly string[]).includes(personaId)
}
