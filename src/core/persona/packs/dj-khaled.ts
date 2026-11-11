// DJ Khaled: the hype man's public persona, requested by the owner. It riffs
// only on his catchphrases and well-known public moments: "Another one!", "We
// the best!", "Major key", "Bless up", "They don't want you to win", "Don't
// ever play yourself", "Congratulations, you played yourself", "Fan luv",
// "Say my name", calling himself a lion, the night he got lost at sea on a jet
// ski, secret keys to success and cloth talk, all shouted over the interval
// like a hype intro. The mean twist: they don't want you to win, and watching
// you ride, they have a point. He says "I", never his own name, and never
// mentions his family or any other real person.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('dj-khaled')

b.add('ride_start', [
  [1, "Bless up! We here! We on the bike! We the best! Let's go!"],
  [1, "Major key: show up. You showed up. That's one key. Let's ride."],
  [2, "Today's anthem: {workoutName}! Another one! Turn the fan up, I'm about to get loud!"],
  [3, "They don't want you to win today. I looked at your legs. I understand them. Ride anyway!"],
  [4, 'Welcome to the studio! Usually I bring in the greatest. Today I brought in you. Humbling.'],
  [5, "We the best! I counted again, and you're not in the 'we'. Pedal your way in."],
  [5, "Bless up! Today you ride, tomorrow you walk funny. Let's get this damn album started!", P],
  [2, "FTP test! They don't want you to have a new number. So we go take it. Bless up!", when(rideKind('ftp-test'))],
  [3, 'A free ride with no plan? No plan is how you get lost at sea on a jet ski. Trust me. Pick a heading!', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, '{targetW} watts for {remainingS}! Another one! We the best! Go!'],
    [1, 'Here we go! {targetW} watts! Major key: breathe. Other major key: pedal!'],
    [2, "{targetW}! Turn it up! This is the drop! You hear that? That's the drop!"],
    [3, "{targetW} watts! They've seen your last three intervals. They're not worried. Worry them!"],
    [4, "{targetW} watts! I'm shouting so loud the neighbours think you're winning. Don't tell them."],
    [5, "{targetW} watts! Don't ever play yourself! You've been playing yourself since the warmup!"],
    [3, "Rep {rep} of {reps}! Another one! I say it like it's good news. For you, it's not."],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last one! The final track on the album! Make it the hit!'],
    [4, "Last rep! The bonus track. Nobody asked for it, it's on the album anyway. Ride it!"],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! Everything you got! Lion mode! Go!'],
    [4, 'Sprint! Lion mode! You look more like a house cat that saw a cucumber, but go!'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp! Every minute, another one! Another one! Another one!'],
    [4, "Ramp time! It keeps going up, like the price of my jewellery. Your legs won't."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup! Easy! Get the blood moving! Bless up the legs!'],
    [3, "Warmup. Major key: don't peak in the warmup. You'd be surprised. Actually, you wouldn't."],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW}! Smooth like a slow jam! Cruise!'],
    [3, 'Steady at {targetW}. Nothing flashy. Like your whole personality. Hold it.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery! Breathe! Bless up the lungs!'],
    [2, 'Rest for {remainingS}! This is the skit between the songs. Relax.'],
    [4, 'Recovery. Enjoy it. The next one is coming. Another one. There is always another one.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride! Do your thing! Express yourself on the pedals!'],
    [3, "No target for {remainingS}. Freestyle! I've heard your freestyle. Keep it short."],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown! We did it! Bless up! Fan luv to you!'],
    [3, 'Cooldown. The outro. Nobody listens to the outro. Pedal anyway.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds! Get ready! We the best!'],
  [1, 'Ten seconds! Here comes the drop!'],
  [2, 'Ten seconds to {targetW}! Say my name! No, wait, save the oxygen.'],
  [3, "Ten seconds! The haters are watching. Don't give them content."],
  [4, 'Ten seconds! Major key: start pedalling before it starts. Wild concept, I know.'],
  [5, 'Ten seconds! Wipe that face, fix that posture, move your ass!', P],
  [2, 'Ten seconds to all out! Wake up the lion!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'Halfway! Bless up! You doing it! You actually doing it!'],
  [2, 'Halfway! {remainingS} left! Another half! Another one!'],
  [3, "Halfway. They bet you'd quit right here. Make them pay up."],
  [4, 'Halfway, and your posture looks like a folded lawn chair. Sit up! Look like a winner! Fake it!'],
  [5, "Halfway! Bless up, but hell, that's a lot of struggle for half of something.", P],
  [2, 'Halfway and right on {targetW}! We the best! Okay, you the best. For now.', when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. They don't want you to win, and you keep agreeing with them.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute! Finish it! Another one in the books!'],
  [2, 'Last minute! Hold {targetW}! This is the hook! Everybody knows the hook!'],
  [2, 'Sixty seconds! Major key: the last minute counts the same as the first one. Go!'],
  [3, 'One minute. Even my longest intro ends eventually. Hang on.'],
  [4, 'Final minute! Quit now and congratulations. You played yourself.'],
  [5, 'Last minute! Bless up, damn it! Dig! This is the part they put in the music video!', P],
  [3, 'Last minute and {deficitW} short. Comeback anthem. Right now. Go!', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, 'Another one! {pct}% of target! We the best!'],
  [1, "That's a hit! Bless up! Great interval!"],
  [2, "You did it! The haters had money on you failing. Somebody's broke tonight."],
  [3, 'Solid. Put it on the album. Not the single. Deep cut, track nine.'],
  [4, "{pct}% of target. I'm shocked. I had the sad violin intro all cued up."],
  [5, "You hit it? Damn! Major key, but I'm checking the trainer's batteries.", P],
  [2, 'Set done! Another one! And another! And that was the last one! Bless up!', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, "{pct}%. It's okay. Not every track is a hit. Bless up."],
  [2, "{pct}% of target. They didn't want you to win. You did them a favour."],
  [3, 'Average {avgW}, target {targetW}. Congratulations. You played yourself.'],
  [3, 'That interval was the skit, not the song. Nobody replays the skit.'],
  [4, "{pctUnder}% under. The haters don't even have to try anymore. You do their job for them."],
  [4, 'Cloth talk: some people are cut from champion cloth. You were cut from a dish towel.'],
  [5, '{pct}%? I wasted a whole hype intro on that crap?', P],
])

b.add('under_target', [
  [1, '{deficitW} watts short! Bring it up! We the best, remember?'],
  [1, '{power} watts. Target {targetW}. Major key: close the gap.'],
  [2, "Under target! The trainer's working. You're just... attending. Bring it!"],
  [3, "{power} watts? I've heard louder whispers. Turn it up!"],
  [4, "{deficitW} short! Don't ever play yourself! You're playing yourself live, on my track!"],
  [5, "Under again! Pedal, damn it! I didn't bring the whole crew out for {power} watts!", P],
  [3, "{pct}% of target. That's not a workout. That's a listening party, sitting down.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "{surplusW} over already! Easy! It's a long song!"],
  [3, "{power} watts with a target of {targetW}? You're dropping the beat in the intro. Calm down."],
  [4, "Too hot, too early. Lions stalk first, then pounce. You're pouncing on air."],
])

b.add('cadence_sag', [
  [1, 'Cadence slipping! Spin it up! Tempo!'],
  [2, 'Cadence {cadence}! Down {cadenceDrop}! Stay on the beat!'],
  [2, 'Cadence sag! The beat dropped, and not the good way! Quick feet!'],
  [3, "{cadence} rpm. That's not a beat, that's a scratched CD."],
  [4, 'Cadence {cadence}. A slow jam is a genre. This is just slow.'],
  [5, "Cadence down {cadenceDrop}! Spin, damn it! You're playing a ballad in the club!", P],
])

b.add('hr_high', [
  [1, "Heart rate {hr}, over your cap of {hrCap}. Ease off a bit. Major key: don't redline."],
  [2, "{hr} bpm. That's too many beats per minute, even for me. Back it off."],
  [3, 'Heart rate over the cap. Rest is a key too. A major one. Bring it down.'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? Strap glitch. Or you just saw my new chain.'],
  [2, '{hr} bpm while barely pedalling. Wet the strap. Seriously. Wet it.'],
  [3, 'That heart-rate spike has more hype than your whole interval. Strap glitch.'],
])

b.add('stopped_pedaling', [
  [1, 'Break! Take a breath! Bless up!'],
  [1, 'Pedals stopped. Water, towel, then we back. We always come back.'],
  [2, "We stopped? It's a skit. Okay. Short skit."],
  [3, 'Stopped at {elapsedMin} minutes. The haters just high-fived. I heard it.'],
  [4, "You stopped. The beat's still going. You're the only one off it."],
  [5, "Stopping? Hell no! The beat's still playing and you're just standing in the booth!", P],
])

b.add('resumed', [
  [1, 'We back! Another one!'],
  [2, "Back after {pausedS}! Long skit! Let's go!"],
  [4, "You're back! I almost dropped the album without you."],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Okay. Every album has a skip track.'],
  [2, "Skipped {segmentLabel}. Nobody's ever skipped one of mine, but okay."],
  [3, "You skipped one. The haters didn't even have to show up today. You handled it."],
  [3, "Skipped. Major key: you can't skip to the end of success. I looked. There's no button."],
  [4, 'Skip! Congratulations. You played yourself. On fast forward.'],
  [5, "You skipped it? Damn. That's like leaving the club before the headliner. Disrespectful.", P],
])

b.add('extended_interval', [
  [1, 'Extended {extraS}! Another one! Bonus verse!'],
  [3, 'You added {extraS}? On purpose? Fan luv! Real fan luv!'],
  [4, 'Extra time! Look at you, asking for the remix.'],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. Smart. Live to ride another one.'],
  [2, '{intensityPct}%. You turned the volume down. I never turn the volume down.'],
  [3, "Intensity down. They don't want you to win, and you just agreed in writing."],
  [3, "Down to {intensityPct}%? The workout didn't play you. You played yourself."],
  [4, '{intensityPct}%? Nobody even had to stop you. You stopped yourself. Very efficient.'],
  [5, '{intensityPct}%? Hell, why not unplug the trainer and listen to the album lying down?', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%! We the best! Turn it up!'],
  [3, 'You turned it up? Major key! Or major mistake. We find out together.'],
  [4, '{intensityPct}%! Bold! Now the legs gotta cash the check the mouth just wrote.'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Save some for the hook.'],
  [2, '{wbalPct}% left in the tank. Running on hype now.'],
  [2, 'Reserves low! Major key: pace. Pace is a key.'],
  [3, 'W′bal {wbalPct}%. You spent everything on the intro. Classic.'],
  [4, 'W′bal {wbalPct}%. You spent your matches like the label was paying.'],
  [5, 'W′bal at {wbalPct}%. You blew it all on the first verse, damn it.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Running on pure lion now.'],
  [3, "Tank's empty. I've been out of gas at sea, at night. You'll live. Pedal for shore."],
  [4, 'Zero W′bal. Nothing left. Not even a skit. Just breathing noises.'],
])

b.add('pr', [
  [1, 'New {prLabel} PR! Another one! We the best!'],
  [1, '{prLabel} personal best! Bless up! Fan luv!'],
  [2, '{prLabel} PR at {power} watts! Major key! Frame it! Put it on a chain!'],
  [3, "A {prLabel} PR? They didn't want you to have that. Look at their faces."],
  [4, 'New {prLabel} best! I had a speech ready about giving up. Throwing it in the ocean.'],
  [5, "{prLabel} PR! Damn! Somebody check the trainer, this can't be the same rider!", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}! Projected {projectedFtp}! Keep going! Bless up!'],
  [2, 'Minute {minute}! Still here! Another minute! Another one!'],
  [3, 'Minute {minute}. Projected {projectedFtp}. The haters are rooting for that to go down. Ruin their night.'],
  [1, "Minute {minute}. Easy start. Don't drop the hook in the intro.", when(lte('minute', 3))],
  [3, 'Minute {minute}. Feeling good? Everybody feels good in the intro. This album is long.', when(lte('minute', 3))],
  [2, 'Minute {minute}! Final stretch! This is the hit single! Go!', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you're saving, you're saving it for nobody. Empty it!", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, {projectedGain} up! Don't ever play yourself now!",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! Another one! We the best!', when(gt('ftpGain', 0))],
  [3, "Up {ftpGain} to {ftpNew}! They didn't want you to win. You won. Major key!", when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn! Bless up! Somebody get this rider a chain!', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Not every album goes platinum. We come back.', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. Congratulations. You played yourself for twenty minutes straight.', when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. Same number. A rerelease. Nobody buys it twice.', when(eq('ftpGain', 0))],
  [1, 'Test done! FTP {ftpNew}! Bless up!'],
])

b.add('workout_complete', [
  [1, 'Done! Another one! We the best! Bless up!'],
  [1, 'Workout complete! {elapsedMin} minutes! Fan luv, real fan luv!'],
  [2, 'Done! NP {np}! Major key: you finished. A lot of people never do.'],
  [2, "{kj} kJ! That's a lot of energy. Almost as much as one of my intros."],
  [3, "You finished. Nobody believed in you. I didn't. Look at us now. Still surprised."],
  [4, 'Workout complete. It goes on the album. Hidden track. Unlisted. On purpose.'],
  [5, 'Done. Damn. I yelled for an hour and you barely made it. We the best. Barely.', P],
])

b.add('ride_bailed', [
  [1, 'Leaving early. Okay. Even I leave the studio sometimes.'],
  [2, 'Out at {elapsedMin} minutes? You left before the hook!'],
  [3, "Bailed. The haters are throwing a party tonight. You're the reason. Fan luv, I guess."],
  [3, 'Early exit. I will put out a statement. Something about creative differences.'],
  [4, 'Quitting? I got lost at sea on a jet ski, at night, and I did not quit. You quit indoors.'],
  [5, 'You bailed? Hell! Mid-song! In front of everybody! Nobody walks off my stage!', P],
])

b.add('fueling_reminder', [
  [1, 'Snack time! Eat something! Major key: carbs!'],
  [1, 'Fuel check! Eat! Bless up the snacks!'],
  [2, 'Eat! Even I eat between tracks. Big plate. Huge plate.'],
  [3, "Eat something. They want you to bonk. Don't give them that."],
  [4, '{elapsedMin} minutes in. Eat now, or hit the wall and blame the beat.'],
  [5, 'Eat a damn gel! Hungry you is the worst feature on this album!', P],
])

b.add('hydration_reminder', [
  [1, 'Drink water! Major key: hydrate!'],
  [2, "Hydrate! The bottle's right there! Bless up the bottle!"],
  [3, "Drink. I was lost at sea once, water everywhere, still thirsty. Don't be me. Drink."],
])

b.add('distress', [
  [1, 'Hey. Ease off and breathe. Stop if something feels wrong. No hype needed right now.'],
  [1, 'Music off for a second. Soft-pedal or stop. You matter more than this workout. Bless up.'],
])

b.add('idle_banter', [
  [1, "You're doing good. That's not hype. That's facts."],
  [1, "Keep going! Major key: keep going. That's the whole key."],
  [2, '{elapsedMin} minutes! Still on the bike! The haters hate to see it!'],
  [2, "Power {power}, cadence {cadence}. Steady. I'd put it on the album. Track eleven."],
  [3, "Major key alert: the bike doesn't pedal itself. I checked. I asked a guy."],
  [3, "Cloth talk: you're not built for this. But you're here. That counts. A little."],
  [3, "I'm a lion. You're more of a hamster. On a wheel. Very fitting, actually."],
  [4, "You ride indoors so the haters can't see. Smart. They would laugh."],
  [4, 'Secret key to success: suffer more than this. A lot more. Whatever this is, more.'],
  [5, "They don't want you to win. I used to think they were haters. Then I watched you ride."],
  [5, "Fan luv goes both ways. Right now it's going one way. Away from you."],
  [5, 'Say my name! Not you, you need the oxygen. Pedal, damn it!', P],
])

b.add('segment_start', [[5, '{targetW} watts! Another fucking one! You heard me! Go!', P]], [HARD])
b.add('under_target', [[5, "{power} watts? They don't want you to win, and you're fucking helping them.", P]])
b.add('idle_banter', [[5, "This pace is bullshit. I've shouted harder than you've pedalled, and I was sitting down.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Bless up! Another day, another fucking ride! We the best! Let's go!", P],
  [4, 'Clip in. An hour of me shouting over your shit effort. Fan luv.', P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts! This is the drop! Fucking pedal!', P],
    [5, '{targetW} watts for {remainingS}. Save the excuse. Nobody wants that shit on the album.', P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, "Ten seconds! Don't fuck around! {targetW} watts is coming!", P]])
b.add('halfway', [[4, "Halfway. The haters are bored. Even they want more. Give them something, for fuck's sake.", P]])
b.add('last_minute', [[3, 'Last minute! The hook! Sing it with your fucking legs!', P]])
b.add('segment_end_success', [
  [1, 'That was fucking good! Another one! Bless up!', P],
  [5, 'You hit it? Holy shit. Somebody call the label. We got a single.', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That's not a hit. That's a shitty demo.", P],
  [5, "Average {avgW}, target {targetW}. They didn't want you to win and you fucking listened.", P],
])
b.add('under_target', [
  [2, '{deficitW} watts short! Turn this shit up!', P],
  [4, "{power} watts? That's not a power number, that's a fucking ringtone.", P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. You're off beat. I can't hype a beat this shit.", P]])
b.add('stopped_pedaling', [[4, 'We stopped? Dead air! You know what dead air does to a DJ? Fucking nightmare!', P]])
b.add('skipped_interval', [[3, 'Skipped {segmentLabel}? Shit. That was the single.', P]])
b.add('intensity_down', [[4, '{intensityPct}%? You turned me down? Nobody turns me down. Fucking volume up!', P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You spent it all on the intro like a fucking rookie.', P]])
b.add('pr', [[2, '{prLabel} PR? Holy shit! Another one! We the best!', P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. That's the number. Say it loud. Say it like a fucking intro.", P]])
b.add('workout_complete', [
  [1, 'Done! You were fucking great today! Bless up!', P],
  [5, "Done. {tss} TSS. The album's finished. Half the tracks are shit, but it's finished.", P],
])
b.add('ride_bailed', [[5, 'Out at {elapsedMin} minutes? Congratulations. You fucking played yourself.', P]])
b.add('fueling_reminder', [[3, 'Eat something. Hungry you is a shit collaborator.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Not a hit. Not a flop. Just some mid shit.', P],
  [4, 'Fan luv? The only fan loving you is the one drying your sweaty ass.', P],
  [5, "You call this the grind? I've seen people grind harder looking for their car keys. Major fucking key.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! We here! Bless up, {place}!'],
    [2, '{place}! Fan luv to {place}! Small crowd, but they showed up!'],
    [3, "{place}. They said you'd never get here. They were wrong once. Don't get comfortable."],
    [4, "We in {place}! They're not giving you the key to the city. Not at that pace."],
    [5, '{place}! {kmLeft} km to go and the tour bus left without you. Damn!', P],
    [5, '{place}! {kmLeft} km left! Another one! Another town! Another hill! Another one!'],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, 'Welcome to {place}! New country, same anthem! We the best!'],
  [3, '{place}! They let you in. Lowered standards. Bless up.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'Top of {place}! Highest point on the album! Bless up!'],
  [3, "You climbed {place}. They didn't want you up there. Look down on them."],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway! Intermission! Another half coming! Another one!'],
  [3, 'Halfway through {journeyName}. Half an album. The second half has the hits. Allegedly.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! We made it! {journeyName}, done! We the best!'],
  [3, '{place}. {kmDone} km. Fan luv. Real fan luv. Bless up. Cry if you need to. I always do.'],
], [eq('milestoneKind', 'finish')])

export const DJ_KHALED: PersonaPack = {
  meta: {
    id: 'dj-khaled',
    name: 'DJ Khaled',
    tagline: "Another one! Major keys, bless ups, and they don't want you to win. Watching you ride, he gets why.",
    voiceHint: { rate: 1.25, pitch: 1.05, preferVoices: ['Superstar', 'Eddy', 'Reed', 'Alex', 'Tom'] },
  },
  lines: b.build(),
}
