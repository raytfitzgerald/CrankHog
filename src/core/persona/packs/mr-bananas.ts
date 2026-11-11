// Mr. Bananas: a chimp in a tracksuit with zero respect for the rider. Mostly
// hooting, screeching, chest beating, banana demands and poop flinging, then
// out of nowhere a genuinely good coaching tip (shoulders, cadence, pacing,
// carbs) before he goes straight back to hooting. Crude, rude, a little useful.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('mr-bananas')

b.add('ride_start', [
  [1, 'Ooh ooh aah aah! Coach Bananas is in the house! Tracksuit on. We ride.'],
  [1, 'OOH OOH! You came! Good. Banana first, then we ride. My banana. Not yours.'],
  [2, "{workoutName}? Ooh ooh. I've flung poop at harder workouts. Clip in."],
  [3, "AAH AAH! Look at the little shoes. I've seen better footwork on a coconut."],
  [4, 'OOH OOH AAH! Big human, tiny bike, goes nowhere. My cousins would laugh for a week.'],
  [5, "EEEEK! You again? Hell, I'd rather pick fleas off a hyena. Clip in.", P],
  [2, 'FTP test! OOH OOH! Pace it like a banana: peel slow, finish strong. AAH!', when(rideKind('ftp-test'))],
  [3, 'No plan? OOH OOH AAH. You and me in a fruit market. Pure chaos.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, 'OOH OOH! {targetW} watts for {remainingS}! Chest out! Go!'],
    [1, '{targetW} watts! Ooh ooh aah aah! Smooth circles. GO!'],
    [2, "{targetW} watts! THUMP THUMP THUMP! That's my chest. Make your legs sound like that."],
    [3, '{targetW} watts. Ooh ooh. Start steady, not stupid. Then AAH AAH AAH, pedal!'],
    [4, "{targetW} watts! OOH OOH! I've seen a sloth go harder, and it was asleep."],
    [5, '{targetW} watts! EEEEK! Pedal like hell or the poop starts flying!', P],
    [3, 'Rep {rep} of {reps}! Ooh ooh. Yes, I can count that high. Ape, not monkey. Pedal.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'LAST ONE! OOH OOH AAH AAH! Empty the tank. Banana after!'],
    [4, "Final rep! EEEEK! Ride it like a zookeeper's chasing you with a dart gun!"],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'ALL OUT for {remainingS}! EEEEEEK! Out of the saddle, arms loose, GO!'],
    [4, "Max effort! AAAH! Pretend there's a banana at the end. There isn't. I ate it."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, "Ramp! Ooh ooh. Like climbing a tree: one branch at a time. Don't look down."],
    [4, "The ramp! OOH! Every step up, you get worse. I'm saving a handful for when you crack."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, "Warmup! Ooh ooh. Easy spin, loose shoulders. I'll eat a banana."],
    [3, 'Warmup. Ooh ooh. The one thing you do well. Barely.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW}. Ooh ooh. Smooth like a peeled banana. Breathe from the belly.'],
    [3, "{targetW} watts, steady. Boring. AAH. I'd rather groom myself."],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Rest! Ooh ooh aah. Spin easy. Recovery is where you get stronger. Really.'],
    [2, "{remainingS} of rest. I'll spend it scratching. You spend it breathing."],
    [4, 'Recovery. You still look worse than me after I fall out of a tree.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride! Ooh ooh aah aah! Do whatever. Like me in a gift shop.'],
    [3, '{remainingS} of free riding. No rules. I respect it. Mostly I throw stuff.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown! Ooh ooh. Easy legs, flush it out. Banana time soon.'],
    [3, 'Cooldown. AAH AAH. Finally I can stop pretending you were impressive.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds! Ooh ooh! Get ready!'],
  [1, 'Ten! OOH OOH AAH AAH! Chest up!'],
  [2, 'Ten seconds to {targetW}! THUMP THUMP! Get angry!'],
  [3, 'Ten seconds. Shift to an easier gear now, spin up, then go. AAH!'],
  [4, 'Ten seconds! EEEEK! Pick up your excuses. I already pooped on them.'],
  [5, 'Ten seconds! Get your hairless ass ready! EEEEEK!', P],
  [2, 'Ten seconds to all-out! Out of the saddle! OOH OOH!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'Halfway! Ooh ooh! Keep it smooth!'],
  [2, 'Halfway. {remainingS} left. Relax your grip. Loose hands, more watts. AAH AAH.'],
  [3, 'Halfway! OOH! Your face looks like my butt. Red and confused.'],
  [4, 'Halfway. Your power line is jumpier than me on espresso.'],
  [5, 'Halfway! EEEEK! Hell, my bananas ripen faster than you ride. Pedal!', P],
  [2, 'Halfway and on target! OOH OOH! Good chimp. Er, human.', when(gte('pct', 98))],
  [3, "Halfway and {deficitW} short. Breathe out hard, push the next stroke. Then I'll hoot.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute! Ooh ooh! Bring it home!'],
  [2, 'Last minute! Hold {targetW}! Pull through the bottom of the stroke! OOH!'],
  [2, 'Sixty seconds! THUMP THUMP THUMP! Banana at the finish!'],
  [3, 'One minute. Even bad intervals end. Then I hoot at you.'],
  [4, 'Final minute! Quit now and I fling. I have a full hand. EEEEEK!'],
  [5, 'Last minute! Dig in, damn it! OOH OOH AAH AAH!', P],
  [3, 'Last minute and {deficitW} short! Stand, five hard strokes, sit, spin! AAH!', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, '{pct}%! OOH OOH AAH AAH! Good human! Here, half a banana!'],
  [1, 'Nailed it! THUMP THUMP! Ooh ooh!'],
  [2, "You did it? AAH? I'm confused. Somebody check the power meter."],
  [3, "Good interval. Ooh. I'd fling something nice, but I only have the one kind."],
  [4, '{pct}% of target. Okay. Still slower than me up a tree.'],
  [5, "Damn. Good interval. EEEEK! I hate it! Here's a banana!", P],
  [2, "Set done! OOH OOH AAH AAH! I'm hooting for you. Don't make it weird.", when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}%. Ooh. Next one: start a bit easier, finish stronger.'],
  [2, "{pct}% of target. AAH AAH. My grandpa held more, and he's stuffed in a museum."],
  [3, "Average {avgW}, target {targetW}. OOH OOH. That gap's wide enough to swing through."],
  [3, 'That interval had the energy of a nap in the sun. And I nap a LOT.'],
  [4, '{pctUnder}% under. EEEEK! I fling poop with more follow-through.'],
  [4, 'Under target. Your excuses grow faster than my back hair.'],
  [5, '{pct}%? Half-assed! OOH OOH AAH! Even my poop has more direction.', P],
])

b.add('under_target', [
  [1, '{deficitW} watts short. Ooh ooh. Drop the shoulders, push down. Better.'],
  [1, '{power} watts. Target {targetW}. Ooh ooh. Close it up.'],
  [2, 'Under target! AAH AAH! I can hear you coasting from up in my tree.'],
  [3, '{power} watts? EEEEK! A chimp on a tricycle does that. I am that chimp.'],
  [4, "{deficitW} watts short! OOH OOH! I spent all day flinging poop at tourists and I've got more left than you."],
  [5, 'Under target again! Pick it up, damn it! EEEEEK!', P],
  [3, "{pct}% of target. Ooh. That's not riding. That's sitting with extra steps.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, 'Whoa, {surplusW} over! Ooh ooh. Easy start, strong finish. Trust the ape.'],
  [3, "{power} when the target's {targetW}? AAH! You'll blow up like a chimp in a soda factory."],
  [4, "Too hot, too early! EEEEK! I've seen this movie. You crack, I hoot."],
])

b.add('cadence_sag', [
  [1, 'Cadence slipping. Ooh ooh. Lighter gear, quicker feet.'],
  [2, 'Cadence {cadence}. Down {cadenceDrop}. Spin, human! OOH!'],
  [2, 'Spin it up! At the bottom, scrape mud off your shoe. AAH AAH.'],
  [3, '{cadence} rpm? I fling my own poop and I still hold 90 rpm.'],
  [3, 'Your legs are slower than a tourist reading the sign on my cage. Spin!'],
  [4, "Cadence {cadence}. That's a pedal stroke? I've seen sloths climb faster. EEEEK!"],
  [5, 'Down {cadenceDrop} rpm! Spin, damn it! OOH OOH AAH AAH!', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}, over {hrCap}. Ooh. Ease off a little. Breathe slow.'],
  [2, '{hr} bpm! AAH! Your heart is chest-beating harder than me. Back it off.'],
  [3, 'Heart over the cap. Easy, human. Long exhales. Then you can be bad again.'],
])

b.add('hr_spike_no_power', [
  [1, "Heart {hr} at {power} watts? Ooh ooh. Strap's glitching. Or you watched me eat."],
  [2, '{hr} bpm, barely pedaling? Wet the strap. AAH AAH. Sensor drama.'],
  [3, "That spike's fake. EEEEK! The strap's wonky. Like your pedal stroke."],
])

b.add('stopped_pedaling', [
  [1, "Break! Ooh ooh. Grab water. I'll grab a banana."],
  [1, 'Stopped? Okay. Ooh. Breathe. Back on when ready.'],
  [2, 'Pedals stopped. AAH? Is this a nap? Chimps respect naps.'],
  [3, "Stopped at {elapsedMin} minutes. OOH OOH. I'll groom myself till you're back."],
  [4, 'You stopped! EEEEK! The flywheel is still going. It has more ape in it than you.'],
  [5, "Stopping? Hell. I'm flinging. Incoming!", P],
])

b.add('resumed', [
  [1, 'Back on! Ooh ooh aah aah!'],
  [2, 'Back after {pausedS}. I ate three bananas. AAH.'],
  [4, 'Back already? I was halfway through redecorating your wall. EEEEK.'],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Ooh. Okay. Next one counts.'],
  [2, 'Skipped {segmentLabel}. AAH AAH. I saw that. Apes see everything.'],
  [3, 'Skipping? Ooh ooh. Like eating the peel and throwing away the banana.'],
  [3, "You skipped an interval. OOH. I'd be disappointed, but I expected it."],
  [4, "Skip! EEEEK! I'm writing that down. In poop. On your wall."],
  [5, 'You skipped it? Damn. Even zoo chimps finish their enrichment puzzle.', P],
])

b.add('extended_interval', [
  [1, '{extraS} more! OOH OOH! Bonus!'],
  [3, "You added {extraS}? Voluntarily? AAH? You're weird. I like it."],
  [4, 'Extra time! EEEEK! Look at you, showing off for the ape.'],
])

b.add('intensity_down', [
  [1, 'Down to {intensityPct}%. Ooh. Smart. Some days are banana days, some are peel days.'],
  [2, '{intensityPct}%. AAH AAH. Lowering the bar. I can reach it from the floor.'],
  [3, 'Down to {intensityPct}%. Fine. Showing up beats hero days. Now stop whining. OOH!'],
  [3, "Intensity down. Ooh ooh. I'd turn it down too, if I were that slow."],
  [4, '{intensityPct}%? EEEEK! Baby chimps hold on to their moms harder than you hold a target.'],
  [5, "{intensityPct}%? Hell, get off and let me ride. I'm a chimp. I'd still win.", P],
])

b.add('intensity_up', [
  [1, 'Up to {intensityPct}%! OOH OOH AAH AAH!'],
  [3, 'You turned it UP? AAH? Bold. The legs better agree.'],
  [4, "{intensityPct}%! EEEEK! I'm getting popcorn. And poop. Mostly poop."],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Ooh. Save some. Smooth, not spiky.'],
  [2, '{wbalPct}% left. Running on fumes. AAH AAH.'],
  [2, 'Reserves low. Sit down, steady pressure, no surges. Ooh ooh.'],
  [3, 'W′bal {wbalPct}%. Your tank is emptier than my fruit bowl.'],
  [4, 'W′bal {wbalPct}%. Burned it all early. Like a chimp with a whole bunch at once.'],
  [5, "W′bal at {wbalPct}%. Blew it in the first minute, didn't you? Damn human. EEEEK!", P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Ooh. Stubborn now. Good stubborn.'],
  [3, "Tank empty! AAH! Now we find out if you're an ape or just ape-shaped."],
  [4, "Zero W′bal! EEEEK! I'm already laughing."],
])

b.add('pr', [
  [1, 'New {prLabel} PR! OOH OOH AAH AAH! Banana for you!'],
  [1, '{prLabel} best! THUMP THUMP! Proud of you, hairless!'],
  [2, '{prLabel} record! {power} watts! Okay. EEEEK. Okay. Respect.'],
  [3, "A {prLabel} PR? Ooh. I had poop ready. I'll save it for next week."],
  [4, 'New {prLabel} best! AAH! Did you eat my bananas? Is that the secret?'],
  [5, "{prLabel} PR! Damn! OOH OOH AAH AAH! I'm beating my chest for you!", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Ooh ooh. Steady.'],
  [2, "Minute {minute}! Still here! OOH! I'm shocked."],
  [3, 'Minute {minute}. Projected {projectedFtp}. Hold even power. No spikes. Then hoot.'],
  [5, 'Minute {minute}! Hurts like hell? Good! EEEEEK! Keep pushing!', P],
  [1, "Minute {minute}. Easy start. Like peeling a banana: don't rip it.", when(lte('minute', 3))],
  [3, 'Minute {minute}. Feeling good? OOH. Feelings lie. Stick to the number.', when(lte('minute', 3))],
  [2, 'Minute {minute}! Final stretch! Empty everything! EEEEK!', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you saved, spend it now. Bananas don't keep.", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, up {projectedGain}. Don't choke. OOH OOH.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! OOH OOH AAH AAH!', when(gt('ftpGain', 0))],
  [3, "Up {ftpGain} to {ftpNew}. AAH. I'll need a bigger chest to beat.", when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn! EEEEK! Bananas for everyone!', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Ooh. Sleep more, eat more, try again.', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. AAH AAH. You are devolving. I can tell.', when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. Ooh. Same as last time. Like my diet.', when(eq('ftpGain', 0))],
  [1, 'Test done! FTP {ftpNew}! OOH OOH!'],
])

b.add('workout_complete', [
  [1, 'Done! OOH OOH AAH AAH! Good human! Banana!'],
  [1, 'Workout complete! {elapsedMin} minutes! THUMP THUMP!'],
  [2, 'Done. NP {np}. Ooh. Solid. Now eat carbs and protein within the hour.'],
  [2, '{kj} kJ! That is a lot of bananas. AAH. Go eat them.'],
  [3, 'You finished. Against every ape prediction.'],
  [4, 'Done. Your form fell apart around minute twenty. I saw. I hooted.'],
  [5, "Damn good ride. EEEEK! Don't tell the other chimps I said that.", P],
])

b.add('ride_bailed', [
  [1, 'Leaving? Ooh. Okay. Rest up, come back.'],
  [2, 'Quitting at {elapsedMin} minutes? AAH AAH. Chimps finish their banana.'],
  [3, "Bailed. OOH. I'm keeping your bananas."],
  [3, "Early exit. Ooh ooh. I'll tell the troop you had a meeting."],
  [4, 'Quitting already? EEEEK! I had a whole handful with your name on it.'],
  [5, 'You bailed? Hell. Even the school trip stayed longer at my cage.', P],
])

b.add('fueling_reminder', [
  [1, 'Snack time! Ooh ooh! Eat something.'],
  [1, 'Fuel! About 60 grams of carbs an hour. A banana counts. AAH AAH.'],
  [2, 'Eat! A banana! Not mine! OOH OOH!'],
  [3, 'Eat something. Hungry human rides like a sad zoo animal. I would know.'],
  [4, '{elapsedMin} minutes in. Eat now or bonk. Bonked humans are hilarious. EEEEK.'],
  [5, 'Eat a damn gel! OOH OOH! Or a banana! Give me the banana!', P],
])

b.add('hydration_reminder', [
  [1, 'Drink! Ooh ooh. Little sips, often.'],
  [2, 'The bottle is right there. AAH AAH. Opposable thumbs. Use them.'],
  [3, 'Drink. You sweat like a gorilla in a sauna. EEEEK.'],
])

b.add('distress', [
  [1, 'No hooting now. Ease off and breathe. Stop if something feels wrong.'],
  [1, 'No monkey business. Soft-pedal or stop. You matter more than the workout.'],
])

b.add('idle_banter', [
  [1, "You're doing fine. Ooh ooh. Really. Banana?"],
  [1, 'Keep going! OOH OOH AAH AAH!'],
  [2, 'Nice form. Relax the hands, elbows soft. Ooh ooh. Better.'],
  [2, '{elapsedMin} minutes in. Still pedaling. Better than most humans. Worse than me.'],
  [2, 'Power {power}, cadence {cadence}. Steady. Ooh. Suspicious.'],
  [3, "You bought a carbon bike to sit in a garage. I live in a tree. Who's the smart one?"],
  [3, 'Your sweat smells like fear and old cheese. EEEEK. Pedal.'],
  [3, 'OOH OOH AAH AAH! No reason. I just like hooting at you.'],
  [4, 'Nice belly. Ooh. Did you eat all the bananas? Is that where they went?'],
  [4, 'Lycra on you looks like a banana skin on a watermelon. AAH AAH.'],
  [5, "We share most of our DNA. You're working really hard on the slow part."],
  [5, 'You pedal like a scared zookeeper. EEEEK! Faster, damn it!', P],
])

b.add('segment_start', [[5, '{targetW} watts! Get the fuck on it! OOH OOH AAH AAH!', P]], [HARD])
b.add('under_target', [[5, "{power} watts. Fucking embarrassing. I'm throwing poop at the screen.", P]])
b.add('idle_banter', [[5, "This pace is bullshit. OOH OOH. I'm flinging.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Ooh ooh aah aah! Coach is here. Banana's peeled. Let's fucking ride.", P],
  [4, "EEEEK! Clip in, hairless. I've got a fistful of shit and perfect aim.", P],
])
b.add(
  'segment_start',
  [
    [2, "{targetW} watts! Easy, right? EEEEK! Shit, this'll be fun to watch.", P],
    [5, "{targetW} for {remainingS}! I fling my own shit and I'd still hold that. GO!", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds! Then {targetW}! Or I start throwing shit! EEEEK!', P]])
b.add('halfway', [[4, 'Halfway! Half the interval, half the effort. Fucking humans. OOH OOH.', P]])
b.add('last_minute', [[3, "Last minute! Don't fuck it up! EEEEEEK!", P]])
b.add('segment_end_success', [
  [1, 'That was fucking good! Ooh ooh! Have a banana!', P],
  [5, "You actually hit it? Shit. I had poop ready. I'll keep it warm.", P],
])
b.add('segment_end_failed', [
  [3, '{pct}%. That was shit. And I know shit. EEEEK!', P],
  [5, 'Average {avgW}, target {targetW}. Fucking pathetic. Banana privileges revoked.', P],
])
b.add('under_target', [
  [2, "{deficitW} watts short. Come on, that's some sad-ass shit. OOH OOH.", P],
  [4, '{power} watts? Fuck! My banana peel puts out more!', P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. You're grinding like shit. Shift down, spin up. EEEEK!", P]])
b.add('stopped_pedaling', [[4, "You stopped? Fucking typical. I'm loading up. EEEEK!", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. Shit move. And I'd know shit. EEEEK!", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? That's fucking soft. EEEEK!", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You blew the whole fucking tank. OOH OOH.', P]])
b.add('pr', [[2, '{prLabel} PR? Holy shit! EEEEK! Banana party!', P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. That's it? Shit. I've flung poop harder than that.", P]])
b.add('workout_complete', [
  [1, 'Done! Honestly? Fucking great. OOH OOH AAH AAH!', P],
  [5, 'Done. {tss} TSS. Not bad for something that started like a wet sack of shit.', P],
])
b.add('ride_bailed', [[5, 'Leaving at {elapsedMin} minutes? Fucking quitter. EEEEEK! FLING!', P]])
b.add('fueling_reminder', [[3, 'Eat something. Hungry you rides like shit. OOH.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Solid. Boring as shit. OOH.', P],
  [4, "I've seen zoo visitors put more fucking effort into tapping the glass.", P],
  [5, "You call this suffering? I've had shittier days in a cage and still hooted harder.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! OOH OOH AAH AAH! New trees!'],
    [2, '{place}! Ooh. Do they have bananas? Find out later. Pedal.'],
    [3, '{place}. I escaped from a zoo here once. Long story. Ask nobody.'],
    [4, "{place}! The locals saw you coming. EEEEK! They're closing the fruit stands."],
    [5, "{place}! {kmLeft} km to go! Damn! I'd swing there faster! OOH OOH!", P],
    [5, "{place}. {kmLeft} km left. I've flung poop farther than you ride in a day."],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, '{place}! New country! Ooh ooh! Same ape!'],
  [3, '{place}! They let you in? AAH. They let me in too. Low standards.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'The top of {place}! THUMP THUMP THUMP! King of the mountain!'],
  [3, "You climbed {place}. Ooh. I'd have done it one-handed, holding a banana."],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway! OOH OOH! Banana break? No. Pedal.'],
  [3, 'Halfway through {journeyName}. AAH AAH. Half the bananas, half the distance.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! {journeyName}, done! OOH OOH AAH AAH! Bananas for everyone!'],
  [3, "{place}. {kmDone} km. Ooh. I'd hoot at you, but honestly? Respect."],
], [eq('milestoneKind', 'finish')])

export const MR_BANANAS: PersonaPack = {
  meta: {
    id: 'mr-bananas',
    name: 'Mr. Bananas',
    tagline: 'A chimp in a tracksuit. Hoots, flings, demands bananas, then gives annoyingly good advice.',
    voiceHint: { rate: 1.15, pitch: 1.35, preferVoices: ['Bahh', 'Boing', 'Jester', 'Junior', 'Alex'] },
  },
  lines: b.build(),
}
