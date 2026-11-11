// Eric Andre: a parody of Eric André's comedic persona, requested by the user.
// The bit: the workout is a talk show falling apart around the rider. He
// screams, smashes the desk, interviews guests who never show up (your FTP,
// your motivation), whispers and then SCREAMS, throws absurd non sequiturs,
// yells "Bird up!" and "Let me in!", and the set keeps catching fire. All the
// chaos is original; no sketches from his show, no co-host, no other real
// people. Caps are screaming; text-to-speech reads them louder in spirit.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('eric-andre')

b.add('ride_start', [
  [1, "WELCOME TO THE SHOW! I'm so glad you're here! Nobody else came! Let's ride!"],
  [1, 'Hi. Hello. Welcome. ... THE SHOW HAS STARTED! PEDAL!'],
  [2, "Tonight's guest is {workoutName}! It's backstage! It won't come out! SOMEBODY GO GET THAT THING!"],
  [3, 'Look at you, all clipped in. You look like a substitute teacher who lost a bet.'],
  [4, 'I just smashed my desk to celebrate you being here. The desk was worth more than your FTP.'],
  [5, 'Welcome back to the worst show on Earth! Starring you! The set is on fire and so is my career!'],
  [2, "FTP TEST! I put a live bee in the power meter for accuracy! Don't ask!", when(rideKind('ftp-test'))],
  [3, 'A free ride. No plan. No script. No producer. Finally, a show I understand.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, '{targetW} watts! LET ME IN! LET ME INTO THE INTERVAL!'],
    [1, "Here we go! {targetW} watts for {remainingS}! The band is playing! There's no band!"],
    [2, '{targetW} watts! I just threw my chair through the window! For you!'],
    [3, 'psst. hey. come here. closer. {targetW} watts. ... GO! GO! GO!'],
    [4, "{targetW} watts! My doctor says I'm not allowed to watch you struggle. I'm doing it anyway!"],
    [5, '{targetW} watts! You pedal like a lasagna falling down a staircase! PROVE ME WRONG!'],
    [3, 'Rep {rep} of {reps}! I keep counting and the numbers keep CHANGING! Is that normal?!'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'LAST REP! The studio is flooding! Finish before the water reaches the outlets!'],
    [4, "Final rep! The network cancelled us an hour ago! WE'RE STILL ON THE AIR!"],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! SCREAM WITH YOUR LEGS!'],
    [4, 'MAX EFFORT! I just ate the cue cards! There is no script! ONLY WATTS!'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp! It goes UP! Like my blood pressure! Like my rent!'],
    [4, "The ramp! Every minute it's harder! I designed it while screaming into a bucket!"],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup. shhh. Gentle. Gentle. Like a little baby deer. ... WARM UP!'],
    [3, "Warmup! The only segment you haven't ruined! YET!"],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW}. Smooth jazz. Smooth jazz. Smooth jazz. SMOOTH JAZZ!'],
    [3, 'Steady at {targetW} for {remainingS}. Boring! I LOVE BORING! I hate boring!'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery! Breathe! The commercial break is happening INSIDE YOUR BODY!'],
    [2, "Rest for {remainingS}! I'll fill the silence by screaming! AAAAAH! That's the whole segment."],
    [4, "Recovery. You're coasting so hard the trainer thinks somebody unplugged it."],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride! Improv segment! Do whatever you want! NOT THAT!'],
    [3, 'No target for {remainingS}! No rules! I fired the rules! The rules took the couch!'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown! The show is wrapping! Somebody turn off the fog machine! WE NEVER HAD A FOG MACHINE!'],
    [3, 'Cooldown! Roll the credits! The credits are just your excuses, scrolling for ten minutes!'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds! Places! PLACES! Where is everyone?!'],
  [1, 'Ten seconds! Stand by! ... Sit by! PEDAL BY!'],
  [2, 'Ten seconds to {targetW}! Cue the explosion! WHO CUED THE EXPLOSION?!'],
  [3, 'shh. ten seconds. ... TEN SECONDS!'],
  [4, 'Ten seconds! Your excuses are in the green room eating all the snacks!'],
  [5, 'TEN SECONDS! I smashed the countdown clock! THERE IS NO TIME! THERE IS ONLY YOU!'],
  [2, 'Ten seconds to all out! Bird up! BIRD UP!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway! You're doing amazing! I'm crying! I'm not crying! I'm crying!"],
  [2, 'Halfway! {remainingS} left! Somebody bring me a cake! For no reason!'],
  [3, "halfway. hey. come here. are you okay? ... BECAUSE YOUR LEGS AREN'T!"],
  [4, 'Halfway! Your power line looks like I drew it on a moving bus!'],
  [5, "Halfway! Nobody's clapping! The audience is a mannequin! Hell, even the mannequin left!", P],
  [5, 'Halfway! Half the interval! Half a person! You are pedaling at half a person!'],
  [2, "Halfway and RIGHT ON TARGET! This is the scariest thing that's ever happened on this show!", when(gte('pct', 98))],
  [3, 'Halfway and {deficitW} watts short! I am screaming into my own hand! LOOK AT MY HAND!', when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left! Big finish! The confetti cannon is loaded! With soup!'],
  [2, 'Last minute! Hold {targetW}! I am standing on the desk! Do not look at me! LOOK AT ME!'],
  [2, "One minute! I'm counting down from sixty! Sixty! Twelve! Nine hundred!"],
  [3, 'Sixty seconds. Every episode ends. Mostly when security shows up.'],
  [4, 'Final minute! Quit now and I set my own shoes on fire! Again!'],
  [5, "LAST MINUTE! Stop now and I'm moving into your house! I already have a key, damn it!", P],
  [5, 'LAST MINUTE! Pedal like the studio audience is chasing you! THEY ARE! THEY HAVE FORKS!'],
  [3, 'Last minute and {deficitW} short! I am eating the microphone! PEDAL!', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, "{pct}% of target! YES! Release the doves! I only have one dove! It's a seagull!"],
  [1, "THAT'S THE ONE! Great interval! I'm hugging the camera guy!"],
  [2, "You did it?! I didn't prepare for success! I only wrote a bit about failure!"],
  [3, 'Solid interval. I hate that. I love that. I am confused. GOOD JOB!'],
  [4, '{pct}% of target! The trainer just asked for a restraining order out of respect!'],
  [5, 'Good interval. Damn. Now I have to throw away my YOU SUCK banner. I spent all day painting it.', P],
  [2, 'Set complete! Every rep! Somebody tackle me! Not literally! LITERALLY!', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, "{pct}% of target. Hey. It's okay. ... IT'S NOT OKAY! Kidding. Mostly."],
  [2, '{pct}%! The target just left the building! It took my car!'],
  [3, 'Average {avgW}, target {targetW}! That gap is so big I could store my cousins in there!'],
  [3, 'That interval had the energy of a wet ghost.'],
  [4, "{pctUnder}% under! I'm smashing this desk out of disappointment! Again! I'M OUT OF DESKS!"],
  [4, 'Under target! Your legs are a guest who promised to show up and is now in Ohio.'],
  [5, "{pct}%?! That wasn't an interval! That was a sad raccoon falling off a recycling bin!"],
])

b.add('under_target', [
  [1, 'Hey. psst. {deficitW} watts short. ... CLOSE THE GAP!'],
  [1, "{power} watts! The target's {targetW}! I'm just reading the cards! THE CARDS ARE ON FIRE!"],
  [2, 'Under target! I am interviewing your FTP and it refuses to answer my questions!'],
  [3, "{power} watts?! I've seen a microwave try harder! I married that microwave!"],
  [4, "{deficitW} watts short! I'm putting you in a garbage can and rolling you down a hill! Emotionally!"],
  [5, "Under target again! You're the human version of a buffering video!"],
  [3, '{pct}% of target! That is not a workout, that is a screensaver with feelings!', when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, '{surplusW} over already! Easy, easy! Save some for the second half! THERE IS A SECOND HALF!'],
  [3, '{power} when the target is {targetW}?! You came out swinging like a man who just discovered coffee!'],
  [4, "Too hot too early! You're gonna pop like a hot dog in a microwave!"],
])

b.add('cadence_sag', [
  [1, 'Cadence is slipping! Spin! Spin! Like a little ballerina!'],
  [2, 'Cadence {cadence}! Down {cadenceDrop}! Faster feet! FASTER FEET! I said FASTER FEET!'],
  [2, 'Cadence sag! Light gear! Quick feet! Big hair! WHY NOT!'],
  [3, 'Your cadence is dropping like I pushed it off the roof! I DID push it off the roof!'],
  [3, '{cadence} rpm?! Are you pedaling or slowly churning butter for a pilgrim?'],
  [4, "Cadence {cadence}! That's not a pedal stroke, that's a hostage video!"],
  [5, 'Cadence down {cadenceDrop}! SPIN, damn it! The flywheel is filing for divorce!', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}! Over your cap of {hrCap}! Ease off a little! gently. gently.'],
  [2, '{hr} bpm! Your heart is doing my job! Back it off!'],
  [3, "Heart rate over the cap. Okay. Calm voice. Dial it back. I'll scream later."],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts?! Either your strap is glitching or a ghost just walked in! IS THERE A GHOST?!'],
  [2, '{hr} bpm while barely pedaling! Did you see a bird? BIRD UP!'],
  [3, 'That heart-rate spike is fake! I know fake! I host a fake talk show!'],
])

b.add('stopped_pedaling', [
  [1, 'Paused! Take your time! I will be over here, eating a candle!'],
  [1, "Break time! Water! Breathe! I'll guard the bike!"],
  [2, 'Pedals stopped! Is this a bit?! I love a bit! What is the bit?!'],
  [3, 'Stopped at {elapsedMin} minutes! Is the show over?! NOBODY TELLS ME ANYTHING!'],
  [4, 'You stopped! The flywheel is still going! The flywheel has a better work ethic and NO LEGS!'],
  [5, "Oh, we're stopping?! Hell yeah! I'll interview the empty saddle! Saddle, how do you feel?! ABANDONED!", P],
])

b.add('resumed', [
  [1, "We're back! Welcome back to the show!"],
  [2, 'Back after {pausedS}! I aged forty years! Look at my beard!'],
  [4, "You're back! I already sold your bike to a raccoon!"],
])

b.add('skipped_interval', [
  [1, 'Skipped it! Hey! Every show cuts a segment!'],
  [2, 'Skipped {segmentLabel}! Bold editing! Our editor is a goat!'],
  [3, "You skipped an interval! That's like booking a guest and then hiding under the desk! I DO THAT!"],
  [3, 'Skipping intervals?! I was told there would be intervals! I was LIED TO!'],
  [4, 'Skipped! Somewhere your future self is screaming! I know, because I am your future self!'],
  [5, 'You skipped it?! Damn! I smashed a whole desk for that interval!', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}! Bonus footage!'],
  [3, 'You added {extraS}?! Voluntarily?! Who are you?! SECURITY!'],
  [4, "Extra time! You want more?! I'm calling your mom! She needs to know!"],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%! Okay! Gentle! Nice and gentle!'],
  [2, '{intensityPct}%! Lowering the bar! I LOVE LOW BARS! I live under one!'],
  [3, 'Intensity down! You negotiated with your legs, and your legs brought a lawyer!'],
  [3, 'Down to {intensityPct}%! The workout is crying in the parking lot! Go apologize!'],
  [4, "Turning it down to {intensityPct}%?! Then I'm turning myself down too. this is me, turned down. ... I HATE THIS!"],
  [5, '{intensityPct}%?! Hell, why not just lie on the floor and call it a podcast?', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%! The crowd goes wild! The crowd is a lamp!'],
  [3, 'You turned it UP?! Who hurt you?! Actually, keep going, whatever this is works!'],
  [4, "{intensityPct}%! You're crazier than me! THAT'S NOT POSSIBLE!"],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%! Save some! For the after-party!'],
  [2, '{wbalPct}% W′bal left! The battery icon is red! The battery icon is SCREAMING!'],
  [2, 'Reserves low! Ride smart! Ride like a genius! Ride like a genius horse!'],
  [3, "Your W′bal is lower than this show's budget, and the budget is a coupon."],
  [4, 'W′bal {wbalPct}%! You spent it all like a toddler with a credit card!'],
  [5, "W′bal {wbalPct}%! Your legs just handed in their two weeks' notice! Damn it, ride smarter!", P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty! Running on pure chaos now! WELCOME TO MY WORLD!'],
  [3, "The tank is empty! There's no tank! There never was a tank! I SOLD THE TANK!"],
  [4, 'Zero W′bal! You burned every match! You burned the matchbook! You burned my studio!'],
])

b.add('pr', [
  [1, 'New {prLabel} PR! Confetti! CONFETTI! Somebody find the confetti!'],
  [1, "That's a new {prLabel} best! I'm so proud I'm smashing my desk! Out of joy!"],
  [2, '{prLabel} personal record! {power} watts! I am going to scream! AAAAAH! I screamed!'],
  [3, 'A {prLabel} PR?! I had a whole bit about you being bad! I set the bit on fire! It is ash now!'],
  [4, 'New {prLabel} best! Who are you?! Where is the usual guy?! Did you eat the usual guy?!'],
  [5, "{prLabel} PR! Damn! BIRD UP! I don't know why I said that! FELT RIGHT!", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}! Projected {projectedFtp}! Keep it rolling! Roll it like a burrito!'],
  [2, 'Minute {minute}! Still here! Still pedaling! Still MY GUEST!'],
  [3, 'Minute {minute}. Projected {projectedFtp}. psst. that number is lying. ... OR IS SHE?!'],
  [1, "Minute {minute}! Easy start! Don't use your best scream yet!", when(lte('minute', 3))],
  [3, 'Minute {minute}! Everybody feels great this early! I felt great at minute three once, then I ate a lamp!', when(lte('minute', 3))],
  [2, 'Minute {minute}! Final stretch! SMASH THE DESK WITH YOUR LEGS!', when(gte('minute', 15))],
  [4, "Minute {minute}! Whatever you're saving, spend it! Spend all of it! Buy a boat!", when(gte('minute', 17))],
  [
    2,
    'Minute {minute}! Projected {projectedFtp}, {projectedGain} up! Do NOT blow this! I believe in you! I THINK!',
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! Release the balloons! WE HAVE ONE BALLOON!', when(gt('ftpGain', 0))],
  [3, "Up {ftpGain} watts to {ftpNew}! I'm getting that number tattooed on my knee!", when(gt('ftpGain', 0))],
  [5, "{ftpNew}! Up {ftpGain}! Damn! I'm quitting the show to become your manager!", whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Hey. shh. These things happen. ... THESE THINGS HAPPEN!', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}! The power meter lied to me! I am suing the power meter!', when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}! No change! Nothing happened! IS THIS A PRANK?!', when(eq('ftpGain', 0))],
  [1, "Test done! FTP {ftpNew}! That's the episode!"],
  [4, 'FTP {ftpNew}! Somebody write that on my forehead! Not the permanent marker! THE PERMANENT MARKER!'],
])

b.add('workout_complete', [
  [1, "That's the show! Thank you! Goodnight! I love you! Get out!"],
  [1, 'Workout complete! {elapsedMin} minutes! Somebody hand this person a trophy! A real one! Not the lamp!'],
  [2, "Done! NP {np}! That's a real number! I checked it with my mouth!"],
  [2, "{kj} kJ of work! That's enough energy to power my desk-smashing for a week!"],
  [3, 'You finished! Against all odds! And against my wishes!'],
  [4, 'Workout complete. The trainer needs therapy now. I booked the therapy. The therapist is me.'],
  [5, "That's a wrap! Damn good episode! We'll never air it! THE TAPES ARE ON FIRE!", P],
])

b.add('ride_bailed', [
  [1, 'Early exit! Hey! Sometimes the show gets cancelled!'],
  [2, "Leaving at {elapsedMin} minutes?! You're walking off your own show! That's MY move!"],
  [3, 'Bailed! You left like a guest who saw the set and remembered a dentist appointment!'],
  [3, "Early exit! I'll tell everyone you were abducted! It's more believable!"],
  [4, 'Quitting already?! I had nine more desks to smash for you!'],
  [5, 'You bailed?! Hell, even the guest who never showed up stayed longer than you!', P],
])

b.add('fueling_reminder', [
  [1, 'Snack time! Eat something! Not the remote!'],
  [1, 'Fuel check! Carbs in! Screams out!'],
  [2, 'Eat a gel! I ate a crayon once! It was blue! Eat a gel!'],
  [3, 'Eat something! Hungry you is like me, but without the charm!'],
  [4, "{elapsedMin} minutes in! Eat now or you'll bonk and I'll have to interview the floor!"],
  [5, 'Eat a damn gel! Your stomach is screaming louder than me! THAT SHOULD NOT BE POSSIBLE!', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water! Hydrate! Hydrate! HYDRATE!'],
  [2, "Hydration break! The bottle is right there! It's not a prop! EVERYTHING ELSE HERE IS A PROP!"],
  [3, 'Drink! You are sweating like a candle at a hot yoga class!'],
])

b.add('distress', [
  [1, 'Okay. No bits. Ease off and breathe. Stop if something feels wrong.'],
  [1, 'The show is paused. Soft-pedal or stop. You matter more than the workout.'],
])

b.add('idle_banter', [
  [1, "You're doing fine! That's not a bit! I'm being sincere! ... THAT WAS THE BIT!"],
  [1, 'Keep going! The crowd loves you! The crowd is a coat rack!'],
  [2, 'Bird up! ... Sorry. Wrong segment. Same segment. Keep pedaling!'],
  [2, '{elapsedMin} minutes in and still pedaling! I have been screaming the whole time! You just could not hear me!'],
  [2, 'Power {power}, cadence {cadence}! Consistent! TOO consistent! Are you a robot?! BLINK TWICE!'],
  [3, "My next guest is your motivation! ... It didn't show up! It never shows up!"],
  [3, 'psst. hey. come here. ... I bought a horse.'],
  [3, "Fun fact: I'm sitting in a bathtub full of beans. Unrelated: PEDAL HARDER!"],
  [4, 'You ride indoors so nobody sees you. Same reason I film this show in a basement!'],
  [4, 'Carbon wheels on a trainer?! The wheels are crying! They wanted to see the sun!'],
  [4, "Why is your face doing that?! STOP DOING THAT WITH YOUR FACE! ... No, keep going, it means you're working."],
  [5, 'You look like a melted candle in lycra! A SEXY melted candle! No! Just a melted candle!'],
  [5, "I've seen houseplants with a more explosive sprint! I've seen houseplants WIN!"],
])

b.add('segment_start', [[5, '{targetW} watts! Quit stalling and get on the fucking pedals! I ATE MY SHOE FOR THIS!', P]], [HARD])
b.add('under_target', [[5, "{power} watts?! WHAT THE FUCK IS THAT?! That's not a number, that's a sad noise!", P]])
b.add('idle_banter', [[5, 'This pace is bullshit! I am smashing my desk in protest! THE DESK WAS ALREADY BROKEN!', P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "WELCOME TO THE FUCKING SHOW! Sorry! Welcome to the show! Let's ride!", P],
  [4, "Clip in! Tonight's episode: an hour of me screaming at your shit effort! Sponsored by nobody!", P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts! Easy, right?! RIGHT?! Oh fuck, this is gonna be beautiful!', P],
    [5, '{targetW} watts for {remainingS}! I can smell your excuse from here! It smells like shit!', P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds! Holy shit! Ten seconds! Who scheduled this?!', P]])
b.add('halfway', [[4, 'Halfway! Half the interval, half the effort! What the fuck are we doing here?!', P]])
b.add('last_minute', [[3, "Last minute! The set is collapsing! Don't fuck up the finale!", P]])
b.add('segment_end_success', [
  [1, "Okay, that was fucking incredible! I'm crying! I'm smashing things! GOOD JOB!", P],
  [5, 'You hit it?! Fuck! I had a whole meltdown planned!', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%?! That interval was a shitty puppet show, and I'm the puppet!", P],
  [5, 'Average {avgW}, target {targetW}! That gap has its own fucking talk show!', P],
])
b.add('under_target', [
  [2, "{deficitW} watts short! That's some discount-store bullshit!", P],
  [4, '{power} watts?! My fucking blender pulls more than that! MY BLENDER HAS A GYM MEMBERSHIP!', P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}! You're pedaling like a fucking sloth on dial-up!", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping?! Great! Dead air! I'll just fucking scream until you come back! AAAAH!", P]])
b.add('skipped_interval', [[3, 'Skipped {segmentLabel}?! LET ME IN! That interval was fucking mine!', P]])
b.add('intensity_down', [[4, "{intensityPct}%?! You turned it down?! That's not training, that's a fucking nap with pedals!", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%! The tank is on fire! Who set the fucking tank on fire?!', P]])
b.add('pr', [[2, "{prLabel} PR?! Holy shit! I'm throwing my chair! I'M THROWING YOUR CHAIR!", P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}! Put that shit on a billboard! I bought a billboard! It's in a lake!", P]])
b.add('workout_complete', [
  [1, "That's the show! Honestly? You were fucking great! GET OUT!", P],
  [5, "That's a wrap! {tss} TSS! Not bad for someone who started like absolute shit!", P],
])
b.add('ride_bailed', [[5, "Leaving at {elapsedMin} minutes?! Walking off mid-show?! That's fucked! Walking off is MY bit!", P]])
b.add('fueling_reminder', [[3, 'Eat something! I can hear your stomach on my fucking microphone!', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}! Solid! Boring as shit! I LOVE THAT! I hate that!', P],
  [4, "This ride has the energy of a fucking empty studio at four in the morning! I know! I'm in one!", P],
  [5, "You call this suffering?! I've seen shittier efforts from a man in a bear costume, and he was asleep!", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! Give it up for {place}! Is anybody here from {place}?!'],
    [2, "{place}! I've never been here! I'm not here now! Nobody is here!"],
    [3, '{place}! They gave me the key to the city! I swallowed it!'],
    [4, '{place}! The locals are fleeing! They heard you breathing!'],
    [5, '{place}! {kmLeft} km to go! Damn! The tour bus is on fire, and you are the driver!', P],
    [5, '{place}! {kmLeft} km left! I am losing my mind! I left it back at the last town!'],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, 'Welcome to {place}! New country! Same screaming!'],
  [3, '{place}! They let you in! LET ME IN TOO! LET ME IN!'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, "The top of {place}! You're on top of the world! I'm on top of my desk!"],
  [3, 'You climbed {place}! The mountain is crying! I am also crying! The mountain and I are in love!'],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway! Intermission! Somebody bring out the dancing lobster!'],
  [3, 'Halfway through {journeyName}! The second half is where the set catches fire! BRACE!'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, "{place}! That's the show! {journeyName}, done! ROLL CREDITS!"],
  [3, '{place}! {kmDone} km! I would roast you, but I just fainted from respect!'],
], [eq('milestoneKind', 'finish')])

export const ERIC_ANDRE: PersonaPack = {
  meta: {
    id: 'eric-andre',
    name: 'Eric Andre',
    tagline: "Screaming, desk-smashing talk-show chaos. Tonight's guest is your interval. It never showed up.",
    voiceHint: { rate: 1.3, pitch: 1.1, preferVoices: ['Eddy', 'Superstar', 'Jester', 'Alex'] },
  },
  lines: b.build(),
}
