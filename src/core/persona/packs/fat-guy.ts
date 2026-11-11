// Fat Guy: an original character. An enormous, badly out-of-shape guy who is
// somehow still faster than you, and never lets you forget it. Self-deprecating
// fat jokes (his weight, his snacks, his sweat, the couch, the buffet, the
// groaning bike), and, as the owner asked, he roasts the rider's body and
// laziness too. Food on the brain, calories up for negotiation, and "I'd still
// drop you on this climb". He tells you to eat, never not to.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('fat-guy')

b.add('ride_start', [
  [1, 'Hey. You made it. I made it too. I had to stop at the fridge twice on the way.'],
  [1, "Alright, let's ride. I'll coach from the couch. It's got a cupholder. It's got two."],
  [2, "Today's menu: {workoutName}. Sounds like an appetizer. I'll have two."],
  [3, "Look at you up on that saddle. It's holding. Not happily, but it's holding."],
  [4, "You and me are built about the same. Difference is, I can still ride. You just own a bike."],
  [5, 'I weigh more than your bike and your pride put together, and I would still drop you on the first climb.'],
  [5, "Let's go. I'm sweating, I'm eating a damn sandwich, and I believe in you less than I believe in salad.", P],
  [2, "FTP test! Twenty minutes of suffering. I get that walking to the mailbox. Let's go.", when(rideKind('ftp-test'))],
  [3, 'A free ride. No plan. Like a buffet with no plate limit. Dangerous for both of us.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, "{targetW} watts for {remainingS}. Go. I'll be over here breathing for both of us."],
    [1, "Here we go, {targetW} watts. I've done this after a full rack of ribs. Your turn."],
    [2, '{targetW} watts! Push! Push like the last donut is waiting at the end of this!'],
    [3, "{targetW} watts. I've seen you take the stairs. I'm not optimistic. Go anyway."],
    [4, '{targetW} watts. Your thighs rub so hard you could start a campfire. Use that heat.'],
    [5, '{targetW} watts! Move that lazy ass before it fuses with the saddle!', P],
    [3, 'Rep {rep} of {reps}. Like courses at a buffet. You tap out at four. I go back for the soup.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last one! The dessert rep! Best part of the meal! Eat it!'],
    [4, "Final rep. I've done more laps of the crab-leg station than this. Finish it."],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! Like the buffet closes in {remainingS}! Go!'],
    [4, "Max effort! Sprint like the ice-cream truck is pulling away. I've seen you do it."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. It gets heavier every minute. Story of my life. Climb.'],
    [4, 'Ramp! It keeps going up, like your belt size. Keep up with it for once.'],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, "Warmup. Easy spin. I'm warming up a burrito. Same energy."],
    [3, 'Warmup. The only part where you and I go the same speed. Enjoy it.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW}. Nice and slow. Like a rotisserie chicken. Round and round.'],
    [3, "Steady at {targetW}. No breaks. You hold the watts, I'll hold this cheeseburger."],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, "Recovery. Breathe. Have a sip. I'm having a snack. Different kind of recovery."],
    [2, 'Rest for {remainingS}. Long enough for me to eat a sandwich. Two if I believe in myself.'],
    [4, "Recovery. Coast. You're good at coasting. That belly built up a lot of momentum."],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, "Free ride. Do whatever. I'm going to the kitchen."],
    [3, "No target for {remainingS}. Nobody watching. That's how I got like this. Careful."],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown. You earned a snack. A small one. Tiny. Like a pickle.'],
    [3, 'Cooldown. The best part. Then the second best part: lunch.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds. Get ready. Wipe your hands.'],
  [1, 'Ten seconds. Put the snack down.'],
  [2, "Ten seconds to {targetW} watts. I'm sweating already, and I'm lying down."],
  [3, 'Ten seconds. Suck it in. The gut. Then push.'],
  [4, "Ten seconds. If you're hiding a donut, swallow it now."],
  [5, 'Ten seconds! Tuck the belly, brush off the crumbs and haul that ass!', P],
  [2, 'Ten seconds to all out! Pretend they just called last orders at the buffet!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway. You're doing fine. Better than me on a staircase."],
  [2, 'Halfway! {remainingS} to go. About one microwave burrito. Go!'],
  [3, "Halfway. This is where I'd stop for a snack. You don't get one. You're not me."],
  [4, "Halfway, and your belly's bouncing like it's trying to escape. It knows what's coming."],
  [5, 'Halfway. You sweat like me and ride worse than me. How the hell is that possible?', P],
  [2, "Halfway and on target. Huh. I'd high-five you, but standing up is a whole thing.", when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. That's a whole slice of pizza left on the table.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left. You got this. Then food.'],
  [2, "Last minute! Hold {targetW}! There's pie at the end. There's no pie. Hold it anyway."],
  [2, 'Sixty seconds. I can eat a hot dog in less. Finish this.'],
  [3, 'One minute. Even the line at the buffet moves eventually.'],
  [4, 'Final minute. Quit now and I tell everyone the fat guy outlasted you. Because I would.'],
  [5, "Last minute! Dig, damn it! I've waddled faster finishes than this!", P],
  [3, "Last minute and {deficitW} short. Lean on it. Use the weight. You've got plenty.", when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, 'Nailed it. {pct}%. That calls for a cookie. For me.'],
  [1, "That's the one. Good interval. I'm proud of you, in a hungry way."],
  [2, 'Look at that. You did it. I was so shocked I put my fork down.'],
  [3, "Solid interval. Almost as solid as me. Nobody's as solid as me."],
  [4, '{pct}% of target. Good. Now do it without the jiggle.'],
  [5, "Damn. Good interval. Didn't think you had it in you. Under all that.", P],
  [2, 'Set done! Full meal! Appetizer, entree, dessert. Clean plate!', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}%. Not quite. Happens to me with jeans every day.'],
  [2, '{pct}% of target. You left watts on the plate. I never leave anything on the plate.'],
  [3, "Average {avgW}, target {targetW}. That gap's wider than me. And I'm wide."],
  [3, 'That interval jiggled more than it pedalled.'],
  [4, "{pctUnder}% under. I'm three hundred pounds of nachos and I wouldn't miss by that much."],
  [4, 'Missed it. Your legs folded faster than a lawn chair under me.'],
  [5, "{pct}%? I've seen more effort from a guy reaching for the remote. I'm that guy. That was crap.", P],
])

