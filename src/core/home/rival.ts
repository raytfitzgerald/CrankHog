// Before the rider's first ride of the week, Sir Loin has the Home velodrome
// to himself, and the rider's own coach yells at him (and at the rider) from
// the infield.
//
// Until 0.6.0 the rival was another coach from the roster. It's the hog now:
// he turns up whoever you ride with, he can't be offended, and "a pig is
// beating you" lands harder than "the Data Nerd is beating you".
//
// The lines are clean at every language setting, and they go through each
// persona's own banned-topic list in the test next door.

import { HOG } from '../mascot/hog'

const TAUNTS: Readonly<Record<string, readonly string[]>> = {
  'drill-sergeant': [
    'Look at {hog}, lapping my track while you sit there. On the bike, recruit!',
    '{hog}! Pick those trotters up! And you, recruit: saddle. Now.',
    'Even the pig showed up today. What is your excuse, recruit?',
  ],
  'roast-comic': [
    '{hog} is out there doing laps. Somebody has to, apparently.',
    'Hey {hog}, slow down, you are making my rider look bad. Well, worse.',
    'The track has a pig on it and you on the couch. Great crowd tonight.',
  ],
  'disappointed-dad': [
    "{hog} is out there riding. I'm not saying anything. I'm just saying.",
    "{hog}, you're doing great. See? That's what it looks like.",
    'I set that trainer up for you, and the pig is the one using it.',
  ],
  'the-overlord': [
    "{hog} is lapping the People's Velodrome. You are not. This has been noted.",
    'Faster, {hog}. The Ministry of Watts is watching. You too, citizen: to your bike.',
    '{hog} has met this week\'s quota. Where is yours?',
  ],
  'hype-coach': [
    'LOOK AT {hog} GO! You could be out there too! Let\'s GOOO!',
    '{hog} is crushing it! Your turn next, champ!',
    'Huge laps from the hog! Imagine what YOU could do out there!',
  ],
  'data-nerd': [
    '{hog} has logged more laps this week than you. I have a chart.',
    'Your rides this week: zero. {hog}: several. Statistically, you should ride.',
    'Nice cadence, {hog}. Yours is currently undefined.',
  ],
  zen: [
    '{hog} circles the track like a passing thought. You could join him.',
    'Watch {hog} ride. Notice the bike is waiting for you, too.',
    '{hog} has found the present moment. It has pedals.',
  ],
  professional: [
    '{hog} is getting a session in. Ready when you are.',
    'Good pace, {hog}. Your bike is set up whenever you want to start.',
  ],
  bibi: [
    'Ladies and gentlemen, {hog} is on the track. You, my friend, are not. This is a red line.',
    'I have a chart. On it, the hog has laps. You have none. Get on the bike.',
  ],
  trump: [
    '{hog} is riding. Tremendous laps, very good. You? Zero laps. Sad. Get on the bike.',
    'Everybody is saying the hog does great laps. Where are yours? Believe me, you can do better.',
  ],
}

const GENERIC = ['{hog} is already on the track. Your bike is waiting.', 'Look who is doing laps: {hog}. Your turn.']

/** What the rider's coach yells at Sir Loin (and at the rider). */
export function rivalTaunt(personaId: string, rng: () => number = Math.random): string {
  const lines = TAUNTS[personaId] ?? GENERIC
  return lines[Math.floor(rng() * lines.length) % lines.length]!.replaceAll('{hog}', HOG.name)
}

/** Every taunt a persona has, with the hog still as `{hog}` (for tests). */
export function allTaunts(personaId: string): readonly string[] {
  return TAUNTS[personaId] ?? GENERIC
}
