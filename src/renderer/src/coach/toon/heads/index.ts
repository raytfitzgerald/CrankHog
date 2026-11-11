// Photo heads for the coach caricatures: the real people, plus a goose and a
// painted chimp. Each head is two layers made by
// scripts/toon-cutout.swift: the head (with a dark mouth painted where only an
// open jaw shows it) and the jaw, which slides down to talk. Sources, licences
// and what was changed: ATTRIBUTION.md in this folder.
import dodHead from './bibi-dod-2025-02-05-head.webp'
import dodJaw from './bibi-dod-2025-02-05-jaw.webp'
import pibHead from './bibi-pib-2026-02-26-head.webp'
import pibJaw from './bibi-pib-2026-02-26-jaw.webp'
import whHead from './bibi-whitehouse-2026-07-28-head.webp'
import whJaw from './bibi-whitehouse-2026-07-28-jaw.webp'
import t17Head from './trump-portrait-2017-head.webp'
import t17Jaw from './trump-portrait-2017-jaw.webp'
import t25Head from './trump-portrait-2025-head.webp'
import t25Jaw from './trump-portrait-2025-jaw.webp'
import t26Head from './trump-portrait-2026-06-head.webp'
import t26Jaw from './trump-portrait-2026-06-jaw.webp'
import twhHead from './trump-whitehouse-2026-07-28-head.webp'
import twhJaw from './trump-whitehouse-2026-07-28-jaw.webp'
import hilStateHead from './hillary-state-2009-head.webp'
import hilStateJaw from './hillary-state-2009-jaw.webp'
import hilWhHead from './hillary-whitehouse-1990s-head.webp'
import hilWhJaw from './hillary-whitehouse-1990s-jaw.webp'
import obama12Head from './barack-portrait-2012-head.webp'
import obama12Jaw from './barack-portrait-2012-jaw.webp'
import obamaCapHead from './barack-capitol-2005-head.webp'
import obamaCapJaw from './barack-capitol-2005-jaw.webp'
import obamaSenHead from './barack-senate-2005-head.webp'
import obamaSenJaw from './barack-senate-2005-jaw.webp'
import holmesTcHead from './holmes-techcrunch-2014-head.webp'
import holmesTcJaw from './holmes-techcrunch-2014-jaw.webp'
import holmesStageHead from './holmes-techcrunch-onstage-2014-head.webp'
import holmesStageJaw from './holmes-techcrunch-onstage-2014-jaw.webp'
import tyson85Head from './tyson-1985-head.webp'
import tyson85Jaw from './tyson-1985-jaw.webp'
import tysonKoHead from './tyson-ko-1988-head.webp'
import tysonKoJaw from './tyson-ko-1988-jaw.webp'
import tysonPressHead from './tyson-press-1988-head.webp'
import tysonPressJaw from './tyson-press-1988-jaw.webp'
import kirkHead from './kirk-skidmore-2025-head.webp'
import kirkJaw from './kirk-skidmore-2025-jaw.webp'
import khaledPressHead from './khaled-press-head.webp'
import khaledPressJaw from './khaled-press-jaw.webp'
import khaled12Head from './khaled-2012-head.webp'
import khaled12Jaw from './khaled-2012-jaw.webp'
import andreHead from './andre-2012-head.webp'
import andreJaw from './andre-2012-jaw.webp'
import gooseHead from './goose-usfws-head.webp'
import gooseJaw from './goose-usfws-jaw.webp'
import chimpHead from './chimp-schippers-head.webp'
import chimpJaw from './chimp-schippers-jaw.webp'
import type { ToonTie } from '../CoachToon'

export interface ToonHead {
  head: string
  jaw: string
  /** Who took the photo, for the tooltip. */
  credit: string
}

const BIBI_HEADS: readonly ToonHead[] = [
  { head: whHead, jaw: whJaw, credit: 'Official White House photo by Daniel Torok (public domain)' },
  { head: dodHead, jaw: dodJaw, credit: 'U.S. Department of Defense photo by Senior Airman Madelyn Keech (public domain)' },
  { head: pibHead, jaw: pibJaw, credit: 'Press Information Bureau, Government of India (GODL-India)' },
]

const TRUMP_HEADS: readonly ToonHead[] = [
  { head: t17Head, jaw: t17Jaw, credit: 'Official White House photo by Shealah Craighead (public domain)' },
  { head: t25Head, jaw: t25Jaw, credit: 'Official portrait by Daniel Torok, White House (public domain)' },
  { head: twhHead, jaw: twhJaw, credit: 'Official White House photo by Daniel Torok (public domain)' },
  { head: t26Head, jaw: t26Jaw, credit: 'Official portrait by Daniel Torok, White House (public domain)' },
]

