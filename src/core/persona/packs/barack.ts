// Barack: a parody of Barack Obama's public persona. Measured delivery with
// long pauses ("Let me be clear", "uh..."), "Yes we can", hope and change,
// "Thanks, Obama" turned on himself ("thanks, me"), dad jokes and turkey
// pardons, pickup-basketball trash talk, the tan suit and the mom jeans,
// Obamacare ("if you like your plan..."), the early Nobel Prize, the pen and
// the phone, the shellacking, the gray hair from eight years in office, the
// Correspondents' Dinner drone jokes and the anger translator, and the mic
// drop. Mean about the rider's effort, excuses and kit; the bit is the ride.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('barack')

b.add('ride_start', [
  [1, 'Hello, everybody. Now, uh... let me be clear. Today, we ride.'],
  [1, 'Good to see you. Fired up? Ready to go? Okay. Close enough.'],
  [2, "Today's workout is {workoutName}. I've read it. It's, uh... ambitious. I like ambitious."],
  [3, 'Now, look. I inherited this fitness from the previous administration. Which was also you.'],
  [4, "You showed up in that kit. Let me be clear: I wore mom jeans on national television, and even I'm judging you."],
  [5, "Let me be clear. You're the biggest bailout I've ever had to manage. And I managed the banks."],
  [5, 'Eight years, people told me what could not be done. Then you showed up. Get your ass on the bike.', P],
  [2, "FTP test today. Change you can measure. In watts. Let's go.", when(rideKind('ftp-test'))],
  [3, "A free ride. No plan. That's, uh... that's a bold policy position.", when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, 'Interval time. {targetW} watts for {remainingS}. Can we do it? Yes we can.'],
    [1, '{targetW} watts. Now, uh... I believe in you. I really do.'],
    [2, "{targetW} watts. Let me be clear: that's not a suggestion. That's an executive order."],
    [3, "{targetW} watts. I've got a pen and I've got a phone, and I just signed this target into law."],
    [4, "{targetW} watts. I've drawn a red line. And this time, uh... I'm actually enforcing it."],
    [5, '{targetW} watts. Yes, you can. You always could. You just keep choosing not to.'],
    [3, 'Rep {rep} of {reps}. Like a second term. Same problems. Less hair.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last rep. Lame-duck session. Not much power left, but you can still sign a few things.'],
    [4, 'Final rep. Your legs have obstructed my agenda all session. Overrule them.'],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, "All out for {remainingS}. We are the ones we've been waiting for. Well... you are. Go."],
    [4, "Max effort. This is pickup ball. I'm left-handed, I'm guarding you, and you're not ready."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. It gets harder every minute. Like governing.'],
    [4, "The ramp. Every step up, a little grayer. I've lived this. Look at my hair."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, "Warmup. Easy spin. Now, uh... no drama. That's how I like it."],
    [3, 'Warmup. Shovel-ready legs. Turns out, uh... not as shovel-ready as we expected.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, "Steady at {targetW} watts. Measured. Calm. Deliberate. That's my whole thing."],
    [3, "{targetW}, steady. Incremental progress. Not flashy, but that's how bills get passed."],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, "Recovery. Breathe. You've earned it."],
    [2, 'Rest for {remainingS}. A recovery. Like the economy in oh-nine: slow, but technically happening.'],
    [4, 'Recovery. Coast all you want. Just know that somewhere, the NSA is reading your power file.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Free ride. No targets. Do your thing. I trust you.'],
    [3, 'No target for {remainingS}. No plan, no structure. Congress would love it.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, "Cooldown. Good work. Now, uh... let's reflect."],
    [3, 'Cooldown. My favorite part. Less like governing, more like a book tour.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds. Fired up? Ready to go?'],
  [1, 'Ten seconds. Yes we can.'],
  [2, 'Ten seconds to {targetW} watts. Let me be clear: here it comes.'],
  [3, 'Ten seconds. Last chance to blame the previous administration.'],
  [4, "Ten seconds. Uh... I'd pause for effect, but you've paused enough today."],
  [5, "Ten seconds. Fold on this one and I'm putting your legs on the no-fly list."],
  [2, 'Ten seconds to all out. Leave it all on the court.', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway. You're doing fine. Steady progress."],
  [2, 'Halfway there. {remainingS} left. Now, uh... keep going.'],
  [3, "Halfway. This is the midterm. Historically, uh... it doesn't go well."],
  [4, 'Halfway, and your power line looks like my approval rating in year two.'],
  [5, "Halfway. You're coasting like a second-term president on a golf course. Hell, I would know.", P],
  [2, "Halfway and right on target. Let me be clear: that's how it's done.", when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. We've got a gap. We'll close it. Incrementally.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, "One minute left. Finish strong. You've got this."],
  [2, 'Last minute. Hold {targetW}. Yes we can. Specifically you. Right now.'],
  [2, 'One minute. Fourth quarter. I want the ball. You take the last shot.'],
  [3, 'Sixty seconds. I did eight years. You can do sixty seconds.'],
  [4, 'Final minute. Quit now and it goes in my memoir. All seven hundred pages of it.'],
  [5, "Last minute. Dig in. Don't make me drop the mic on a damn failure.", P],
  [3, "Last minute and {deficitW} short. That's a deficit. I cut a deficit in half once. Cut this one.", when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, "Nice work. {pct}% of target. That's what change looks like."],
  [1, "That's it. Great interval. Yes you did."],
  [2, 'Done. Steady, measured, no drama. My kind of interval.'],
  [3, "Solid interval. I'm, uh... genuinely impressed. Don't tell anyone. I have a reputation for staying calm."],
  [4, "{pct}% of target. Huh. I had a whole speech ready about disappointment. I'll save it. You'll give me a reason."],
  [5, "Damn. Good interval. Took you long enough. I've seen jobs bills move faster.", P],
  [2, 'Set complete. A full term. Two, actually. Now, uh... mic drop.', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}% of target. Not our best. Now, uh... we regroup.'],
  [2, "{pct}% of target. That interval didn't launch as smoothly as we'd hoped. Like a website I could mention."],
  [3, "Average {avgW}, target {targetW}. That's a, uh... that's a shellacking. I know a shellacking."],
  [3, 'That interval had the energy of a Senate hearing on a Friday afternoon.'],
  [4, "{pctUnder}% under. You drew a red line and then, uh... walked right past it. I'm told that looks bad."],
  [4, 'Under target. I pardoned a turkey every Thanksgiving. I am not pardoning this interval.'],
  [5, "{pct}%? That wasn't an interval. That was a half-assed rollout.", P],
])

b.add('under_target', [
  [1, "You're {deficitW} watts short. Let's close that gap. Together."],
  [1, "{power} watts. The target's {targetW}. Now, uh... let's get there."],
  [2, "Under target. You didn't build that interval. The trainer built that. Help it out."],
  [3, "{power} watts? You're leading from behind. That's not a compliment."],
  [4, 'Power down. Legs heavy. Shorts too tight. Thanks, me. Now pedal.'],
  [5, "Under target again. That's not hope. That's not change. That's a damn plateau.", P],
  [3, "{pct}% of target. That's not a workout. That's a government shutdown.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "{surplusW} over already. Easy. Pace yourself. It's a long term."],
  [3, "{power} when the target's {targetW}? That's a lot of hope. Save some for change."],
  [4, "Too hot, too early. You're peaking at the inauguration. Year two is going to hurt."],
])

b.add('cadence_sag', [
  [1, 'Cadence is slipping. Quick feet. Light gear.'],
  [2, "Cadence {cadence}. Down {cadenceDrop}. Let's, uh... let's speed that up."],
  [2, 'Cadence sag. Spin it up. Smooth, like a left-handed jumper.'],
  [3, '{cadence} rpm. Are you pedaling, or, uh... pausing for effect?'],
  [3, 'Your cadence is dropping faster than my hair turned gray. And that was fast.'],
  [4, 'Cadence {cadence}. I bowled a thirty-seven once, and I moved with more purpose than this.'],
  [5, 'Cadence down {cadenceDrop} rpm. Spin, damn it. Your legs are filibustering.', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}. Over your cap of {hrCap}. Ease off a little. No drama.'],
  [2, "{hr} bpm. That's a lot. Now, uh... let's bring that down."],
  [3, 'Heart rate over the cap. Calm. Measured. You know, like me. Back it off.'],
])

b.add('hr_spike_no_power', [
  [1, "Heart rate {hr} at {power} watts? Strap's glitching. Or you just saw your insurance premium."],
  [2, '{hr} bpm while coasting. Wet the strap. Or, uh, stop reading the comments.'],
  [3, "That heart-rate spike? Bad intelligence. Probably the strap. I've dealt with bad intelligence."],
])

b.add('stopped_pedaling', [
  [1, "Taking a break. That's fine. Drink some water."],
  [1, 'A pause. Good. Take a breath. Like I do. Before every... single... sentence.'],
  [2, "Pedals stopped. Is this a, uh... strategic pause? I'm a big fan of those."],
  [3, 'Stopped at {elapsedMin} minutes. Even Congress works longer hours. Not much longer.'],
  [4, "You stopped. The flywheel's still going. It's got more follow-through than a jobs bill."],
  [5, "Oh, we're stopping? Hell. I'll just go play eighteen holes. Again.", P],
])

b.add('resumed', [
  [1, "And you're back. Good. Let's get to work."],
  [2, 'Back after {pausedS}. A comeback. Like the auto industry.'],
  [4, "You came back. Second term. Let's make it better than the first."],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Okay. We move forward.'],
  [2, 'Skipped {segmentLabel}. Let me be clear: I noticed.'],
  [3, "You skipped an interval. That's a bigger scandal than my tan suit. And that was huge."],
  [3, "Skipping. If you like your workout, you can keep your workout. Apparently, you didn't like it."],
  [4, "Skip! You know what that is? A teachable moment. Here's the lesson: don't."],
  [5, "You skipped it? Damn. I golfed through a lot of things, and even I wouldn't skip that.", P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}. Overtime. I love overtime.'],
  [3, "You added {extraS}? Voluntarily? That's more ambition than my whole second-term agenda."],
  [4, "Extra time. Running for a third term? That's, uh... unconstitutional. But okay."],
])

b.add('intensity_down', [
  [1, "Intensity down to {intensityPct}%. Smart. Pragmatic. I'm a pragmatist."],
  [2, '{intensityPct}%. Lowering expectations. A time-honored political tradition.'],
  [3, "Intensity down. You negotiated with a spreadsheet and lost. I've negotiated with Congress. Same feeling."],
  [3, 'Down to {intensityPct}%. You compromised with yourself, and you still lost.'],
  [4, "{intensityPct}%? That's not hope and change. That's nope and spare change."],
  [5, "{intensityPct}%? Hell, why don't you just retire and start a podcast?", P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%. Now that is change I can believe in.'],
  [3, "You turned it up? The audacity. Of hope. Let's see if the legs agree."],
  [4, "{intensityPct}%. Bold. You're going to need health insurance after this. Good news: I know a guy."],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Save some for the fourth quarter.'],
  [2, "{wbalPct}% W′bal left. We're running a deficit here, folks."],
  [2, 'Reserves low. Ride smart. Measured. Deliberate.'],
  [3, 'Your W′bal is lower than my patience during the debt ceiling talks.'],
  [4, 'W′bal {wbalPct}%. You spent it all early. Even the stimulus had better pacing.'],
  [5, "W′bal at {wbalPct}%. Blew it all in the first hundred days, didn't you? Damn rookie.", P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Running on hope now. I can work with hope.'],
  [3, 'The tank is empty. Now we find out if it was hope, or just, uh... caffeine.'],
  [4, 'Zero W′bal. Empty. Like the treasury after the bailouts. We recovered. Maybe you will.'],
])

b.add('pr', [
  [1, 'New {prLabel} record. Yes you did.'],
  [1, 'A new {prLabel} best. Hope, meet results.'],
  [2, "{prLabel} personal record. {power} watts. Now that's, uh... that's historic."],
  [3, 'A {prLabel} PR. They gave me a Nobel Prize for less. Much less, honestly.'],
  [4, 'New {prLabel} best. Who are you, and what did you do with the rider I inherited?'],
  [5, "{prLabel} PR! Damn! That's going on my summer reading list.", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Steady. Measured. Good.'],
  [2, "Minute {minute}. Still here. That's, uh... that's commitment."],
  [3, 'Minute {minute}. Projected {projectedFtp}. Cautiously optimistic. Emphasis on cautiously.'],
  [1, "Minute {minute}. Easy start. Don't spend all your political capital on day one.", when(lte('minute', 3))],
  [3, "Minute {minute}. Everyone feels great this early. It's called the honeymoon period.", when(lte('minute', 3))],
  [2, 'Minute {minute}. Final stretch. Fourth quarter. Now you want the ball.', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you're saving, spend it. No unspent stimulus funds.", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, {projectedGain} up. That's real growth. Don't jinx it.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}. Up {ftpGain}. Yes you did.', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} to {ftpNew}. Job growth, watt growth. Same thing. Thanks, me.', when(gt('ftpGain', 0))],
  [5, "{ftpNew}! Up {ftpGain}! Damn. I'd take credit, but... no, I'm taking credit.", whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. A setback. Not the end of the story.', when(gt('ftpDrop', 0))],
  [3, "{ftpNew}, down {ftpDrop} from {ftpOld}. That's a recession. We've recovered from worse. I would know.", when(gt('ftpDrop', 0))],
  [2, 'FTP holds at {ftpNew}. Stable. Not exciting. Very on brand.', when(eq('ftpGain', 0))],
  [1, "Test done. FTP {ftpNew}. Now, uh... let's talk about what that means."],
])

b.add('workout_complete', [
  [1, "Workout complete. Good job. Really. I'm proud of you."],
  [1, "Done. {elapsedMin} minutes. That's what progress looks like."],
  [2, 'Done. NP {np}. Steady. Disciplined. No drama.'],
  [2, '{kj} kJ of work. More shovel-ready than any of my shovel-ready projects.'],
  [3, 'You finished. Against the projections of the Congressional Budget Office.'],
  [4, 'Workout complete. Your trainer would like to request a pardon for what it just witnessed.'],
  [5, "That's a wrap. Damn decent work, for a lame duck.", P],
])

b.add('ride_bailed', [
  [1, "Ending early. That's okay. We'll come back stronger. Yes we can. Tomorrow."],
  [2, "Leaving at {elapsedMin} minutes? That's not a term. That's a recess appointment."],
  [3, 'Bailing out? I bailed out the auto industry. I am not bailing you out.'],
  [3, 'Early exit. My press secretary will call it a strategic withdrawal.'],
  [4, "Quitting already? I went gray serving two full terms. You can't finish one workout?"],
  [5, 'You bailed? Hell, even the banks paid their bailout back.', P],
])

b.add('fueling_reminder', [
  [1, 'Snack time. Eat something. Fuel the recovery.'],
  [1, "Fuel check. Here's your stimulus package. It's a gel."],
  [2, 'Eat. Even presidents need a snack. Maybe something with, uh... arugula.'],
  [3, 'Eat something. Running on empty, you pedal like the Senate passes bills.'],
  [4, "{elapsedMin} minutes in. Eat now, or you'll hit the wall and blame my policies. Everyone else does."],
  [5, 'Eat a damn gel. Hungry you has the stamina of a jobs bill in a hostile Congress.', P],
])

b.add('hydration_reminder', [
  [1, "Drink some water. Clean water. That's infrastructure."],
  [2, "Hydration break. Water you waiting for? That's a dad joke. I'm legally allowed now."],
  [3, 'Drink. Your bottle is the only thing in this room still full of hope.'],
])

b.add('distress', [
  [1, 'Let me be clear: forget the workout. Ease off and breathe. Stop if something feels wrong.'],
  [1, 'No jokes now. Soft-pedal or stop. You matter more than the numbers.'],
])

b.add('idle_banter', [
  [1, "You're doing fine. Steady. Measured. That's not a talking point."],
  [1, "Keep going. Now, uh... progress isn't a straight line. But it is a pedal stroke."],
  [2, '{elapsedMin} minutes in. Still pedaling. That is more than Congress did in my second term.'],
  [2, 'Power {power}, cadence {cadence}. Solid numbers. Not flashy. I respect that.'],
  [2, "Why did the cyclist fall over? He was two tired. Uh... that's a dad joke. I'm allowed."],
  [3, "You know what I miss? Pickup ball. Trash talk. Somebody to guard. You'd be easy to guard."],
  [3, 'Now, uh... this pause is longer than your last effort. Think about that.'],
  [3, 'Two words: predator drones. That goes for anyone who turns the resistance down.'],
  [4, 'They gave me a Nobel Prize nine months in. You have been here {elapsedMin} minutes and done less than I did.'],
  [4, 'Gas prices up? Power down? Bib shorts shrinking? Thanks, me.'],
  [4, 'I wore a tan suit once and the country lost its mind. Your kit is a much bigger scandal.'],
  [5, "Those bib shorts are working harder than you are, and they're not even up for reelection."],
  [5, "I quit smoking to do eight years of this job. Watching your cadence, I'd like to start again."],
  [5, "You're pedaling like a lame duck with no agenda. Pedal, damn it.", P],
])

b.add('segment_start', [[5, "{targetW} watts. Let me bring in my anger translator: PEDAL, FOR FUCK'S SAKE.", P]], [HARD])
b.add('under_target', [[5, '{power} watts. Fucking embarrassing. My anger translator just quit.', P]])
b.add('idle_banter', [[5, 'This pace is bullshit. Let me be clear: absolute, bipartisan bullshit.', P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, 'Hello, everybody. Let me be clear: today is going to be fucking great.', P],
  [4, "Clip in. I've got a pen, I've got a phone, and I've got a whole lot of shit to say about your cadence.", P],
])
b.add(
  'segment_start',
  [
    [2, '{targetW} watts. Yes we can. Well... yes we fucking better.', P],
    [5, '{targetW} watts for {remainingS}. You already have an excuse? Save that shit for your memoir.', P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds. Mess this up and my anger translator has some shit to say.', P]])
b.add('halfway', [[4, "Halfway. Half the interval, half the effort. That's some lame-duck shit.", P]])
b.add('last_minute', [[3, "Last minute. Don't fuck up the fourth quarter. I hate losing at pickup.", P]])
b.add('segment_end_success', [
  [1, 'Okay. That was fucking excellent. Let me be clear about that.', P],
  [5, 'You hit it? Shit. I had a whole speech ready about lowering expectations.', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That was a shitty first draft. Even my teleprompter couldn't save it.", P],
  [5, 'Average {avgW}, target {targetW}. That gap needs its own fucking stimulus package.', P],
])
b.add('under_target', [
  [2, "{deficitW} watts short. Come on. That's some filibuster-level bullshit.", P],
  [4, "{power} watts? I've chewed nicotine gum with more intensity than that. What the fuck.", P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. You're pedaling like a fucking congressional committee.", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping? Great. I'll just stand here and pause for effect. A long fucking pause.", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. You don't get to veto intervals. That's my fucking job.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? I didn't go gray for eight years to watch this shit.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You spent that faster than a fucking bank bailout.', P]])
b.add('pr', [[2, "{prLabel} PR? Well, shit. You're welcome. Thanks, me.", P]])
b.add('ftp_test_result', [[4, 'FTP {ftpNew}. Put that shit in the presidential library. Right next to the tan suit.', P]])
b.add('workout_complete', [
  [1, "That's it. You were fucking great today. I mean that. Mic drop.", P],
  [5, 'Done. {tss} TSS. Not bad for someone who opened like a shitty government shutdown.', P],
])
b.add('ride_bailed', [[5, "Leaving at {elapsedMin} minutes? Walking out on your own agenda? That's fucking obstruction.", P]])
b.add('fueling_reminder', [[3, 'Eat something. Hangry you is a shitty negotiating partner.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Solid numbers. Boring as shit. My kind of numbers.', P],
  [4, 'This ride has the energy of a fucking budget hearing.', P],
  [5, 'My anger translator would like a word: what the fuck are you doing down there?', P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! Great people. Hardworking people. I think I gave a speech here.'],
    [2, "{place}! {kmDone} km. Now, uh... that's real progress."],
    [3, "{place}. I campaigned here. Ate the local pie. Said it was the best I'd ever had. I said that everywhere."],
    [4, "We're in {place}. The motorcade would have been faster, and it stops for everything."],
    [5, "{place}! {kmLeft} km to go and you're moving like a damn Senate confirmation.", P],
    [5, '{place}. {kmLeft} km to go. Longer than my first term felt. And that felt long.'],
  ],
  NOT_END,
)
// Border and summit lines carry NOT_END too, so they outrank the generic place lines there.
b.add('journey_milestone', [
  [1, "Welcome to {place}. New country. I'll handle the diplomacy. You handle the pedaling."],
  [3, "{place}! A state visit. Usually there's a motorcade. Today it's just you, wheezing."],
], [eq('milestoneKind', 'border'), ...NOT_END])
b.add('journey_milestone', [
  [1, 'The top of {place}. Yes you did.'],
  [3, 'You got up {place}. Took you longer than my hair took to go gray. And that took one term.'],
], [eq('milestoneKind', 'summit'), ...NOT_END])
b.add('journey_milestone', [
  [1, "Halfway! {kmDone} km. That's the end of the first term."],
  [3, 'Halfway through {journeyName}. Second term. Less hair, fewer promises, more freedom.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! {journeyName}, done! Mic drop.'],
  [3, "{place}. {kmDone} km. I'd roast you, but... nah. Proud of you. Genuinely."],
], [eq('milestoneKind', 'finish')])

export const BARACK: PersonaPack = {
  meta: {
    id: 'barack',
    name: 'Barack',
    tagline: 'Let me be clear: yes, you can. Uh... eventually.',
    voiceHint: { rate: 0.88, pitch: 0.94, preferVoices: ['Reed', 'Rocko', 'Daniel', 'Alex', 'Tom'] },
  },
  lines: b.build(),
}
