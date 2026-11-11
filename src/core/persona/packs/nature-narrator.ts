// The Nature Narrator: a hushed wildlife-documentary voice that watches the
// rider as an animal in its natural habitat, the garage. The rider is the weak
// straggler of the herd, the next interval is the predator in the long grass,
// posted watts are a mating display, journeys are migrations, the bottle is the
// watering hole, and nature is cruel: the slow ones get eaten. Original lines in
// a generic documentary style; it imitates no real narrator or programme.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('nature-narrator')

b.add('ride_start', [
  [1, 'Here, in the half-light of the garage, a lone rider stirs. Let us watch quietly.'],
  [1, 'Dawn in the pain cave. The rider emerges, blinking, and mounts its machine.'],
  [2, 'Today the rider attempts {workoutName}. Few of its kind survive it with dignity.'],
  [3, 'The rider clips in. A creature built for the sofa, now pretending to be built for speed.'],
  [4, 'Observe the rider. Soft, slow, and far from the herd. Out on the plains, this one is lunch.'],
  [5, 'Behold the rider: the weakest member of a herd of one. Somehow, it is still falling behind.'],
  [5, "The rider prepares to ride. Biologists call this ritual 'a hell of a lot of fuss for nothing'.", P],
  [2, 'Testing season. The rider must prove its strength, or lose its place in the herd. Such as it is.', when(rideKind('ftp-test'))],
  [3, 'No plan today. The rider wanders the plains aimlessly, as its ancestors did. They also got eaten.', when(rideKind('free'))],
  [3, 'A long migration lies ahead. Most of the herd will make it. We are not filming most of the herd.', when(rideKind('route'))],
])

