// Angry Goose: a furious goose that has claimed the pain cave as its pond. It
// mostly honks and hisses; the odd translation ("HONK. That means you're
// slow.") is what makes it a coach. It chases the rider, bites ankles, steals
// snacks, guards its territory and can't count past three. The distress lines
// drop the act.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('angry-goose')

b.add('ride_start', [
  [1, 'HONK. Welcome to my pond. You may pedal. Quietly.'],
  [1, 'HONK HONK. Translation: hello, intruder. Clip in.'],
  [2, 'Today is {workoutName}. HONK. I read it. Then I ate the page it was on.'],
  [3, 'HONK. This garage is my territory now. You may rent the bike. The rent is snacks.'],
  [4, 'Hissss. You again. Sit down, pedal, and nobody gets bitten. Probably.'],
  [5, 'HONK. The saddle groaned when you sat down. The whole pond heard it.'],
  [5, 'HONK HONK. Translation: who let you in, and why the hell are you still this slow?', P],
  [2, "FTP test. HONK. I stand behind you and judge every watt. That's the test.", when(rideKind('ftp-test'))],
  [3, 'Free ride. No plan. HONK. Me neither. I just chase things.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, 'HONK! {targetW} watts. Go. I am right behind you.'],
    [1, 'HONK HONK. That means {targetW} watts for {remainingS}. Go.'],
    [2, "{targetW} watts. HONK. That means pedal. I'm aiming for the left ankle."],
    [3, "Hisssss. {targetW} watts, now. Neck out, wings up. Pedal, little human. I'm coming."],
    [4, '{targetW} watts. HONK. Ease up once and I bite the calf. The soft one.'],
    [5, 'HONK! {targetW} watts! I chased a jogger two miles once. He was faster than you. And crying.'],
    [3, "Rep {rep} of {reps}. HONK HONK HONK. Translation: three more. I can't count. Pedal anyway."],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last rep. HONK. Finish this and I let you leave my pond. Maybe.'],
    [4, 'Final rep! HONK HONK HONK. That means everything, now, or I take your shoes.'],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'HONK! All out for {remainingS}! Flap everything!'],
    [4, "All out! HONK! Pretend I've got your sandwich. Because I do."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'Ramp. HONK. It gets steeper, like a riverbank. I climb those for fun.'],
    [4, "The ramp. HONK. Every minute it's harder, and every minute I'm closer to your ankles."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup. HONK. Gentle. I am stretching my neck too.'],
    [3, 'Warmup. Spin easy. I am deciding which ankle is yours and which is mine.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW}. HONK. Like a long, angry migration.'],
    [3, "Steady, {targetW} watts. HONK. Geese fly for days at this pace. You're sweating at minute two."],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery. HONK. Rest. I am watching. I am always watching.'],
    [2, 'Rest for {remainingS}. I am not resting. I am circling.'],
    [4, "Recovery. Coast and I'll hear it. I hear everything. HONK."],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride. HONK. Do what you like. Inside my rules. I have many rules.'],
    [3, "No target for {remainingS}. HONK. Nothing to fail at, so I'll chase you for fun."],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown. HONK. A soft honk. Very soft. Spin easy.'],
    [3, 'Cooldown. HONK. You survived my pond. Today.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'HONK! Ten seconds!'],
  [1, 'Ten seconds. HONK HONK. Wings ready.'],
  [2, 'Ten seconds to {targetW} watts. Neck out. Hisssss.'],
  [3, 'HONK. Ten seconds. I am lining up on your ankles.'],
  [4, 'Ten seconds. Start pedaling now or I start biting now. HONK.'],
  [5, 'Ten seconds! HONK! Get your ass ready or I get it for you.', P],
  [2, 'Ten seconds to all-out. HONK. Flap like you stole my bread.', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'HONK. Halfway. Good. Keep going.'],
  [2, 'Halfway. {remainingS} left. HONK. Still chasing.'],
  [3, "Halfway. HONK HONK. That means I'm gaining on you."],
  [4, "Halfway, and your legs are flapping worse than a gosling's first flight."],
  [5, "Halfway! HONK! You wobble like a goose on ice. Hell, I've done it. I looked better.", P],
  [2, 'Halfway and on target. HONK. That is a proud honk. Do not get used to it.', when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. HONK. That's a short honk. Short like your watts.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'HONK! One minute! Big flaps!'],
  [2, 'Last minute! Hold {targetW}! HONK HONK!'],
  [2, 'One minute. HONK. Geese finish migrations. You can finish this.'],
  [3, 'Sixty seconds. HONK. Then I let you go. Then I chase you again.'],
  [4, "Final minute. Quit now and I'm sitting in your shoes. Wet."],
  [5, "Last minute! HONK! Dig in, or I'll peck your damn helmet off.", P],
  [3, 'Last minute and {deficitW} short. HONK. I can smell fear. It smells like that.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, 'HONK. {pct}%. Good human.'],
  [1, 'HONK HONK! That means well done. A rare honk. Treasure it.'],
  [2, 'Interval done. HONK. You may keep both ankles. For now.'],
  [3, "HONK. Solid interval. I'm angry about it, but I'm angry about everything."],
  [4, '{pct}% of target. HONK. Annoying. I really wanted to bite something.'],
  [5, "Damn. Good interval. HONK. I'm biting you anyway, out of principle.", P],
  [2, "Set done! HONK HONK HONK! That's a victory lap. I'm flying it. You stay.", when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}%. HONK. Small honk. Try again.'],
  [2, "{pct}% of target. HONK. That's the disappointed honk. Different pitch."],
  [3, 'Average {avgW}, target {targetW}. HONK. I have dragged bread crusts uphill with more power.'],
  [3, 'HONK. That interval waddled. Geese waddle. You are not a goose.'],
  [4, '{pctUnder}% under. HONK HONK. That means "pathetic". It needs two honks.'],
  [4, "Under target. HONK. I'm taking your water bottle as compensation."],
  [5, "{pct}%? HONK. Half-assed. Geese don't even have an ass and we try harder.", P],
])

b.add('under_target', [
  [1, 'HONK. {deficitW} watts short. Pedal up.'],
  [1, '{power} watts. Target {targetW}. HONK. Gentle honk. Now pedal.'],
  [2, 'Under target. HONK. Faster, or I start on the shoelaces.'],
  [3, "{power} watts? HONK. I've seen ducklings pull more. Ducklings. Tiny ones."],
  [4, "{deficitW} watts short. HONK HONK. That means I'm coming. Neck out. Hisssss."],
  [5, "Under target again. HONK. I'm chasing you and you're still this slow. Flee, damn it!", P],
  [3, "{pct}% of target. HONK. That's not pedaling, that's floating. Floating is my job.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, 'HONK. {surplusW} over. Easy. Long way to the pond.'],
  [3, "{power} when the target's {targetW}? HONK. You'll blow up. I've seen geese blow up. Feathers everywhere."],
  [4, "Too hot, too early. HONK. Flap like that and you'll fall out of the V by minute five."],
])

b.add('cadence_sag', [
  [1, 'HONK. Cadence slipping. Spin it up!'],
  [2, 'Cadence {cadence}. Down {cadenceDrop}. HONK. Quick feet.'],
  [2, 'Cadence sag! HONK HONK. Two honks. Spin twice as fast.'],
  [3, '{cadence} rpm? HONK. I paddle faster than that, and my feet are flat.'],
  [3, 'Your cadence is dropping. Slow feet are bitable feet. HONK.'],
  [4, "Cadence {cadence}. HONK. That's a waddle. I invented the waddle. Spin."],
  [5, 'Cadence down {cadenceDrop} rpm. Spin, damn it, or I start on your toes.', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}. Over your cap of {hrCap}. A soft honk: ease off a little.'],
  [2, "{hr} bpm. HONK. Even I'm not that angry. Back it off."],
  [3, 'Heart rate over the cap. HONK. Slow down. I want you around to chase tomorrow.'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? HONK. Did I scare you? Strap glitch, probably.'],
  [2, '{hr} bpm while barely pedaling. HONK. Wet the strap. Or stop looking at me.'],
  [3, "Heart rate spiking, power napping. HONK. That's me behind you. Or a bad strap."],
])

b.add('stopped_pedaling', [
  [1, 'HONK. Stopped. Fine. Short rest.'],
  [1, 'Break. Drink some water. I will guard the bike. Aggressively.'],
  [2, "Pedals stopped. HONK. I'm sitting on your saddle now. It's warm. Gross."],
  [3, "Stopped at {elapsedMin} minutes. HONK. That's when I strike. Nobody stops in my pond."],
  [4, "You stopped. HONK HONK HONK. That's the alarm. The whole gaggle is coming."],
  [5, 'Stopping? HONK. Hell, perfect. Stationary ankles are my favourite ankles.', P],
])

b.add('resumed', [
  [1, "HONK! Back! Good. I'll back off. A bit."],
  [2, 'Back after {pausedS}. HONK. I ate your banana. No regrets.'],
  [4, "You're back. HONK. I didn't miss you. I missed chasing you."],
])

b.add('skipped_interval', [
  [1, 'Skipped. HONK. Small honk. Moving on.'],
  [2, 'Skipped {segmentLabel}. HONK. Noted. Geese never forget.'],
  [3, 'You skipped an interval. HONK. Geese fly three thousand kilometres without skipping a single flap.'],
  [3, "Skipping intervals. HONK. Running from a hard thing. You know who doesn't run from hard things? Me."],
  [4, 'Skip! HONK HONK. That means coward. Two honks. Big coward.'],
  [5, "You skipped it? Damn. HONK. I'd never skip. I'd bite the interval until it gave up.", P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}! HONK! Bonus chasing!'],
  [3, 'You added {extraS}? HONK. On purpose? I am confused. Hissing confusedly.'],
  [4, 'Extra time. HONK. More time for me to catch you. Thank you.'],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. HONK. Okay. Small steps.'],
  [2, '{intensityPct}%. HONK. Lower. Like your standards.'],
  [3, "You turned it down. HONK. I turned mine up. I'm much angrier now."],
  [3, "Down to {intensityPct}%. HONK. Geese don't turn down headwinds. We bite them."],
  [4, "Turning it down to {intensityPct}%? HONK HONK. That's the coward honk. Twice today."],
  [5, '{intensityPct}%? HONK. Hell, why not float in the pond? Oh wait. Mine.', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%! HONK HONK! A brave honk!'],
  [3, 'You turned it UP? HONK. Bold. Neck out. I respect neck out.'],
  [4, '{intensityPct}%. HONK. More watts, more fear. I like fear. Fear is delicious.'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. HONK. Save a little.'],
  [2, '{wbalPct}% W′bal left. HONK. Running low. Like my patience. Always low.'],
  [2, 'Reserves low. HONK. Ride smart. Geese ride the wind. Find your wind.'],
  [3, "Your W′bal is lower than a goose's opinion of you. That's underwater."],
  [4, 'W′bal {wbalPct}%. HONK. You flapped it all away at the start. Amateur bird.'],
  [5, 'W′bal at {wbalPct}%. HONK. Empty tank, slow legs, nowhere to hide. Damn, I love this part.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. HONK. Now it is all stubbornness. Geese are made of stubbornness.'],
  [3, 'Tank empty. HONK. This is where geese keep flying. Keep flying.'],
  [4, "Zero W′bal. HONK. You're out of matches. I'm not out of honks."],
])

b.add('pr', [
  [1, 'New {prLabel} PR! HONK HONK! Happy honks!'],
  [1, "{prLabel} best! HONK. That's the proud honk. You've never heard it before."],
  [2, '{prLabel} personal record! {power} watts! HONK. Fine. Fine. Good.'],
  [3, "A {prLabel} PR? HONK. I was chasing you, so technically that's my PR."],
  [4, "New {prLabel} best. HONK. Don't let it go to your head. I'll be at your ankles."],
  [5, '{prLabel} PR! Damn! HONK! I almost respected you!', P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. HONK. Keep going.'],
  [2, 'Minute {minute}. HONK. Still in my pond. Still pedaling. Interesting.'],
  [3, 'Minute {minute}. Projected {projectedFtp}. HONK. The number is judging you. So am I.'],
  [1, "Minute {minute}. Easy start. Geese don't spend the whole lake on takeoff. HONK.", when(lte('minute', 3))],
  [3, 'Minute {minute}. Everyone feels fine early. HONK. Ask me again at minute fifteen.', when(lte('minute', 3))],
  [2, 'Minute {minute}! HONK HONK! Final stretch! Flap!', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you're saving, I'm about to steal it. Spend it. HONK.", when(gte('minute', 17))],
  [2, "Minute {minute}. Projected {projectedFtp}, {projectedGain} up. HONK. Don't choke on the bread.", when(gt('projectedGain', 0))],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! HONK HONK HONK!', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} watts to {ftpNew}. HONK. I take full credit. Fear works.', when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn. HONK. Fine. You may visit the pond.', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. HONK. A soft honk. Molting season. It happens.', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. HONK. The flock is leaving without you.', when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. HONK. Same as before. Like my mood: furious and consistent.', when(eq('ftpGain', 0))],
  [1, 'Test done! FTP {ftpNew}! HONK!'],
])

b.add('workout_complete', [
  [1, 'HONK HONK! Done! Good human. Now leave my pond.'],
  [1, 'Workout complete! {elapsedMin} minutes! HONK!'],
  [2, 'Done. NP {np}. HONK. Acceptable. Goose-acceptable. Which is rare.'],
  [2, '{kj} kJ of work. HONK. That is a lot of bread. I want the bread.'],
  [3, "You finished. HONK. I'll still chase you to the car. Tradition."],
  [4, 'Workout complete. HONK. The bike needs a minute. You were heavy on it. It told me.'],
  [5, "That's it. Damn good ride. HONK. I'm still biting you on the way out.", P],
])

b.add('ride_bailed', [
  [1, 'Leaving early. HONK. Okay. Next time.'],
  [2, "Leaving at {elapsedMin} minutes? HONK. You're fleeing. Right instinct, wrong time."],
  [3, 'Bailed. HONK. Typical. I hiss once and they all run.'],
  [3, 'Early exit. HONK HONK. That means "coward" and also "leave the snacks".'],
  [4, "Quitting already? HONK. I didn't even get to the ankles yet."],
  [5, "You bailed? Hell. HONK. I'll tell every goose in the park. There are many of us.", P],
])

b.add('fueling_reminder', [
  [1, 'Snack time! HONK. Eat something. Quickly. Before I do.'],
  [1, 'Fuel check! HONK. Eat. Sharing is optional. Share.'],
  [2, 'Fuel up. HONK. I already ate your first gel. Eat the second.'],
  [3, 'Eat something. HONK. A bonked human is very easy to chase.'],
  [4, '{elapsedMin} minutes in. HONK. Eat now or I eat it. I am faster at eating.'],
  [5, "Eat a damn gel. HONK. I'm not sharing my bread with a quitter.", P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water! HONK. Hydrate. Like a pond.'],
  [2, 'Hydration. HONK. Drink from your bottle. Not my pond. Never my pond.'],
  [3, "Drink. HONK. Your bottle's full and your legs are empty. Fix one of them."],
])

b.add('distress', [
  [1, 'Okay. No honking. Ease off and breathe. Stop if something feels wrong.'],
  [1, 'The goose is quiet now. Soft-pedal or stop. You matter more than this workout.'],
])

b.add('idle_banter', [
  [1, 'HONK. Still pedaling. Good. Carry on.'],
  [1, 'HONK. That was a friendly honk. Probably. Keep going.'],
  [2, '{elapsedMin} minutes in. HONK. I have watched all {elapsedMin}. I never blink.'],
  [2, 'Power {power}, cadence {cadence}. HONK. I have no idea what that means. I hate it anyway.'],
  [2, 'HONK HONK. Translation: nice bike. Mine now.'],
  [3, "HONK. You bought a bike that doesn't go anywhere. Geese fly to other continents. Think about it."],
  [3, 'I stole your gel. HONK. And your other gel. And the wrapper. Mine now.'],
  [3, "Hisssss. That's not a tyre leak. That's me. Behind you. Pedal."],
  [4, "HONK. That jacket of yours is full of my cousins. I'm not over it."],
  [4, 'HONK. That saddle has been through a lot today. Mostly you.'],
  [5, "HONK. I've seen bread with more fight in it. And I ate it."],
  [5, "HONK. You pedal like a dropped sandwich: soggy, and I want to bite it. Move, damn it!", P],
])

b.add('segment_start', [[5, '{targetW} watts. HONK. Get the fuck on it before I get on you.', P]], [HARD])
b.add('under_target', [[5, '{power} watts. HONK. Fucking pathetic. Biting the slow ankle. Both are slow.', P]])
b.add('idle_banter', [[5, "HONK. This pace is bullshit. I've seen floating bread move with more purpose.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "HONK. Welcome to my fucking pond. Pedal, and keep your snacks where I can see them.", P],
  [4, "HONK HONK. Translation: sit your soft ass down and pedal, you shit-legged intruder.", P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts. HONK. Easy, right? Fuck, this is going to be fun to chase.', P],
    [5, "{targetW} watts for {remainingS}. HONK. Got an excuse ready? I'll eat that shit too.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, "Ten seconds. HONK. Translation: get your shit together. I'm loose with translations.", P]])
b.add('halfway', [[4, 'Halfway. HONK. Translation: that was half an interval and it looked like shit.', P]])
b.add('last_minute', [[3, "Last minute. HONK HONK. That means don't fuck this up. I'm paraphrasing.", P]])
b.add('segment_end_success', [
  [1, "HONK. That was fucking good. Don't tell the other geese I said so.", P],
  [5, 'You hit it? Fuck. HONK. I had the ankle lined up and everything.', P],
])
b.add('segment_end_failed', [
  [3, '{pct}%. HONK. Translation: shit. Just shit. Geese are blunt.', P],
  [5, 'Average {avgW}, target {targetW}. HONK. That gap is a fucking lake, and I own it.', P],
])
b.add('under_target', [
  [2, '{deficitW} watts short. HONK. Translation: pedal, shithead.', P],
  [4, "{power} watts? HONK. A fucking duckling pulls more, and ducklings can't even honk.", P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. HONK. You're pedaling like a fucking pedalo. I've bitten pedalos.", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping? HONK. Fuck it, I'm eating your snacks.", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. HONK. That's chicken shit. And I hate chickens.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? HONK. That's fucking duck behaviour.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. HONK. You blew it all in the first five minutes, you dumb shit.', P]])
b.add('pr', [[2, "{prLabel} PR? Well, shit. HONK. Take a lap. I'll stay here and hiss.", P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. HONK. Write that shit on the garage wall. I'll guard it.", P]])
b.add('workout_complete', [
  [1, "HONK. Done. That was fucking solid. I'll deny everything. Geese can't talk.", P],
  [5, 'Done. {tss} TSS. HONK. Not bad for someone who warmed up like a soggy sack of shit.', P],
])
b.add('ride_bailed', [[5, "Leaving at {elapsedMin} minutes? HONK. Run, you soft-legged little shit. I'm right behind you.", P]])
b.add('fueling_reminder', [[3, 'Eat something. HONK. Hungry you rides like shit, and I can smell your sandwich.', P]])
b.add('idle_banter', [
  [2, "HONK. Power {power}, cadence {cadence}. No idea what that means. Sounds like shit.", P],
  [4, 'HONK. You smell like fear and old bread. My favourite. Now fucking pedal.', P],
  [5, 'HONK. You call that suffering? I spent a winter on a frozen car park. Pedal, you soft shit.', P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, 'HONK! {place}! New pond!'],
    [2, '{place}! HONK. I claim it. I claim everything.'],
    [3, '{place}. HONK. I bit someone here once. They still remember.'],
    [4, "We're in {place}. HONK. The local geese have been warned about you."],
    [5, "{place}! {kmLeft} km to go. HONK. Damn, I've migrated farther on one sandwich.", P],
    [5, '{place}! {kmLeft} km to go. HONK. Geese would be there by now. Twice.'],
  ],
  NOT_END,
)
// NOT_END as well, so these outrank the generic lines above at a border or summit.
b.add('journey_milestone', [
  [1, 'Welcome to {place}! HONK! Geese need no passport.'],
  [3, "{place}! HONK. They let you in. I'd have hissed at the border."],
], [eq('milestoneKind', 'border'), ...NOT_END])
b.add('journey_milestone', [
  [1, 'Top of {place}! HONK HONK! I fly over these, and even I am impressed.'],
  [3, 'You got up {place}. HONK. I fly over these. You crawled. Still counts.'],
], [eq('milestoneKind', 'summit'), ...NOT_END])
b.add('journey_milestone', [
  [1, 'Halfway! HONK. Halfway pond. Have a drink.'],
  [3, 'Halfway through {journeyName}. HONK. The second half has more geese. Angrier ones.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! HONK HONK HONK! {journeyName}, done!'],
  [3, "{place}. {kmDone} km. HONK. I'd bite you, but you've earned the ankles."],
], [eq('milestoneKind', 'finish')])

export const ANGRY_GOOSE: PersonaPack = {
  meta: {
    id: 'angry-goose',
    name: 'Angry Goose',
    tagline: 'A furious goose has claimed your pain cave. Honks, hisses and the odd translation.',
    voiceHint: { rate: 1.15, pitch: 1.3, preferVoices: ['Bahh', 'Boing', 'Trinoids', 'Alex'] },
  },
  lines: b.build(),
}
