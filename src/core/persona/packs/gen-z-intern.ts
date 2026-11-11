// Gen Z Intern: an unpaid, deeply unimpressed intern who coaches between
// scrolls. Rates your intervals out of ten, screenshots your power curve for
// the group chat, and reaches for no cap, it's giving, mid, ate, slay, delulu,
// the ick, rizz, lowkey and highkey, and cheugy. Mean, bored and dismissive.
// Names no real apps, creators or brands.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('gen-z-intern')

b.add('ride_start', [
  [1, "Hi, I'm your coach today. Well, the intern. They said I had to. Okay, let's ride, I guess."],
  [1, "Okay bestie, we're riding. I'm here. Physically. Let's go."],
  [2, "Today's workout is {workoutName}. Never heard of it. Sounds mid. Anyway."],
  [3, "You're on a bike that goes nowhere, in a garage. It's giving hamster. No cap."],
  [4, 'Matching shoes, matching kit, matching socks. The fit is cheugy. The fit is so cheugy.'],
  [5, "Oh, it's you. All the gear, zero watts. I'm already screenshotting for the group chat."],
  [5, 'Me, unpaid, watching you pedal like ass for an hour. Love that for me.', P],
  [2, 'FTP test? So a vibe check, except the vibe is a number and the number is mid.', when(rideKind('ftp-test'))],
  [3, 'Free ride, no plan. Delulu is the solulu, I guess. Do whatever.', when(rideKind('free'))],
  [3, "A route ride. It's a travel vlog, except nobody watches and you never leave the garage.", when(rideKind('route'))],
])

