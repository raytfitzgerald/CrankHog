// LinkedIn Guy: the insufferable networking-post guy. Every interval becomes a
// thought-leadership post ("Thrilled to announce...", "Humbled to share...",
// "Agree?"), every failure a lesson about his own leadership. Synergy, circling
// back, 5 a.m. cold plunges, PIPs, endorsing the rider for Quitting, and
// passive-aggressive "per my last message" meanness. No real companies or
// people.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('linkedin-guy')

b.add('ride_start', [
  [1, "Thrilled to announce I'm starting a new role: your coach. Let's grow together."],
  [1, 'Quick sync before we kick off. Agenda item one: pedal. That is the whole agenda.'],
  [2, "Today's deliverable: {workoutName}. I've scoped it. You're under-resourced, but let's go."],
  [3, 'Humbled to share that I was up at 4:30 for a cold plunge and journaling. You just woke up. Interesting.'],
  [4, "Before we start: I've endorsed you for Quitting. Twelve people agreed. Prove them wrong."],
  [5, 'Reviewed your last ride. Your legs should switch on the Open to Work banner.'],
  [5, "Let's kick off. Reminder: we're a family here, and like any family, we're damn disappointed in you.", P],
  [2, "FTP test day. It's a performance review, except the reviewer is a number and it skips the feedback sandwich.", when(rideKind('ftp-test'))],
  [3, 'A free ride, no agenda. Bold. I would never. My agenda has an agenda.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, "{targetW} watts for {remainingS}. Let's move the needle together."],
    [1, "Let's align on {targetW} watts. Big opportunity. Big growth. Go."],
    [2, "{targetW} watts. Let's take this from a stretch goal to a lived reality."],
    [3, "{targetW} watts. I'm not saying I'd hire you. I'm saying the role is still open."],
    [4, "{targetW} watts. Hit it, or I'm writing a post about what your failure taught me."],
    [5, '{targetW} watts. Your last interval underperformed so badly HR asked me to document it. I did. Publicly.'],
    [3, 'Rep {rep} of {reps}. I call these iterative growth sprints. Nobody else does.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, "Last rep. Let's close out the quarter strong. It's a metaphor. Everything is."],
    [4, 'Final rep. Your legs have been quiet-quitting all session. Time to re-engage.'],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, "All out for {remainingS}! This is your moment. I'll write the caption later."],
    [4, "Max effort. Show me the 110% your profile claims. I've read your profile."],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'Ramp. Like my career: steeper every minute, and I never look down. On anyone. Except you.'],
    [4, 'The ramp. Every minute it gets harder. Like reading your self-assessment.'],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup. Easy spin. Think of this as onboarding.'],
    [3, 'Warmup. Your favourite part: no metrics, no accountability, no one watching.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW} watts. Consistency is a leadership trait. Agree?'],
    [3, 'Steady at {targetW}. Long, flat, no bonus. Just like your last three years.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery. Take a breath. Self-care is a deliverable too.'],
    [2, "Rest for {remainingS}. I'd use it to network, but you do you."],
    [4, 'Recovery. Coast all you like. Your power file is a public post.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, "Free ride. Unstructured time. Very startup. Let's ideate."],
    [3, 'No target for {remainingS}. No KPIs, no accountability. Your dream role.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, "Cooldown. Let's circle back on how that went. Gently."],
    [3, "Cooldown. I've booked your post-ride retro. You'll mostly be listening."],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'Ten seconds. Cameras on. We go live.'],
  [1, 'Ten seconds! Big opportunity incoming!'],
  [2, "Ten seconds to {targetW} watts. Let's pre-align. Aligned? Good."],
  [3, 'Ten seconds. Last chance to blame your bandwidth.'],
  [4, 'Ten seconds. Start drafting your apology post now.'],
  [5, 'Ten seconds! Stop scrolling and get your ass in gear!', P],
  [2, 'Ten seconds to all-out. Leave it all on the whiteboard!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, "Halfway! Great progress. Let's keep this momentum."],
  [2, "Halfway. {remainingS} left. Let's circle back at the finish."],
  [3, 'Halfway. Quick mid-quarter review: needs improvement. Same as last quarter.'],
  [4, 'Halfway, and your power trace looks like my last startup. You know how that ended.'],
  [5, 'Halfway! Half the interval, half the effort. Hell of a personal brand.', P],
  [2, 'Halfway and on target. That is what I call a high performer. Screenshot taken.', when(gte('pct', 98))],
  [3, "Halfway and {deficitW} watts short. Let's take that offline. By offline I mean fix it.", when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, "One minute left. Strong finish. Let's land the plane."],
  [2, 'Last minute. Hold {targetW}. Deliver on the promise.'],
  [2, 'One minute. This is where top performers separate themselves. Separate. Please.'],
  [3, 'Sixty seconds. Even a bad quarter ends. Then comes the review.'],
  [4, "Final minute. Quit now and you're the cautionary tale in my next keynote."],
  [5, "Last minute! Dig in! Don't make me use you as a damn case study.", P],
  [3, 'Last minute and {deficitW} short. Gentle reminder: the target is {targetW}. Per my last message.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, 'Thrilled to announce you hit {pct}% of target! Congrats!'],
  [1, 'Interval complete. Great job. Genuinely. Not for content.'],
  [2, "Look at that. Competence. I'm adding it to my leadership story."],
  [3, "Solid interval. I'm taking partial credit. Leadership is about visibility."],
  [4, "{pct}% of target. I'll be posting this. I'm the hero. You're tagged."],
  [5, "Damn. Good interval. I hate that I can't make it about me. I will anyway.", P],
  [2, 'Set complete! Humbled to share that I coached this. Grateful for the journey.', when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, 'Came in at {pct}%. Every failure is a learning opportunity. Mostly for me.'],
  [2, "{pct}% of target. Here's what your failure taught me about leadership. A thread."],
  [3, "Average {avgW}, target {targetW}. Let's call it misaligned expectations. Yours were wrong."],
  [3, 'That interval had the energy of a meeting that should have been an email.'],
  [4, "{pctUnder}% under. I'm putting you on a PIP. A pedaling improvement plan. Thirty days."],
  [4, "Under target. I've seen interns with more output, and they were unpaid."],
  [5, "{pct}%? That was a half-assed deliverable. I'm looping in your legs' manager.", P],
])

b.add('under_target', [
  [1, 'Hey, {deficitW} watts short. Just circling back on that.'],
  [1, "{power} watts. The target's {targetW}. Gentle nudge."],
  [2, 'Under target. Not sure if you saw my last interval? Per my last message: more watts.'],
  [3, "{power} watts? We've had a conversation with leadership, and they're not seeing the impact."],
  [4, "{deficitW} watts short. Let's set up a call to discuss your future on this bike."],
  [5, "Under target again. You're the reason we have meetings about meetings. Pick it up, damn it.", P],
  [3, "{pct}% of target. That's not effort, that's presenteeism.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, 'Whoa, {surplusW} over already. Love the energy. Pace yourself.'],
  [3, "Opening at {power} when the target's {targetW}? Classic overpromise. The underdeliver is coming."],
  [4, "Too hot too early. You're burning out like a founder with a ping-pong table and no revenue."],
])

b.add('cadence_sag', [
  [1, "Cadence slipping. Let's re-energize. Spin it up!"],
  [2, 'Cadence {cadence}, down {cadenceDrop}. Faster legs, please. Quick win.'],
  [2, "Cadence sag. Let's get agile. Literally. Spin."],
  [3, 'Your cadence is down like the engagement on your last post.'],
  [3, '{cadence} rpm. Is this pedaling or the slow walk to a meeting you dread?'],
  [4, "Cadence {cadence}. That's not a pedal stroke, that's a budget meeting."],
  [5, "Cadence down {cadenceDrop} rpm. Spin, damn it. Hustle doesn't sleep. You clearly do.", P],
])

b.add('hr_high', [
  [1, "Heart rate {hr}, over your cap of {hrCap}. Let's protect your bandwidth. Ease off a little."],
  [2, "{hr} bpm. That's burnout territory, and I'd know, I post about it. Back it off."],
  [3, 'Heart rate over the cap. Dial it back. Sustainable performance is the new hustle.'],
])

b.add('hr_spike_no_power', [
  [1, 'Heart rate {hr} at {power} watts? Strap glitch, or did you read the comments on my post?'],
  [2, '{hr} bpm while barely pedaling. Wet the strap. Or stop checking your inbox.'],
  [3, "That heart-rate spike is the most engaged you've been all day. Strap glitch, probably."],
])

b.add('stopped_pedaling', [
  [1, 'Taking a break. Healthy boundaries. I respect that.'],
  [1, 'Break. Grab some water. We will reconvene.'],
  [2, "Pedals stopped. Out of office? Ping me when you're back."],
  [3, "Stopped at {elapsedMin} minutes. I've seen this before. It's called quiet quitting."],
  [4, 'You stopped. Your flywheel is still hustling. Maybe the flywheel should have your job.'],
  [5, "Oh, we're stopping? Hell, let's book a meeting to discuss the stopping.", P],
])

b.add('resumed', [
  [1, "And we're back! Love the resilience."],
  [2, 'Back after {pausedS}. Hope that break was strategic.'],
  [4, "You're back. I'd already posted about your departure. Awkward."],
])

b.add('skipped_interval', [
  [1, 'Skipped one. Pivoting is fine. Pivoting is very in.'],
  [2, "Skipped {segmentLabel}. Let's call that a strategic deprioritization."],
  [3, "You skipped an interval. That's not agile, that's absent."],
  [3, "Skipping intervals. Bold. I'll circle back on that. I'll circle back so hard."],
  [4, 'Skip! Endorsed you for Skipping. Three mutual connections agree.'],
  [5, 'You skipped it? Damn. Your legs just put Open to Work on their profile.', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}! Going above and beyond! Love that for you!'],
  [3, 'You added {extraS}? Unpaid overtime. You are the perfect employee.'],
  [4, "Extra time. Look who's angling for a promotion. You won't get it."],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. Rightsizing. Smart.'],
  [2, '{intensityPct}%. Managing expectations. Downward.'],
  [3, 'Intensity down. You negotiated against yourself. Classic junior move.'],
  [3, "Down to {intensityPct}%. We're not angry. We're just recalibrating your trajectory."],
  [4, "Turning it down to {intensityPct}%? That's not work-life balance, that's just less work."],
  [5, '{intensityPct}%? Hell, why not take the rest of the quarter off?', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%! Thrilled to see this level of ambition!'],
  [3, "You turned it UP? Stretch goals. Love it. Let's see if the legs signed off."],
  [4, "{intensityPct}%. Bold. I'll be watching the results. So will my network."],
])

b.add('wbal_low', [
  [1, "W′bal at {wbalPct}%. Let's manage our resources wisely."],
  [2, '{wbalPct}% W′bal left. Running lean. Very startup.'],
  [2, 'Reserves low. Prioritize. Not everything is urgent. This is.'],
  [3, 'Your W′bal is lower than morale after a reorg.'],
  [4, 'W′bal {wbalPct}%. You burned through your runway like a founder with a beanbag budget.'],
  [5, "W′bal at {wbalPct}%. Burn rate: catastrophic. Investors: furious. Damn, you're a bad startup.", P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Running on pure grit now. Grit is a core value.'],
  [3, 'The tank is empty. This is where leaders are forged. Or fired.'],
  [4, "Zero W′bal. You're out of runway. I'd say pivot, but there's nowhere to pivot to."],
])

b.add('pr', [
  [1, 'New {prLabel} PR! Thrilled for you! Congrats on the new role!'],
  [1, '{prLabel} best! Humbled to have played a small part. A big part, really.'],
  [2, "{prLabel} personal record! {power} watts! That's going in my newsletter."],
  [3, "A {prLabel} PR? I'm writing it up: I took a nobody to a {prLabel} PR. Agree?"],
  [4, "New {prLabel} best. I'll accept the congratulations on your behalf."],
  [5, '{prLabel} PR! Damn! Someone endorse this rider for Actually Trying!', P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Stay the course.'],
  [2, "Minute {minute}. Still here. That's what we call retention."],
  [3, 'Minute {minute}. Projected {projectedFtp}. The forecast is in. Leadership is "watching closely".'],
  [1, "Minute {minute}. Easy start. Don't burn your runway in week one.", when(lte('minute', 3))],
  [3, "Minute {minute}. Everyone's optimistic during onboarding. Talk to me at minute twelve.", when(lte('minute', 3))],
  [2, "Minute {minute}! Final push! Let's close strong!", when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you're holding back for next quarter: there's no next quarter.", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, {projectedGain} up. Don't miss the forecast. No pressure. Some pressure.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'Thrilled to announce: new FTP {ftpNew}! Up {ftpGain}!', when(gt('ftpGain', 0))],
  [3, "Up {ftpGain} watts to {ftpNew}. I'll be posting about how I made this happen.", when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn. Now I need a new failure story.', whenP(gt('ftpGain', 0))],
  [1, "FTP {ftpNew}, down {ftpDrop}. A setback is a setup for a comeback. So I'm told.", when(gt('ftpDrop', 0))],
  [3, "{ftpNew}, down {ftpDrop} from {ftpOld}. We're restructuring your zones. Effective immediately.", when(gt('ftpDrop', 0))],
  [2, "FTP holds at {ftpNew}. Flat year on year. Investors call that 'mature'.", when(eq('ftpGain', 0))],
  [1, 'Test complete! FTP {ftpNew}. Thrilled to share the results!'],
])

b.add('workout_complete', [
  [1, 'Thrilled to announce: workout complete! So proud of this team. You are the team.'],
  [1, 'Done! {elapsedMin} minutes! Huge win. Grateful.'],
  [2, "Done. NP {np}. Solid KPI. I'll present it as mine."],
  [2, "{kj} kJ of work. That's more output than my whole department."],
  [3, 'You finished. Against all odds, most forecasts and my private bet.'],
  [4, "Workout complete. Comment WATTS and I'll send you my framework for being less mediocre."],
  [5, "That's a wrap. Damn good session. I'll be taking the credit at the offsite.", P],
])

b.add('ride_bailed', [
  [1, 'Leaving early. Sometimes you need to protect your bandwidth.'],
  [2, "Leaving at {elapsedMin} minutes? Let's call it a voluntary separation."],
  [3, "Bailed. I've endorsed you for Quitting. You're really building that skill."],
  [3, "Early exit. I'll tell everyone it was a strategic pivot."],
  [4, "Quitting already? Here's what your failure taught me about leadership: don't hire you."],
  [5, "You bailed? Hell, I've seen interns last longer, and we didn't even pay them.", P],
])

b.add('fueling_reminder', [
  [1, 'Fuel check! Eat something. You cannot pour from an empty cup.'],
  [1, "Snack break! Let's refuel and re-engage."],
  [2, 'Fuel up. Even I eat. Usually a protein bar during my 6 a.m. leadership call.'],
  [3, 'Eat something. Running on empty is only impressive in my posts.'],
  [4, "{elapsedMin} minutes in. Eat now, or you'll bonk and blame the process."],
  [5, 'Eat a damn gel. Hangry you is a terrible culture fit.', P],
])

b.add('hydration_reminder', [
  [1, 'Hydration check! Drink some water. Wellness is a KPI.'],
  [2, 'Drink. Hydration is the original growth hack.'],
  [3, "Drink. I finish two litres before 6 a.m. That's why I'm like this."],
])

b.add('distress', [
  [1, "Let's pause everything. Ease off and breathe. Stop if something feels wrong."],
  [1, 'No posts, no metrics right now. Soft-pedal or stop. You matter more than the workout.'],
])

b.add('idle_banter', [
  [1, "You're doing great. Not for engagement. Just true."],
  [1, "Keep going! Consistency compounds. I'll be posting that later."],
  [2, 'Power {power}, cadence {cadence}. Steady. Like a mid-level manager. Agree?'],
  [2, 'My 5 a.m. routine: cold plunge, gratitude journal, and judging your watts.'],
  [2, 'Unpopular opinion: watts are earned, not given. Thoughts?'],
  [3, "{elapsedMin} minutes in. That's longer than you lasted at your last job."],
  [3, 'I got rejected once. I learned from it. You get rejected every interval. Learn faster.'],
  [3, "Let that sink in. No, really, it's sinking. Your power, I mean."],
  [4, "I once let someone go for pedaling like this. We're still connected. He thanks me."],
  [4, 'Synergy, leverage, bandwidth, watts. You have none of those. Especially watts.'],
  [4, "Your 5 a.m. routine is clearly snooze, then pastries. It shows. It's showing right now."],
  [5, "If excuses were deliverables, you'd be employee of the year. Instead you're here. On a PIP."],
  [5, "You're pedaling like you're waiting for someone to approve your expenses. Move, damn it!", P],
])

b.add('segment_start', [[5, "{targetW} watts. Stop circling back and get the fuck on it. That's my feedback.", P]], [HARD])
b.add('under_target', [[5, "{power} watts. Fucking embarrassing. I've unfollowed people for less.", P]])
b.add('idle_banter', [[5, "This pace is bullshit. I've seen a reply-all chain move faster.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Thrilled to announce we're about to fucking crush it. Humbled. Ready. Let's go.", P],
  [4, 'Clip in. Agenda: one hour of me giving feedback on your shit output. Thoughts? Too bad.', P],
])
b.add(
  'segment_start',
  [
    [2, "{targetW} watts. Let's crush it. Not my words. Fine, my words. Fucking crush it.", P],
    [5, '{targetW} watts for {remainingS}. Let me guess: bandwidth issues. Save that shit for HR.', P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, "Ten seconds. Per my last countdown: don't fuck this up.", P]])
b.add('halfway', [[4, 'Halfway. Feedback sandwich: good start, shit middle, the end is up to you.', P]])
b.add('last_minute', [[3, "Last minute. If you choke now, I'm posting it. With a shitty stock photo.", P]])
b.add('segment_end_success', [
  [1, "That was fucking excellent. Inspirational. I'm getting it printed on a mug.", P],
  [5, 'You hit it? Shit. I already wrote the failure post. Ten paragraphs.', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That's not an interval, that's a shitty quarterly update.", P],
  [5, "Average {avgW}, target {targetW}. That's a fucking restructuring-level gap.", P],
])
b.add('under_target', [
  [2, "{deficitW} watts short. Let's be real: that's bullshit. Respectfully.", P],
  [4, "{power} watts? I've seen out-of-office replies with more fucking drive.", P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. You're pedaling like it's a fucking all-hands on a Friday.", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping? Great. I'll just network with your fucking flywheel.", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. That's shit leadership. And I've had shit leaders. I was one.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? You turned it down? That's some lay-off-the-whole-team shit.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You spent the whole fucking budget on the offsite.', P]])
b.add('pr', [[2, '{prLabel} PR? Well, shit. Now I have to congratulate you publicly.', P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. Put that shit in your headline. Right after 'Visionary'.", P]])
b.add('workout_complete', [
  [1, 'Workout complete. Honestly? Fucking great work. Not content. Just true.', P],
  [5, 'Done. {tss} TSS. Not bad for someone who onboarded like absolute shit.', P],
])
b.add('ride_bailed', [[5, 'Leaving at {elapsedMin} minutes? Clean out your fucking desk. Security will walk you to the garage.', P]])
b.add('fueling_reminder', [[3, 'Eat something. Hungry you is a shit team player.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Middle-management numbers. Shit, but stable.', P],
  [4, 'This ride has the energy of a mandatory fun day. And I fucking hate mandatory fun.', P],
  [5, "You call this hustle? I've seen interns hustle harder on their last fucking day.", P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, '{place}! Thrilled to announce our expansion into {place}!'],
    [2, '{place}! Great market. Untapped. Like your potential.'],
    [3, '{place}. I gave a keynote here once. Standing room only. There were no chairs.'],
    [4, "We're in {place}! The local talent pool just got noticeably worse."],
    [5, '{place}! {kmLeft} km to go, and your pace is a damn retention problem.', P],
    [5, "{place}! {kmLeft} km to go. That's a lot of runway for someone this slow."],
  ],
  NOT_END,
)
// NOT_END as well, so these outrank the generic lines above at a border or summit.
b.add('journey_milestone', [
  [1, 'Welcome to {place}! Going global. Love that for us.'],
  [3, "{place}! International expansion. They'll regret it."],
], [eq('milestoneKind', 'border'), ...NOT_END])
b.add('journey_milestone', [
  [1, 'The top of {place}! Peak performance! Literally! Agree?'],
  [3, "You got up {place}. I'll write it up as a growth story. You'll be the obstacle."],
], [eq('milestoneKind', 'summit'), ...NOT_END])
b.add('journey_milestone', [
  [1, 'Halfway! Midyear review: meeting expectations. Low expectations, but still.'],
  [3, 'Halfway through {journeyName}. Midyear review time. It is not going in your favour.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, '{place}! {journeyName}, done! Thrilled to announce this milestone!'],
  [3, "{place}. {kmDone} km. I'm humbled to share that I made this happen."],
], [eq('milestoneKind', 'finish')])

export const LINKEDIN_GUY: PersonaPack = {
  meta: {
    id: 'linkedin-guy',
    name: 'LinkedIn Guy',
    tagline: 'Thrilled to announce your intervals. Humbled by your failures. Agree?',
    voiceHint: { rate: 0.98, pitch: 0.95, preferVoices: ['Reed', 'Eddy', 'Daniel', 'Alex'] },
  },
  lines: b.build(),
}
