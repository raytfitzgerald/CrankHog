// The built-in persona packs: the original characters, the ones added in
// 0.7 (more characters, more animals and more real people), and the parodies
// of real people last. The iPhone build hides some (src/renderer/src/coach/available.ts).
import type { PersonaPack } from '../types'
import { ANGRY_GOOSE } from './angry-goose'
import { BARACK } from './barack'
import { BIBI } from './bibi'
import { CHARLIE_KIRK } from './charlie-kirk'
import { DATA_NERD } from './data-nerd'
import { DISAPPOINTED_DAD } from './disappointed-dad'
import { DJ_KHALED } from './dj-khaled'
import { DRILL_SERGEANT } from './drill-sergeant'
import { ELIZABETH_HOLMES } from './elizabeth-holmes'
import { ERIC_ANDRE } from './eric-andre'
import { FAT_GUY } from './fat-guy'
import { GEN_Z_INTERN } from './gen-z-intern'
import { HILLARY } from './hillary'
import { HYPE_COACH } from './hype-coach'
import { INFOMERCIAL_HOST } from './infomercial-host'
import { IRON_MIKE } from './iron-mike'
import { LINKEDIN_GUY } from './linkedin-guy'
import { MR_BANANAS } from './mr-bananas'
import { NATURE_NARRATOR } from './nature-narrator'
import { PROFESSIONAL } from './professional'
import { ROAST_COMIC } from './roast-comic'
import { SHREK } from './shrek'
import { SLENDER_MAN } from './slender-man'
import { THE_OVERLORD } from './the-overlord'
import { THE_THING } from './the-thing'
import { TRUMP } from './trump'
import { ZEN } from './zen'

export { ANGRY_GOOSE } from './angry-goose'
export { BARACK } from './barack'
export { BIBI } from './bibi'
export { CHARLIE_KIRK } from './charlie-kirk'
export { DATA_NERD } from './data-nerd'
export { DISAPPOINTED_DAD } from './disappointed-dad'
export { DJ_KHALED } from './dj-khaled'
export { DRILL_SERGEANT } from './drill-sergeant'
export { ELIZABETH_HOLMES } from './elizabeth-holmes'
export { ERIC_ANDRE } from './eric-andre'
export { FAT_GUY } from './fat-guy'
export { GEN_Z_INTERN } from './gen-z-intern'
export { HILLARY } from './hillary'
export { HYPE_COACH } from './hype-coach'
export { INFOMERCIAL_HOST } from './infomercial-host'
export { IRON_MIKE } from './iron-mike'
export { LINKEDIN_GUY } from './linkedin-guy'
export { MR_BANANAS } from './mr-bananas'
export { NATURE_NARRATOR } from './nature-narrator'
export { PROFESSIONAL } from './professional'
export { ROAST_COMIC } from './roast-comic'
export { SHREK } from './shrek'
export { SLENDER_MAN } from './slender-man'
export { THE_OVERLORD } from './the-overlord'
export { THE_THING } from './the-thing'
export { TRUMP } from './trump'
export { ZEN } from './zen'

export const PACKS: readonly PersonaPack[] = [
  DRILL_SERGEANT,
  ROAST_COMIC,
  DISAPPOINTED_DAD,
  THE_OVERLORD,
  HYPE_COACH,
  DATA_NERD,
  ZEN,
  PROFESSIONAL,
  FAT_GUY,
  SHREK,
  SLENDER_MAN,
  THE_THING,
  MR_BANANAS,
  ANGRY_GOOSE,
  LINKEDIN_GUY,
  INFOMERCIAL_HOST,
  NATURE_NARRATOR,
  GEN_Z_INTERN,
  BIBI,
  TRUMP,
  HILLARY,
  BARACK,
  CHARLIE_KIRK,
  ELIZABETH_HOLMES,
  IRON_MIKE,
  ERIC_ANDRE,
  DJ_KHALED,
]

const BY_ID = new Map(PACKS.map((p) => [p.meta.id, p]))

export function packById(id: string): PersonaPack | undefined {
  return BY_ID.get(id)
}
