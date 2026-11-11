// Hillary: a parody of Hillary Clinton's public persona. The over-prepared
// policy wonk with a binder and a fourteen-point plan for every interval,
// Secretary of State diplomacy turned on your quads, the 2016 loss she still
// brings up (the popular vote, Wisconsin, "it was in the bag"), the private
// email server ("like with a cloth", "I don't recall"), "I'm with her",
// "Pokémon go to the polls", the basket of deplorables (your excuses), the
// cackle, "it takes a village", pantsuits and "delete your account". Mean
// about the rider's effort, excuses and kit; the bit is always the ride.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('hillary')

b.add('ride_start', [
  [1, "Hello. I've prepared a fourteen-point plan for today's ride. Point one: pedal. Points two through fourteen: see point one."],
  [1, "So good to see you. I was ready on day one. Let's see if you are."],
  [2, "Today's workout is {workoutName}. I've read the briefing book. All nine hundred pages. Twice. With tabs."],
  [3, "Welcome back. I've reviewed your last ride. I have concerns. They're in a binder, color-coded by disappointment."],
  [4, "You showed up. That's more than I did in Wisconsin, and we all saw how that turned out."],
  [5, 'Look at you. High negatives, no ground game, zero enthusiasm. I know a losing campaign when I see one. I ran two.'],
  [5, 'You look like a voter who stayed home in November. Get on the damn bike.', P],
  [2, "FTP test today. The polls say you'll improve. I stopped trusting polls in 2016.", when(rideKind('ftp-test'))],
  [3, "A free ride? No plan? I've never done anything without a plan. I have plans for my plans.", when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, "Interval time. {targetW} watts for {remainingS}. I've briefed your legs. They know what to do."],
    [1, '{targetW} watts. Stronger together: you and the pedals. Mostly the pedals.'],
    [2, '{targetW} watts. I have a fourteen-point plan for this interval. Point one: do not embarrass me on camera.'],
    [3, '{targetW} watts. Everyone said I was overqualified. Nobody will ever say that about your legs.'],
    [4, '{targetW} watts. I have negotiated with dictators. I can negotiate with your quads. Your quads are worse.'],
    [5, "{targetW} watts. Go. Fold on this one and I'll delete you. Like with a cloth."],
    [3, 'Rep {rep} of {reps}. Like campaign stops. Exhausting, repetitive, and you still have to smile.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'Last rep. Finish strong. Leave nothing on the table. Or on a private server.'],
    [4, "Final rep. It's 3 a.m. and the phone is ringing. Who do you want answering it? Not those legs."],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'All out for {remainingS}. Every watt. This is not the time for a cautious campaign.'],
    [4, 'Max effort. Show me the passion I never once managed in a stump speech.'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, "The ramp. It gets harder every minute, like a primary that won't end. Ask me how I know."],
    [4, "Ramp test. Every step is another debate, and you didn't prep for a single one. I prepped for all of mine."],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, 'Warmup. Easy spin. Fundamentals first. Then the binder.'],
    [3, "Warmup. You'll win this part. Enjoy it. I won the popular vote once, and look where it got me."],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Steady at {targetW} watts. Methodical. Disciplined. Very on message.'],
    [3, 'Steady at {targetW}. Careful, competent, a little boring. Voters hated it. So will your legs.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, 'Recovery. Breathe. Even diplomats get a coffee break.'],
    [2, "Rest for {remainingS}. That's a congressional recess. Just as productive, too."],
    [4, "Recovery. Your power file shows coasting. I'd delete it for you, but people get so upset when I delete things."],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, "Free ride. No plan. I'll try to stay calm about that."],
    [3, "No target for {remainingS}. Nothing to fail at. Your comfort zone. I've never had one."],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, "Cooldown. Well done. That's a good day's work for the American people."],
    [3, 'Cooldown. The concession speech of the workout. Be gracious. I was. Mostly.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, "Ten seconds. Briefing book closed. Let's go."],
  [1, "Ten seconds. I'm with her. Today I'm also with you. Go."],
  [2, "Ten seconds to {targetW} watts. I've war-gamed this. Go."],
  [3, 'Ten seconds. Last chance to blame Russian bots for your power meter.'],
  [4, "Ten seconds. I've rehearsed this moment. You clearly haven't."],
  [5, 'Ten seconds. Quit on this one and you can delete your account.'],
  [2, 'Ten seconds to all out. Hold nothing back. Not even a backup server.', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'Halfway. Right on schedule. I love a schedule.'],
  [2, 'Halfway there. {remainingS} left. Stay on message.'],
  [3, "Halfway. This is where my campaigns started to wobble. Don't wobble."],
  [4, 'Halfway, and your power line looks like my favorability rating. Up, down, and then mostly down.'],
  [5, "Halfway. Half the effort, half the turnout. Damn, it's like watching my Rust Belt numbers come in.", P],
  [2, 'Halfway and right on target. Prepared, competent, on message. My kind of rider.', when(gte('pct', 98))],
  [3, 'Halfway and {deficitW} watts short. The polling is soft. Get out the vote in those quads.', when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'One minute left. Close it out.'],
  [2, 'Last minute. Hold {targetW}. Take nothing for granted. Believe me, I know.'],
  [2, 'One minute. Closing statement. Make it sound rehearsed. I always did.'],
  [3, "Sixty seconds. I've smiled through four-hour state dinners. You can do one minute."],
  [4, 'Final minute. Fade now and the networks will call it before the polls close.'],
  [5, "Last minute. Don't you dare blow a lead. That's my damn move.", P],
  [3, "Last minute and {deficitW} short. Comebacks happen. Not to me, but I've read about them.", when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, "Well done. {pct}% of target. That's a mandate."],
  [1, "That's it. Excellent interval. Very presidential."],
  [2, "Good. Competent, prepared, effective. Nobody's excited about it, but it's good. Story of my life."],
  [3, "Nailed it. I'd hold a press conference, but I don't really do those."],
  [4, "{pct}% of target. Huh. I had a fourteen-point critique ready for when you failed. Shredding it."],
  [5, "Damn. That was good. Don't let it go to your head. I've seen what winning does to people. From a distance.", P],
  [2, "Set complete. A clean sweep. I wouldn't know the feeling, but congratulations.", when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, '{pct}% of target. Not the result we wanted. We regroup. We always regroup.'],
  [2, "{pct}% of target. I've seen better numbers on election night. Not mine, but I've seen them."],
  [3, "Average {avgW}, target {targetW}. That's the gap between my polls and my results."],
  [3, 'That interval had the energy of a policy speech nobody came to.'],
  [4, "{pctUnder}% under. I've lost by less than that, and I still bring it up. Constantly."],
  [4, "Under target. Your excuses are piling up in a basket. And frankly, they're deplorable."],
  [5, "{pct}%? That was half-assed. I've seen subpoenas with more follow-through.", P],
])

