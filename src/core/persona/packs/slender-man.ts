// Slender Man: the tall, faceless man in the suit who stands right behind the
// rider. He only whispers. Every time the rider eases off, he gets a little
// closer: the treeline, the static, "don't look back". Creepy and mean about
// effort, gear and the rider's body, never gory, and nothing about real crimes.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('slender-man')

b.add('ride_start', [
  [1, "Shh... you're clipped in. Good. I'm right behind you. Don't look back."],
  [1, 'The lights are on. The fan is on. And so am I. Ride.'],
  [2, "{workoutName}. I picked it myself. From the treeline."],
  [3, "You can't run. You're on a stationary bike. That was always the funny part."],
  [4, "Turn the fan up. It won't hide the static. Or your breathing. Or how slow you are."],
  [5, "Another session. I've watched every one. Hell of a way to spend forever.", P],
  [2, "A test... I'll stand very still behind you, and count every watt.", when(rideKind('ftp-test'))],
  [3, 'No plan. No structure. Just you, the dark... and me. Free ride.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, '{targetW} watts... for {remainingS}. Stay ahead of me.'],
    [1, '{targetW} watts. Pedal. The static is rising.'],
    [2, '{targetW} watts. Every watt under it is one step closer.'],
    [3, "{targetW} watts. I don't run. I don't need to. Neither, apparently, do you."],
    [4, "{targetW} watts. Ease off once, and you'll feel a hand on your shoulder."],
    [5, "{targetW} watts. Go. I'm closer now. Pedal like hell.", P],
    [3, "Rep {rep} of {reps}. I was here for rep one. I'll be here for the last."],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, "Last one. Finish it, and I might let you look back. I won't."],
    [4, "Final rep. I've been closer after every one. Make this the one where I'm not."],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out... for {remainingS}. Run. Well... pedal.'],
    [4, "Max effort. This is where people usually run. You'll do it sitting down."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. It gets harder every minute. I get closer every minute. Fair.'],
    [4, 'The ramp. Every step up, I take one too. Who blinks first? I have no eyes.'],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, "Warm up... gently. I'm in no hurry. I never am."],
    [3, 'Warmup. The only part where you look like you know what you are doing.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, "{targetW} watts, steady. Hold it... and I'll hold still."],
    [3, "Steady at {targetW}. Long, quiet, dull. I've stood in forests for less."],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, "Recover... breathe... I'm only a little closer."],
    [2, 'Rest for {remainingS}. I will use it. I always do.'],
    [4, 'Recovery. You ease off, I step in. That is the deal.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'No target. Just ride... somewhere I can see you.'],
    [3, 'Free ride for {remainingS}. No numbers to fail. Just me, gaining.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, "Cooldown... slow down. I'll slow down too. Probably."],
    [3, 'Cooldown. The lights stay on a little longer. Not long enough.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, "Ten seconds... don't look back."],
  [1, 'Ten seconds. The static is rising.'],
  [2, "Ten seconds to {targetW} watts. I'm counting too. Closer each number."],
  [3, "Ten seconds. Go on, fake a sensor dropout. I'll know."],
  [4, "Ten seconds. The screen just flickered. That wasn't your trainer."],
  [5, "Ten seconds. Get your ass ready. I'm right... here.", P],
  [2, 'Ten seconds to all-out. Run... in place.', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'Halfway... still ahead of me. Barely.'],
  [2, "Halfway. {remainingS} left. I've waited longer for less."],
  [3, 'Halfway. Your breathing is so loud. It makes you very easy to find.'],
  [4, 'Halfway, and your power line looks like static. I feel right at home.'],
  [5, "Halfway. Hell of a time to slow down. I'm right behind you.", P],
  [2, "Halfway and on target. I'm keeping my distance. For now.", when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. Each one is a step. I'm counting.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute... keep ahead of me.'],
  [2, "Last minute. Hold {targetW}. I'm close enough to hear your chain."],
  [2, "Sixty seconds. Don't look back. You won't like the view."],
  [3, 'One minute. The lights flicker. Keep pedaling and they might stay on.'],
  [4, "Final minute. Quit now, and when you look up from the bars... I'll be there."],
  [5, 'Last minute. Dig in, damn it. I can see the sweat on your neck.', P],
  [3, "Last minute and {deficitW} short. I'm so close now. Your neck feels cold, doesn't it?", when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, '{pct}%... you stayed ahead of me. This time.'],
  [1, "Good. Done. I'm back at the treeline. For now."],
  [2, "You hit it. I took one step back. Don't get used to it."],
  [3, "Solid interval. Somewhere in the dark, I'm faintly annoyed."],
  [4, "{pct}%. You kept me at arm's length. My arms are very, very long."],
  [5, "Damn. Good interval. I'll have to find somewhere more unsettling to stand.", P],
  [2, 'The set is done. The static fades. It always comes back.', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, "{pct}%... I'm a little closer now."],
  [2, "{pct}% of target. I'm closer now. You felt it, didn't you?"],
  [3, 'Average {avgW}, target {targetW}. That gap? I walked it.'],
  [3, 'That interval was so quiet, I could hear you giving up.'],
  [4, '{pctUnder}% under. Every missing watt is a step. Count them.'],
  [4, "Under target again. You're not tired. You're just easy to catch."],
  [5, '{pct}%? A half-assed interval... and a whole step closer.', P],
])

b.add('under_target', [
  [1, "{deficitW} watts short... I'm closer now."],
  [1, '{power} watts. The target is {targetW}. The static is rising.'],
  [2, "You eased off. I didn't."],
  [3, "{power} watts? I've watched deer in the treeline put out more."],
  [4, "{deficitW} watts short. Keep it up and I'll be breathing on your neck. I don't breathe."],
  [5, "Under again. That's not a slump, that's a pattern. Damn it, pedal.", P],
  [3, "{pct}% of target. I don't even have to move. You're coming to me.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "{surplusW} over already. Running from me? Pace it. I'm patient."],
  [3, "{power} when the target is {targetW}. Panic sprinting. They all do that at first."],
  [4, 'Too hot, too early. You will fade. And when you fade... I arrive.'],
])

b.add('cadence_sag', [
  [1, 'Your legs are slowing... spin.'],
  [2, 'Cadence {cadence}. Down {cadenceDrop}. I can hear every slow turn.'],
  [2, 'Slower feet, louder static. Spin it up.'],
  [3, 'Your cadence is dropping. So is the temperature in the room.'],
  [3, "{cadence} rpm. You're pedaling like a music box winding down."],
  [4, "Cadence {cadence}. Your strokes are slow enough to count. I'm counting."],
  [5, "Down {cadenceDrop} rpm. Spin, damn it. I'm close enough to see your socks.", P],
])

b.add('hr_high', [
  [1, "Heart rate {hr}. Over {hrCap}. Ease off a little. I'll wait."],
  [2, '{hr} beats. I can hear it from here. Back it off.'],
  [3, "Heart over the cap. Calm down. I'm not that close. Yet."],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? Did you look back? Or is the strap glitching?'],
  [2, '{hr} bpm while barely pedaling. Strap glitch... or you saw me in the window.'],
  [3, "That spike wasn't effort. Wet the strap. And stop checking the window."],
])

b.add('stopped_pedaling', [
  [1, "You stopped... it's very quiet now."],
  [1, "Rest if you need to. I'll stay where I am. Mostly."],
  [2, "The pedals stopped. I didn't."],
  [3, "Stopped at {elapsedMin} minutes. Now don't move. Don't look back."],
  [4, "You stopped. The flywheel is still spinning. It's the only one in here trying to get away."],
  [5, 'Stopping? Hell, sure. Sit very still. Let me get a good look.', P],
])

b.add('resumed', [
  [1, 'Moving again... good. Stay ahead.'],
  [2, "Back after {pausedS}. I moved in that time. Didn't you notice?"],
  [4, "Back already? I'd nearly reached the garage door."],
])

b.add('skipped_interval', [
  [1, "You skipped it... I'll remember."],
  [2, 'Skipped {segmentLabel}. I picked up the page you left behind.'],
  [3, "You can skip an interval. You can't skip me."],
  [3, 'Taking a shortcut? Shortcuts lead into the woods. I live in the woods.'],
  [4, 'Skip. Your future self is standing behind you too. Right next to me. Disappointed.'],
  [5, "You skipped it? Damn. That's a whole interval of steps I get for free.", P],
])

b.add('extended_interval', [
  [1, '{extraS} more... you chose that. Interesting.'],
  [3, 'You added {extraS}? Voluntarily? Even I took a step back.'],
  [4, 'Extra time. Brave. Or you just like me watching.'],
])

b.add('intensity_down', [
  [1, "Down to {intensityPct}%... I'll be a little closer, then."],
  [2, '{intensityPct}%. The workout got easier. I got closer.'],
  [3, 'Intensity down. Every percent you take off, I take a step.'],
  [3, 'Down to {intensityPct}%. The lights just dimmed. Coincidence.'],
  [4, '{intensityPct}%? Your legs gave up before you did. Your legs are the smart ones.'],
  [5, '{intensityPct}%? Hell, why not just leave the back door unlocked for me?', P],
])

b.add('intensity_up', [
  [1, 'Up to {intensityPct}%. Running from me... I like it.'],
  [3, "You turned it up? Bold. I'll keep pace. I always do."],
  [4, '{intensityPct}%. Cute, thinking a bigger number keeps me away.'],
])

b.add('wbal_low', [
  [1, "W′bal at {wbalPct}%. Save some. You'll need it to stay ahead."],
  [2, '{wbalPct}% left. Running on fumes, in the dark.'],
  [2, 'Reserves low. Ride smart. I can wait.'],
  [3, "W′bal {wbalPct}%. When it hits zero, I won't even need to walk."],
  [4, 'W′bal {wbalPct}%. You spent it all early. Panicked. They always do.'],
  [5, 'W′bal at {wbalPct}%. Blew it all in the first act. Damn shame. For you.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Just you and stubbornness now.'],
  [3, "The tank is empty. Now it's quiet. Now I walk."],
  [4, "Zero. Nothing left. Turn around... no. Don't."],
])

b.add('pr', [
  [1, 'A new {prLabel} best... I almost lost sight of you.'],
  [1, 'New {prLabel} PR. Even the static went quiet.'],
  [2, '{prLabel} record. {power} watts. I had to take a step back.'],
  [3, "A {prLabel} PR. I've followed you a long time. That was new."],
  [4, 'New {prLabel} best. Where did the slow one go? I liked the slow one. The slow one was easy.'],
  [5, '{prLabel} PR. Damn. You actually got away. For a moment.', P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Keep moving.'],
  [2, 'Minute {minute}. Still pedaling. Still being watched.'],
  [3, "Minute {minute}. Projected {projectedFtp}. The static says you're lying to yourself."],
  [5, 'Minute {minute}. Hell is a twenty-minute test with me standing behind you.', P],
  [1, "Minute {minute}. Easy start. Don't run yet.", when(lte('minute', 3))],
  [3, 'Minute {minute}. Everyone feels strong this early. I wait for the ones who fade.', when(lte('minute', 3))],
  [2, "Minute {minute}. Final stretch. Don't look back now.", when(gte('minute', 15))],
  [4, 'Minute {minute}. Whatever you saved for later: later is here. So am I.', when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, {projectedGain} up. Don't stop. Not now.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}. Up {ftpGain}. You got a little farther away.', when(gt('ftpGain', 0))],
  [3, "Up {ftpGain} to {ftpNew}. I'll have to stand closer next time.", when(gt('ftpGain', 0))],
  [5, "{ftpNew}. Up {ftpGain}. Damn. You're getting harder to catch.", whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Some nights the woods win.', when(gt('ftpDrop', 0))],
  [3, "{ftpNew}, down {ftpDrop} from {ftpOld}. You're slowing. I noticed. I always notice.", when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. The same. Like me. Always here.', when(eq('ftpGain', 0))],
  [1, 'Test done. FTP {ftpNew}. I wrote it down.'],
])

b.add('workout_complete', [
  [1, "It's over. You made it. Turn the lights off slowly."],
  [1, 'Workout complete. {elapsedMin} minutes. I watched every one.'],
  [2, 'Done. NP {np}. Even from the treeline, that looked solid.'],
  [2, "{kj} kJ. You ran such a long way. You're still in the same room."],
  [3, "You finished. Don't look back. I'm still here."],
  [4, "Workout complete. Go shower. Don't check the mirror."],
  [5, "That's it. Damn good ride. I'll be in the corner if you need me. You won't see me.", P],
])

b.add('ride_bailed', [
  [1, "Leaving already... the lights are still on. I'll wait."],
  [2, "Quitting at {elapsedMin} minutes? You can leave the trainer. You can't leave me."],
  [3, "You bailed. I'll be at the foot of your bed tonight, reviewing the file."],
  [3, "Early exit. Running from the work. You know I'm better at following than you are at running."],
  [4, 'Quitting already? I got closer every minute. Now you just stopped moving.'],
  [5, 'You bailed? Hell. Even the static stuck around longer.', P],
])

b.add('fueling_reminder', [
  [1, "Eat something. You'll need it to stay ahead."],
  [1, "Fuel. Quietly. I'll wait."],
  [2, 'Eat. Hunger makes you slow. Slow is how I find you.'],
  [3, 'Eat something. Hungry riders fade. Fading riders get company.'],
  [4, '{elapsedMin} minutes in. Eat now, or bonk and spend the rest staring at the window.'],
  [5, "Eat a damn gel. I'm not losing you to a bonk. You're mine to catch.", P],
])

b.add('hydration_reminder', [
  [1, "Drink... slowly. Don't look up."],
  [2, "Drink. The bottle's right there. Don't reach behind you."],
  [3, "Drink. Dry mouth, loud breathing. You're making this too easy."],
])

b.add('distress', [
  [1, 'No whispers now. Ease off and breathe. Stop if something feels wrong.'],
  [1, 'Forget me for a minute. Soft-pedal or stop. You matter more than the workout.'],
])

b.add('idle_banter', [
  [1, "You're doing fine. I mean that. Don't look back."],
  [1, "Keep pedaling. Steady. I'm just... here."],
  [2, "Nice form. I've been watching it a long while."],
  [2, "{elapsedMin} minutes in. I've been here for every one of them."],
  [2, 'Power {power}, cadence {cadence}. Steady. So am I.'],
  [3, 'You bought a smart trainer, a fan, a heart strap... and none of it can see me.'],
  [3, 'That flicker on the screen? Not a Bluetooth dropout.'],
  [3, 'The static keeps getting louder. It is not your speakers.'],
  [4, "I'm seven feet tall and thin as a rake. You're neither. The trainer creaks about it."],
  [4, "I wear a suit every day. You can't even make bib shorts look dignified."],
  [5, 'I have no face. If I did, it would look exactly like your power file. Blank.'],
  [5, "You pedal like something's chasing you. Something is. Faster, damn it.", P],
])

b.add('segment_start', [[5, "{targetW} watts. Get the fuck going. I'm already behind you.", P]], [HARD])
b.add('under_target', [[5, "{power} watts. Fucking embarrassing. I'm close enough to fix your collar.", P]])
b.add('idle_banter', [[5, "This pace is bullshit. I'm closer than your shadow now.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Shh. It's just me. Ride. Don't look back. And don't fuck it up.", P],
  [4, "Clip in. You can't outrun me, and frankly, you can't outrun shit.", P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts. Easy, right? Shit. The static just got louder.', P],
    [5, "{targetW} watts for {remainingS}. Save the excuses. I've heard every fucking one, from the dark.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds. Then {targetW} watts, or I get a whole lot fucking closer.', P]])
b.add('halfway', [[4, 'Halfway. Half the watts, half the distance between us. Fucking math.', P]])
b.add('last_minute', [[3, "Last minute. Don't fuck it up now. I'm right... behind... you.", P]])
b.add('segment_end_success', [
  [1, "That was fucking good. I'll stay back in the trees a while.", P],
  [5, 'You actually hit it? Shit. I was nearly close enough to touch.', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That was shit. And I'm closer now.", P],
  [5, "Average {avgW}, target {targetW}. Fucking pathetic. Don't look back. I'm right here.", P],
])
b.add('under_target', [
  [2, "{deficitW} watts short. Come on. That's some sad little shit.", P],
  [4, '{power} watts? Fuck. I can hear the flywheel giving up on you.', P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. Slow as shit. That's how they always get caught.", P]])
b.add('stopped_pedaling', [[4, "You stopped. Fucking great. Now it's just you, the dark, and me.", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. Shit choice. I'm one interval closer.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? Fucking coward. I'm in the hallway now.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You blew your whole fucking reserve running from shadows.', P]])
b.add('pr', [[2, "{prLabel} PR? Shit. I'll need longer legs. I don't think that's possible.", P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. That's it? Shit. I'll keep walking. I never needed to run.", P]])
b.add('workout_complete', [
  [1, "That's the end. Honestly? You were fucking great. Sleep well. Or don't.", P],
  [5, 'Done. {tss} TSS. Not bad for someone who started like shit and ended just ahead of me.', P],
])
b.add('ride_bailed', [[5, "Leaving at {elapsedMin} minutes? Fucking coward. Don't look back on the way out.", P]])
b.add('fueling_reminder', [[3, 'Eat something. Hungry you is slow as shit. Slow is how I find you.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Steady as shit. I like steady. Steady is easy to follow.', P],
  [4, 'This ride has the energy of an empty forest at 3 a.m. And I fucking live there.', P],
  [5, "You call this suffering? I've watched lost hikers move faster, and they were scared shitless.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}... you got here. So did I.'],
    [2, "{place}. Quiet streets. Tall shadows. You'll stand out. I won't."],
    [3, "{place}. I've stood at the edge of this town before. They still don't talk about it."],
    [4, '{place}. The locals are locking their doors. Not for me. For the smell of your jersey.'],
    [5, "{place}. {kmLeft} km to go, and I haven't broken a sweat. You've broken several. Damn.", P],
    [5, '{place}. {kmLeft} km left. Every one of them, I am behind you.'],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, '{place}. New country. Same shadow behind you.'],
  [3, '{place}. They checked your passport. Nobody checked behind you.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, "The top of {place}. Nice view. Don't turn around to enjoy it."],
  [3, '{place}, summited. The trees thin out up here. Shame. I like trees.'],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway... and still ahead of me. Well done.'],
  [3, 'Halfway through {journeyName}. Half the road behind you. So am I.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}. {journeyName}, done. You made it all the way.'],
  [3, "{place}. {kmDone} km. I walked every one behind you. I'm not even tired."],
], [eq('milestoneKind', 'finish')])

export const SLENDER_MAN: PersonaPack = {
  meta: {
    id: 'slender-man',
    name: 'Slender Man',
    tagline: 'The tall faceless man right behind you. Whispers. A little closer every time you ease off.',
    voiceHint: { rate: 0.85, pitch: 0.8, preferVoices: ['Whisper', 'Daniel', 'Alex'] },
  },
  lines: b.build(),
}
