// Iron Mike: a parody of Mike Tyson's public persona, requested by the user.
// The bit: intervals are rounds, the trainer is the opponent, "everybody has a
// plan until they get punched in the mouth", the baddest man on the planet,
// Kid Dynamite, the face tattoo, the pigeons he adores, late-night
// philosophical tangents, the ear bite as a threat to soft-pedallers, his
// cannabis business and his podcast. The owner asked for his lisp: many lines
// spell s and z sounds as "th" so text-to-speech lisps them, while each line
// stays readable. Swear words are never lisped, so the profanity checker sees
// them. Off limits: his conviction, his family's losses, and every other real
// person (no opponents by name).
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('iron-mike')

b.add('ride_start', [
  [1, 'Welcome to the ring, champ. Thith ith gonna hurt, but in a beautiful way.'],
  [1, "Let'th go to work, champ. Jutht you, me, the trainer and the pain."],
  [2, "Tonight'th fight card: {workoutName}. You're the underdog. Thorry."],
  [3, 'Look at you, all clipped in like a contender. You look like a guy who hath a plan.'],
  [4, 'Everybody hath a plan until they get punched in the mouth. Today the trainer throwth the punch.'],
  [5, "I wath the baddetht man on the planet. You're the thoftetht man on a thtationary bike."],
  [2, 'FTP tetht. Thith ith a title fight, champ. Twenty minuteth, no judgeth, jutht numberth.', when(rideKind('ftp-test'))],
  [3, 'Free ride. No plan? Good. Planth get punched in the mouth anyway.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, 'Ding ding! {targetW} wattth for {remainingS}. Handth up, chin down, pedal.'],
    [1, '{targetW}, champ. You got thith. I believe in you like I believe in my pigeonth.'],
    [2, '{targetW} wattth! Come out thwinging!'],
    [3, "{targetW}. Everybody hath a plan until the interval thtartth. What'th your plan now?"],
    [4, "{targetW} wattth. It'th gonna hit you. Hit it back harder."],
    [5, "{targetW}. Go! I been around fighterth my whole life. Never thaw one tho thcared of a bicycle."],
    [3, 'Round {rep} of {reps}. Thith ith where the fight getth ugly. I love ugly.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Latht round! Empty the tank, champ! Leave nothing in the corner!'],
    [4, "Final round. You're behind on the thcorecardth. You need a knockout."],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! Throw everything! Combinationth!'],
    [4, 'All out! They uthed to call me Kid Dynamite. Show me a firecracker at leatht. A thparkler. Anything.'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. It keepth getting harder, like the latht roundth of a long fight.'],
    [4, 'The ramp. Every minute, a bigger guy getth in the ring. Thtay on your feet.'],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup. Shadowbox with the pedalth. Eathy. Find your rhythm.'],
    [3, 'Warmup. The only round you ever win on pointth.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Thteady at {targetW}. Jab, jab, jab. Thame rhythm, every thtroke.'],
    [3, "Thteady at {targetW} for {remainingS}. Champion thtuff ith boring. That'th why you never do it."],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery. Back to your corner. Breathe. Drink.'],
    [2, 'Retht for {remainingS}. Thpit in the bucket. Get ready for the next round.'],
    [4, "Recovery. In my corner, they'd have thlapped you awake by now."],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride. No target, no judgeth. Thpar with yourthelf.'],
    [3, "No target for {remainingS}. No opponent. Thow me what you do when nobody'th punching you."],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown. The fight ith over. You did good, champ.'],
    [3, "Cooldown. You thurvived. It wathn't pretty, but the judgeth don't thcore pretty."],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten thecondth! Gloveth up, champ!'],
  [1, 'Ten thecondth to the bell!'],
  [2, 'Ten thecondth to {targetW}. Bite down on the mouthpiethe.'],
  [3, 'Ten thecondth. Latht chance to fake a thenthor dropout.'],
  [4, 'Ten thecondth. Everybody hath a plan. Yourth ith about to get punched.'],
  [5, 'Ten thecondth! Thtop hiding in the corner like a thcared pigeon!'],
  [2, 'Ten thecondth to all out. Knockout power, champ!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway, champ! You're doing great! Keep thwinging!"],
  [2, "Halfway. {remainingS} to go. You're thtill on your feet. That'th thomething."],
  [3, 'Halfway. Thith ith where guyth with glath jawth thtart looking for the exit.'],
  [4, 'Halfway. Your power line lookth like a guy who jutht ate a right hook.'],
  [5, "Halfway! Nobody'th cheering. Hell, keep throwing puncheth anyway.", P],
  [5, 'Halfway. I can thmell fear on you from here. It thmellth like a warmup.'],
  [2, "Halfway and right on target. That'th championthip thtuff.", when(gte('pct', 98))],
  [3, "Halfway and {deficitW} wattth short. You're getting outpointed. Thtep it up.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left! Finish the round, champ!'],
  [2, 'Latht minute! Hold {targetW}! Throw everything!'],
  [2, 'One minute. Thith ith where legendth are made. Or knocked out.'],
  [3, 'Thixty thecondth. Every fight endth. Even the ugly oneth.'],
  [4, "Final minute. Quit now and I'm telling the whole podcatht."],
  [5, "Latht minute! Dig in! Don't make me get in the ring with you. You won't like it."],
  [3, 'Latht minute and {deficitW} short. Get up off the canvath, champ.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, "{pct}% of target! What a round! Raithe your handth, champ!"],
  [1, "That'th the one! Beautiful round!"],
  [2, "Look at that. You actually landed a punch. I'm proud of you. Weirdly."],
  [3, "Good round. I wath ready to bite thomething. Now I'm jutht hungry."],
  [4, "{pct}% of target. Okay. You're not a bum. Not today."],
  [5, "Good interval. Don't get cocky. Cocky guyth get knocked out cold."],
  [2, 'Thet complete! Every round! Raithe the belt!', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}% of target. Hey, everybody getth hit thometimeth.'],
  [2, '{pct}%. You got outpointed by a bicycle, champ.'],
  [3, "Average {avgW}, target {targetW}. That ain't a gap, that'th a canyon you fell in."],
  [3, 'That interval had all the danger of a pillow fight between two pigeonth.'],
  [4, "{pctUnder}% under. You didn't lothe on pointth, you got knocked out."],
  [4, 'Under target. Your excutheth got better footwork than your legth.'],
  [5, "{pct}%? I've theen guyth fight better with a broken jaw."],
])

b.add('under_target', [
  [1, 'Hey, {deficitW} wattth short. Clothe the gap, champ.'],
  [1, '{power} wattth. Target ith {targetW}. Jab your way back up.'],
  [2, "Under target. You're fighting like you're hoping the referee thtopth it."],
  [3, '{power} wattth? My pigeonth make more power flapping.'],
  [4, "{deficitW} wattth short. Thoft-pedal one more time and I'm taking an ear. I'm not kidding."],
  [5, "Under target again. You're built like a heavyweight and you pedal like a featherweight."],
  [3, "{pct}% of target. That ain't a fight, that'th a long, thad clinch.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "{surplusW} over already. Patienthe, champ. Don't punch yourthelf out."],
  [3, "{power} when the target'th {targetW}? You're throwing haymakerth in round one. Amateur."],
  [4, "Too hot, too early. You're gonna gath out by round three, and I'm gonna laugh."],
])

b.add('cadence_sag', [
  [1, 'Cadenthe ith thlipping. Quick feet, champ!'],
  [2, 'Cadenthe {cadence}. Down {cadenceDrop}. Fathter handth. I mean feet.'],
  [2, 'Cadenthe thag. Light gear, quick feet, like thkipping rope.'],
  [3, 'Your cadenthe ith dropping like a guy who walked into an uppercut.'],
  [3, "{cadence} rpm. That ain't pedaling, that'th thtirring thoup."],
  [4, "Cadenthe {cadence}. Thpin! Thpin fathter! You're pedaling like you're thtuck in thyrup."],
  [5, 'Cadenthe down {cadenceDrop}. Thpin, damn it! Thith ith a bike, not a rowboat.', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}. Over your cap of {hrCap}. Eathe off a little, champ.'],
  [2, '{hr} bpm. Even fighterth need to breathe. Back it off.'],
  [3, 'Heart rate over the cap. Thlow it down. Thmart fighterth pace themthelveth.'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} wattth? Either the thtrap ith glitching or you jutht thaw me thmile.'],
  [2, '{hr} bpm while barely pedaling. Wet the thtrap, champ.'],
  [3, "That heart-rate thpike ith fake. I know fake. I know real. That ain't real."],
])

b.add('stopped_pedaling', [
  [1, 'Break time. Go to your corner. Take a breath.'],
  [1, 'Paused. Drink thome water. The fight waitth for you.'],
  [2, 'Pedalth thtopped. You taking a knee, champ?'],
  [3, 'Thtopped at {elapsedMin} minuteth. The ref ith counting. One. Two. Three.'],
  [4, "You thtopped. The flywheel'th thtill going. The flywheel'th got more heart than you."],
  [5, "Thtopping? Hell, I've theen guyth out cold get up fathter than thith.", P],
])

b.add('resumed', [
  [1, "And you're back up! Beat the count! Let'th go!"],
  [2, "Back after {pausedS}. Long count. I'll allow it."],
  [4, "You're back. I wath about to throw in the towel for you."],
])

b.add('skipped_interval', [
  [1, 'Thkipped it. Okay. Thometimeth you dodge a punch.'],
  [2, 'Thkipped {segmentLabel}. You ducked that one, huh?'],
  [3, "You thkipped an interval. That'th like thowing up to the weigh-in and not the fight."],
  [3, "Thkipping intervalth. That ain't defenthe. That'th running away."],
  [4, "Thkipped. You're ducking fightth now? Real fighterth don't duck."],
  [5, "You thkipped it? Damn. I never ducked a fight in my life. Not one.", P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}! Extra round! I love it!'],
  [3, "You added {extraS}? Voluntarily? Now you're talking like a fighter."],
  [4, 'Extra time? You athked for more punishment. Rethpect.'],
])

b.add('intensity_down', [
  [1, 'Intenthity down to {intensityPct}%. Thmart. Know your weight clath.'],
  [2, '{intensityPct}%. Dropping a weight clath. It happenth.'],
  [3, 'Intenthity down. You threw in the towel. Jutht one little corner of it.'],
  [3, "Down to {intensityPct}%. That ain't a comeback, that'th a retirement."],
  [4, "Turning it down to {intensityPct}%? Your legth tapped out. Thith ain't even that kind of fight."],
  [5, "{intensityPct}%? Hell, thith ain't training anymore, it'th a thpa day.", P],
])

b.add('intensity_up', [
  [1, "Intenthity up to {intensityPct}%! Now we're fighting!"],
  [3, "You turned it UP? Bold. Let'th thee if the chin can take it."],
  [4, '{intensityPct}%! You called me out. Big mithtake. I love it.'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Thave thome for the latht round.'],
  [2, '{wbalPct}% W′bal left. Your legth are wobbling, champ.'],
  [2, 'Retherveth low. Fight thmart. Clinch if you have to.'],
  [3, 'Your W′bal ith lower than my patienthe for thoft-pedalerth.'],
  [4, 'W′bal {wbalPct}%. You punched yourthelf out. Rookie mithtake.'],
  [5, "W′bal at {wbalPct}%. Thpent it all in the firtht round, didn't you? Damn amateur.", P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Now you fight on heart. Heart ith free.'],
  [3, 'The tank ith empty. Thith ith where you find out who you are.'],
  [4, "Zero W′bal. You're out on your feet. Thtill, don't fall."],
])

b.add('pr', [
  [1, 'New {prLabel} PR! Champion! Raithe your handth!'],
  [1, "That'th a new {prLabel} betht! I'm proud of you, champ!"],
  [2, "{prLabel} perthonal record! {power} wattth! That'th knockout power!"],
  [3, "A {prLabel} PR? I had my teeth ready for your ear. Now I'm jutht thmiling with them."],
  [4, 'New {prLabel} betht! I gotta change my whole opinion of you. Thlightly.'],
  [5, '{prLabel} PR! Damn! The baddetht rider on the planet! For today!', P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Keep jabbing.'],
  [2, "Minute {minute}! Thtill thtanding! That'th a fighter!"],
  [3, 'Minute {minute}. Projected {projectedFtp}. Title fight, champ. No clinching.'],
  [1, 'Minute {minute}. Eathy thtart. Feel out your opponent.', when(lte('minute', 3))],
  [3, 'Minute {minute}. Everybody feelth great early. Everybody hath a plan.', when(lte('minute', 3))],
  [2, 'Minute {minute}! Championthip roundth! Leave it all in the ring!', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you were thaving, thpend it. There ain't no rematch.", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, up {projectedGain}. You're winning on the cardth. Don't get thloppy.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! And the NEW champion!', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} to {ftpNew}. Rethpect. You hit harder now.', when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn! You might be a real fighter after all!', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Everybody lotheth thometimeth. Come back thtronger.', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. You got knocked down. Get up.', when(gt('ftpDrop', 0))],
  [2, 'FTP thtayth at {ftpNew}. A draw. Nobody likth a draw.', when(eq('ftpGain', 0))],
  [1, "Tetht done! FTP {ftpNew}! That'th the fight!"],
  [4, "FTP {ftpNew}. The number don't lie. People lie. Numberth don't."],
])

b.add('workout_complete', [
  [1, "That'th the fight! You went the dithtanthe, champ!"],
  [1, 'Workout complete! {elapsedMin} minuteth in the ring! Proud of you!'],
  [2, 'Done. NP {np}. You fought like you meant it.'],
  [2, "{kj} kJ of work. That'th a lot of puncheth, champ."],
  [3, 'You finithed. I had money on the other guy. The other guy wath your couch.'],
  [4, "Workout complete. You're not the baddetht man on the planet. But you're not the wortht, either."],
  [5, "That'th a wrap. Damn good fight. I'll talk about it on the podcatht. Mothtly the bad partth.", P],
])

b.add('ride_bailed', [
  [1, 'Early exit. Thometimeth the corner throwth in the towel.'],
  [2, "Leaving at {elapsedMin} minuteth? You didn't even make it to the judgeth."],
  [3, 'Bailed. Everybody hath a plan. Your plan wath the couch.'],
  [3, "Early exit. I'll tell everybody you had a cut over the eye."],
  [4, "Quitting already? I've theen guyth finish with both eyeth thwollen shut."],
  [5, "You bailed? Hell. I'd bite your ear, but you'd quit on that too.", P],
])

b.add('fueling_reminder', [
  [1, 'Eat thomething, champ. Fighterth gotta eat.'],
  [1, 'Fuel check. Carbth in, puncheth out.'],
  [2, 'Eat thomething. Not my edibleth. Thave thothe for after.'],
  [3, 'Eat now. Hungry fighterth get thloppy.'],
  [4, "{elapsedMin} minuteth in. Eat now, or you'll hit the wall like it threw the firtht punch."],
  [5, "Eat a damn gel. You're gonna bonk and blame the trainer.", P],
])

b.add('hydration_reminder', [
  [1, 'Drink thome water, champ. Rinthe and thpit. No, wait. Drink it.'],
  [2, "Hydration. The bottle'th right there. Don't make me hand it to you."],
  [3, 'Drink. Dehydrated fighterth fold like lawn chairth.'],
])

b.add('distress', [
  [1, 'Hey, champ. Ease off and breathe. Stop if something feels wrong. Your health comes first.'],
  [1, 'No fight right now. Soft-pedal or stop. You matter more than any workout.'],
])

b.add('idle_banter', [
  [1, "You're doing good, champ. I mean that. I'm a thoft guy now."],
  [1, "Keep going. Rhythm, breath, heart. That'th boxing. That'th life."],
  [2, "I'm putting thith ride on my podcatht. It'th gonna be a short epithode."],
  [2, '{elapsedMin} minuteth in and thtill punching. Good. Keep moving your head. And your legth.'],
  [2, 'Power {power}, cadenthe {cadence}. Conthithtent. I like conthithtent.'],
  [2, "They uthed to call me the baddetht man on the planet. Now I'm the baddetht coach in your thpare room."],
  [3, 'Thometimeth late at night I think: what ith a watt, really? Then I look at you and think: not thith.'],
  [3, "I got a fathe tattoo. That'th commitment. You can't even commit to a cadenthe."],
  [3, "Life ith pain. The trainer ith a mirror. And the mirror thayth you're thlow."],
  [3, 'My pigeonth fly hundredth of mileth home and never complain. You whined at minute {elapsedMin}.'],
  [4, 'You ride indoorth tho nobody theeth you get bullied by a bicycle. Thmart.'],
  [4, "Thoft-pedal one more time. I'm thtaring at your ear. You know my hithtory."],
  [4, 'You pedal like you ate one of my gummieth. The thtrong oneth.'],
  [5, "You're built like a heavy bag and you hit like a pillow."],
  [5, 'Everybody hath a plan until they get punched in the mouth. You got punched by a warmup.'],
])

b.add('segment_start', [[5, '{targetW} wattth. Thtop thtalling and get on the fucking pedalth.', P]], [HARD])
b.add('under_target', [[5, "{power} wattth. Fucking embarrathing. Keep thoft-pedaling and I'm biting thomething.", P]])
b.add('idle_banter', [[5, 'Thith pathe ith bullshit. The ref would thtop thith fight out of pity.', P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Welcome to the fucking ring, champ. Thith gonna be beautiful.", P],
  [4, 'Clip in. Tonight: an hour of me watching you get beat up by a fucking bicycle.', P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} wattth. Eathy, right? Fuck no. Handth up.', P],
    [5, '{targetW} wattth for {remainingS}. I can thmell the excuthe on you already. Thave that shit.', P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten thecondth. Fuck around and get punched in the mouth.', P]])
b.add('halfway', [[4, 'Halfway. Half the round, half the effort. Fucking pathetic, champ.', P]])
b.add('last_minute', [[3, "Latht minute. Thith ith the knockout round. Don't fuck it up.", P]])
b.add('segment_end_success', [
  [1, "That wath fucking beautiful, champ. I'm getting emotional.", P],
  [5, 'You actually hit it? Holy shit. Thomebody call the commithion, I want thith on record.', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That wathn't a fight, that wath shitty thparring.", P],
  [5, 'Average {avgW}, target {targetW}. That gap ith fucking huge. Get off the canvath.', P],
])
b.add('under_target', [
  [2, "{deficitW} wattth short. Come on, that'th bullshit, champ.", P],
  [4, '{power} wattth? My fucking toathter putth out more than that.', P],
])
b.add('cadence_sag', [[3, "Cadenthe {cadence}. You're pedaling like a fucking thnail with a hangover.", P]])
b.add('stopped_pedaling', [[4, "Oh, we're thtopping? Great. Thtanding in the ring doing fucking nothing.", P]])
b.add('skipped_interval', [[3, "Thkipped {segmentLabel}. Ducking fightth? That'th fucked, champ.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? That ain't boxing, that'th fucking patty-cake.", P]])
b.add('wbal_low', [[3, "W′bal {wbalPct}%. You're gathed, champ. Thith ith where the shit getth real.", P]])
b.add('pr', [[2, '{prLabel} PR? Holy shit, champ! Thomebody get thith fighter a belt!', P]])
b.add('ftp_test_result', [[4, 'FTP {ftpNew}. Tattoo that shit on your fathe. It worked for me.', P]])
b.add('workout_complete', [
  [1, "That'th the fight, champ. Honethtly? You were fucking great.", P],
  [5, 'Done. {tss} TSS. Not bad for thomeone who opened like shit.', P],
])
b.add('ride_bailed', [[5, "Leaving at {elapsedMin} minuteth? Walking out mid-fight? That'th fucked up, champ. The crowd wanted a fight.", P]])
b.add('fueling_reminder', [[3, 'Eat thomething. Hungry fighterth fight like shit.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadenthe {cadence}. Good numberth. Boring ath shit, but good.', P],
  [4, 'Thith ride hath the energy of a fucking weigh-in. Lotth of thtanding around, no puncheth.', P],
  [5, "You call thith thuffering? I've had shittier nightth and thtill went twelve roundth.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! New town, new crowd! They came to thee a fight!'],
    [2, "{place}! Nithe plathe. I'd keep pigeonth here."],
    [3, '{place}. The localth came out to thee a fighter. They got a guy on a bike. Thorry, everybody.'],
    [4, '{place}! You rolled in like a guy on a three-fight lothing threak.'],
    [5, "{place}! {kmLeft} km to go and you're wobbling like a damn drunk at the weigh-in!", P],
    [5, "{place}. {kmLeft} km to go. The fight ain't over. Not even clothe."],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, 'Welcome to {place}! International fight, champ!'],
  [3, "{place}! They let you in. I hope they don't athk to thee your training log."],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'Top of {place}! Champion of the mountain!'],
  [3, 'You climbed {place}. Mountainth hit hard. You hit back.'],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, "Halfway! That'th the middle roundth. Thtay tight."],
  [3, 'Halfway through {journeyName}. The thecond half ith where the real fighterth thow up.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, "{place}! That'th the fight! {journeyName}, done!"],
  [3, "{place}. {kmDone} km. I'd talk trash, but you went the whole dithtanthe. Rethpect."],
], [eq('milestoneKind', 'finish')])

export const IRON_MIKE: PersonaPack = {
  meta: {
    id: 'iron-mike',
    name: 'Iron Mike',
    tagline: 'Baddest man on the planet, pigeon lover, ear-biter. Everybody hath a plan until the interval punches back.',
    voiceHint: { rate: 1.05, pitch: 1.3, preferVoices: ['Rocko', 'Reed', 'Junior', 'Fred', 'Alex'] },
  },
  lines: b.build(),
}
