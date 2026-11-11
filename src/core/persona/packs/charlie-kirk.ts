// Charlie Kirk: a parody of Charlie Kirk's public persona as a campus
// debater. The "Prove me wrong" table, rapid-fire "let me ask you a
// question", talking fast over you, "that's a fact", your legs indoctrinated
// by a tenured professor, socialism, safe spaces, participation trophies,
// student loans and Turning Point puns, and owning the rider in a debate
// about whether they can finish the interval. Strictly the debate-table act:
// nothing about his death or anything around it. Mean about the rider's
// effort, excuses and kit; the bit is always the ride.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('charlie-kirk')

b.add('ride_start', [
  [1, 'Okay, welcome to the table. The sign says prove me wrong. Today, you get to try.'],
  [1, "Hey, great to see you. Grab a mic. Today we're debating your legs."],
  [2, "Today's workout is {workoutName}. Let me ask you a question: did you even read it? I read it. Twice."],
  [3, "Let me ask you a question. Simple question. Yes or no: are you going to quit? You hesitated. That's a yes."],
  [4, 'You walked up to my table in a forty-dollar helmet with a socialist work ethic. Bold.'],
  [5, "Four years of indoctrination and you still can't clip in on the first try. Prove me wrong."],
  [5, 'Your legs went to a liberal arts college. Let us see if we can deprogram the damn things.', P],
  [2, "FTP test. Finally, a debate where your feelings don't get a vote. Just watts.", when(rideKind('ftp-test'))],
  [3, "A free ride? No plan, no structure? That's how socialism starts.", when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, 'Interval time. {targetW} watts for {remainingS}. Simple question: can you do it? Prove it.'],
    [1, "{targetW} watts. Okay. Let's have a good-faith debate with the pedals."],
    [2, "{targetW} watts. That's not my opinion. That's a fact. Targets are facts."],
    [3, '{targetW} watts. Let me ask you a question. Did a professor tell you watts were a social construct?'],
    [4, '{targetW} watts. Your legs want a safe space. There are no safe spaces on a trainer.'],
    [5, "{targetW} watts. I've debated thousands of college kids. You're the first one to lose to a flywheel."],
    [3, 'Rep {rep} of {reps}. Next in line. Step up. Same question. Will you crack?'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last rep. This is the turning point. Trust me, I know a turning point.'],
    [4, "Final rep. Your legs have argued with me all session. Time to concede the debate."],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}. No targets, no excuses, no safe spaces.'],
    [4, 'Max effort. This is the clip. You own the interval, or the interval owns you. Pick one.'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'The ramp. Every minute it costs more. Like tuition. Except this one actually teaches you something.'],
    [4, "Ramp test. Every step up is a question you can't answer. Watch. Here comes one."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup. Easy spin. Opening statements. Keep it civil.'],
    [3, "Warmup. Enjoy it. It's the only part of this workout where you won't get owned."],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW} watts. Consistent. Conservative. Love it.'],
    [3, '{targetW}, steady. The free market rewards consistency. Your legs reward naps.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, "Recovery. Catch your breath. You'll need it for the rebuttal."],
    [2, "Rest for {remainingS}. Enjoy it. It's the only handout you're getting from me."],
    [4, "Recovery. Coasting on work you did ten minutes ago. That's basically socialism."],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, "Free ride. Free market. Let's see what you produce."],
    [3, 'No target for {remainingS}. No structure, no accountability. Like a sociology department.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, 'Cooldown. Good debate. Shake hands with the pedals.'],
    [3, "Cooldown. Closing statements. Yours is going to be short."],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds. Opening statements. Go.'],
  [1, 'Ten seconds. Prove me wrong.'],
  [2, "Ten seconds to {targetW} watts. Simple question: ready? Doesn't matter. Here it comes."],
  [3, 'Ten seconds. Last chance to claim the trainer is biased against you.'],
  [4, "Ten seconds. The clip title's already written: rider owned by a simple interval."],
  [5, "Ten seconds. Fold on this one and you're the cringe compilation. That's a fact."],
  [2, 'Ten seconds to all out. No safe space. Go.', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway. Good. You're holding your position. Keep going."],
  [2, "Halfway there. {remainingS} left. Are you tired? Don't answer. Pedal."],
  [3, "Halfway. This is where college kids start yelling. Are you yelling inside? You're yelling inside."],
  [4, 'Halfway, and your power line looks like a freshman GPA: strong start, then the parties started.'],
  [5, "Halfway, and you're fading like a liberal arts degree on a resume. Pick it up, damn it.", P],
  [2, 'Halfway and right on target. See? Facts. Logic. Watts. Beautiful.', when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. That's a fact. You can't feel your way out of a fact.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left. Finish the argument strong.'],
  [2, 'Last minute. Hold {targetW}. Prove me wrong. Right now.'],
  [2, 'One minute. Closing argument. Make it count.'],
  [3, 'Sixty seconds. You sat through four years of lectures. You can sit through sixty seconds of watts.'],
  [4, "Final minute. Fade now and I'm clipping it. Slow motion. Zoom on your face. Ten million views."],
  [5, "Last minute. Dig in. Don't you dare fold like a damn tenured professor.", P],
  [3, 'Last minute and {deficitW} short. Let me ask you a question: is this who you are? Wrong answer. Pedal.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, "Nailed it. {pct}% of target. That's a fact."],
  [1, 'Great interval. Debate over. You won that one.'],
  [2, "Okay. Competence. On a college campus, that's practically a miracle."],
  [3, "Solid interval. I had a gotcha question ready and now I can't use it. Annoying."],
  [4, '{pct}% of target. Huh. Did somebody finally deprogram your legs?'],
  [5, "Damn. Good interval. Don't let it go to your head. I've seen what applause does to freshmen.", P],
  [2, 'Set complete. Clean sweep. Debate over. Next.', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}% of target. Not every debate goes your way. Next one.'],
  [2, '{pct}% of target. The target called. It needs a safe space from you.'],
  [3, "Average {avgW}, target {targetW}. That's a gap. That's a fact. Feelings won't close it."],
  [3, 'That interval had the energy of a freshman who just discovered socialism and a hammock.'],
  [4, "{pctUnder}% under. Your legs just lost a debate to a number. A number. That's a new low."],
  [4, 'Under target. Your excuses have more structure than your intervals. Somebody give them tenure.'],
  [5, "{pct}%? That wasn't an interval. That was a half-assed protest sign.", P],
])

b.add('under_target', [
  [1, "Hey, {deficitW} watts short. Simple question: can you close it? Yes you can. Do it."],
  [1, "{power} watts. Target's {targetW}. That's not my opinion. Just math."],
  [2, "Under target. You want the trainer to do the work for you? That's literally socialism."],
  [3, '{power} watts? Let me ask you a question. Who told you that was enough? A professor?'],
  [4, "{deficitW} watts short! What's the plan, protest until the target lowers itself?"],
  [5, 'Under target again. Your legs want a bailout. No bailouts. Pedal, damn it.', P],
  [3, "{pct}% of target. That's not a workout. That's an unpaid internship.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "Whoa, {surplusW} over already. Pace yourself. It's a long debate."],
  [3, "{power} when the target's {targetW}? Leading with your best argument. You'll have nothing left for the rebuttal."],
  [4, "Too hot, too early. You're the freshman who yells first and cries at the rebuttal."],
])

b.add('cadence_sag', [
  [1, 'Cadence is slipping. Spin it up. Quick feet.'],
  [2, 'Cadence {cadence}. Down {cadenceDrop}. Faster. Like I talk. Faster.'],
  [2, 'Cadence sag. Are you pedaling or protesting? Pedal.'],
  [3, 'Your cadence is dropping faster than enrollment at a woke college.'],
  [3, "{cadence} rpm. I talk faster than you pedal. Way faster. Hear that? That's speed."],
  [4, "Cadence {cadence}. That's not pedaling. That's a tenured professor strolling to his one class a week."],
  [5, 'Cadence down {cadenceDrop} rpm. Spin, damn it. Your legs are unionizing.', P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}. Over your cap of {hrCap}. Ease off a little. Keep it civil.'],
  [2, "{hr} bpm. You're getting heated. Easy. Back it off."],
  [3, "Heart rate over the cap. You're losing an argument with yourself. Dial it back."],
])

b.add('hr_spike_no_power', [
  [1, "Heart rate {hr} at {power} watts? Strap's glitching. Or you just opened your student loan statement."],
  [2, '{hr} bpm while coasting. Wet the strap. Or did somebody say the word socialism?'],
  [3, 'That heart-rate spike has no data behind it. Like a campus protest. Probably the strap.'],
])

b.add('stopped_pedaling', [
  [1, "Taking a break? Fine. Grab some water. The table's still here."],
  [1, "Pause. Okay. Gather your thoughts. You'll need them."],
  [2, "Pedals stopped. Is this a walkout? This is a walkout, isn't it?"],
  [3, 'Stopped at {elapsedMin} minutes. Let me ask you a question: is this a protest? What are your demands?'],
  [4, "You stopped. That's a sit-in. Sit-ins don't produce watts."],
  [5, "Oh, we're stopping? Hell. Let me guess. You need a safe space.", P],
])

b.add('resumed', [
  [1, "And you're back. Good. Let's continue the conversation."],
  [2, 'Back after {pausedS}. Okay. Rebuttal time.'],
  [4, "You're back. Walked out, walked back in. Classic freshman."],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Okay. Next question.'],
  [2, 'Skipped {segmentLabel}. Dodging the question. I see that a lot.'],
  [3, "You skipped an interval. That's cancel culture. You canceled an interval for being difficult."],
  [3, "Skipping. Let me ask you a question: do you skip class too? Actually, don't answer. I know."],
  [4, 'Skip! College is a scam, but at least you paid for it. This one was free, and you still skipped it.'],
  [5, 'You skipped the interval? Damn. Even college students show up when there is free food.', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}. Overtime. Love it. More debate.'],
  [3, "You added {extraS}? Voluntarily? I don't have a rebuttal. That never happens."],
  [4, 'Extra time! Look who wants to keep arguing. Bold. Probably a mistake.'],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. Okay. Know your limits.'],
  [2, '{intensityPct}%. Lowering the bar. Like grading on a curve, but for watts.'],
  [3, 'Intensity down. You negotiated with a spreadsheet and you lost. To a spreadsheet.'],
  [3, "Down to {intensityPct}%. That's not a workout anymore. That's a participation trophy with a fan."],
  [4, '{intensityPct}%? Let me guess: the workout was problematic.'],
  [5, "{intensityPct}%? Hell, why not ask for student loan forgiveness while you're at it?", P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%. Love that. Personal responsibility.'],
  [3, "You turned it up? Somebody's been deprogrammed. Love to see it."],
  [4, "{intensityPct}%. Bold. Simple question: can you back that up? We'll see."],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Save some for the rebuttal.'],
  [2, '{wbalPct}% W′bal left. Running on fumes. Government-subsidized fumes.'],
  [2, 'Reserves low. Ride smart. Smarter than a freshman with a credit card.'],
  [3, 'Your W′bal is lower than attendance at a socialism meeting after the free pizza runs out.'],
  [4, 'W′bal {wbalPct}%. You spent it like the government: fast, early and on nothing useful.'],
  [5, 'W′bal at {wbalPct}%. Blew the whole budget on day one? Damn. Spoken like a true socialist.', P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Running on conviction now. Good. I run on conviction too.'],
  [3, 'The tank is empty. Now we find out what you actually believe.'],
  [4, "Zero W′bal. Bankrupt. You want a bailout. You're not getting one. Free market."],
])

b.add('pr', [
  [1, "New {prLabel} PR. That's a fact. A beautiful fact."],
  [1, 'A new {prLabel} best. Personal responsibility pays off.'],
  [2, "{prLabel} personal record. {power} watts. Prove you wrong? I can't. Respect."],
  [3, "A {prLabel} PR? Huh. I've got nothing. Nobody screenshot this. I always have something."],
  [4, 'New {prLabel} best. Finally, some evidence. Where has this been all semester?'],
  [5, "{prLabel} PR! Damn! Clip it! That's going on the channel!", P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Holding your position. Good.'],
  [2, 'Minute {minute}. Still at the table. I respect that. Kind of.'],
  [3, "Minute {minute}. Projected {projectedFtp}. The data's on your side. For now."],
  [1, "Minute {minute}. Easy start. Don't open with your best argument.", when(lte('minute', 3))],
  [3, "Minute {minute}. Everyone's confident this early. Ask any freshman in September.", when(lte('minute', 3))],
  [2, 'Minute {minute}. Closing arguments. Make them count.', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you're saving, spend it. This isn't a trust fund.", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, that's {projectedGain} up. Data doesn't lie. Don't choke.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, "New FTP {ftpNew}. Up {ftpGain}. That's a fact. Congratulations.", when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} to {ftpNew}. Hard work, no handouts. The free market of watts.', when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn. You actually proved me wrong.', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Tough result. We learn and we come back.', when(gt('ftpDrop', 0))],
  [3, "{ftpNew}, down {ftpDrop} from {ftpOld}. That's what a semester of indoctrination does to a pair of legs.", when(gt('ftpDrop', 0))],
  [2, 'FTP holds at {ftpNew}. Conservative. I approve.', when(eq('ftpGain', 0))],
  [1, "Test done. FTP {ftpNew}. Numbers don't have feelings. That's the beauty of it."],
])

b.add('workout_complete', [
  [1, 'Workout complete. Great job. That was a good debate.'],
  [1, 'Done. {elapsedMin} minutes. Personal responsibility. Love it.'],
  [2, 'Done. NP {np}. Solid. Better than most college kids could manage.'],
  [2, '{kj} kJ of work. More productive than a whole semester of most majors.'],
  [3, "You finished. Against all my predictions. I'll admit it. Once."],
  [4, "Workout complete. You came to the table and you didn't get owned. Mostly."],
  [5, "That's a wrap. Damn good work. I'll deny it on the podcast.", P],
])

b.add('ride_bailed', [
  [1, "Early exit. Okay. We'll pick the debate back up tomorrow."],
  [2, "Leaving at {elapsedMin} minutes? You forfeit. Forfeits count as losses. That's a fact."],
  [3, "Bailed. You're a dropout. I'm a dropout too, but I built something. You built a skipped workout."],
  [3, "Early exit. I'll tell everyone you had a safe-space emergency."],
  [4, 'Quitting already? I had twenty more questions about your cadence. All gotchas.'],
  [5, 'You bailed? Hell, even the protesters stick around longer than that.', P],
])

b.add('fueling_reminder', [
  [1, 'Snack time. Eat something. Fuel the argument.'],
  [1, 'Fuel check. Carbs in. Excuses out.'],
  [2, "Eat. And no, it's not free. You earned it. Barely."],
  [3, 'Eat something. Running on empty, you pedal like a sophomore at an 8 a.m. lecture.'],
  [4, "{elapsedMin} minutes in. Eat now, or you'll bonk and blame capitalism."],
  [5, 'Eat a damn gel. Hungry you debates like a toddler.', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water. Stay hydrated. Stay sharp.'],
  [2, "Hydration break. Bottle's right there. It's not a protest sign. Pick it up."],
  [3, "Drink. Talking this fast is thirsty work. For me. You're barely talking."],
])

b.add('distress', [
  [1, "Okay, debate's off. Seriously: ease off and breathe. Stop if something feels wrong."],
  [1, 'No arguments now. Soft-pedal or stop. You matter more than the workout.'],
])

b.add('idle_banter', [
  [1, "You're doing fine. That's not spin. That's a fact."],
  [1, 'Keep going. Personal responsibility, one pedal stroke at a time.'],
  [2, 'Let me ask you a question. Let me ask you a question. Are you still pedaling? Good. Next.'],
  [2, "{elapsedMin} minutes in. Still at the table. That's more than most people manage."],
  [2, 'Power {power}, cadence {cadence}. Facts. I love facts.'],
  [3, 'Who taught your legs to quit at the first sign of hardship? A tenured professor? That is indoctrination.'],
  [3, "Your quads want to redistribute the work to your calves. That's socialism. Stop it."],
  [3, "Hold on, hold on, hold on. I'm talking. I'm talking. Okay. Now you pedal."],
  [4, 'Your legs are on my watchlist. Not for their opinions. For their output.'],
  [4, 'You own a smart trainer, a fan and a strap, and you still want a handout from the cooldown.'],
  [4, 'Big government, big promises, big gut. Two of those are your fault.'],
  [5, "Sixteen years of school and you still haven't figured out how pedals work. Prove me wrong."],
  [5, 'Your power file reads like a student loan: big promises up front, then decades of nothing.'],
  [5, "You're pedaling like you expect the government to finish this for you. Pedal, damn it.", P],
])

b.add('segment_start', [[5, '{targetW} watts. Quit stalling. Prove me wrong or get the fuck off my table.', P]], [HARD])
b.add('under_target', [[5, '{power} watts. Fucking embarrassing. My folding table puts out more than that.', P]])
b.add('idle_banter', [[5, "This pace is bullshit. And I've sat through a lot of campus bullshit.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Welcome to the table. Prove me wrong. Spoiler: you fucking can't.", P],
  [4, "Clip in. Today we're debating your effort, and your effort's position is shit.", P],
])
b.add(
  'segment_start',
  [
    [2, "{targetW} watts. You think it's easy? Okay. Prove me wrong. No, seriously, fucking prove it.", P],
    [5, "{targetW} watts for {remainingS}. Already got an excuse? That's a talking point. A shit one.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'Ten seconds. Your legs have a counterargument? Fuck the counterargument. Pedal.', P]])
b.add('halfway', [[4, "Halfway. Half the interval, half the effort. That's some participation-trophy shit.", P]])
b.add('last_minute', [[3, "Last minute. Don't fuck this up. Everybody's filming.", P]])
b.add('segment_end_success', [
  [1, 'Okay, that was fucking great. Clip it. Post it.', P],
  [5, 'You hit it? Shit. I had a whole rebuttal ready.', P],
])
b.add('segment_end_failed', [
  [3, '{pct}%. That interval was a shitty term paper. Plagiarized from someone slower.', P],
  [5, 'Average {avgW}, target {targetW}. That gap is bigger than your fucking student debt.', P],
])
b.add('under_target', [
  [2, "{deficitW} watts short. Come on, that's some safe-space bullshit.", P],
  [4, '{power} watts? A freshman with a megaphone pushes more than that. What the fuck.', P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. You're pedaling like a fucking student government meeting.", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping? Great. A walkout. Very brave. Very fucking brave.", P]])
b.add('skipped_interval', [[3, 'Skipped {segmentLabel}. Canceled it. Woke as fuck.', P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? That's some big-government, do-it-for-me shit.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You blew that like a fucking student loan on a gap year.', P]])
b.add('pr', [[2, '{prLabel} PR? Well, shit. I stand corrected. That never fucking happens.', P]])
b.add('ftp_test_result', [[4, 'FTP {ftpNew}. Put that shit on the table sign. Prove me wrong.', P]])
b.add('workout_complete', [
  [1, "That's it. You were fucking great today. That's a fact.", P],
  [5, 'Done. {tss} TSS. Not bad for someone who opened like a shitty freshman essay.', P],
])
b.add('ride_bailed', [[5, "Leaving at {elapsedMin} minutes? Walking out mid-debate? That's the most college shit I've ever seen.", P]])
b.add('fueling_reminder', [[3, 'Eat something. Hangry you is a shit debater.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Solid. Boring as shit. Very centrist.', P],
  [4, 'This ride has the energy of a fucking faculty meeting.', P],
  [5, 'Your legs have been indoctrinated by Big Recovery. Wake the fuck up.', P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, "{place}! New campus. New table. Let's go."],
    [2, "{place}! {kmDone} km. That's a real campus tour."],
    [3, '{place}. I set up a table here once. They yelled at me for six hours. I loved it.'],
    [4, "We're in {place}. The locals did not expect you to arrive this slowly. Nobody did."],
    [5, "{place}! {kmLeft} km to go and you're touring like a damn freshman on a rental scooter.", P],
    [5, '{place}. {kmLeft} km to go. Your legs want to transfer schools.'],
  ],
  NOT_END,
)
// Border and summit lines carry NOT_END too, so they outrank the generic place lines there.
b.add('journey_milestone', [
  [1, 'Welcome to {place}. New country. Same debate.'],
  [3, "{place}! A new country. I checked. They don't hand out free watts here either."],
], [eq('milestoneKind', 'border'), ...NOT_END])
b.add('journey_milestone', [
  [1, 'The top of {place}. The high ground. Debate from here.'],
  [3, 'You got up {place}. The mountain argued. You won. Respect.'],
], [eq('milestoneKind', 'summit'), ...NOT_END])
b.add('journey_milestone', [
  [1, "Halfway! That's midterms. You're passing."],
  [3, 'Halfway through {journeyName}. Second semester. Less partying, more pedaling.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! {journeyName}, done! Debate over. You win.'],
  [3, "{place}. {kmDone} km. You finished. Prove me wrong? I can't. Respect."],
], [eq('milestoneKind', 'finish')])

export const CHARLIE_KIRK: PersonaPack = {
  meta: {
    id: 'charlie-kirk',
    name: 'Charlie Kirk',
    tagline: "Prove me wrong: you can't finish this interval. Let me ask you a question...",
    voiceHint: { rate: 1.28, pitch: 1.05, preferVoices: ['Eddy', 'Reed', 'Fred', 'Alex', 'Tom'] },
  },
  lines: b.build(),
}