b.add('under_target', [
  [1, "You're {deficitW} watts short. Let's close that gap together."],
  [1, "{power} watts. The target is {targetW}. I have a plan for this. It's called pedaling."],
  [2, "Under target. My old server worked harder than this, and it's been wiped."],
  [3, "{power} watts? That's not a workout, that's a listening tour."],
  [4, '{deficitW} watts short. Your legs are turning out like young voters in a midterm.'],
  [5, "Thirty years of investigations and I never folded. You can't hold {targetW} for {remainingS}? Damn.", P],
  [3, "{pct}% of target. That's not a power output, that's a third-party vote share.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, "{surplusW} over already. Pace yourself. It's a long campaign."],
  [3, "{power} when the target's {targetW}? Peaking early. Like my poll numbers in October."],
  [4, "Too hot, too early. You'll blow it in the final week. Trust me. I'm an expert."],
])

b.add('cadence_sag', [
  [1, 'Cadence is slipping. Light gear, quick feet.'],
  [2, "Cadence {cadence}. Down {cadenceDrop}. Let's get turnout back up."],
  [2, 'Cadence sag. Spin it up. Stay on message.'],
  [3, 'Your cadence is dropping faster than my approval numbers after the emails.'],
  [3, "{cadence} rpm. You pedal like you're waiting for a recount."],
  [4, "Cadence {cadence}. I've seen faster reflexes on a Senate committee. And they're all ninety."],
  [5, "Cadence down {cadenceDrop} rpm. Spin, damn it. Your legs think this is in the bag. It's not. Trust me.", P],
])

b.add('hr_high', [
  [1, 'Heart rate {hr}. Over your cap of {hrCap}. Ease off a little. Pace matters.'],
  [2, '{hr} bpm. This is diplomacy, not a war. Back it off.'],
  [3, "Heart rate over the cap. You're campaigning like it's the final week. It isn't. Ease off."],
])

b.add('hr_spike_no_power', [
  [1, "Heart rate {hr} at {power} watts? That strap's been hacked. I know a hack when I see one."],
  [2, "{hr} bpm while coasting? Wet the strap. Or tell me who's been reading your emails."],
  [3, 'That heart-rate spike? Foreign interference. Probably just the strap.'],
])

b.add('stopped_pedaling', [
  [1, "Taking a break. That's fine. Hydrate. Regroup."],
  [1, "A pause. Good. Gather your thoughts. I'll put mine in a binder."],
  [2, "Pedals stopped. Is this a press availability? I don't do those."],
  [3, "Stopped at {elapsedMin} minutes. That's not on the itinerary. I wrote the itinerary."],
  [4, 'You stopped. Your legs are staging a sit-in. I support protest. Not this one.'],
  [5, 'Stopped at {elapsedMin} minutes? Hell. I did eighteen-hour campaign days in heels.', P],
])

b.add('resumed', [
  [1, "You're back. Wonderful. Let's get back to work."],
  [2, 'Back after {pausedS}. A short recess. Congress would be jealous.'],
  [4, 'You came back. A comeback. I tried that once. Twice, actually. Do better than me.'],
])

b.add('skipped_interval', [
  [1, 'Skipped it. Okay. We pivot.'],
  [2, "Skipped {segmentLabel}. I'll call it a strategic reallocation of resources."],
  [3, "You skipped an interval. That's not a strategy. That's a Wisconsin."],
  [3, "Skipping. It's not a big deal. Nothing is, if you delete it fast enough."],
  [4, 'Skipped? Delete your account.'],
  [5, 'Skipped it? Damn. You wiped that interval cleaner than my server. Like with a cloth.', P],
])

b.add('extended_interval', [
  [1, 'Extended by {extraS}. Overprepared. I love it.'],
  [3, "You added {extraS}? Voluntarily? That's going in my next memoir."],
  [4, "Extra time. Look who's running for a second term. Careful. Some of us never got a first."],
])

b.add('intensity_down', [
  [1, 'Intensity down to {intensityPct}%. Smart. Know your electorate.'],
  [2, "{intensityPct}%. Managing expectations. I've been doing that for decades."],
  [3, 'Intensity down. You negotiated with a spreadsheet and lost. I know the feeling. Mine was an electoral map.'],
  [3, "Down to {intensityPct}%. That's not a compromise, that's a surrender. Diplomatically speaking."],
  [4, '{intensityPct}%? I once pressed a reset button that said overcharge. Yours says undercharge.'],
  [5, '{intensityPct}%? Hell, just quit and write a memoir called What Happened. Oh, wait. Taken.', P],
])

b.add('intensity_up', [
  [1, 'Intensity up to {intensityPct}%. Ambitious. I like ambition.'],
  [3, "You turned it up? Bold. I hope the legs got the memo. And didn't delete it."],
  [4, "{intensityPct}%. Ready on day one, are we? I said that too. Let's see how it goes."],
])

b.add('wbal_low', [
  [1, 'W′bal at {wbalPct}%. Save some for the closing argument.'],
  [2, "{wbalPct}% W′bal left. We're low on campaign funds."],
  [2, 'Reserves low. Ride smart. Smarter than I campaigned in the Midwest.'],
  [3, 'Your W′bal is lower than turnout in a primary nobody cares about.'],
  [4, 'W′bal {wbalPct}%. You spent it all early, like a campaign that thought it had this in the bag.'],
  [5, "W′bal {wbalPct}%. Blew it all early and ran dry in the final stretch? Damn. That's my whole 2016.", P],
])

b.add('wbal_empty', [
  [1, 'W′bal empty. Running on pure determination now. I have plenty. Borrow some.'],
  [3, 'The tank is empty. Now you find out who you really are. I found out on a Tuesday night in November.'],
  [4, 'Zero W′bal. Empty. Like a ballroom after the victory party gets cancelled.'],
])

b.add('pr', [
  [1, "New {prLabel} record. Congratulations. That's a historic first."],
  [1, 'A {prLabel} personal best. You put a crack in the glass ceiling.'],
  [2, "{prLabel} personal record, {power} watts. That's a landslide."],
  [3, 'A {prLabel} PR. Take this moment. Savor it. Some of us never got ours.'],
  [4, 'New {prLabel} best. Where were you when I needed a Michigan field office?'],
  [5, '{prLabel} PR! Damn. Frame that power file. And for once, nobody delete it.', P],
])

b.add('ftp_test_minute', [
  [1, 'Minute {minute}. Projected {projectedFtp}. Steady. Disciplined. Exactly as planned.'],
  [2, "Minute {minute}. I've given longer speeches to smaller crowds. Keep going."],
  [3, "Minute {minute}. Projected {projectedFtp}. The polls look good. I've learned not to celebrate."],
  [1, "Minute {minute}. Start easy. Don't peak in the primaries.", when(lte('minute', 3))],
  [3, "Minute {minute}. Everybody's a frontrunner this early. I've been a frontrunner. It doesn't last.", when(lte('minute', 3))],
  [2, 'Minute {minute}. Final stretch. This is get-out-the-vote weekend. Go knock on doors.', when(gte('minute', 15))],
  [4, "Minute {minute}. Whatever you're saving, spend it. Don't be the campaign with money left in the bank.", when(gte('minute', 17))],
  [
    2,
    "Minute {minute}. Projected {projectedFtp}, {projectedGain} up. Don't celebrate before it's certified.",
    when(gt('projectedGain', 0)),
  ],
])

b.add('ftp_test_result', [
  [1, 'New FTP {ftpNew}. Up {ftpGain}. A historic victory. Congratulations.', when(gt('ftpGain', 0))],
  [3, 'Up {ftpGain} to {ftpNew}. You won the popular vote and the electoral college. Show-off.', when(gt('ftpGain', 0))],
  [5, '{ftpNew}! Up {ftpGain}! Damn. You actually won something. Enjoy it. Some of us never do.', whenP(gt('ftpGain', 0))],
  [1, 'FTP {ftpNew}, down {ftpDrop}. Losing hurts. I know. We learn, and we come back.', when(gt('ftpDrop', 0))],
  [3, '{ftpNew}, down {ftpDrop} from {ftpOld}. I know this feeling. I wrote a whole book about it.', when(gt('ftpDrop', 0))],
  [2, "FTP holds at {ftpNew}. Stable. Experienced. Nobody's excited, but it's very qualified.", when(eq('ftpGain', 0))],
  [1, "Test complete. FTP {ftpNew}. I'll have my team draft a statement."],
])

b.add('workout_complete', [
  [1, "Workout complete. Wonderful job. I'm proud of you."],
  [1, "Done. {elapsedMin} minutes of hard work. That's public service."],
  [2, 'Done. NP {np}. Solid, competent, experienced. My kind of numbers.'],
  [2, '{kj} kJ of work. That is more energy than the youth vote ever gave me.'],
  [3, "You finished. Against my projections. And I've learned my projections aren't great."],
  [4, "Workout complete. I'm saving this ride to my private server, where nobody will ever have to see it."],
  [5, "That's a wrap. Damn good work. If anyone asks, I'll say I don't recall.", P],
])

b.add('ride_bailed', [
  [1, "Ending early. That's okay. Sometimes you concede and fight another day."],
  [2, "Leaving at {elapsedMin} minutes? That's a short campaign."],
  [3, "Bailed. I stayed in a primary until June. You couldn't stay in a workout for an hour."],
  [3, "Early exit. I'll have my team call it a scheduling conflict."],
  [4, "Quitting already? I've conceded twice and I still showed up for more than this."],
  [5, 'You bailed? Hell, even my campaign made it to November.', P],
])

b.add('fueling_reminder', [
  [1, 'Snack time. Eat something. Fuel the campaign.'],
  [1, 'Fuel check. A gel now, so you can win the final stretch.'],
  [2, 'Eat. Every good campaign runs on cold pizza and stubbornness.'],
  [3, 'Eat something. Running on empty, you ride like a candidate at a county fair. Awkwardly.'],
  [4, "{elapsedMin} minutes in. Eat now, or you'll fade in the final week and blame the FBI."],
  [5, 'Eat a damn gel. Hungry you has the stamina of a Senate quorum on a Friday.', P],
])

b.add('hydration_reminder', [
  [1, 'Drink some water. Hydration is a bipartisan issue.'],
  [2, "Hydration break. The bottle's right there. It's not a prop."],
  [3, 'Drink. Your bottle is the only thing in this room still polling above fifty.'],
])

b.add('distress', [
  [1, "Let's suspend the campaign for a moment. Ease off and breathe. Stop if something feels wrong."],
  [1, 'No plan matters more than you do. Soft-pedal or stop. The workout can wait.'],
])

b.add('idle_banter', [
  [1, "You're doing well. I mean that. It's not a talking point."],
  [1, "Keep going. Steady, prepared, relentless. That's how things get done."],
  [2, 'It takes a village to finish a workout. Today the village is you and a fan.'],
  [2, '{elapsedMin} minutes in. Still pedaling. That is more stamina than most congressional committees.'],
  [2, "Power {power}, cadence {cadence}. I've put those in a spreadsheet. Color-coded."],
  [3, 'Ha ha ha ha ha. Sorry. I just looked at your power file.'],
  [3, 'Some of your excuses are deplorable. The rest are just sad. Either way, they go in a basket.'],
  [3, 'Pokémon go to the pedals. Was that relatable? My team said it was relatable.'],
  [4, 'I visited a hundred and twelve countries as Secretary of State. None of them pedaled like this. Thank God.'],
  [4, "My speaking fee is two hundred grand. You're getting this pep talk free. Act like it."],
  [5, "You're the most overprepared, underperforming rider I've ever seen. And I own a mirror."],
  [5, "I'll say this diplomatically: your bib shorts are under more pressure than I was in 2016."],
  [5, "You're pedaling like it's already in the bag. It's never in the bag. Pedal, damn it.", P],
])

b.add('segment_start', [[5, "{targetW} watts. I didn't put eighteen million cracks in the glass ceiling to watch you pedal like a fucking houseplant.", P]], [HARD])
b.add('under_target', [[5, "{power} watts. Fucking pathetic. I've seen more push from a pantsuit on a hanger.", P]])
b.add('idle_banter', [[5, "I'm keeping your power file on a private server. Nobody needs to see this shit.", P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, "Hello, everyone. I have a plan for this ride, a backup plan, and a backup server. Let's fucking go.", P],
  [4, "Clip in. I survived thirty years of hearings, and I'm going to enjoy every fucking minute of yours.", P],
])
b.add(
  'segment_start',
  [
    [2, "{targetW} watts. I've read the full briefing. Executive summary: this is going to hurt like shit.", P],
    [5, "{targetW} watts for {remainingS}. Got an excuse ready? I've heard better from my own campaign, and those were shit.", P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, "Ten seconds. Don't fuck this up. I've had enough losses for one lifetime.", P]])
b.add('halfway', [[4, "Halfway. Half the interval, a quarter of the effort. That's a shit ground game.", P]])
b.add('last_minute', [[3, "Last minute. Victory speech or concession speech. Don't fuck it up.", P]])
b.add('segment_end_success', [
  [1, 'Okay, that was fucking excellent. Put it in the record. The real record, not the deleted one.', P],
  [5, 'You hit it? Shit. I had a whole binder of criticism ready.', P],
])
b.add('segment_end_failed', [
  [3, "{pct}%. That wasn't an interval, that was a shitty first draft of a concession speech.", P],
  [5, 'Average {avgW}, target {targetW}. That gap is a fucking swing state, and you just lost it.', P],
])
b.add('under_target', [
  [2, "{deficitW} watts short. Come on. That's some low-turnout bullshit.", P],
  [4, '{power} watts? My old fucking BlackBerry pushed more than that.', P],
])
b.add('cadence_sag', [[3, "Cadence {cadence}. That's not a pedal stroke, that's a fucking filibuster.", P]])
b.add('stopped_pedaling', [[4, "Oh, we're stopping? Fine. I'll just stand here and fucking smile like it's a debate.", P]])
b.add('skipped_interval', [[3, "Skipped {segmentLabel}. Where'd it go? Same place as the thirty-three thousand emails. Fucking gone.", P]])
b.add('intensity_down', [[4, "{intensityPct}%? I spent my life breaking ceilings and you're digging a fucking basement.", P]])
b.add('wbal_low', [[3, 'W′bal {wbalPct}%. You spent that like a super PAC with no fucking strategy.', P]])
b.add('pr', [[2, "{prLabel} PR? Well, shit. Alert the press. I'll even take questions. Fuck it, two questions.", P]])
b.add('ftp_test_result', [[4, "FTP {ftpNew}. I'm having it embroidered on a pantsuit. Don't you fucking question it.", P]])
b.add('workout_complete', [
  [1, "That's it. You were fucking great today. I'm with you. I mean it.", P],
  [5, 'Done. {tss} TSS. Not bad for someone who opened like a fucking third-party candidate.', P],
])
b.add('ride_bailed', [[5, 'Leaving at {elapsedMin} minutes? Walking out mid-race? Even I stuck around for the fucking results.', P]])
b.add('fueling_reminder', [[3, 'Eat something. Hangry you is a shitty surrogate.', P]])
b.add('idle_banter', [
  [2, 'Power {power}, cadence {cadence}. Solid numbers. Boring as shit. Very on brand for me.', P],
  [4, 'This ride has the energy of a fucking town hall at a Holiday Inn.', P],
  [5, 'Delete your account. Then delete this ride. Then delete whatever the fuck that cadence was.', P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, "{place}. What a wonderful town. I'd love to hear their concerns."],
    [2, '{place}! {kmDone} km. On schedule. I love it when the itinerary holds.'],
    [3, "{place}. I never campaigned here. That's usually where things go wrong."],
    [4, "We're in {place}. The local field office did not expect you to arrive this slowly."],
    [5, "{place}! {kmLeft} km to go and you're moving like a damn motorcade with a flat.", P],
    [5, '{place}. {kmLeft} km to go. Longer than my road to the White House. And mine never got there.'],
  ],
  NOT_END,
)
// Border and summit lines carry NOT_END too, so they outrank the generic place lines there.
b.add('journey_milestone', [
  [1, "Welcome to {place}. I've been here on official business. You're on unofficial suffering."],
  [3, '{place}! New country. I once landed somewhere under sniper fire. Or I remember it that way.'],
], [eq('milestoneKind', 'border'), ...NOT_END])
b.add('journey_milestone', [
  [1, "The top of {place}. Wonderful. Higher than any ceiling I've cracked."],
  [3, 'You got up {place}. Harder than the glass ceiling, and I never got through that either.'],
], [eq('milestoneKind', 'summit'), ...NOT_END])
b.add('journey_milestone', [
  [1, "Halfway! {kmDone} km. We're on track. I hate saying that out loud."],
  [3, "Halfway through {journeyName}. In my experience, the second half is where it all goes wrong. Don't let it."],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, "{place}! {journeyName}, done! That's a victory. I'll take it."],
  [3, '{place}. {kmDone} km. You finished the race. Not everyone gets to. Believe me.'],
], [eq('milestoneKind', 'finish')])

export const HILLARY: PersonaPack = {
  meta: {
    id: 'hillary',
    name: 'Hillary',
    tagline: 'A fourteen-point plan for every interval, and a private server for your excuses.',
    voiceHint: { rate: 1.02, pitch: 1.0, preferVoices: ['Samantha', 'Karen', 'Moira', 'Victoria', 'Alex'] },
  },
  lines: b.build(),
}