const HILLARY_HEADS: readonly ToonHead[] = [
  { head: hilStateHead, jaw: hilStateJaw, credit: 'U.S. Department of State official photo (public domain)' },
  { head: hilWhHead, jaw: hilWhJaw, credit: 'Official White House portrait (public domain)' },
]

const BARACK_HEADS: readonly ToonHead[] = [
  { head: obama12Head, jaw: obama12Jaw, credit: 'Official White House photo by Pete Souza (public domain)' },
  { head: obamaCapHead, jaw: obamaCapJaw, credit: 'United States Senate photo (public domain)' },
  { head: obamaSenHead, jaw: obamaSenJaw, credit: 'United States Senate official portrait (public domain)' },
]

const ELIZABETH_HOLMES_HEADS: readonly ToonHead[] = [
  { head: holmesTcHead, jaw: holmesTcJaw, credit: 'Photo by Max Morse for TechCrunch (CC BY 2.0)' },
  { head: holmesStageHead, jaw: holmesStageJaw, credit: 'TechCrunch (CC BY 2.0)' },
]

const IRON_MIKE_HEADS: readonly ToonHead[] = [
  { head: tyson85Head, jaw: tyson85Jaw, credit: 'Unknown photographer, 1985 (public domain)' },
  { head: tysonKoHead, jaw: tysonKoJaw, credit: 'Bill Apter, KO Magazine (public domain)' },
  { head: tysonPressHead, jaw: tysonPressJaw, credit: 'Unknown photographer, Boxing 89 (public domain)' },
]

const CHARLIE_KIRK_HEADS: readonly ToonHead[] = [
  { head: kirkHead, jaw: kirkJaw, credit: 'Gage Skidmore (CC BY-SA 2.0)' },
]

const DJ_KHALED_HEADS: readonly ToonHead[] = [
  { head: khaledPressHead, jaw: khaledPressJaw, credit: 'Dapper Lou / Sony Music Entertainment (CC BY 4.0)' },
  { head: khaled12Head, jaw: khaled12Jaw, credit: 'Meghan Roberts (CC BY 2.0)' },
]

const ERIC_ANDRE_HEADS: readonly ToonHead[] = [
  { head: andreHead, jaw: andreJaw, credit: 'CleftClips (CC BY 2.0)' },
]

const ANGRY_GOOSE_HEADS: readonly ToonHead[] = [
  { head: gooseHead, jaw: gooseJaw, credit: 'U.S. Fish and Wildlife Service (public domain)' },
]

const MR_BANANAS_HEADS: readonly ToonHead[] = [
  { head: chimpHead, jaw: chimpJaw, credit: 'Portrait of a chimpanzee by Jos Schippers, 1887 (public domain)' },
]

/** A persona's caricature: the photo heads it cycles through, and the suit's tie. */
export interface Toon {
  heads: readonly ToonHead[]
  tie: ToonTie
}

const TOONS: Readonly<Record<string, Toon>> = {
  bibi: { heads: BIBI_HEADS, tie: { color: '#2d6cdf', length: 1 } },
  // the long red tie, streaming in the wind
  trump: { heads: TRUMP_HEADS, tie: { color: '#d7263d', length: 1.55 } },
  hillary: { heads: HILLARY_HEADS, tie: { color: '#1f5fb8', length: 1 } },
  barack: { heads: BARACK_HEADS, tie: { color: '#3a6fd8', length: 1 } },
  // black, so it reads as the turtleneck
  'elizabeth-holmes': { heads: ELIZABETH_HOLMES_HEADS, tie: { color: '#111418', length: 0.8 } },
  'iron-mike': { heads: IRON_MIKE_HEADS, tie: { color: '#f2c14e', length: 0.9 } },
  'charlie-kirk': { heads: CHARLIE_KIRK_HEADS, tie: { color: '#c8102e', length: 1 } },
  'dj-khaled': { heads: DJ_KHALED_HEADS, tie: { color: '#d4af37', length: 1.2 } },
  'eric-andre': { heads: ERIC_ANDRE_HEADS, tie: { color: '#ff4fa3', length: 1.35 } },
  'angry-goose': { heads: ANGRY_GOOSE_HEADS, tie: { color: '#7a4b2a', length: 1 } },
  'mr-bananas': { heads: MR_BANANAS_HEADS, tie: { color: '#ffd23f', length: 1 } },
}

/** A persona's caricature, or null for the personas drawn as monograms. */
export function toonFor(personaId: string | null | undefined): Toon | null {
  return (personaId && TOONS[personaId]) || null
}