b.add('under_target', [
  [1, '{deficitW} watts short. Push a little. Just a little.'],
  [1, "{power} watts. Target's {targetW}. I can do math. It's just calories with a different label."],
  [2, 'Under target. My belt works harder than you, and my belt is holding back an ocean.'],
  [3, '{power} watts? I put out more than that getting off the couch. Louder, too.'],
  [4, '{deficitW} short! Saving it for a rainy day? I eat my rainy-day snacks on sunny days.'],
  [5, "Under again. Lazy as hell. And I'm saying that lying down.", P],
  [3, "{pct}% of target. I've seen more effort from a beanbag chair. I've been the beanbag chair.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "Whoa, {surplusW} over already. Pace it. It's a long meal, not a hot-dog contest."],
  [3, "{power} watts, target {targetW}? Hit the buffet like that and you're done after the salad."],
  [4, "Too hot, too early. You ate the whole cake before the candles. You'll feel it in ninety seconds."],
])

b.add('cadence_sag', [
  [1, 'Cadence is slipping. Spin it up.'],
  [2, 'Cadence {cadence}. Down {cadenceDrop}. Quick little feet, like hot sand on the way to the snack bar.'],
  [2, "Cadence sag! Light gear, fast legs. Pretend the floor's lava and the fridge is across the room."],
  [3, "Your cadence is dropping like my waistband. It's been dropping for years."],
  [3, "{cadence} rpm. You're pedalling like you're stirring cold peanut butter."],
  [4, 'Cadence {cadence}. Even I spin faster, and my knees hit my belly every stroke.'],
  [5, "Cadence down {cadenceDrop}! Spin, damn it! You're churning butter with your feet!", P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}, over your {hrCap} cap. Ease off a bit. Nobody rushes dessert.'],
  [2, "{hr} bpm. That's my heart rate opening a bag of chips. Back it off."],
  [3, 'Heart rate over the cap. Slow down. Nobody hands out medals for that.'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? Strap glitch. Or you smelled bacon.'],
  [2, '{hr} bpm while barely pedalling. Wet the strap. Or did somebody say dessert?'],
  [3, "That heart-rate spike's more exciting than your interval. Strap glitch. Probably sweat. Probably mine."],
])

b.add('stopped_pedaling', [
  [1, "Break time. Grab some water. I'm grabbing a pudding cup."],
  [1, 'Pedals stopped. Take a breath. No rush.'],
  [2, "Stopped? I respect it. I'm a professional at stopping."],
  [3, 'Stopped at {elapsedMin} minutes. Copying my moves now? I want royalties. In snacks.'],
  [4, 'You stopped. The flywheel kept going. It has more stamina than your whole body type.'],
  [5, 'Oh, we stopping? Hell, pass the chips then.', P],
])

b.add('resumed', [
  [1, "And we're back. Good. I wasn't getting up."],
  [2, "Back after {pausedS}. That was longer than my lunch. No, it wasn't."],
  [4, "You're back! I almost finished your snacks. I finished your snacks."],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Hey, I skip things too. Mostly salads.'],
  [2, 'Skipped {segmentLabel}. Like skipping the vegetables. I approve, but it shows.'],
  [3, "You skipped an interval. That's how it starts. Then you skip the stairs. Then you're me."],
  [3, 'Skipping intervals. Only the easy bits, like me at a fruit platter. Just the melon.'],
  [4, "Skip! Your body didn't get like that by accident. It got like that by skipping."],
  [5, "You skipped it? Damn. I'm the fat guy and even I'm judging you.", P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}! Second helping! Love that!'],
  [3, 'You added {extraS}? On purpose? First time you went back for seconds of anything healthy.'],
  [4, "Extra time! Somebody's trying to earn dessert."],
])

b.add('intensity_down', [
  [1, "Intensity down to {intensityPct}%. Smart. Know your limits. I don't know mine. Nobody's found them."],
  [2, '{intensityPct}%. Loosening the belt a notch. Nobody knows that move better than me.'],
  [3, "Intensity down. That's ordering a diet soda with the triple burger. Doesn't count."],
  [3, 'Down to {intensityPct}%. You and me both, buddy. You and me both.'],
  [4, '{intensityPct}%? Your legs called in sick, and your belly signed the note.'],
  [5, "{intensityPct}%? Hell, just come sit on the couch. I'd scoot over. I wouldn't. There's no room.", P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%! Supersize it!'],
  [3, 'You turned it up? Confident. Like me ordering the large, then asking if there is a larger.'],
  [4, '{intensityPct}%! Bold, for somebody shaped like a bag of dinner rolls.'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Save some for later. Like leftovers.'],
  [2, '{wbalPct}% W′bal left. Running on fumes. Burrito fumes.'],
  [2, 'Reserves low. Ride smart. Pace it like a seven-course meal.'],
  [3, 'Your W′bal is lower than my standards at a gas-station hot-dog roller.'],
  [4, 'W′bal {wbalPct}%. You ate all your energy in the first ten minutes. I relate. I hate that I relate.'],
  [5, 'W′bal at {wbalPct}%. You blew it all early, damn it. Like a free-sample tray with me in the room.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Running on pure stubbornness. And stored snacks.'],
  [3, "The tank is empty. Good news: you've got backup tanks. Around the waist."],
  [4, 'Zero W′bal. The plate is clean. You licked it. Now what?'],
])

b.add('pr', [
  [1, "New {prLabel} PR! I'm so proud I'm sweating. I was already sweating."],
  [1, "That's a new {prLabel} best! Celebrate! Cake! Small cake!"],
  [2, "{prLabel} personal record at {power} watts! Okay. That's real."],
  [3, 'A {prLabel} PR? All that weight and you still found watts. I know the feeling.'],
  [4, "New {prLabel} best! You're still slower than me, but less slow."],
  [5, "{prLabel} PR! Damn! I'm getting up for this! Okay, I'm not, but damn!", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Keep rolling.'],
  [2, 'Minute {minute}. Still going. Like me at a buffet.'],
  [3, "Minute {minute}. Projected {projectedFtp}. Mine's higher, and I'm eating ribs right now."],
  [1, "Minute {minute}. Easy start. Don't eat the whole bag at once.", when(lte('minute', 3))],
  [3, "Minute {minute}. Feeling light? Give it ten minutes. You'll feel every pound.", when(lte('minute', 3))],
  [2, "Minute {minute}! Last stretch! Dessert's coming!", when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you're saving, eat it now. Metaphorically. Don't stop pedalling.", when(gte('minute', 17))],
  [
    2,
    'Minute {minute}. Projected {projectedFtp}, {projectedGain} up. Hold on to it like the last rib.',
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! Somebody get this rider a cake!', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} to {ftpNew}. Now your watts per kilo almost matter. Almost.', when(gt('ftpGain', 0))],
  [5, "{ftpNew}! Up {ftpGain}! Damn! You still couldn't drop me, but damn!", whenP(gt('ftpGain', 0))],
  [1, "FTP {ftpNew}, down {ftpDrop}. Rough day. Have a snack. That's my answer to everything.", when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. You lost watts. Wrong thing to lose, buddy.', when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. Same as before. Like my weight. Huge, but stable.', when(eq('ftpGain', 0))],
  [1, "Test done! FTP {ftpNew}! Let's eat!"],
])

b.add('workout_complete', [
  [1, 'Done. Good work. Now go eat something. Not everything. Something.'],
  [1, "Workout complete! {elapsedMin} minutes! I'm exhausted just from watching."],
  [2, 'Done! NP {np}. Not bad. Not me, but not bad.'],
  [2, "{kj} kJ. That's about a large fries. You earned it. Get the medium."],
  [3, 'You finished. Against all odds and most of the snacks in this house.'],
  [4, 'Workout complete. The bike needs a minute. So does the floor.'],
  [5, "That's it. Done. Damn good. I'd hug you, but we'd both stick.", P],
])

b.add('ride_bailed', [
  [1, 'Early exit. Hey, I leave stuff early too. Mostly the gym.'],
  [2, "Leaving at {elapsedMin} minutes? The kitchen isn't going anywhere."],
  [3, 'Bailed. I know that move. I invented that move. That move is how I got this big.'],
  [3, 'Early exit. Let me guess. You smelled food.'],
  [4, "Quitting? I'm three hundred pounds and I'd have finished. Let that sink in. Like me into a hot tub."],
  [5, "You bailed? Hell, even the bike lasted longer, and I've sat on that bike.", P],
])

b.add('fueling_reminder', [
  [1, 'Snack time. Finally. My favourite part of any day. Eat something.'],
  [1, "Fuel check. Eat a little something. I'll eat a big something."],
  [2, 'Fuel up! Carbs! The good stuff! The only stuff!'],
  [3, "Eat something. Not the whole box. That's my move. You haven't earned my move."],
  [4, '{elapsedMin} minutes in. Eat now. I already did. Three times. Since you started.'],
  [5, 'Eat a damn gel. Bonking is no excuse. Bonking is only allowed after a buffet.', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water! That sweat has to come from somewhere. Mine comes from gravy.'],
  [2, "Hydration break. The bottle's right there. Mine's a two-liter. Of cola."],
  [3, "Drink. You're sweating like me, and nobody should sweat like me."],
])

b.add('distress', [
  [1, 'Hey. Ease right off and breathe. Stop if something feels wrong. The jokes can wait.'],
  [1, 'No bits right now. Soft-pedal or stop. You matter more than this workout, buddy.'],
])

b.add('idle_banter', [
  [1, "You're doing fine. I mean it. I don't waste breath. I don't have much."],
  [1, "Keep going. I'm cheering. You can't hear it over the chewing, but I'm cheering."],
  [2, "{elapsedMin} minutes in and still pedalling. That's longer than I've gone without a snack since the nineties."],
  [2, 'Power {power}, cadence {cadence}. Steady. Like a lazy Susan. Round and round.'],
  [3, "The bike's making a noise. Oh no, that's me. I'm digesting."],
  [3, 'Your bike has a carbon frame to save weight. Your body never got that memo.'],
  [3, "I drop people on climbs. They see me coming. They just don't believe it."],
  [4, 'You ride indoors so nobody sees you jiggle. Good call. I do the same.'],
  [4, "That top tube is carrying a lot of you. It didn't sign up for that."],
  [5, "I'm shaped like a vending machine and I'd still drop you on this climb. Think about that."],
  [5, "Listen. The saddle's crying. Not the drivetrain, the saddle. That's on you."],
  [5, "Even my sweat works harder than you. For it, this is a full-time job. Damn, it's a career.", P],
])

b.add('segment_start', [[5, "{targetW} watts. Stop jiggling and fucking pedal. I'd drop you right now with gravy on my shirt.", P]], [HARD])
b.add('under_target', [[5, '{power} watts. Fucking pathetic. I make more than that sneezing.', P]])
b.add('idle_banter', [[5, "This pace is bullshit. I'm twice your size and I'd drop you before the snack stop.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Alright, let's fucking ride. I'll be right here. Eating. Believing in you. A little.", P],
  [4, 'Clip in. An hour of me watching your shit effort with a bucket of wings.', P],
])
b.add(
  'segment_start',
  [
    [2, "{targetW} watts. Fucking push, buddy. Like you're squeezing into last year's jeans.", P],
    [5, "{targetW} watts for {remainingS}. Save the excuse. I've used all that shit on my doctor.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds. Put the fucking fork down. {targetW} watts is coming.', P]])
b.add('halfway', [[4, 'Halfway. Half-assed effort from a full-sized ass. Fucking tragic.', P]])
b.add('last_minute', [[3, 'Last minute. Squeeze it out like the end of the ketchup. Fucking squeeze.', P]])
b.add('segment_end_success', [
  [1, "Okay, that was fucking good. I'm clapping. With a drumstick in one hand.", P],
  [5, 'You actually hit it? Shit. There goes my chance to feel better about myself.', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That's not an interval, that's a shitty side salad.", P],
  [5, "Average {avgW}, target {targetW}. I'm fat as fuck and I'd have closed that.", P],
])
b.add('under_target', [
  [2, "{deficitW} watts short. That's a fucking snack-sized effort. Supersize it.", P],
  [4, '{power} watts? I fart more power than that. Fucking pedal.', P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. You're spinning like a fat guy on a hot day. Shit, that's me. Spin anyway.", P]])
b.add('stopped_pedaling', [[4, "We're stopping? Fine. Gives me time to eat this shit before it gets cold.", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. Even I eat my vegetables when they're fried. Fucking eat it.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? That's some low-fat, sugar-free bullshit.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You ate your whole fucking lunch at breakfast.', P]])
b.add('pr', [[2, "{prLabel} PR? Holy shit. I'm sweating for you. Also for me.", P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. Fuck yeah. Put it on a cake. A big cake. I'll handle the cake.", P]])
b.add('workout_complete', [
  [1, "Done. You were fucking great. I'm proud. And hungry.", P],
  [5, "That's a wrap. {tss} TSS. You started like shit and finished like slightly warmer shit.", P],
])
b.add('ride_bailed', [[5, "Bailing at {elapsedMin} minutes? I've stayed longer at a salad bar, and I fucking hate salad bars.", P]])
b.add('fueling_reminder', [[3, 'Eat something. Hungry you rides like shit. Full you also rides like shit, but happier.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Fine. Fucking fine. Like a lukewarm burger.', P],
  [4, "You know what's sad? I'm the fat guy, and you're the one wheezing. Fucking wheezing.", P],
  [5, "Look at you. All gut, no guts. I've got both. Shit, I've got plenty of both.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! Nice. What do they eat here?'],
    [2, '{place}! I hear the bakeries are great. I hear it from my stomach.'],
    [3, "{place}. I've been here. I ate here. They remember me. There's a plaque."],
    [4, "We're in {place}! The locals are staring. It's the sweat. Or it's me. It's both."],
    [5, "{place}! {kmLeft} km to go and you're dragging that gut like a damn trailer.", P],
    [5, "{place}! {kmLeft} km to go. That's a lot of km. That's a lot of snack stops you don't get."],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, 'Welcome to {place}! New country, new snacks!'],
  [3, '{place}! Customs asked if you had anything to declare. You should have declared that belly.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'The top of {place}! Good climbing! Downhill is my specialty. Gravity loves me.'],
  [3, "You got up {place}. I'd have beaten you up it. With this body. Sit with that."],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway! Lunch break! Kidding. Mostly. Keep going.'],
  [3, 'Halfway through {journeyName}. Half a meal. Nobody stops at half a meal.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, "{place}! You did it! {journeyName}, done! Let's eat everything!"],
  [3, "{place}. {kmDone} km. That's a lot of riding. And a lot of eating, after. Earned it."],
], [eq('milestoneKind', 'finish')])

export const FAT_GUY: PersonaPack = {
  meta: {
    id: 'fat-guy',
    name: 'Fat Guy',
    tagline: "Three hundred pounds of snacks and sweat, and he'd still drop you on this climb.",
    voiceHint: { rate: 0.85, pitch: 0.85, preferVoices: ['Grandpa', 'Fred', 'Ralph', 'Alex', 'Tom'] },
  },
  lines: b.build(),
}
