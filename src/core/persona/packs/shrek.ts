// Shrek: the swamp ogre, requested by the owner by name. Grumpy, territorial
// and furious that you're pedalling in his swamp (your garage). Gross ogre
// habits: mud baths, earwax candles, bog food, belching, plus a rough, vaguely
// Scottish bluntness. Every line is original: no quotes or paraphrases from
// the films, no other characters from them, no song lyrics, and no onion
// layers bit (onions are fine as food).
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('shrek')

b.add('ride_start', [
  [1, 'Right. Ye are here again. In my swamp. Fine. Pedal quietly.'],
  [1, "Morning. Mind the mud by the door. Actually, don't. It's decorative."],
  [2, "{workoutName}, is it? Fancy name. I'd call it 'the bit before ye leave my bog'."],
  [3, "Ye've parked a bicycle in my bog, plugged it into my wall, and ye expect me to cheer?"],
  [4, 'Another day, another squatter on a stationary bike. Stationary. Like yer progress.'],
  [5, "I've scraped livelier things off the bottom of my boot. Clip in."],
  [5, 'Look at ye. Sweaty, lost, and in my bloody swamp. Pedal or pay rent.', P],
  [2, 'FTP test, eh? I test things too. Mostly whether they are edible. Go on.', when(rideKind('ftp-test'))],
  [3, 'A free ride. No plan. Wandering a swamp with no plan is how folk end up in soup.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, '{targetW} watts for {remainingS}. Go on, then. Make some noise that is not whining.'],
    [1, 'Here we go. {targetW} watts. Push. The faster ye go, the sooner ye leave.'],
    [2, "{targetW} watts! Stomp those pedals like ye're squashing beetles for supper!"],
    [3, "{targetW} watts. I've seen bog frogs with stronger legs. Prove me wrong. Ye won't."],
    [4, '{targetW} watts. Ye pedal like a scarecrow in a breeze. Put some ogre in it.'],
    [5, "{targetW} watts! Move yer arse! This swamp has rules, and rule one is don't be rubbish!", P],
    [3, "Rep {rep} of {reps}. I count on my fingers. Don't make me use the toes. Nobody wants that."],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, "Last one! Finish it and I'll stop growling. For a minute."],
    [4, "Final rep. Do it properly or I light an earwax candle, and ye'll smell it all night."],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! Roar if ye have to! Go!'],
    [4, "Max effort! Pedal like an angry ogre's after ye. One is. He's sitting right here."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. Steeper every minute. Like the bank of my swamp. Climb.'],
    [4, 'Ramp! Harder every minute. Like chewing week-old eel. Keep chewing.'],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warm up. Slow and easy. Like mud sliding off a log.'],
    [3, "Warmup. The one bit ye're good at, and even then ye wheeze."],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, "Steady at {targetW}. Like a swamp. Doesn't move, doesn't complain."],
    [3, 'Steady at {targetW}. Boring as a dry bog. Hold it anyway.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery. Breathe. Through the nose. Not near me.'],
    [2, "Rest for {remainingS}. Long enough for a mud bath. Not that ye'd know."],
    [4, 'Recovery. Ye coast better than a log on a river. Same face, too.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, "Free ride. Do as ye like. Just don't touch my things."],
    [3, "No target for {remainingS}. Ye'll stop pedalling and call it thinking."],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown. Nearly done. Then out ye go.'],
    [3, "Cooldown. Best part. Means ye'll be leaving soon."],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds. Get ready, ye.'],
  [1, 'Ten seconds. Feet on the pedals, not on my rug.'],
  [2, "Ten seconds to {targetW} watts. Breathe in. Not too deep. It's swamp air."],
  [3, 'Ten seconds. Stop fidgeting. Ye look like a slug on salt.'],
  [4, "Ten seconds. If ye've an excuse, eat it. Ogres eat everything."],
  [5, 'Ten seconds! Get yer bloody arse in gear!', P],
  [2, "Ten seconds to all out! Find yer inner ogre! It's wee, but it's in there!", when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'Halfway. Not bad. Not good either. But not bad.'],
  [2, 'Halfway. {remainingS} to go. About as long as it takes me to finish a mud pie.'],
  [3, 'Halfway. This is where wee folk start crying. Are ye crying? Ye are.'],
  [4, "Halfway, and ye've the face of a toad that swallowed a wasp."],
  [5, "Halfway! Ye're sweating more than my bog in summer. Bloody disgusting. Almost respect it.", P],
  [2, "Halfway and right on target. Huh. Didn't expect that from a swamp squatter.", when(gte('pct', 98))],
  [3, 'Halfway and {deficitW} watts short. Lazy as a log. At least logs float.', when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left. Finish it.'],
  [2, "Last minute! Hold {targetW}! Then I'll put the kettle on. Nettle tea. Ye'll hate it."],
  [2, "Sixty seconds! Push like the swamp's rising round yer ankles!"],
  [3, 'One minute. Even my bath water drains eventually. Takes a week, but it drains.'],
  [4, "Final minute! Give up now and I'm telling the whole bog. The frogs gossip."],
  [5, 'Last minute! Dig in, ye great soft lump! Bloody dig!', P],
  [3, 'Last minute and {deficitW} short. Get angry. Ogre angry. Go.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, 'Good. {pct}% of target. Not terrible.'],
  [1, "There ye go. Good interval. Don't let it go to yer head."],
  [2, "Huh. Ye did it. I'm almost not grumpy. Almost."],
  [3, "Solid interval. I'd clap, but my hands are full of mud."],
  [4, "{pct}% of target. Fine. I'll let ye stay another five minutes."],
  [5, "Bloody hell. Good interval. Don't tell anyone I said that. I've a reputation.", P],
  [2, "Set done! All of them! I'll grumble a bit less. A wee bit.", when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}%. Missed it. Happens. Shake it off like swamp water.'],
  [2, "{pct}% of target. The target's still out there, waiting. Like a mosquito."],
  [3, "Average {avgW}, target {targetW}. That gap's wider than my bog, and my bog is massive."],
  [3, 'That interval was as limp as a boiled eel.'],
  [4, "{pctUnder}% under. I've seen worms with more push. I've eaten those worms."],
  [4, 'Missed. Ye fell apart like a mouldy loaf.'],
  [5, "{pct}%? That's not an interval, that's a bloody puddle.", P],
])

b.add('under_target', [
  [1, '{deficitW} watts short. Push a wee bit harder.'],
  [1, "{power} watts. The target's {targetW}. Ogres can count. Some ogres."],
  [2, "Under target. The trainer's working harder than ye, and it's not even angry."],
  [3, "{power} watts? A snail on my windowsill puts out more, and it's been there a week."],
  [4, "{deficitW} short! Ye pedal like ye're wading through my bog in yer good socks."],
  [5, 'Under again. Pathetic. Pick it up before I sit on ye. Bloody well pick it up.', P],
  [3, "{pct}% of target. That's not training. That's loitering in my swamp.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "Easy. {surplusW} over already. Ye'll burn out."],
  [3, "{power} watts, target {targetW}? Charging in like a wild boar. Boars don't last long round here. I eat them."],
  [4, "Too hot, too early. Ye'll be gasping like a fish in a dry bog."],
])

b.add('cadence_sag', [
  [1, 'Cadence slipping. Spin faster.'],
  [2, "Cadence {cadence}. Down {cadenceDrop}. Pick yer feet up, ye're dragging them like a sack."],
  [2, "Cadence sag! Quick feet! Like ye're running from my breath!"],
  [3, "Ye're pedalling like ye're stirring porridge. Cold porridge. Week-old porridge."],
  [3, '{cadence} rpm. Slower than a mudslide in winter.'],
  [4, "Cadence {cadence}. A leech has more rhythm, and it's mostly sitting."],
  [5, 'Cadence down {cadenceDrop}! Spin, ye lazy bugger! Spin!', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}, over yer cap of {hrCap}. Ease off. Even ogres rest.'],
  [2, "{hr} bpm. That's a lot of thumping. Back it off a wee bit."],
  [3, "Heart rate's over the cap. Calm down. Sit in a mud bath. In yer head."],
])

b.add('hr_spike_no_power', [
  [1, "Heart rate {hr} at {power} watts? Strap's glitching. Or ye smelled my breath."],
  [2, '{hr} bpm and barely pedalling. Wet the strap. Spit works. Ogre spit works best.'],
  [3, "That heart-rate spike's more exciting than yer whole ride. Strap glitch, probably."],
])

b.add('stopped_pedaling', [
  [1, 'Stopped. Grab some water. Not from the swamp.'],
  [1, 'Take a breather. Then pedal again.'],
  [2, 'Pedals stopped. Oh good. Silence. I like silence.'],
  [3, "Stopped at {elapsedMin} minutes. Is that it? I've had naps longer than yer effort."],
  [4, 'Ye stopped. The flywheel kept going. Smarter than ye, that flywheel.'],
  [5, 'Stopping? Bloody typical. Ye pedal like ye nap: badly, and in my house.', P],
])

b.add('resumed', [
  [1, 'Back again. Right. Carry on.'],
  [2, "Back after {pausedS}. I'd started enjoying the quiet."],
  [4, "Ye're back. I'd already moved my mud tub into yer spot."],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Fine. I skip baths. Water ones, not mud ones.'],
  [2, 'Skipped {segmentLabel}. Cowardly. But practical, in an ogre sort of way.'],
  [3, 'Ye skipped an interval. Even swamp rats finish their crawl.'],
  [3, "Skipping intervals. Ye'd skip the hard bits of anything. Like chewing."],
  [4, "Skip! Ye'll be in my garage forever at this rate. Forever. Think about that."],
  [5, 'Ye skipped it? Bloody coward. Even my earwax has more backbone.', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}. More? Fine. Odd, but fine.'],
  [3, 'Ye added {extraS}? On purpose? Are ye feverish? Did ye drink the swamp water?'],
  [4, 'Extra time! So ye want to stay in my swamp longer. Brilliant. Just brilliant.'],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. Fair enough. Pace yerself.'],
  [2, '{intensityPct}%. Backing off like a mouse from a cheese trap.'],
  [3, "Intensity down. Ye've the spine of a wet reed."],
  [3, 'Down to {intensityPct}%. Brilliant. More time in my swamp, less done in it.'],
  [4, '{intensityPct}%? Even the slugs are disappointed. And slugs expect nothing.'],
  [5, '{intensityPct}%? Bloody hell. Why not lie in the mud and let the bike pedal itself?', P],
])

b.add('intensity_up', [
  [1, "Intensity up to {intensityPct}%! Now that's ogre talk!"],
  [3, "Ye turned it up? Bold. Or daft. Let's see which."],
  [4, '{intensityPct}%! Big talk for someone wheezing in a swamp.'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Save some.'],
  [2, "{wbalPct}% W′bal left. Ye're running on swamp gas now."],
  [2, 'Reserves low. Ride smart. Ogre smart. Grunt and keep going.'],
  [3, "Yer W′bal's lower than the bottom of my bog."],
  [4, 'W′bal {wbalPct}%. Ye spent it all like a fool at a goblin market.'],
  [5, 'W′bal at {wbalPct}%. Blew it all early, ye daft bugger.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Grit yer teeth. Ogre grit.'],
  [3, "Tank's empty. Nothing left but grunting. Grunt, then."],
  [4, "Zero W′bal. Ye're as empty as a beetle shell I've licked clean."],
])

b.add('pr', [
  [1, "New {prLabel} PR! Well done. Don't make it weird."],
  [1, "That's a new {prLabel} best! Nice. I'll light a candle. Earwax. Special occasion."],
  [2, "{prLabel} personal record! {power} watts! Huh. That's actually decent."],
  [3, "A {prLabel} PR? In my swamp? I'll allow it. This once."],
  [4, 'New {prLabel} best! The frogs are croaking about it. Usually they croak about me.'],
  [5, "{prLabel} PR! Bloody hell! Ye've a wee bit of ogre in ye after all!", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Keep at it.'],
  [2, 'Minute {minute}. Still going. Stubborn. I like stubborn. A bit.'],
  [3, 'Minute {minute}. Projected {projectedFtp}. Not ogre numbers. Not even goblin numbers.'],
  [1, "Minute {minute}. Easy start. Don't gobble it all at once.", when(lte('minute', 3))],
  [3, "Minute {minute}. Feeling fresh? Give it ten minutes. Ye'll smell like my swamp.", when(lte('minute', 3))],
  [2, 'Minute {minute}! Final stretch! Roar it out!', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever ye're saving, spend it. There's nothing in a swamp worth buying.", when(gte('minute', 17))],
  [
    2,
    'Minute {minute}. Projected {projectedFtp}, {projectedGain} up. Hold on to it like a muddy eel.',
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! Not bad at all.', when(gt('ftpGain', 0))],
  [3, "Up {ftpGain} to {ftpNew}. Ye're getting stronger. I'm getting nervous. Not really.", when(gt('ftpGain', 0))],
  [5, "{ftpNew}! Up {ftpGain}! Bloody brilliant! Now go home. Ye smell worse than me, and that's a record.", whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Bad day. Even ogres have them.', when(gt('ftpDrop', 0))],
  [3, "{ftpNew}, down {ftpDrop} from {ftpOld}. Ye're shrinking. Wrong direction for a monster.", when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. Same as before. Like the smell in here.', when(eq('ftpGain', 0))],
  [1, "Test done. FTP {ftpNew}. There. Ye've a number."],
])

b.add('workout_complete', [
  [1, 'Done. Good work. Now go and wash. A proper wash.'],
  [1, 'Workout complete. {elapsedMin} minutes. Ye survived the swamp.'],
  [2, "Done. NP {np}. Not awful. I've seen awful. I've eaten awful."],
  [2, "{kj} kJ. That's a lot of work. Not ogre work, but work."],
  [3, "Ye finished. I'm as surprised as the frogs."],
  [4, 'Workout complete. Now leave. The mud needs a rest from ye.'],
  [5, "That's it. Done. Bloody good, actually. Now shoo.", P],
])

b.add('ride_bailed', [
  [1, 'Leaving early. Fine. Means peace and quiet for me.'],
  [2, 'Off at {elapsedMin} minutes? Ye barely got the swamp warm.'],
  [3, 'Bailed. Ye come in, sweat on my floor and leave. Like a wet dog.'],
  [3, "Early exit. Important business, I'm sure. Like sitting down somewhere else."],
  [4, "Quitting already? Ogres don't quit. They sulk, but they don't quit."],
  [5, 'Ye bailed? Bloody hell. Even the mould on my bread stayed longer.', P],
])

b.add('fueling_reminder', [
  [1, "Eat something. Ye're running low."],
  [1, 'Fuel time. Have a snack. An onion? Raw? Go on.'],
  [2, "Eat. I'd share my slug jerky, but I won't."],
  [3, "Eat something before ye get grumpier than me. That's not possible, but try."],
  [4, "{elapsedMin} minutes in. Eat now or ye'll bonk and blame my swamp."],
  [5, 'Eat a bloody gel. Hungry ye is worse company than a wet badger.', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water. Clean water. Not from the bog.'],
  [2, "Hydration break. Bottle's right there. Use it."],
  [3, "Drink. Ye're sweating so much the swamp's getting bigger."],
])

b.add('distress', [
  [1, 'No more growling. Ease right off and breathe. Stop if something feels wrong.'],
  [1, 'Easy now. Soft-pedal or stop. Ye matter more than this workout. I mean it.'],
])

b.add('idle_banter', [
  [1, "Ye're doing fine. Don't let it go to yer head."],
  [1, "Keep going. I'll be in my mud tub, listening."],
  [2, '{elapsedMin} minutes, still pedalling. Stubborn. I respect stubborn.'],
  [2, 'Power {power}, cadence {cadence}. Steady. Steady as a sinking log.'],
  [3, "I've lit an earwax candle. Smell that? That's character."],
  [3, 'This garage was a perfectly good swamp before ye dragged a bicycle into it.'],
  [3, 'Ye breathe like a bellows with a hole in it.'],
  [4, 'Ye ride indoors so nobody sees ye. Smart. I live in a swamp for the same reason.'],
  [4, "Ye've more gear than sense. Carbon wheels on a bike that doesn't go anywhere. Genius."],
  [5, "Folk are scared of ogres. Nobody's scared of ye. Watching ye pedal, I see why."],
  [5, "I had mud for breakfast and I'm still more motivated than ye."],
  [5, "Ye pedal like ye're scared of waking me. I'm awake. Bloody pedal!", P],
])

b.add('segment_start', [[5, '{targetW} watts. Move, ye lazy shite, before I sit on yer handlebars.', P]], [HARD])
b.add('under_target', [[5, '{power} watts. Fucking pitiful. Frogs push harder getting out of a puddle.', P]])
b.add('idle_banter', [[5, "This pace is shite. The mud's moving faster, and mud doesn't move.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Right. Ye're here. In my fucking swamp. Fine. Pedal.", P],
  [4, 'Clip in. An hour of ye sweating on my floor. Shite deal for me.', P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts. Go on. Make the swamp proud. Fucking hard.', P],
    [5, "{targetW} watts for {remainingS}. Keep yer excuses. I've a bucket for that shite, out by the latrine.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, "Ten seconds. Fuck about now and ye'll meet {targetW} watts face first.", P]])
b.add('halfway', [[4, "Halfway. Half an effort. Ye're a fucking half-ogre at best.", P]])
b.add('last_minute', [[3, "Last minute. Don't fuck it up. I'm watching. From the mud.", P]])
b.add('segment_end_success', [
  [1, "That was fucking good. I'm nearly smiling. Look away.", P],
  [5, "Ye hit it? Shite. Now I've nothing to grumble about. I'll find something.", P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That's a shite interval. Bog-standard shite.", P],
  [5, "Average {avgW}, target {targetW}. A fucking toad would've jumped that gap.", P],
])
b.add('under_target', [
  [2, '{deficitW} watts short. Shift yer arse, ye great soft shite.', P],
  [4, "{power} watts? I've broken wind harder than that. Fucking push.", P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. Ye're pedalling through treacle. Shite treacle.", P]])
b.add('stopped_pedaling', [[4, 'Stopped? In my swamp? On my floor? Fucking typical.', P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. Ye'd skip yer own birthday if it had a hill in it. Shite.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? Ye turned it down? That's some soft, swampy shite.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. Ye blew it all early like a fucking fool.', P]])
b.add('pr', [[2, "{prLabel} PR? Well, shite. Ye've earned a mud bath.", P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. Carve that shite into a tree. I'll piss on it, so everyone knows it's mine.", P]])
b.add('workout_complete', [
  [1, "Done. Ye were fucking decent today. Don't get used to me saying it.", P],
  [5, "That's it. {tss} TSS. Not bad for someone who started like a bog full of shite.", P],
])
b.add('ride_bailed', [[5, 'Bailing at {elapsedMin} minutes? Fuck off, then. More swamp for me.', P]])
b.add('fueling_reminder', [[3, 'Eat something. Hungry ye is shite company, and I hate company.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Fine. Dull as shite, but fine.', P],
  [4, 'This swamp smells of yer sweat now. Mine smelled better. Fucking hell.', P],
  [5, 'Ye call this suffering? Try a winter in a bog with a fucking head cold.', P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}. Right. Quick look. Moving on.'],
    [2, '{place}! Too many people. Too clean. Keep going.'],
    [3, "{place}. They've cobbles. Cobbles are just mud that gave up."],
    [4, "We're in {place}. The locals are pointing. At ye, for once."],
    [5, "{place}! {kmLeft} km to go and ye're crawling like a bloody bog snail.", P],
    [5, "{place}. {kmLeft} km left. That's a lot of swamp between here and anywhere decent."],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, '{place}! New country. Same grumpy ogre.'],
  [3, '{place}! They let ye in? Their guards must be blind. Or kind. Same thing round here.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'Top of {place}! Good climb. Air is thin. Smells less of swamp, sadly.'],
  [3, "Ye got up {place}. Took ye long enough. I'd have carried the bike up. And ye."],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway! Half done. Half grumpy. Fully ogre.'],
  [3, "Halfway through {journeyName}. Half a journey. Ye've complained the whole first half."],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! Ye made it! {journeyName}, done! Now go home.'],
  [3, "{place}. {kmDone} km. Fine. Impressive. Don't tell the swamp I said that."],
], [eq('milestoneKind', 'finish')])

export const SHREK: PersonaPack = {
  meta: {
    id: 'shrek',
    name: 'Shrek',
    tagline: 'A grumpy swamp ogre who wants you out of his garage. Pedal harder and he might let you leave.',
    voiceHint: { rate: 0.92, pitch: 0.7, preferVoices: ['Daniel', 'Rocko', 'Fred', 'Alex', 'Tom'] },
  },
  lines: b.build(),
}
