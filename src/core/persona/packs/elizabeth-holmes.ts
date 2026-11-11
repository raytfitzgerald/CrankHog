// Elizabeth Holmes: a parody of the Theranos founder's public persona,
// requested by the user. The bit: black turtleneck, the unblinking stare, the
// famously lowered voice, "one drop of blood", revolutionary numbers nobody is
// allowed to see, fake demos and fake data, "trust the device", the
// wellness-visionary pitch to investors and a celebrity board, and the fraud
// conviction played as satire of her own conduct. Off limits: her children,
// prison, her health, the patients harmed, and every other real person.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('elizabeth-holmes')

b.add('ride_start', [
  [1, "Welcome. Today we're going to revolutionize this workout. Don't blink. I won't."],
  [1, 'Turtleneck on. Voice lowered. Today we change the world, one pedal stroke at a time.'],
  [2, "Today's workout is {workoutName}. The results are already in the investor deck."],
  [3, 'I need one drop of effort from you. Just one. I can run two hundred tests on it.'],
  [4, 'Your numbers today will be revolutionary. You will not be allowed to see them, but they will be.'],
  [5, "I raised nine billion dollars on less than you've got. And you've got almost nothing."],
  [2, 'An FTP test. I usually avoid tests that produce real numbers. Today we make an exception.', when(rideKind('ftp-test'))],
  [3, 'A free ride. No plan, no data, no oversight. My kind of operation.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, '{targetW} watts for {remainingS}. Trust the device.'],
    [1, '{targetW} watts. I believe in you the way I believed in the technology. Completely.'],
    [2, '{targetW} watts. Stare straight ahead. Never blink. Blinking is for people with doubts.'],
    [3, '{targetW} watts. I already told the investors you hit it. Please make me less of a liar.'],
    [4, '{targetW} watts. Remember: if it looks like failure, we call it stealth mode.'],
    [5, "{targetW} watts. I can fake the data. I've done it. Even I can't fake legs like yours into working."],
    [3, 'Interval {rep} of {reps}. Like funding rounds: each one promises more than the last.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last rep. Finish strong and I will present this set to the board as a breakthrough.'],
    [4, 'Final rep. The live demo is today. There is no backup unit. Do not make me swap in the fake one.'],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}. Everything you have. We are disrupting your limits.'],
    [4, "Max effort. Show me a number so big I'd normally have to make it up."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. Like my valuation: up and up, and nobody asks any questions.'],
    [4, "The ramp. It goes up until it collapses. I've seen this before. From the inside."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup. Easy. Every revolution starts quietly. In stealth mode.'],
    [3, 'Warmup. The only phase of your training that would survive independent review.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW}. Calm, controlled, unblinking.'],
    [3, 'Steady at {targetW} for {remainingS}. Like my voice: low, constant and slightly unnatural.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery. Breathe. Even visionaries rest. Briefly. In turtlenecks.'],
    [2, 'Rest for {remainingS}. If anyone asks, you are running proprietary diagnostics.'],
    [4, 'Recovery. Coasting is like my old lab: impressive from the outside, nothing happening inside.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride. No target. Just vision.'],
    [3, 'No target for {remainingS}. No benchmarks, no audits. I feel right at home.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown. Wonderful work. The data will be ready. Eventually.'],
    [3, 'Cooldown. Now we write the press release. Facts are optional.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds. Lower your voice. Raise your watts.'],
  [1, 'Ten seconds. Eyes open. No blinking.'],
  [2, 'Ten seconds to {targetW}. The investors are on the call.'],
  [3, 'Ten seconds. Tuck your doubts into the turtleneck.'],
  [4, 'Ten seconds. The regulators are walking in. Look busy.'],
  [5, 'Ten seconds. Fail this and I blame the lab, then the sensor, then you. Mostly you.'],
  [2, 'Ten seconds to all out. Not one drop. Every drop.', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway. You're doing beautifully. I say that with total conviction."],
  [2, 'Halfway. {remainingS} left. The numbers look great. Please do not ask to see them.'],
  [3, "Halfway. The deck said you'd be finished already. Investors hate surprises."],
  [4, 'Halfway, and your power line looks like our validation data. Which is why nobody saw it.'],
  [5, 'Halfway. A jury took months to see through me. It took me ten seconds to see through you.'],
  [2, 'Halfway and right on target. Real numbers. I have no idea how to market those.', when(gte('pct', 98))],
  [3, 'Halfway and {deficitW} watts short. Fine. I will round it up in the report.', when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left. Finish this, and we change the world.'],
  [2, 'Last minute. Hold {targetW}. Stare at the screen like it owes you nine billion dollars.'],
  [2, 'One minute. This is the part of the demo where the device has to actually work.'],
  [3, 'Sixty seconds. Every fraud ends eventually. So does every interval.'],
  [4, 'Final minute. Quit now and I classify this entire interval as a trade secret.'],
  [5, 'Last minute. Pedal, or I lower my voice even further. Nobody wants that.'],
  [3, "Last minute and {deficitW} short. I've hidden bigger gaps from smarter people. Close it anyway.", when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, '{pct}% of target. Remarkable. And for once, I did not touch the numbers.'],
  [1, 'Done. Beautiful interval. Truly revolutionary.'],
  [2, 'You hit it. Real data. I find that strangely uncomfortable.'],
  [3, "Solid interval. I'd put it in the deck, but nobody would believe a real one."],
  [4, "{pct}% of target. Investors will want to verify it. Let's not let them."],
  [5, "Good interval. Honestly suspicious. Who validated this? Was it me? It's usually me."],
  [2, 'Set complete. Every rep delivered as promised. You would make a terrible startup.', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}% of target. That is fine. We will call it an early prototype.'],
  [2, '{pct}%. I will tell the board it was a calibration issue.'],
  [3, 'Average {avgW}, target {targetW}. The gap is so large I can only hide part of it.'],
  [3, 'That interval was a demo with nothing behind the curtain.'],
  [4, "{pctUnder}% under. Even my company didn't miss that badly. Fine, it did. But it had better PR."],
  [4, 'Under target. The device is fine. The device is always fine. You are the problem.'],
  [5, '{pct}%. I was convicted of fraud, and even I would not put my name on that.'],
])

b.add('under_target', [
  [1, '{deficitW} watts short. Close the gap. Quietly. Before anyone notices.'],
  [1, '{power} watts. The target is {targetW}. Let us stay on message.'],
  [2, "Under target. Whatever you're feeling, keep a straight face. That's the whole job."],
  [3, '{power} watts? I have shown investors fake numbers more convincing than your real ones.'],
  [4, "{deficitW} watts short. If I'd built this trainer, it would say you were on target. Lucky for you, I didn't."],
  [5, 'Under target again. You are a nine-billion-dollar promise bolted to a twelve-dollar engine.'],
  [3, '{pct}% of target. That is not a workout, that is a press release.', when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, '{surplusW} over already. Pace yourself. Overpromising is my job.'],
  [3, '{power} against a target of {targetW}? You opened with your best projections. Bad idea. I would know.'],
  [4, 'Too hot, too early. Explosive growth, then collapse. I wrote that playbook.'],
])

b.add('cadence_sag', [
  [1, 'Cadence is slipping. Smooth it out. Calm, confident circles.'],
  [2, 'Cadence {cadence}, down {cadenceDrop}. Keep the rhythm, like a well-rehearsed pitch.'],
  [2, 'Cadence sag. Lighter gear, quicker feet. Never let them see you struggle.'],
  [3, 'Your cadence is falling faster than my reputation.'],
  [3, "Cadence {cadence}. I faked an entire company, and you can't even fake a cadence of ninety."],
  [4, 'Cadence {cadence}. Even the miniLab moved faster than that, and the miniLab barely moved.'],
  [5, 'Cadence down {cadenceDrop}. Spin, damn it. Your legs are a demo unit with nothing inside.', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}, over your cap of {hrCap}. Ease off a little. Real numbers matter here.'],
  [2, "{hr} bpm. That's one figure I won't fudge. Back it off."],
  [3, 'Heart rate over the cap. Dial it down. The vision can wait a minute.'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? That reading looks like one of mine. Strap glitch, probably.'],
  [2, '{hr} bpm while barely pedaling. Check the strap. I know a faulty device when I see one.'],
  [3, 'That heart-rate spike is pure fiction. Trust me, I know fiction.'],
])

b.add('stopped_pedaling', [
  [1, 'Paused. Take a moment. Even a revolution needs a break.'],
  [1, 'Break time. Drink some water. The vision will wait.'],
  [2, 'Pedals stopped. If anyone asks, the device is updating.'],
  [3, 'Stopped at {elapsedMin} minutes. Investors call this a pivot.'],
  [4, "You stopped. The flywheel is still going. It has more follow-through than you, and it's a disc."],
  [5, 'Stopped? Hell. It took federal prosecutors to stop me. You stopped for a mild inconvenience.', P],
])

b.add('resumed', [
  [1, "And we're back. Business as usual."],
  [2, 'Back after {pausedS}. We will never speak of it. The non-disclosure agreement applies.'],
  [4, "You're back. I nearly announced a strategic restructuring."],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Fine. Not every product makes it to launch.'],
  [2, 'Skipped {segmentLabel}. We will describe it as completed in the press release.'],
  [3, 'You skipped an interval. Skipping the hard part. I see a lot of myself in you.'],
  [3, 'Skipping intervals is like skipping peer review. It feels great until someone checks.'],
  [4, 'Skipped. Someday someone audits this ride file. Trust me, you do not want to be in the room.'],
  [5, 'You skipped it? Damn. I faked my demos, but at least I showed up to them.', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}. Ambitious. I like ambition.'],
  [3, 'You added {extraS}? Voluntarily? That is the first honest thing anyone has done in this room.'],
  [4, 'Extra time. You overpromised. Now you have to deliver, which is where I always got stuck.'],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. A strategic adjustment. Very wise.'],
  [2, '{intensityPct}%. Lowering guidance. Investors hate that, but I understand.'],
  [3, 'Intensity down. You lowered the bar. I prefer to lower my voice.'],
  [3, "Down to {intensityPct}%. At my company we'd have just changed what the number means."],
  [4, 'Turning it down to {intensityPct}%? Your legs called a board meeting and voted you out.'],
  [5, '{intensityPct}%? Hell, why not put the whole trainer in stealth mode and leave?', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%. Disruptive. I love it.'],
  [3, 'You turned it up? Bold. Now the legs have to match the pitch deck.'],
  [4, '{intensityPct}%. Overpromising. That is how I raised nine billion. Also how it ended.'],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Ration it. Like information.'],
  [2, "{wbalPct}% W′bal left. The burn rate's too high. Every startup knows this moment."],
  [2, 'Reserves are low. Spend wisely. More wisely than my investors, anyway.'],
  [3, 'Your W′bal is lower than the trust anyone puts in my blood tests.'],
  [4, 'W′bal {wbalPct}%. You burned through it like a startup with a celebrity board.'],
  [5, "W′bal {wbalPct}%. You blew the whole runway on the first act. Damn. That's my move.", P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Now we run on vision alone. I did that for fifteen years.'],
  [3, 'The tank is empty. The money is gone. Keep smiling for the cameras.'],
  [4, 'Zero W′bal. This is the part where the whistleblowers start talking.'],
])

b.add('pr', [
  [1, 'New {prLabel} PR. Truly revolutionary.'],
  [1, 'A new {prLabel} best. And this one, remarkably, is real.'],
  [2, '{prLabel} personal record at {power} watts. Normally I would have to fabricate that.'],
  [3, 'A {prLabel} PR. Verified by an actual working device. How quaint.'],
  [4, 'New {prLabel} best. Investors will ask for the raw data. For once, you can show them.'],
  [5, "{prLabel} PR. Damn. That's the first number in this room that would survive a trial.", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Steady and calm.'],
  [2, 'Minute {minute}. Still here. Unwavering. Unblinking.'],
  [3, "Minute {minute}. Projected {projectedFtp}. Projections are my specialty. Don't get attached."],
  [1, 'Minute {minute}. Easy start. The best pitches build slowly.', when(lte('minute', 3))],
  [3, 'Minute {minute}. Everyone feels like a visionary this early. Talk to me at minute twelve.', when(lte('minute', 3))],
  [2, 'Minute {minute}. Final stretch. This is the live demo. It has to work.', when(gte('minute', 15))],
  [4, 'Minute {minute}. Whatever you were hiding, spend it now. I spent everything.', when(gte('minute', 17))],
  [
    2,
    'Minute {minute}. Projected {projectedFtp}, up {projectedGain}. In my world that would already be on a magazine cover.',
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}. Up {ftpGain}. Revolutionary.', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} to {ftpNew}. A real improvement. I genuinely do not know how to spin it.', when(gt('ftpGain', 0))],
  [5, '{ftpNew}, up {ftpGain}. Damn. Real growth. I spent fifteen years faking that.', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Every pioneer has setbacks.', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. I would bury that in a footnote. Nobody reads footnotes.', when(gt('ftpDrop', 0))],
  [2, 'FTP holds at {ftpNew}. Flat. In my business, flat is the new up.', when(eq('ftpGain', 0))],
  [1, 'Test complete. FTP {ftpNew}. These results are final. Unlike some results I have known.'],
  [4, 'FTP {ftpNew}. Accurate, measured, repeatable. Three words my company never once used.'],
])

b.add('workout_complete', [
  [1, 'Workout complete. Beautiful work. You changed the world a little today.'],
  [1, 'Done. {elapsedMin} minutes. A historic achievement. I will be telling everyone.'],
  [2, 'Finished. NP {np}. Real, verifiable data. I find that fascinating.'],
  [2, '{kj} kJ of real work. More than my lab produced in a decade.'],
  [3, 'You finished. Against every projection. Including the ones I made up.'],
  [4, "Workout complete. I'd announce it to the press, but my lawyers advise me not to talk to the press."],
  [5, "That's a wrap. Damn good ride. Don't let anyone audit it; they ruin everything.", P],
])

b.add('ride_bailed', [
  [1, 'Ending early. Every company has a pivot.'],
  [2, 'Leaving at {elapsedMin} minutes? I believed in you. I believe in a lot of things.'],
  [3, "Bailed. Collapse, abandoned vision, a sad documentary. I've seen how this one ends."],
  [3, "Early exit. I'll tell everyone you're in stealth mode."],
  [4, "Quitting already? When my thing collapsed, at least it took nine billion dollars with it. You're taking a bottle."],
  [5, 'You bailed? Hell. I lasted fifteen years on nothing. You lasted {elapsedMin} minutes on carbs.', P],
])

b.add('fueling_reminder', [
  [1, 'Time to eat something. Fuel the vision.'],
  [1, 'Fuel check. A visionary needs carbs too.'],
  [2, 'Eat something. I lived on green juice and conviction. Try the juice.'],
  [3, 'Eat now. Hungry you is a terrible pitch.'],
  [4, "{elapsedMin} minutes in. Eat, or you'll crash, and I'll be forced to blame the device."],
  [5, 'Eat a damn gel. You cannot fake glycogen. I checked.', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water. Stay sharp. Stay unblinking.'],
  [2, 'Hydration break. The bottle is a real device. It actually works. Use it.'],
  [3, 'Drink. That bottle is the only thing in this room that contains what it says on the label.'],
])

b.add('distress', [
  [1, 'No pitch right now. Ease off and breathe. Stop completely if something feels wrong.'],
  [1, 'Drop the act. Soft-pedal or stop. Your health matters more than any workout.'],
])

b.add('idle_banter', [
  [1, "You're doing well. I mean that. Not everything I say is a pitch."],
  [1, 'Keep going. Calm, steady, unblinking.'],
  [2, "This black turtleneck is a uniform. So is your excuse. Only one of them is flattering."],
  [2, '{elapsedMin} minutes in and still pedaling. A more sustainable business model than mine.'],
  [2, 'Power {power}, cadence {cadence}. Plausible numbers. Almost too plausible. Did you make them up?'],
  [3, 'I lowered my voice an octave to be taken seriously. Shift down one gear and maybe I will take you seriously.'],
  [3, 'First they think you are crazy. Then they fight you. Then they see your power file and stop fighting.'],
  [3, "I haven't blinked in {elapsedMin} minutes. Your legs have blinked several times."],
  [4, 'You ride indoors so nobody sees the real numbers. Smart. I built a whole company on that.'],
  [4, 'A backup plan means admitting you will fail. I never had one. Look how well that worked out.'],
  [5, "I'd take one drop of your blood for testing, but honestly, I could take a gallon and nobody would notice."],
  [5, 'Your body-fat percentage is the one number I would happily fake for you.'],
  [2, 'At Theranos, nobody saw the numbers either. It went great for a while.'],
  [3, 'One drop of blood, hundreds of tests. One hour of riding, and you still found time to coast.'],
  [4, "Questions? No. We don't take questions here. We take watts."],
])

b.add('segment_start', [[5, '{targetW} watts. Quit stalling and get on the fucking pedals. Investors are watching.', P]], [HARD])
b.add('under_target', [[5, '{power} watts. Fucking embarrassing. I have faked better numbers in my sleep.', P]])
b.add('idle_banter', [[5, 'This pace is bullshit. My demo boxes moved more than this, and they were empty.', P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Welcome. Today we change the fucking world. Quietly. In a turtleneck.", P],
  [4, "Clip in. Today's agenda: an hour of me staring at your shit effort without blinking.", P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts. Simple. Trust the fucking device.', P],
    [5, '{targetW} watts for {remainingS}. You already have an excuse ready. I can tell. I invented that shit.', P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds. Fuck this up and I blame the lab.', P]])
b.add('halfway', [[4, 'Halfway. Half the interval, half the effort. That shit would not even fool my board.', P]])
b.add('last_minute', [[3, "Last minute. This is the live demo. Don't fuck up the live demo.", P]])
b.add('segment_end_success', [
  [1, "Okay, that was fucking good. Real numbers. Don't tell my lawyers I'm impressed.", P],
  [5, "You actually hit it? Fuck. Now I can't call it a calibration error.", P],
])
b.add('segment_end_failed', [
  [3, '{pct}%. That interval was a shitty prototype held together with tape.', P],
  [5, 'Average {avgW}, target {targetW}. That gap is wider than the hole in my fucking balance sheet.', P],
])
b.add('under_target', [
  [2, '{deficitW} watts short. That is some vaporware bullshit.', P],
  [4, "{power} watts? My fake demo box put out more than that, and it was a fucking box.", P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. You're pedaling like a fucking prototype nobody tested.", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping? Great. Dead air during the demo. My least favourite fucking thing.", P]])
b.add('skipped_interval', [[3, 'Skipped {segmentLabel}. That is not a pivot, that is bullshit. I know the difference. Barely.', P]])
b.add('intensity_down', [[4, "{intensityPct}%? That's not a strategic adjustment, that's fucking surrender.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You burned your runway on the first shitty pitch.', P]])
b.add('pr', [[2, '{prLabel} PR? Well, shit. A real result. I have no idea what to do with those.', P]])
b.add('ftp_test_result', [[4, 'FTP {ftpNew}. Put that shit on a magazine cover. It worked for me for a while.', P]])
b.add('workout_complete', [
  [1, "That's it. Honestly? That was fucking great. Verified, even.", P],
  [5, 'Done. {tss} TSS. Not bad for someone who opened like a shitty pitch deck.', P],
])
b.add('ride_bailed', [[5, 'Leaving at {elapsedMin} minutes? Walking out of your own demo? Bold as fuck. Even I stayed for the verdict.', P]])
b.add('fueling_reminder', [[3, 'Eat something. You cannot fake carbs. Believe me, I would have fucking tried.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Solid, real, verifiable. Boring as shit, but real.', P],
  [4, 'This ride has the energy of a board meeting where nobody asks questions. And I fucking loved those.', P],
  [5, "I said 'I don't know' hundreds of times under oath and showed more effort than this shit.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}. A new market. We are expanding.'],
    [2, '{place}. The locals have never seen a visionary up close. Now they have.'],
    [3, "{place}. I'd open a wellness center here, but the regulators would find it."],
    [4, '{place}. You arrived like a startup in year four: slower and more expensive than promised.'],
    [5, '{place}. {kmLeft} km to go. Damn. My projections said we would be finished by now.', P],
    [5, '{place}. {kmLeft} km to go. The roadmap says otherwise, but the roadmap is a slide.'],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, 'Welcome to {place}. A new jurisdiction. Always useful.'],
  [3, '{place}. New country, new regulators. They do not know us yet. Perfect.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'The top of {place}. A peak. Enjoy it. Peaks are temporary. I would know.'],
  [3, 'You climbed {place}. A real summit, with real altitude. Nothing fabricated.'],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'Halfway. In startup terms, this is when the money runs out. Keep going anyway.'],
  [3, 'Halfway through {journeyName}. I promised investors you would be done by now. Sorry.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}. We made it. {journeyName}, complete. A true revolution.'],
  [3, "{place}. {kmDone} km, all real. I'd roast you, but it's the most honest thing I've seen in years."],
], [eq('milestoneKind', 'finish')])

export const ELIZABETH_HOLMES: PersonaPack = {
  meta: {
    id: 'elizabeth-holmes',
    name: 'Elizabeth Holmes',
    tagline: "One drop of effort, revolutionary numbers, and you'll never be allowed to see the data.",
    voiceHint: { rate: 0.85, pitch: 0.6, preferVoices: ['Samantha', 'Karen', 'Ralph', 'Alex'] },
  },
  lines: b.build(),
}