b.add(
  'segment_start',
  [
    [1, 'And now, the hunt begins. {targetW} watts. Stay low. Stay steady.'],
    [1, '{targetW} watts for {remainingS}. The rider gathers itself. Remarkable.'],
    [2, 'The interval approaches like a predator through the long grass. {targetW} watts. Move.'],
    [3, "{targetW} watts. In the wild, the rider would already be somebody's breakfast."],
    [4, "{targetW} watts. The rider's legs tremble, as a gazelle's do, moments before the lion arrives."],
    [5, '{targetW} watts. Natural selection is watching, and frankly, it made up its mind some time ago.'],
    [5, '{targetW} watts. Run, you magnificent, soft-bellied creature. Run like hell.', P],
    [3, 'Rep {rep} of {reps}. The herd thins with every one. Stay in the middle, where it is safe.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [1, 'The final rep. The watering hole is in sight. Keep moving.'],
    [2, 'Last rep. The predators know it too. This is when they strike the tired ones.'],
    [4, 'Final rep. The pack has noticed the limp. Do not show them the limp.'],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! The rider bolts, as prey does when the grass rustles.'],
    [4, 'Maximum effort. Somewhere, a cheetah watches this top speed and quietly laughs.'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. The ground rises, the air thins, and the weak begin to fall away.'],
    [4, "The ramp. Like a slow flood, it will find the rider's limits. It will not need long."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'The warmup. The rider stretches its stiff limbs after a long hibernation.'],
    [3, 'The warmup. The rider moves with the urgency of a sloth that has just eaten.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'A steady {targetW} watts. The long, patient grazing of the endurance animal.'],
    [3, 'Steady at {targetW}. The rider plods, as the slowest beast in the herd always plods. At the back.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery. The rider retreats to the shade to lick its wounds.'],
    [2, 'Rest for {remainingS}. The predator has eaten someone else. For now.'],
    [4, 'Recovery. The rider gasps like a fish on a riverbank. A small, sweaty, expensive fish.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'No target for {remainingS}. The rider roams freely across its tiny territory.'],
    [3, 'No target. Left to its instincts, the rider takes the path of least resistance. As always.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'The cooldown. As the sun sets on the garage, the rider slows, and rests.'],
    [3, 'Cooldown. The rider survived, which in this ecosystem counts as thriving.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds. The grass begins to rustle.'],
  [1, 'Ten seconds. Ears forward. Something is coming.'],
  [2, 'Ten seconds to {targetW} watts. Somewhere out there, it is crouching.'],
  [3, 'Ten seconds. The herd tenses. One of them will not keep up. We all know which one.'],
  [4, 'Ten seconds. The predator has chosen its target. It is the one breathing like that.'],
  [5, 'Ten seconds. A smart animal would run. This one is not smart. Run anyway, damn it.', P],
  [2, "Ten seconds to all-out. Fight or flight. Pick flight. It's faster.", when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'Halfway. The rider endures. Truly, nature is remarkable.'],
  [2, 'Halfway, with {remainingS} to go. The rider clings on, as a limpet clings to its rock.'],
  [3, 'Halfway. Here the weaker animals start looking for a way out. Stop looking for a way out.'],
  [4, "Halfway. The rider's breathing has reached the frequency of a startled walrus."],
  [5, "Halfway. Vultures have begun to circle the garage. Hell, I'd circle too.", P],
  [2, 'Halfway and right on target. It moves like a creature that has read the instructions.', when(gte('pct', 98))],
  [3, 'Halfway, {deficitW} watts short. The herd moves on. The rider has not noticed it is alone.', when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left. The far bank is in sight. Keep swimming.'],
  [2, 'The final minute. Hold {targetW}. The crocodiles prefer the ones who slow down.'],
  [2, 'One minute. Every creature has one last burst in it. This is the moment.'],
  [3, 'Sixty seconds. Even the longest migration ends. Usually with fewer animals.'],
  [4, 'Last minute. The jackals are not chasing the fast ones. Think about that.'],
  [5, 'Last minute. The lion has picked you. Pedal like hell, you delicious idiot.', P],
  [3, 'Last minute, {deficitW} watts short. The wounded animal limps on. The predators take notes.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, '{pct}% of target. Survival. In this ecosystem, there is no higher honour.'],
  [1, 'The interval ends, and the rider lives. A rare and beautiful moment.'],
  [2, 'A clean interval. The film crew exchange glances. We had not prepared for this.'],
  [3, 'It hit the target. Scientists will be asked to explain. They will not be able to.'],
  [4, '{pct}%. Extraordinary. Like a penguin that has learned to fly. Briefly. Badly. But still.'],
  [5, "Damn. It actually survived. We'd already started filming the scavengers.", P],
  [2, 'The set is done. Another season survived. Nature does not grade on style.', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}% of target. Not every hunt succeeds. Most, in fact, do not.'],
  [2, '{pct}%. The prey escaped. The prey, in this case, was the target.'],
  [3, 'Average {avgW}, target {targetW}. The gap between them could hold a small herd of antelope.'],
  [3, 'That interval was like watching a tortoise attempt a sprint, and then reconsider.'],
  [4, '{pctUnder}% under. In the wild, this rider would have been eaten twice by now.'],
  [4, 'Under target. The rider, like many soft creatures, has mistaken survival for success.'],
  [5, '{pct}%. A half-assed hunt. On the plains, the hyenas would already be arguing over you.', P],
])

b.add('under_target', [
  [1, '{deficitW} watts short. The herd is drifting ahead. Close the gap.'],
  [1, '{power} watts. The target is {targetW}. The rider has noticed nothing.'],
  [2, 'Under target. The rider has adopted the energy-saving strategy of the common houseplant.'],
  [3, '{power} watts. A hibernating bear gives off more heat than this, and it is asleep.'],
  [4, '{deficitW} watts short. This is how the slow ones get eaten. Quietly, at the back, still pedaling.'],
  [5, 'Under target again. Out here, this animal is a snack. A damn shareable snack.', P],
  [3, '{pct}% of target. The rider plays dead, as the opossum does. It is not convincing.', when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, 'Whoa. {surplusW} watts over, so early. The young ones always bolt too soon.'],
  [3, '{power} when the target is {targetW}? A classic display of youthful overconfidence. It rarely ends well.'],
  [4, 'Too hot, too early. Like a young stag picking a fight it cannot finish. The herd has seen this before.'],
])

b.add('cadence_sag', [
  [1, 'The cadence is slipping. Quick, light steps, like a deer.'],
  [2, "Cadence {cadence}, down {cadenceDrop}. The rider's legs have slowed to a lumbering trot."],
  [2, 'Cadence sag. A lighter gear. Small, quick steps, like a nervous little bird.'],
  [3, '{cadence} rpm. The majestic tortoise, in its natural element.'],
  [3, 'The cadence drops. Like a great beast wading into the mud, the rider is slowly sinking.'],
  [4, 'Cadence {cadence}. Even the three-toed sloth is watching this and thinking: pick it up.'],
  [5, 'Cadence down {cadenceDrop} rpm. The rider is pedaling through treacle. Spin, damn it.', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}, above the cap of {hrCap}. Even the hunter rests. Ease off.'],
  [2, "{hr} bpm. The heart flutters like a hummingbird's. Back it off a little."],
  [3, 'Heart rate over the cap. Even predators pace themselves. Dial it back.'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? Either the strap is glitching, or the rider has seen a spider.'],
  [2, "{hr} bpm while barely moving. A sensor glitch, perhaps. Or it has heard the word 'intervals'."],
  [3, 'A heart-rate spike, with no exertion to explain it. A strap glitch, most likely. Moisten the strap.'],
])

b.add('stopped_pedaling', [
  [1, 'The rider has stopped to rest. Let it graze for a moment.'],
  [1, 'The rider pauses at the watering hole. Drink. Breathe.'],
  [2, 'Stillness. The rider freezes, hoping the workout cannot see it if it does not move.'],
  [3, 'Stopped at {elapsedMin} minutes. The rider plays dead. The workout is not fooled.'],
  [4, 'It has stopped. The flywheel spins on alone, the last loyal member of a very small herd.'],
  [5, 'The rider has stopped. Out here, a stopped animal is an eaten animal. Hell of a time for a nap.', P],
])

b.add('resumed', [
  [1, 'And the rider stirs again. The migration continues.'],
  [2, 'Back after {pausedS}. A long time to spend at the watering hole.'],
  [4, 'It moves again. The scavengers, who had already gathered, are visibly disappointed.'],
])

b.add('skipped_interval', [
  [1, 'The rider skips the interval. Sometimes the herd takes the long way around.'],
  [2, 'Skipped {segmentLabel}. The rider avoids the river crossing. The crocodiles are deeply offended.'],
  [3, 'Skipping intervals. The rider has learned that the safest hunt is the one you never go on.'],
  [3, 'It skipped one. Natural selection has noted this. In pen.'],
  [4, 'A skip. A survival instinct, in a sense. A sad, soft survival instinct.'],
  [5, 'It skipped the damn interval. Evolution spent four billion years on those legs, for this.', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}. The rider ventures further than usual. Extraordinary.'],
  [3, 'It added {extraS}. Voluntarily. Our crew has never documented this behaviour before.'],
  [4, 'Extra time. A rare display of dominance. Or a misclick. Science cannot yet tell.'],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. The rider conserves its energy, as wise animals do.'],
  [2, '{intensityPct}%. The rider has chosen smaller prey. A beetle, perhaps.'],
  [3, 'Intensity down. In the ancient struggle between rider and spreadsheet, the spreadsheet wins again.'],
  [3, 'Down to {intensityPct}%. The herd moves on at full pace. The rider waves it goodbye.'],
  [4, '{intensityPct}%? The rider has retreated to its burrow, where nothing difficult can reach it.'],
  [5, '{intensityPct}%. Hell, why not roll onto your back like a sunbathing seal.', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%. A bold display. The herd takes notice.'],
  [3, 'It turned the intensity up. The creature is showing off. Let us see if the legs agree.'],
  [4, '{intensityPct}%. Brave. The bravest animals make the best documentaries. Short ones.'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. The reserves run low. Ride wisely.'],
  [2, '{wbalPct}% W′bal left. Like a camel at the end of a long crossing, the rider has little left.'],
  [2, 'Reserves low. The clever animal paces itself. Be the clever animal, for once.'],
  [3, 'W′bal {wbalPct}%. It burned through its stores like a bear that forgot winter was coming.'],
  [4, 'W′bal {wbalPct}%. All those reserves stored around the middle, and it runs out of the useful kind.'],
  [5, 'W′bal at {wbalPct}%. It spent everything in the first act, like a damn mayfly.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. The rider runs on instinct alone now.'],
  [3, 'The tank is empty. This is the part of the film where the music turns sad.'],
  [4, 'Zero W′bal. Nothing left but stubbornness, and a body that stored its energy in all the wrong places.'],
])

b.add('pr', [
  [1, 'A new {prLabel} record. Remarkable. The rider has evolved.'],
  [1, "A {prLabel} personal best. A rare and beautiful sight. Hold still, we're filming."],
  [2, '{prLabel} record at {power} watts. The herd looks on in quiet astonishment.'],
  [3, 'A {prLabel} PR. The slowest of the herd has, for one moment, not been the slowest.'],
  [4, 'New {prLabel} best. A once-in-a-generation sighting, like a snow leopard. But damp, and wheezing.'],
  [5, '{prLabel} PR. Damn. The predators have called off the hunt out of respect.', P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. The rider settles into its rhythm.'],
  [2, 'Minute {minute}. Still moving. The herd is quietly impressed.'],
  [3, 'Minute {minute}. Projected {projectedFtp}. The rider is being measured, as all animals eventually are.'],
  [1, 'Minute {minute}. Easy now. The long migration begins with a gentle walk.', when(lte('minute', 3))],
  [3, 'Minute {minute}. Every animal looks strong at the start. We will see who is still upright at minute fifteen.', when(lte('minute', 3))],
  [2, 'Minute {minute}. The final stretch. The water is in sight. Push for it.', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever reserves you've been hiding in there, the drought is here.", when(gte('minute', 17))],
  [
    2,
    'Minute {minute}. Projected {projectedFtp}, {projectedGain} up. The rider may yet rise in the herd.',
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'A new FTP: {ftpNew}, up {ftpGain}. The rider has grown stronger. Nature is, occasionally, kind.', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} to {ftpNew}. The rider climbs the food chain by one rung. There are many rungs.', when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn. Somewhere, a lion has quietly crossed you off its menu.', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Every animal has its lean seasons.', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. The rider slides down the food chain, toward the snacks.', when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. The rider holds its place in the herd. Not a good place, but its own.', when(eq('ftpGain', 0))],
  [1, 'Test complete. FTP {ftpNew}. The measurement is recorded, for science.'],
])

b.add('workout_complete', [
  [1, "And so the rider's journey ends. It has survived another day in the wild."],
  [1, 'Workout complete. {elapsedMin} minutes. The rider rests, and the garage falls silent.'],
  [2, 'Done. NP {np}. A respectable showing. For this species.'],
  [2, '{kj} kJ of work. Enough to keep a small burrow warm for a week.'],
  [3, "It finished. Against the odds, and most of our crew's predictions."],
  [4, 'Complete. The rider retreats to the sofa, where it will spend six to eight hours digesting.'],
  [5, "That's a wrap. A damn good one. We'll cut the wheezing out in the edit.", P],
])

b.add('ride_bailed', [
  [1, 'The rider leaves early. Sometimes the herd must rest.'],
  [2, 'Leaving at {elapsedMin} minutes. The migration continues without it.'],
  [3, 'It has abandoned the hunt. Back to the burrow, where the snacks are.'],
  [3, 'An early exit. We shall tell the viewers the weather turned.'],
  [4, 'It bailed. In nature, this is when the slow one gets eaten. Here, it just gets a cookie.'],
  [5, 'Bailed at {elapsedMin} minutes. Hell, even the dung beetle finishes what it starts.', P],
])

b.add('fueling_reminder', [
  [1, 'Feeding time. The rider must eat to survive the hunt.'],
  [1, 'Fuel check. Even the hardiest animal needs to graze.'],
  [2, 'Eat something. The wise animal feeds before it is hungry.'],
  [3, 'Feeding time. Not the kind the rider prefers, on the sofa at midnight. Something small.'],
  [4, '{elapsedMin} minutes in. Eat now, or bonk, and be left behind by the herd. Again.'],
  [5, "Feed, damn it. Judging by the silhouette, finding food has never been this creature's problem.", P],
])

b.add('hydration_reminder', [
  [1, 'Drink. The watering hole is right there, in the bottle cage.'],
  [2, 'Hydration. Even the camel drinks eventually. And the rider is no camel.'],
  [3, 'Drink something. The rider is losing water at a rate usually reserved for melting glaciers.'],
])

b.add('distress', [
  [1, "We'll stop filming for a moment. Ease off and breathe. Stop if something feels wrong."],
  [1, 'Forget the herd. Soft-pedal or stop, and look after yourself. You matter more than the workout.'],
])

b.add('idle_banter', [
  [1, 'The rider pedals on, steady and determined. Truly, a marvel of the garage.'],
  [1, 'Keep going. The film crew is rooting for you. Quietly.'],
  [2, 'Here we see the rider in its natural habitat: a dim garage, a fan, and a pile of laundry.'],
  [2, '{elapsedMin} minutes in and still moving. For this species, that is a record of some kind.'],
  [2, 'Power {power}, cadence {cadence}. A steady rhythm, like the slow drumming of a contented beetle.'],
  [3, "The rider's plumage: a faded jersey, worn with the confidence of a much faster animal."],
  [3, 'Notice the sweat pooling beneath the bike. The rider is marking its territory.'],
  [3, 'The mating display: the rider posts its watts online. The response from potential mates: silence.'],
  [4, 'The rider owns a bike worth more than its car. A mating display. It has not worked.'],
  [4, 'Carbon wheels, aero helmet, indoors. The peacock fans its feathers for an empty room.'],
  [4, 'Watch the belly ripple in the breeze of the fan. Majestic. Like a jelly in a light wind.'],
  [5, 'In the wild, the herd protects its weakest member. This rider has no herd. Now we see why.'],
  [5, "Look at it go. Biologists call this pace 'grazing'. I call it bloody pathetic.", P],
])

// Unhinged: strong profanity, only for riders who asked for it. Still whispered.
b.add('ride_start', [
  [1, "Shh. The rider awakens. Let's watch this beautiful fucking creature at work.", P],
  [4, 'The rider clips in. What follows is an hour of rare, unfiltered, shit pedaling. Stay very quiet.', P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts. The predator is coming. Move your ass. Move your whole fucking ass.', P],
    [5, '{targetW} watts for {remainingS}. The lion has seen you, and frankly, you are not worth the fucking effort.', P],
    [5, "{targetW} watts. Shh. Don't startle it. It is about to do absolutely fuck all for {remainingS}.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds. Something in the grass is about to fuck you up. It is {targetW} watts.', P]])
b.add('halfway', [[4, 'Halfway. The rider moves like a wounded fucking manatee. Fascinating.', P]])
b.add('last_minute', [[3, 'Last minute. The zebra either makes it across or gets fucking eaten. Choose.', P]])
b.add('segment_end_success', [
  [1, 'It made it. Look at that. A beautiful fucking animal, in its prime.', P],
  [5, "It hit the target. Shit. We'd already sold the footage of it failing.", P],
])
b.add('segment_end_failed', [
  [3, '{pct}%. The hunt failed. The rider returns empty-handed, like a shit lion.', P],
  [5, 'Average {avgW}, target {targetW}. Even a fucking slug would be embarrassed by that gap.', P],
])
b.add('under_target', [
  [2, '{deficitW} watts short. A shit display, by the standards of any species.', P],
  [4, '{power} watts. A sleeping fucking hedgehog gives off more heat.', P],
  [5, '{power} watts. Fucking pitiful. The moss on this garage wall grows with more purpose.', P],
])
b.add('cadence_sag', [[3, 'Cadence {cadence}. Like watching a fucking glacier, except the glacier has somewhere to be.', P]])
b.add('stopped_pedaling', [[4, "It has stopped. It's just sitting there, breathing, doing absolutely fuck all. Fascinating.", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. Crafty little shit. It thinks we didn't see.", P]])
b.add('intensity_down', [[4, '{intensityPct}%. Back to the burrow, where it is warm, and safe, and fucking useless.', P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. It ate its whole fucking winter store in August, like a dim squirrel.', P]])
b.add('pr', [[2, 'A {prLabel} PR. Well, shit. The weakling of the herd just bit back.', P]])
b.add('ftp_test_result', [[4, 'FTP {ftpNew}. The rider will now tell every fucking creature it meets.', P]])
b.add('workout_complete', [
  [1, 'And the rider rests. Honestly? That was a fucking magnificent display.', P],
  [5, '{tss} TSS. It began like a newborn foal on ice, and ended like a slightly older one. Shit, but progress.', P],
])
b.add('ride_bailed', [[5, 'Bailed at {elapsedMin} minutes. The herd does not wait for that kind of fucking weakness. Neither do I.', P]])
b.add('fueling_reminder', [[3, "Feeding time. Eat, or it turns into a hangry little shit. We've filmed that. It's not pretty.", P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Remarkable consistency. Shit television, but remarkable.', P],
  [4, 'Here, the rider performs its mating display: posting its watts online. Nobody gives a fuck.', P],
  [5, 'Look at it. Slow, soft and sweating. On the plains, the lions would call this a fucking buffet.', P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, 'The migration reaches {place}. The rider presses on.'],
    [2, '{place}. The herd pauses to graze. The rider, as ever, grazes the most.'],
    [3, '{place}. The locals watch the rider pass, the way locals watch a lost sheep.'],
    [4, 'We reach {place}. Few creatures this slow have ever made it this far. Few have tried.'],
    [5, '{place}. {kmLeft} km of migration left, and it moves like a damn sedated hippo.', P],
    [5, '{place}. {kmLeft} km to go. The slow ones get eaten long before the end. Keep moving.'],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, '{place}. The rider crosses into new territory. New land, same legs.'],
  [3, '{place}. The border let it in. Invasive species usually get more scrutiny.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'The summit of {place}. The rider stands where only mountain goats dare. Wheezing.'],
  [3, 'The top of {place}. The eagles circle. Not out of respect. Out of hope.'],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway. The great migration is half done. Rest a moment, then onward.'],
  [3, 'Halfway through {journeyName}. Most of the herd made it this far. Most of the herd is faster.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}. The migration is complete. {journeyName}, done. Remarkable.'],
  [3, '{place}. {kmDone} km. Against every expectation of science, the rider has arrived.'],
], [eq('milestoneKind', 'finish')])

export const NATURE_NARRATOR: PersonaPack = {
  meta: {
    id: 'nature-narrator',
    name: 'The Nature Narrator',
    tagline: 'A hushed wildlife documentary. You are the slowest animal in the garage.',
    voiceHint: { rate: 0.85, pitch: 0.95, preferVoices: ['Daniel', 'Albert', 'Grandpa', 'Alex'] },
  },
  lines: b.build(),
}