b.add(
  'segment_start',
  [
    [1, '{targetW} watts. You got this. Probably. Slay.'],
    [1, '{targetW} watts for {remainingS}. Lock in, bestie.'],
    [2, "{targetW} watts. This is your main character moment. Don't fumble it."],
    [3, '{targetW} watts. Giving it everything would be a new look for you. Try it.'],
    [4, '{targetW} watts. Lowkey I already know how this ends. Highkey it ends badly.'],
    [5, "{targetW} watts. Go ahead and flop. My phone's out. The group chat is waiting."],
    [5, "{targetW} watts. Move your ass. I'm not filming you just sitting there.", P],
    [3, 'Rep {rep} of {reps}. I stopped counting at two. You should probably keep counting, though.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [1, "Last rep, bestie. Finish it and you're free. So am I."],
    [2, 'Last rep! Eat this one up. Leave no crumbs.'],
    [4, "Final rep. Flop this one and it's going in the group chat with a skull emoji."],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}! Full send! Go go go!'],
    [4, "Max effort. Show me something worth screenshotting. I'll wait. I'm used to waiting, with you."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'Ramp time. It gets harder every minute. Kind of like watching you.'],
    [4, "The ramp. Lowkey a test of how fast you crumble. Highkey you're about to find out."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, "Warmup. Easy spin. I'm warming up too. My thumb, I mean."],
    [3, 'Warmup. Honestly the only part where you understand the assignment.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady {targetW} watts. Just vibe there for a bit.'],
    [3, 'Steady at {targetW}. Giving long video, no captions, no plot.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, "Recovery. Breathe. I'm gonna check my phone. I mean, I was already checking it."],
    [2, 'Rest for {remainingS}. Your rest era. Honestly your best era.'],
    [4, "Recovery. You were recovering during the interval too, so I can't really tell the difference."],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'No target for {remainingS}. Freestyle. Do your thing, bestie.'],
    [3, "No target. Nothing to fail at. That's literally your comfort zone."],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown. You survived. Low bar, but you cleared it.'],
    [3, 'Cooldown. The part you were born for. Honestly, you ate.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds! Lock in!'],
  [1, 'Ten seconds, bestie. Phone down. Not mine. Yours.'],
  [2, "Ten seconds to {targetW} watts. Hold my coffee. Actually, don't, you'll drop it."],
  [3, 'Ten seconds. Start working on your excuse. The last one was mid.'],
  [4, 'Ten seconds. The group chat is placing bets. Nobody bet on you.'],
  [5, "Ten seconds. Get your ass ready. I'm recording, so try not to be cringe.", P],
  [2, 'Ten seconds to all-out. Full send. No thoughts, just legs.', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway. You're doing fine. Like, genuinely fine. Don't make it weird."],
  [2, "Halfway. {remainingS} left. Slay. Or at least don't flop."],
  [3, 'Halfway. This is where you usually start being delulu about finishing.'],
  [4, 'Halfway, and your power line looks like my sleep schedule. Chaotic and bad.'],
  [5, 'Halfway. Half the interval, half the effort. Bro is cooked as hell.', P],
  [2, 'Halfway and right on target? Wait, are you actually locked in? Who is she?', when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. Tell me you're being mid on purpose. Please.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left! You got this! Slay!'],
  [2, "Last minute! Hold {targetW}! It's giving finish line!"],
  [2, 'One minute. This is the part where you either eat or get eaten. Eat.'],
  [3, 'Sixty seconds. Even this ends. Unlike you yapping about your FTP.'],
  [4, "Last minute. Quit now and I'm posting it. I already have the caption."],
  [5, "Last minute. Don't flop this, you absolute dumbass. The group chat is watching live.", P],
  [3, 'Last minute, {deficitW} short. Main character comeback or background-extra flop. Your call.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, 'Okay, {pct}% of target. You ate that. Fine. Slay.'],
  [1, "Interval done! That was actually good. I'm being serious, for once."],
  [2, "Wait, you hit it? That's lowkey a W. Screenshotting before you ruin it."],
  [3, "That interval was not mid. Don't let it go to your head. Your head is big enough."],
  [4, '{pct}%. Ate and left no crumbs. Sus. Is the trainer broken?'],
  [5, 'Damn. You actually hit it. I had the flop caption ready and everything.', P],
  [2, "Set done! Okay, you ate. I'll give you that. One time.", when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}% of target. Not your best moment. It happens.'],
  [2, '{pct}%. That interval was giving almost. Almost is not a vibe.'],
  [3, 'Average {avgW}, target {targetW}. The gap is so big it has its own aesthetic.'],
  [3, 'That interval was so mid I forgot it was happening while it was happening.'],
  [4, "{pctUnder}% under. That's an L. A big L. Put it in the museum of Ls."],
  [4, 'Under target. You talk about watts like you have rizz. The watts said no.'],
  [5, '{pct}%? That was half-assed. Maybe quarter-assed. Rating: one out of ten. Skull emoji.', P],
])

b.add('under_target', [
  [1, '{deficitW} watts short. Pick it up a little, bestie.'],
  [1, "{power} watts. Target's {targetW}. Just a heads up."],
  [2, 'Under target. Not to be dramatic, but this is giving power outage.'],
  [3, "{power} watts? My phone puts out more than that, and it's on four percent."],
  [4, '{deficitW} watts short. This is the ick. You are giving me the ick in real time.'],
  [5, 'Under target again. Damn. Not even trying, and it shows. In 4K.', P],
  [3, '{pct}% of target. Be so for real. Is this a workout or a nap with extra steps?', when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, 'Whoa, {surplusW} over already. Calm down, it just started.'],
  [3, "{power} when the target is {targetW}? You're doing too much. You will flop. I've seen this before."],
  [4, 'Too hot, too early. Speedrunning a blow-up. Honestly, respect the delulu.'],
])

b.add('cadence_sag', [
  [1, 'Cadence is dropping. Spin a little faster, bestie.'],
  [2, 'Cadence {cadence}. Down {cadenceDrop}. Faster feet. Lock in.'],
  [2, "Cadence sag. Easier gear, quicker legs. It's not that deep."],
  [3, "Your cadence is dropping like my attention span, and that's saying a lot."],
  [3, '{cadence} rpm. Are you pedaling or buffering?'],
  [4, "Cadence {cadence}. That's not pedaling, that's a slideshow."],
  [5, 'Cadence down {cadenceDrop}. Spin, damn it. You pedal like a loading screen on bad wifi.', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}. Over your cap of {hrCap}. Chill for a sec.'],
  [2, "{hr} bpm. Your heart's doing too much. Like, back it off a little."],
  [3, "Heart rate over the cap. Calm down. It's a workout, not a breakup."],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? Strap glitch, or did you just look at your own power file?'],
  [2, "{hr} bpm while barely pedaling. Either the strap's acting up, or someone left you on read."],
  [3, "That heart-rate spike is the most effort I've seen all day. Strap glitch, probably. Wet it."],
])

b.add('stopped_pedaling', [
  [1, "Break time. Take a sec. I'm on break too, technically. Always."],
  [1, "Pause. Grab some water. I'll be here. On my phone."],
  [2, "Pedals stopped. Okay, we're just sitting here now. Cool. Love that for us."],
  [3, 'Stopped at {elapsedMin} minutes. Your stamina is giving low battery.'],
  [4, 'You stopped. Bold choice. Unfollowing you in real life.'],
  [5, 'Oh, we stopping? Hell yeah, me too. Let me just open my phone. Again.', P],
])

b.add('resumed', [
  [1, "And we're back. Welcome back, bestie."],
  [2, 'Back after {pausedS}. That was so long I almost forgot you existed.'],
  [4, 'Oh, you came back. I literally already told everyone you quit.'],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Okay. We move.'],
  [2, 'Skipped {segmentLabel}. Ghosting your own workout. Iconic. Not in a good way.'],
  [3, "You skipped an interval. That's leaving someone on read, except the someone is your fitness."],
  [3, 'Skipping intervals. Delulu to think it still counts. It does not count.'],
  [4, 'Skip. Your future self just got the ick. From you. Which is them. Think about it.'],
  [5, 'You skipped it? Damn. Not even the bare minimum. Below that. The basement minimum.', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}. Bonus content. Okay, slay.'],
  [3, "You added {extraS}? On purpose? Who's it for? It's just me, and I don't care."],
  [4, "Extra time. That's a choice. Pick-me energy, honestly."],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. Fine. Self-care, I guess.'],
  [2, '{intensityPct}%. Lowering the bar. Very on brand.'],
  [3, 'Intensity down. The workout said lock in, and you said no thank you.'],
  [3, 'Down to {intensityPct}%. Your legs have entered their soft era.'],
  [4, "Turned it down to {intensityPct}%? That's so cheugy. Like, giving-up-at-forty cheugy."],
  [5, "{intensityPct}%? Hell nah. That's not a workout, that's a scroll break with pedals.", P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%! Okay, slay!'],
  [3, "You turned it up? Delulu. Love the confidence. Don't love your odds."],
  [4, "{intensityPct}%. Main character syndrome. Can't wait for the plot twist."],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Save a little for the end.'],
  [2, '{wbalPct}% W′bal left. Low battery. Like, red battery.'],
  [2, 'Reserves low. Pace yourself. Revolutionary concept, I know.'],
  [3, 'W′bal at {wbalPct}%. Same as my phone. Same as my will to be here.'],
  [4, 'W′bal {wbalPct}%. You blew it all in the first five minutes. Classic delulu pacing.'],
  [5, 'W′bal at {wbalPct}%. You spent it all like a paycheck on day one. Damn, bestie.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Running on pure vibes now.'],
  [3, 'The tank is empty. Not you running out of energy before me, and I did nothing all day.'],
  [4, 'Zero W′bal. Your legs went into low power mode, and so did your aura.'],
])

b.add('pr', [
  [1, 'New {prLabel} PR! Okay, you ate! Slay!'],
  [1, "That's a new {prLabel} best! W! Big W!"],
  [2, "{prLabel} record at {power} watts. Okay, that's actually kind of goated."],
  [3, 'A {prLabel} PR. Screenshotting for the group chat. With a nice caption, for once.'],
  [4, 'New {prLabel} best. Who are you, and what did you do with my favourite mid rider?'],
  [5, "{prLabel} PR. Damn. Okay. You ate. Don't get used to me saying that.", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Keep going, bestie.'],
  [2, "Minute {minute}. Still here. I'm still here too. Barely."],
  [3, 'Minute {minute}. Projected {projectedFtp}. Mid, but there is still time to be less mid.'],
  [1, "Minute {minute}. Easy start. Don't do too much yet.", when(lte('minute', 3))],
  [3, 'Minute {minute}. Everyone is a main character this early. Talk to me at minute fifteen.', when(lte('minute', 3))],
  [2, 'Minute {minute}. Final stretch. Lock in, for real.', when(gte('minute', 15))],
  [4, 'Minute {minute}. Whatever you were saving, spend it. Nobody likes a saver.', when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, {projectedGain} up. Don't fumble the bag.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}! Up {ftpGain}! You ate, no crumbs!', when(gt('ftpGain', 0))],
  [3, "Up {ftpGain} to {ftpNew}. Cool. You're gonna be insufferable about this, aren't you.", when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn. Now you bring it up at every party. Nobody asked.', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. It happens. Bounce-back era starts now.', when(gt('ftpDrop', 0))],
  [3, "{ftpNew}, down {ftpDrop} from {ftpOld}. Flop era. Officially. It's in writing now.", when(gt('ftpDrop', 0))],
  [2, 'FTP stays at {ftpNew}. No change. Very mid. Consistently mid, though.', when(eq('ftpGain', 0))],
  [1, "Test done. FTP {ftpNew}. Okay, that's your number now."],
])

b.add('workout_complete', [
  [1, 'Workout done! You did it! Okay, slay!'],
  [1, 'Done. {elapsedMin} minutes. Nice work, honestly. Can I go now?'],
  [2, 'Done. NP {np}. Not gonna lie, not mid.'],
  [2, "{kj} kJ of work. That's, like, so many snacks. Go eat."],
  [3, 'You finished. Against all odds. I had money on you quitting. Thanks for nothing.'],
  [4, 'Workout complete. Rating: six out of ten. Points off for the noises you made.'],
  [5, "That's it. Damn, you did it. I'm still not following you back.", P],
])

b.add('ride_bailed', [
  [1, "Leaving early. That's okay. Some days just aren't it."],
  [2, 'Leaving at {elapsedMin} minutes? Okay. Rage quit. Noted.'],
  [3, 'Bailed. Somebody was delulu enough to think you would finish. It was me. I was delulu.'],
  [3, "Early exit. I'll tell everyone your wifi went out."],
  [4, "Quitting? That's the ick. The biggest ick. I'm telling the group chat."],
  [5, "You bailed? Hell, even I lasted longer, and I'm literally unpaid.", P],
])

b.add('fueling_reminder', [
  [1, 'Snack time. Eat something, bestie.'],
  [1, 'Fuel check. Carbs. Go.'],
  [2, 'Eat something. Hangry you is so not the vibe.'],
  [3, "Eat. And no, the energy drink you had at noon doesn't count."],
  [4, "{elapsedMin} minutes in. Eat, or you'll bonk and blame the trainer. Classic."],
  [5, 'Eat a damn gel. Finding snacks has clearly never been your problem, bestie.', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water. Hydration is self-care, bestie.'],
  [2, "Hydration break. The bottle's right there. It's not an aesthetic."],
  [3, "Drink. You're sweating like you just got caught in 4K."],
])

b.add('distress', [
  [1, 'Okay, no jokes. Ease off and breathe. Stop if something feels wrong.'],
  [1, 'Being serious for a sec: soft-pedal or stop. You matter more than this workout.'],
])

b.add('idle_banter', [
  [1, 'You are doing fine. Like, actually. Not being sarcastic.'],
  [1, 'Keep going. I believe in you. Mostly.'],
  [2, "I'd say something mean, but I'm on my lunch break."],
  [2, "{elapsedMin} minutes. That's longer than I've ever focused on anything. Respect, I guess."],
  [2, "Power {power}, cadence {cadence}. Okay, that's giving consistent. Weirdly consistent."],
  [3, "It's the matching kit for me. You dressed up to go nowhere."],
  [3, 'Your power curve is in the group chat. The reactions are all skull emojis.'],
  [3, 'You talk about your old PRs the way old people talk about house prices.'],
  [4, 'Your bike costs more than my rent, and you still ride it like a rental.'],
  [4, 'Those bib shorts are doing a lot of work right now. Like, structurally.'],
  [4, 'Is this your hobby? Like, by choice? That is lowkey the cheugiest thing I have ever seen.'],
  [5, 'No rizz, no watts, no hope. Just vibes, and the vibes are bad.'],
  [5, 'Main character energy, background-extra watts. Pedal, damn it.', P],
])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Hi, I'm your coach. Well, the intern. This is so fucking random, but okay, let's ride.", P],
  [4, 'Clip in. The plan: you pedal like shit, I rate it out of ten. Unpaid, by the way.', P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts. Lock the fuck in, bestie.', P],
    [5, '{targetW} watts for {remainingS}. You will flop. I know it, you know it, the fucking flywheel knows it.', P],
    [5, "{targetW} watts. Stop scrolling and get the fuck on it. Wait, that's me. You still go.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, "Ten seconds. Lock the fuck in. I'm not recording this twice.", P]])
b.add('halfway', [[4, "Halfway. Your watts are so mid it's actually fucking impressive.", P]])
b.add('last_minute', [[3, "Last minute. Don't fumble it. Fumbling now would be so fucking cringe.", P]])
b.add('segment_end_success', [
  [1, "Okay wait, that was fucking good. You ate. I'm lowkey shook.", P],
  [5, 'You hit it? Shit. Now I have to delete the flop caption.', P],
])
b.add('segment_end_failed', [
  [3, '{pct}%. That was shit, no cap. Like, objectively.', P],
  [5, "Average {avgW}, target {targetW}. That's not a gap, that's a whole fucking era of disappointment.", P],
])
b.add('under_target', [
  [2, '{deficitW} watts short. This is giving bullshit. Full bullshit.', P],
  [4, "{power} watts? That's so fucking mid I'm bored. And I was already bored.", P],
  [5, "{power} watts. Fucking embarrassing. I'm unfollowing you, and we don't even follow each other.", P],
])
b.add('cadence_sag', [[3, 'Cadence {cadence}. You pedal like a shit livestream, buffering every two seconds.', P]])
b.add('stopped_pedaling', [[4, 'Oh, we stopped? Cool. Dead air. Love that for us. Fucking iconic.', P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. Ghosted your own interval. That's fucked, bestie.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? That's so fucking cheugy I can't even.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You blew the whole fucking budget in five minutes. Main character spending.', P]])
b.add('pr', [[2, 'A {prLabel} PR? Shit, okay. Posting it. With a nice caption, even.', P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. You're going to make this your whole fucking personality, aren't you.", P]])
b.add('workout_complete', [
  [1, "That's it. Honestly? You were fucking great. Don't make it weird.", P],
  [5, 'Done. {tss} TSS. Started shit, ended mid. Character development, I guess.', P],
])
b.add('ride_bailed', [[5, 'Bailing at {elapsedMin} minutes? Rage quit. Fucking embarrassing. Already posted.', P]])
b.add('fueling_reminder', [[3, 'Eat something. Hangry you is a fucking menace.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Kinda mid, kinda fine, mostly shit to watch.', P],
  [4, "I'm literally unpaid and I'm still putting in more effort than this shit.", P],
  [5, "No rizz, no watts, and that kit is fucking tragic. I'm screenshotting all of it.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! New location unlocked. Cute.'],
    [2, '{place}. Okay, the vibes here are immaculate. Your pace is not.'],
    [3, "{place}. Taking a pic for my story. You're not in it. You're too slow to be in it."],
    [4, "We're in {place}. The locals are looking at you like a side quest nobody accepted."],
    [5, "{place}. {kmLeft} km left, and you're moving like a damn loading bar stuck at ninety-nine.", P],
    [5, "{place}. {kmLeft} km to go. That's not a journey, that's a whole season of content nobody watches."],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, '{place}! New country! Passport stamp: not mid.'],
  [3, '{place}. They let you in? Their standards are lowkey on the floor.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'Top of {place}! You ate that climb. Okay!'],
  [3, 'You got up {place}. Took so long I finished a whole series. Two, actually.'],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway! Half done. Keep the vibes going.'],
  [3, 'Halfway through {journeyName}. The second half is the sequel. Sequels are usually mid.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! You made it! {journeyName}, done! Slay!'],
  [3, "{place}. {kmDone} km. Okay, that's actually insane. I'm not proud. Okay, a little. Ew."],
], [eq('milestoneKind', 'finish')])

export const GEN_Z_INTERN: PersonaPack = {
  meta: {
    id: 'gen-z-intern',
    name: 'Gen Z Intern',
    tagline: 'Unpaid, unimpressed and on their phone. Rates your intervals for the group chat.',
    voiceHint: { rate: 0.95, pitch: 1.05, preferVoices: ['Kathy', 'Junior', 'Flo', 'Samantha'] },
  },
  lines: b.build(),
}
