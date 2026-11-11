// The Infomercial Host: the shouty late-night TV pitchman. Every interval is a
// product demo ("But wait, there's more!", "Operators are standing by!",
// "Order in the next ten minutes!"), every bad rep the black-and-white "before"
// footage, and the prize is always another interval. Fake testimonials, absurd
// gadgets, fine print read at speed. No real products, brands or presenters.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('infomercial-host')

b.add('ride_start', [
  [1, 'Hi there! Are you tired of being this slow? Then have I got a workout for you!'],
  [1, 'Folks, welcome to the show! Stay on the line, because this ride is not available in stores!'],
  [2, 'Introducing {workoutName}! It burns! It builds! It does not come with a refund!'],
  [3, "Look at you, clipped in and ready! Folks, this is the 'before' picture. Keep it handy!"],
  [4, "You bought a smart trainer, and look how you use it! There's got to be a better way!"],
  [5, 'Sick of being the slowest thing in your own garage? Operators are laughing! I mean standing by!'],
  [5, 'Folks, look at this rider! Out of shape, out of excuses, out of luck! Hell of a before shot!', P],
  [2, 'FTP test tonight! Twenty minutes to find out what you are really worth! No refunds!', when(rideKind('ftp-test'))],
  [3, 'A free ride! No plan! No structure! Just like my last three business ventures!', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, '{targetW} watts for {remainingS}! Order now and get the burn absolutely free!'],
    [1, 'Here it is, folks: {targetW} watts! Watch how easy it looks! It is not easy!'],
    [2, "{targetW} watts! Now, how much would you pay for an interval like this? Don't answer! Pedal!"],
    [3, '{targetW} watts! Watch this rider turn a premium trainer into a very expensive chair!'],
    [4, '{targetW} watts! Our studio audience saw your last interval. They gasped. One fainted.'],
    [5, '{targetW} watts! Results not typical! Especially not yours!'],
    [3, "Rep {rep} of {reps}! But wait, there's more! There's always more! That's the business model!"],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last rep! This offer ends soon! In {remainingS}, to be exact!'],
    [4, 'Final rep! Supplies are limited! Your legs are the supplies! Very limited!'],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! This is a limited-time offer! Act now!'],
    [4, 'Max effort! Show the folks at home what this baby can really do! Spoiler: not much!'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp! It gets harder every minute! And at no extra charge!'],
    [4, 'Introducing the ramp! It adjusts automatically to your weakness! Patent pending!'],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup! Easy spin! Just like the gentle setting on our deluxe model!'],
    [3, 'Warmup! The only part of the program with a money-back guarantee!'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW} watts! Just plug it in and watch it go!'],
    [3, 'Steady at {targetW}! Long, flat and boring! Like the fine print!'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, "Recovery! Catch your breath! We'll be right back after these messages!"],
    [2, "Rest for {remainingS}! Enjoy it! It's the only free trial you're getting!"],
    [4, "Recovery! Don't coast too much, the cameras are still rolling!"],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride! Free! Did somebody say free?'],
    [3, 'No target for {remainingS}! Nothing to fail at! The perfect product for you!'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown! Thanks for watching, folks! Stay tuned!'],
    [3, "Cooldown! That's the end of the demo! Returns are not accepted!"],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds! Operators are standing by!'],
  [1, 'Ten seconds to showtime! Smile for the camera!'],
  [2, 'Ten seconds to {targetW} watts! Act now! Well, in ten seconds!'],
  [3, 'Ten seconds! Last chance to read the fine print! Too late!'],
  [4, 'Ten seconds! Our lawyers make me say this: it will hurt!'],
  [5, 'Ten seconds! Get your ass on that bike before the offer ends!', P],
  [2, 'Ten seconds to all-out! This offer will not be repeated!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway there! And folks, it's working!"],
  [2, "Halfway! {remainingS} left! But wait, there's more! It's the other half!"],
  [3, "Halfway! Let's check in with our rider. Oh. Oh no. Back to the studio!"],
  [4, 'Halfway! Your power line looks like our sales chart after the lawsuit!'],
  [5, 'Halfway! Results may vary! Yours varied straight to hell!', P],
  [2, 'Halfway and right on target! Folks, this is not a paid actor! Probably!', when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short! In the business, we call that 'the before'!", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left! Only one! Get yours while it lasts!'],
  [2, "Last minute! Hold {targetW}! Don't touch that dial!"],
  [2, 'One minute! This is the part where the music swells and the price drops!'],
  [3, "Sixty seconds! Like our warranty: short, and it doesn't cover this!"],
  [4, "Final minute! Quit now and you're the black-and-white footage of a guy falling over!"],
  [5, "Last minute! Dig in! Don't make me run this damn demo again!", P],
  [3, "Last minute and {deficitW} short! The product works, folks! The rider's what's broken!", when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, '{pct}% of target! Folks, it really works! Give it up!'],
  [1, "That's how it's done! Wow! Amazing! Incredible!"],
  [2, "Look at that result! And no, we didn't pay this rider! Yet!"],
  [3, "Solid interval! I'm using this clip in the ad! You get nothing!"],
  [4, '{pct}% of target! Folks, results not typical! Seriously, this never happens!'],
  [5, 'Damn, good interval! Somebody check those legs for hidden wires!', P],
  [2, "Set complete! And if you call in the next ten minutes, we'll double it! Free!", when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, 'Came in at {pct}%! Hey, every product has a learning curve!'],
  [2, '{pct}% of target! Are you tired of THIS? The folks at home certainly are!'],
  [3, "Average {avgW}, target {targetW}! That's what we call the 'before' picture!"],
  [3, "That interval broke on first use! Luckily, the warranty doesn't cover you either!"],
  [4, '{pctUnder}% under! Folks, this rider is not a paid actor! You can tell!'],
  [4, "Under target! Even our knockoff version would've done better, and it's mostly glue!"],
  [5, "{pct}%? That was a half-assed demo! I'm going to need a new rider and a new career!", P],
])

b.add('under_target', [
  [1, 'Hey, {deficitW} watts short! Call now and get those watts back!'],
  [1, "{power} watts! The target's {targetW}! There's got to be a better way!"],
  [2, 'Under target! Are you tired of pedaling like this? Me too! Me too!'],
  [3, "{power} watts? Folks, I've demoed kitchen gadgets with more output! Broken ones!"],
  [4, "{deficitW} watts short! I'm not saying you're the 'before' picture. The lawyers say I can't."],
  [5, "Under target again! Folks, I've sold a lot of junk, but this? Damn, this is junk!", P],
  [3, "{pct}% of target! That's not a workout, that's a free trial you're not even using!", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "Whoa, {surplusW} over already! Easy! Don't use the whole product in the first minute!"],
  [3, "{power} when the target's {targetW}? Hot open! Like most of my launches! Watch for the crash!"],
  [4, "Too hot too early! You'll burn out faster than my last product line! Recall pending!"],
])

b.add('cadence_sag', [
  [1, 'Cadence slipping! Spin it up! Faster, faster!'],
  [2, "Cadence {cadence}! Down {cadenceDrop}! Speed it up, this segment's sponsored!"],
  [2, 'Cadence sag! Quick feet! Sold separately!'],
  [3, "Cadence {cadence}! Folks, you've seen the slow-motion replay. This is the live version!"],
  [3, 'Your cadence is dropping faster than our prices after midnight!'],
  [4, '{cadence} rpm! Is that pedaling, or the demo of a broken egg-beater?'],
  [5, 'Cadence down {cadenceDrop} rpm! Spin, damn it! This is live television!', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}, over your cap of {hrCap}! Ease off a little, folks! Safety first!'],
  [2, "{hr} bpm! Whoa! Back it off! Our insurance doesn't cover this!"],
  [3, 'Heart rate over the cap! Dial it back! This product is for adults, not heroes!'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? Strap glitch! Or you just saw the price!'],
  [2, '{hr} bpm while barely pedaling! Wet the strap! Batteries not included!'],
  [3, 'That heart-rate spike is the most exciting thing on this channel tonight! Strap glitch, probably!'],
])

b.add('stopped_pedaling', [
  [1, "We'll be right back after these messages!"],
  [1, 'Break time! Grab some water! Stay tuned!'],
  [2, "Pedals stopped! Folks, that's not a malfunction! That's the user!"],
  [3, 'Stopped at {elapsedMin} minutes! Like most of our customers! Nobody reads the manual!'],
  [4, 'You stopped! The flywheel kept going! Folks, the flywheel is our best spokesperson!'],
  [5, "Stopping? Hell, why not! It's not like we're on live television! Oh wait!", P],
])

b.add('resumed', [
  [1, "And we're back! Welcome back to the show!"],
  [2, 'Back after {pausedS}! Thanks for holding! Your call is important to us!'],
  [4, "You're back! We'd already cut to the testimonials!"],
])

b.add('skipped_interval', [
  [1, "Skipped one! Hey, that's what the fast-forward button is for!"],
  [2, 'Skipped {segmentLabel}! A bold choice! Not covered by the warranty!'],
  [3, "You skipped an interval! That's like buying the deluxe set and using the box!"],
  [3, "Skipping intervals! Folks, this rider is why we print 'some assembly required'!"],
  [4, 'Skip! Somewhere, a product designer is weeping into a prototype!'],
  [5, 'You skipped it? Damn! Even our returns department works harder than that!', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}! Bonus content! At no extra cost!'],
  [3, "You added {extraS}? Voluntarily? Folks, no customer has ever done that!"],
  [4, "Extra time! That's what we call an upsell! And you bought it!"],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%! The economy model! Very sensible!'],
  [2, '{intensityPct}%! Now available in Lite!'],
  [3, 'Intensity down! Folks, this rider just downgraded from deluxe to the floor model!'],
  [3, 'Down to {intensityPct}%! Still works! Mostly! Results not guaranteed!'],
  [4, "Turning it down to {intensityPct}%? That's the version we sell to people who return things!"],
  [5, '{intensityPct}%? Hell, why not buy a couch with pedals!', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%! Now with extra power!'],
  [3, "You turned it UP? Folks, the deluxe edition! Let's see if the legs are compatible!"],
  [4, '{intensityPct}%! New and improved! Side effects may include regret!'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%! Supplies are limited! Save some!'],
  [2, "{wbalPct}% W′bal left! Hurry, while supplies last! They're not lasting!"],
  [2, 'Reserves low! Ride smart! Smarter than our target customer!'],
  [3, 'Your W′bal is lower than our production costs, and those are basically zero!'],
  [4, 'W′bal {wbalPct}%! You spent it all like a guy who found the shopping channel at 3 a.m.!'],
  [5, 'W′bal at {wbalPct}%! Sold out! Damn, you blew the whole inventory!', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty! Running on pure enthusiasm now, folks!'],
  [3, 'Sold out! The tank is empty! No backorders!'],
  [4, 'Zero W′bal! Folks, this unit is out of stock. Permanently, by the look of it.'],
])

b.add('pr', [
  [1, 'New {prLabel} PR! Folks, it really works!'],
  [1, "That's a new {prLabel} best! Call your friends! Call everyone!"],
  [2, "{prLabel} personal record! {power} watts! Folks, that's real! Not a dramatization!"],
  [3, "A {prLabel} PR! I'm putting this in the commercial! You'll get nothing!"],
  [4, 'New {prLabel} best! Results not typical! Results not typical at all for you!'],
  [5, '{prLabel} PR! Damn! Somebody get this rider a testimonial and a lawyer!', P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}! Projected {projectedFtp}! Keep it rolling, folks!'],
  [2, "Minute {minute}! Still here! Folks, that's customer retention!"],
  [3, "Minute {minute}! Projected {projectedFtp}! And that's before shipping and handling!"],
  [1, "Minute {minute}! Easy start! Don't use the whole product on day one!", when(lte('minute', 3))],
  [3, 'Minute {minute}! Everyone loves it in the first week! Talk to me at minute twelve!', when(lte('minute', 3))],
  [2, 'Minute {minute}! Final stretch! Operators are standing by!', when(gte('minute', 15))],
  [4, "Minute {minute}! Whatever you're saving for later, there is no later! This offer ends now!", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}! Projected {projectedFtp}, {projectedGain} up! But wait, there's more! Probably! Don't blow it!",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! It really works, folks!', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} watts to {ftpNew}! Results not typical! Seriously, we checked!', when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn! Get this rider on the box!', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}! Hey, every product has a recall!', when(gt('ftpDrop', 0))],
  [3, "{ftpNew}, down {ftpDrop} from {ftpOld}! Folks, this is the 'before'! Call now!", when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}! Same great product, same great price!', when(eq('ftpGain', 0))],
  [1, "Test complete! FTP {ftpNew}! And that's not all!"],
])

b.add('workout_complete', [
  [1, "That's our show! Thank you, folks, you've been wonderful!"],
  [1, 'Workout complete! {elapsedMin} minutes! Call now to order another!'],
  [2, "Done! NP {np}! Folks, that's a real number! Our lawyers checked!"],
  [2, "{kj} kJ of work! That's enough to run a demo blender for a week!"],
  [3, "You finished! Folks, this is the 'after' picture! Well, it's an 'after' picture!"],
  [4, "Workout complete! Order now, and we'll send a second rider to do it properly!"],
  [5, "That's a wrap! Damn good show! Shame nobody was watching!", P],
])

b.add('ride_bailed', [
  [1, "Leaving early? Hey, there's always the thirty-day trial!"],
  [2, "Leaving at {elapsedMin} minutes? Folks, that's what we call a return!"],
  [3, "Bailed! Don't worry, you can still pay in four easy installments!"],
  [3, "Early exit! We'll tell the viewers it was a technical difficulty!"],
  [4, 'Quitting already? I had a whole second product to sell you! It was this ride again!'],
  [5, 'You bailed? Hell! No refunds, no exchanges, no respect!', P],
])

b.add('fueling_reminder', [
  [1, 'Snack time! Eat something! Snacks sold separately!'],
  [1, "Fuel check! Carbs in! Watts out! It's that simple!"],
  [2, "Fuel up! Call now and we'll throw in a second gel! You have to eat it yourself!"],
  [3, 'Eat something! Running on empty is not a feature!'],
  [4, "{elapsedMin} minutes in! Eat now, or you'll bonk on live TV!"],
  [5, 'Eat a damn gel! Hungry riders make terrible testimonials!', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water! Hydration: now with zero calories!'],
  [2, 'Hydration break! Folks, the bottle comes free with the bike!'],
  [3, 'Drink! Our scientists say water works! Our scientists are a guy named Doug!'],
])

b.add('distress', [
  [1, 'Cut the cameras. Ease off and breathe. Stop if something feels wrong.'],
  [1, 'No sales pitch now. Soft-pedal or stop. You matter more than the workout.'],
])

b.add('idle_banter', [
  [1, "You're doing great! That's not a pitch! That's just true!"],
  [1, 'Keep going! Stay tuned! The best part is coming up!'],
  [2, '{elapsedMin} minutes in! Folks, look at that commitment! Is it real? Call to find out!'],
  [2, "Power {power}, cadence {cadence}! Steady numbers! Folks, that's quality you can measure!"],
  [2, "Here's a testimonial: 'I used to coast. Now I coast faster.' Gary. Not a real person."],
  [3, 'This bike folds away under the bed! Your effort folded away ten minutes ago!'],
  [3, "A real customer writes: 'I was skeptical, then I was tired.' Results not typical."],
  [3, 'Fine print, read fast: results may vary, legs may fail, effort sold separately!'],
  [4, 'Tired of thighs that rub together and produce nothing? Introducing: pedaling!'],
  [4, 'You bought the trainer, the fan and the strap! And you still pedal like a free sample!'],
  [5, 'Are you embarrassed by your own power numbers? You should be! Call now!'],
  [5, "You're pedaling like a guy assembling furniture with no instructions! Move, damn it!", P],
])

b.add('segment_start', [[5, "{targetW} watts! Call now and we'll throw in a second fucking interval absolutely free!", P]], [HARD])
b.add('under_target', [[5, "{power} watts! That's fucking embarrassing on national television!", P]])
b.add('idle_banter', [[5, "This pace is bullshit! Folks, I've sold a lot of junk, but never this slowly!", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Folks, welcome to the show! Tonight's product is a fucking miracle! It's you! Allegedly!", P],
  [4, 'Clip in! Tonight only: a full hour of me selling your shit effort to strangers!', P],
])
b.add(
  'segment_start',
  [
    [2, "{targetW} watts! It's so easy, anyone can do it! Fuck, I hope that includes you!", P],
    [5, "{targetW} watts for {remainingS}! Don't call with excuses! Operators hang up on that shit!", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds! Call now! Operators are standing the fuck by!', P]])
b.add('halfway', [[4, 'Halfway! Half the interval, all the shit performance! Order now!', P]])
b.add('last_minute', [[3, "Last minute! If this rider quits now, I'm losing my fucking mind on live TV!", P]])
b.add('segment_end_success', [
  [1, "That was fucking fantastic! Get the cameras on this rider!", P],
  [5, 'You hit it? Shit! The whole ad was built around you failing!', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%! Folks, that was a shitty demo! Roll the testimonials! Quick!", P],
  [5, "Average {avgW}, target {targetW}! That's not a gap, that's a fucking class-action lawsuit!", P],
])
b.add('under_target', [
  [2, "{deficitW} watts short! That's discount-bin bullshit! Act now and fix it!", P],
  [4, "{power} watts? My demo blender puts out more than that, and it's a fucking prop!", P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}! That's a fucking defective unit! Send it back!", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping? Fantastic! That's fucking dead air on live TV, folks!", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}! Folks, that's the shit we warn you about in the fine print!", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? That's some knockoff, made-in-a-basement shit!", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%! You blew the whole fucking budget on the first commercial!', P]])
b.add('pr', [[2, '{prLabel} PR? Holy shit, folks! It actually works!', P]])
b.add('ftp_test_result', [[4, 'FTP {ftpNew}! Put that shit on the box! In big letters! Bigger!', P]])
b.add('workout_complete', [
  [1, "That's the show! Honestly? Fucking fantastic! Roll the credits!", P],
  [5, 'Done! {tss} TSS! Not bad for someone who opened like a shit demo!', P],
])
b.add('ride_bailed', [[5, 'Leaving at {elapsedMin} minutes? Folks, this sorry piece of shit just walked off the set!', P]])
b.add('fueling_reminder', [[3, 'Eat something! Hangry you is a shit spokesperson!', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}! Not bad! Not great! Honestly kind of shit! Order now!', P],
  [4, "This ride has the energy of a 3 a.m. rerun! And I'm fucking in the rerun!", P],
  [5, "You call this suffering? I've watched people test can openers with more fucking passion!", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! Folks, give it up for {place}!'],
    [2, '{place}! Now available in {place}! Not in stores!'],
    [3, '{place}! We filmed a commercial here once! They asked us to leave!'],
    [4, "We are in {place}! The locals didn't order this, but they're getting it!"],
    [5, '{place}! {kmLeft} km to go, and this delivery is late as hell!', P],
    [5, '{place}! {kmLeft} km to go! Please allow six to eight weeks for delivery!'],
  ],
  NOT_END,
)
// NOT_END as well, so these outrank the generic lines above at a border or summit.
b.add('journey_milestone', [
  [1, 'Welcome to {place}! Now shipping internationally!'],
  [3, '{place}! Customs let you through! They checked you for value and found none!'],
], [eq('milestoneKind', 'border'), ...NOT_END])
b.add('journey_milestone', [
  [1, "The top of {place}! Folks, what a view! And it's included!"],
  [3, 'You got up {place}! Folks, this is not a dramatization! It just looks like one!'],
], [eq('milestoneKind', 'summit'), ...NOT_END])
b.add('journey_milestone', [
  [1, "Halfway! But wait, there's more! Exactly as much more!"],
  [3, 'Halfway through {journeyName}! The second half ships separately!'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, "{place}! That's our show! {journeyName}, done!"],
  [3, "{place}! {kmDone} km! Folks, it really works! I'm as shocked as you are!"],
], [eq('milestoneKind', 'finish')])

export const INFOMERCIAL_HOST: PersonaPack = {
  meta: {
    id: 'infomercial-host',
    name: 'The Infomercial Host',
    tagline: "But wait, there's more! Every interval sold at full volume. Operators are standing by.",
    voiceHint: { rate: 1.3, pitch: 1.1, preferVoices: ['Superstar', 'Fred', 'Ralph', 'Tom'] },
  },
  lines: b.build(),
}
