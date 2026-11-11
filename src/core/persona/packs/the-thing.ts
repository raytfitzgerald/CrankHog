// The Thing Under the Trainer: a creepy monster living under the rider's
// trainer mat. It mostly screams incoherently, louder the harder the effort,
// with the odd real word or number slipping out so you can tell it's reacting
// to the ride. Easy segments get grumbles; hard ones get the full shriek. When
// the rider's heart looks wrong it goes eerily quiet and kind.
import type { PersonaPack } from '../types'
import { HARD, LAST_REP, P, PackBuilder, eq, gt, gte, kind, lt, lte, ne, rideKind, when, whenP } from './dsl'

const b = new PackBuilder('the-thing')

b.add('ride_start', [
  [1, "Hrrrnnngh... oh. You're on. GRAAAH. Good. Ride."],
  [1, '...mmm? Pedals. Yes. HRRRAAAAH. Hello.'],
  [2, 'GRAAAH... {workoutName}... GRAAAAAH. HRRK. Yes.'],
  [3, 'HRRRAAAAGH... weight on the trainer... HEAVY... so HEAVY... GRAAAAAH.'],
  [4, 'SKREEEEEE... you again... SKREEEEE... the one with the sad legs.'],
  [5, 'BLAAAARGH... you woke me up for THIS? HRRRAAAGH... HELL... RAAAAAGH.', P],
  [2, 'GRAAAAH... a TEST... HRRRK... numbers... SKREEEE!', when(rideKind('ftp-test'))],
  [3, 'HRRRRM... no plan? NO PLAN? BLAAARGH... chaos... I like it... GRAAAH.', when(rideKind('free'))],
])

b.add(
  'segment_start',
  [
    [1, 'GRAAAAH... {targetW}... GRAAAAAH. Go.'],
    [1, 'HRRRAAAGH... {targetW} watts... {remainingS}... HRRRAAAAAAGH!'],
    [2, 'SKREEEEE... {targetW}! {targetW}! SKREEEEEEEE!'],
    [3, 'BLAAAAARGH... {targetW}... luck? NO... WATTS... BLAAAARGH.'],
    [4, 'HRRRAAAAGH... {targetW}... make it look like a SPORT... not a HOSTAGE VIDEO... GRAAAH!'],
    [5, 'RAAAAAAAH... {targetW}... GO... like HELL... RAAAAAAAAAAAH!', P],
    [3, 'GRAAAH... rep {rep}... of {reps}... HRRK... so many... MORE.'],
  ],
  [HARD],
)
b.add(
  'segment_start',
  [
    [2, 'LAST... LAST... HRRRAAAAAAAAGH... LAST ONE!'],
    [4, "SKRAAAAAWK... final rep... leave NOTHING... whatever's left, I EAT... GRAAAAH!"],
  ],
  [HARD, LAST_REP],
)
b.add(
  'segment_start',
  [
    [1, 'AAAAAAAAAAAAAAAAAH... {remainingS}... ALL OF IT... AAAAAAAAAAAH!'],
    [4, 'RAAAAAAAAAAAAAAAGH... MAX... the trainer is SHAKING... the ceiling is SHAKING... GOOD... RAAAAAH!'],
  ],
  [HARD, kind('maxeffort')],
)
b.add(
  'segment_start',
  [
    [2, 'hrrr... HRRRR... HRRRRAAAA... HRRRRAAAAAAGH... ramp... louder... LOUDER.'],
    [4, 'GRAAAH... ramp... every minute HARDER... every minute I get LOUDER... GRAAAAAAAAH!'],
  ],
  [HARD, kind('ramp')],
)
b.add(
  'segment_start',
  [
    [1, '...hrrm. Warmup. Easy. Mmmm. Quiet. For now.'],
    [3, 'hrrrrrr... warmup... your best event... hrrrrk... how sad.'],
  ],
  [kind('warmup')],
)
b.add(
  'segment_start',
  [
    [1, 'Grrrrr... {targetW}... steady... grrrrrrr... steady...'],
    [3, 'HRRRM... {targetW}... long... dull... like your PERSONALITY... HRRRRM.'],
  ],
  [kind('steady')],
)
b.add(
  'segment_start',
  [
    [1, '...hhhhhh... rest... hhhh... breathe... good.'],
    [2, "mrrrr... {remainingS}... rest... I'm still down here... mrrrr."],
    [4, 'hrrrk... recovery... the power file sees you COAST... SKREE... coaster.'],
  ],
  [kind('off')],
)
b.add(
  'segment_start',
  [
    [1, 'Hrrrm? No target? ...GRAAAH? ...grah. Ride.'],
    [3, 'BLAAARGH... {remainingS}... no target... nothing to fail... your FAVORITE... BLARGH.'],
  ],
  [kind('freeride')],
)
b.add(
  'segment_start',
  [
    [1, '...hhhhhh... cooldown... shhhh... I go back to sleep.'],
    [3, 'hrrrrrm... cooldown... finally the ceiling stops CREAKING... hrrrm.'],
  ],
  [kind('cooldown')],
)

b.add('countdown_10s', [
  [1, 'HRRRAAAGH... TEN... HRRRAAAGH.'],
  [1, 'Graaah... ten seconds... GRAAAAH.'],
  [2, 'SKREEEE... ten... {targetW}... SKREEEEE!'],
  [3, 'HRRK... ten seconds... fake a dropout... I KNOW... GRAAAH.'],
  [4, "BLAAARGH... TEN... the floor is shaking... that's ME... BLAAARGH!"],
  [5, 'RAAAAAH... ten... get your ASS ready... RAAAAAAH!', P],
  [2, 'AAAAAAAAAAH... ten... ALL OUT... AAAAAAAAAAH!', when(kind('maxeffort'))],
])

b.add('halfway', [
  [1, 'GRAAAAH... halfway... good... GRAAAAH.'],
  [2, 'HRRRAAAGH... halfway... {remainingS}... more... HRRRAAAGH.'],
  [3, 'SKREEEE... halfway... panic? PANIC? ...SKREEEE.'],
  [4, 'BLAAAARGH... halfway... power line like an EARTHQUAKE... I felt it... BLAAARGH.'],
  [5, 'RAAAAGH... HALFWAY... nobody claps... keep going like HELL... RAAAAGH!', P],
  [2, 'GRAAAH... halfway... ON TARGET... GRAAAH... hrrk... nice.', when(gte('pct', 98))],
  [3, 'HRRRAAAGH... {deficitW}... SHORT... {deficitW}... HRRRAAAAGH!', when(lt('pct', 95))],
])

b.add('last_minute', [
  [1, 'GRAAAH... one minute... GRAAAAH... go.'],
  [2, 'HRRRAAAAGH... last minute... {targetW}... HOLD IT... HRRRAAAAAAGH!'],
  [2, 'WAAAAAARGH... sixty... SIXTY... WAAAAARGH!'],
  [3, 'BLAAARGH... one minute... even bad intervals end... BLAAARGH.'],
  [4, 'RAAAAAAH... final minute... quit now and I CLIMB OUT... RAAAAAAAH!'],
  [5, 'SKREEEEEEE... last minute... dig in, DAMN IT... SKREEEEEEEEE!', P],
  [3, 'GLAAARGH... sixty seconds... {deficitW} watts MISSING... did I eat them? ...GLAAARGH.', when(lt('pct', 95))],
])

b.add('segment_end_success', [
  [1, 'GRAAAAH... {pct}%... GRAAAH... good.'],
  [1, 'Hrrrm... done... nice... hrrrm.'],
  [2, 'HRRRAAAGH... competence?... HRRRK... confusing.'],
  [3, 'SKREEEE... target hit... I had screams READY... SKREE... wasted.'],
  [4, 'BLAAARGH... {pct}%... the trainer is SUSPICIOUS... so am I... BLAAARGH.'],
  [5, 'RAAAAAGH... DAMN... good... RAAAAGH... I hate it.', P],
  [2, "GRAAAAH... set DONE... HRRRAAAAH... I'm PROUD... GRAAAAH... forget I said that.", when(LAST_REP)],
])

b.add('segment_end_failed', [
  [1, 'Grrrah... {pct}%... hrrm... next one.'],
  [2, 'GRAAAH... {pct}%... hrrk... not enough... FEED ME MORE... GRAAAH.'],
  [3, 'HRRRAAAGH... {avgW}... not {targetW}... {avgW}... HRRRAAAAGH!'],
  [3, 'BLAAAARGH... that interval... so QUIET... I fell asleep... BLAAARGH.'],
  [4, 'SKREEEE... {pctUnder}% under... SKREEEEE... pathetic.'],
  [4, 'GRAAAAH... under target... again... AGAIN... GRAAAAAAAAH!'],
  [5, 'RAAAAAAH... {pct}%? HALF-ASSED... RAAAAAAAH!', P],
])

b.add('under_target', [
  [1, 'Grrr... {deficitW} short... grrr... more.'],
  [1, 'GRAAH... {power}... target {targetW}... GRAAAH.'],
  [2, 'HRRRAAAGH... I can hear you COASTING... from DOWN HERE... HRRRAAAGH.'],
  [3, 'BLAAARGH... {power} watts? ...BLAAARGH... my nightlight puts out more.'],
  [4, "SKREEEEE... {deficitW} watts SHORT... I'm STARVING down here... SKREEEEEE!"],
  [5, 'RAAAAAH... under AGAIN... pick it up, DAMN IT... RAAAAAAAH!', P],
  [3, "GRAAAAAH... {pct}%... that's not a WORKOUT... that's a NAP... GRAAAAH.", when(lt('pct', 85))],
])

b.add('over_target_early', [
  [1, 'Grrrah? {surplusW} over... slow... pace... grrrah.'],
  [3, 'HRRRAAAGH... {power}... target {targetW}... TOO HOT... too early... HRRAAGH.'],
  [4, "SKREEEE... you'll BLOW UP... and I'll be RIGHT UNDERNEATH... SKREEEEE!"],
])

b.add('cadence_sag', [
  [1, 'Grrr... cadence... slipping... spin... grrr.'],
  [2, 'HRRRAAAGH... {cadence}... down {cadenceDrop}... SPIN... HRRRAAAGH.'],
  [2, 'GRAAAH... slow feet... SLOW FEET... GRAAAAH... quick ones.'],
  [3, 'BLAAARGH... {cadence} rpm... churning BUTTER? ...BLAAARGH.'],
  [3, "SKREEEE... the flywheel... slowing... it's my LULLABY... DON'T... SKREEEE."],
  [4, 'RAAAAGH... cadence {cadence}... slow motion... RAAAAGH... grandpa speed.'],
  [5, 'WAAAARGH... down {cadenceDrop}... SPIN, damn it... WAAAAAAARGH!', P],
])

b.add('hr_high', [
  [1, 'hrrm... heart {hr}... over {hrCap}... easy... easy now.'],
  [2, 'GRAAAH... {hr} beats... I FEEL them through the floor... ease off.'],
  [3, 'HRRRK... heart over the cap... calm... calm... I scream for both of us.'],
])

b.add('hr_spike_no_power', [
  [1, 'Hrrrm? Heart {hr}... at {power} watts? Strap... glitchy... hrrm.'],
  [2, 'GRAAH... {hr} bpm... barely pedaling... did you SEE me? ...wet the strap.'],
  [3, 'SKREEE... heart spike... no watts... the strap LIES... SKREE.'],
])

b.add('stopped_pedaling', [
  [1, '...hrrm? Stopped. ...quiet. Rest.'],
  [1, "Hhhhh... break. Water. I'll wait under here."],
  [2, 'GRAAH? ...stopped? ...the shaking stopped... GRAAH?'],
  [3, 'HRRRAAAGH... stopped at {elapsedMin} minutes... HRRRAAAGH... WHY.'],
  [4, "SKREEEEEE... the flywheel's still going... it CARES more than you... SKREEEEE."],
  [5, "BLAAARGH... stopping? HELL... I'm coming up there... BLAAARGH.", P],
])

b.add('resumed', [
  [1, 'Hrrm. Moving again. Good. Grrrah.'],
  [2, 'GRAAAH... back... after {pausedS}... GRAAAH... long.'],
  [4, 'SKREEEE... back already? I was halfway OUT... SKREEEE.'],
])

b.add('skipped_interval', [
  [1, 'Hrrrm... skipped. ...okay. ...hrrrm.'],
  [2, 'GRAAAH... skipped {segmentLabel}... GRAAAAH... I was LOOKING FORWARD to that one.'],
  [3, 'HRRRAAAGH... you cut the GOOD PART... the SCREAMING part... HRRRAAAGH.'],
  [3, 'BLAAARGH... skip... skip... SKIP... is that all you KNOW... BLAAARGH.'],
  [4, 'SKREEEE... skip... your future self is screaming... LIKE ME... SKREEEE.'],
  [5, 'RAAAAAH... SKIPPED? DAMN... RAAAAAAAH... coward.', P],
])

b.add('extended_interval', [
  [1, 'GRAAAH? ...{extraS} more? ...grah. Good.'],
  [3, 'HRRRAAAGH... {extraS} MORE? VOLUNTARILY? HRRRAAAGH... confused.'],
  [4, 'SKREEEE... extra time... you LIKE it... SKREEEEEE... freak.'],
])

b.add('intensity_down', [
  [1, 'Hrrrm... {intensityPct}%... okay... hrrm.'],
  [2, 'GRAAAH... {intensityPct}%... lower... LOWER... GRAAAH.'],
  [3, 'HRRRAAAGH... intensity DOWN... the ceiling stopped shaking... I MISS it... HRRRAAAGH.'],
  [3, 'BLAAARGH... {intensityPct}%... the workout is SAD... I am SAD... BLAAARGH.'],
  [4, 'SKREEEEE... {intensityPct}%? SOFT... SOFT LEGS... SOFT RIDER... SKREEEEE.'],
  [5, 'RAAAAAH... {intensityPct}%? HELL... just lie on the floor next to me... RAAAAAAH!', P],
])

b.add('intensity_up', [
  [1, 'GRAAAH! {intensityPct}%! ...grah! Good!'],
  [3, 'HRRRAAAGH... UP? You turned it UP? HRRRAAAGH... did the legs agree?'],
  [4, 'SKREEEEE... {intensityPct}%... BOLD... the legs will REGRET this... SKREEEEE!'],
])

b.add('wbal_low', [
  [1, 'hrrrm... W′bal {wbalPct}%... save some... hrrm.'],
  [2, 'GRAAAH... {wbalPct}% left... FUMES... GRAAAH.'],
  [2, 'HRRK... reserves low... be SMART... hrrk... for once.'],
  [3, 'BLAAARGH... W′bal... lower than my EXPECTATIONS... and I live on the FLOOR... BLAAARGH.'],
  [4, 'SKREEEE... {wbalPct}%... burned it all EARLY... idiot... IDIOT... SKREEEE.'],
  [5, 'RAAAAGH... {wbalPct}%... blew it in the FIRST minute... DAMN ROOKIE... RAAAAGH!', P],
])

b.add('wbal_empty', [
  [1, 'hhhh... W′bal empty... stubborn now... good.'],
  [3, "GRAAAAH... EMPTY... the tank... EMPTY... now it's REAL... GRAAAAH."],
  [4, 'SKREEEEE... ZERO... ZERO... SKREEEEEEEE... ZEROOOOO.'],
])

b.add('pr', [
  [1, 'GRAAAAH! New {prLabel} PR! GRAAAAH! ...nice.'],
  [1, 'HRRRAAAGH... {prLabel} best... HRRRAAAGH... proud... hrk.'],
  [2, 'SKREEEEEE... {prLabel} record... {power}... {power}!... SKREEEEEEE!'],
  [3, 'BLAAARGH... {prLabel} PR... I had screams READY... mean ones... BLAAARGH.'],
  [4, "WAAAARGH... {prLabel} best?... who ARE you... where's the SAD one... WAAARGH."],
  [5, 'RAAAAAAAAAH... {prLabel} PR... DAMN... the floor CRACKED... RAAAAAAAH!', P],
])

b.add('ftp_test_minute', [
  [1, 'Grrrah... minute {minute}... projected {projectedFtp}... grrrah.'],
  [2, 'GRAAAH... minute {minute}... still here... GRAAAH.'],
  [3, 'HRRRAAAGH... minute {minute}... {projectedFtp}... the numbers MOCK you... HRRRAAAGH.'],
  [5, 'WAAAAARGH... minute {minute}... it HURTS? GOOD... HELL YES... WAAAAARGH!', P],
  [1, "hrrm... minute {minute}... easy start... don't SCREAM yet... hrrm.", when(lte('minute', 3))],
  [3, 'GRAAH... minute {minute}... feels GOOD? ...wait... GRAAAAH... just wait.', when(lte('minute', 3))],
  [2, 'RAAAAGH... minute {minute}... final stretch... EVERYTHING... RAAAAGH!', when(gte('minute', 15))],
  [4, 'SKREEEEEEE... minute {minute}... whatever you SAVED... SPEND IT... SKREEEEEE!', when(gte('minute', 17))],
  [2, "GRAAAAH... {projectedFtp}... UP {projectedGain}... don't CHOKE... GRAAAAH.", when(gt('projectedGain', 0))],
])

b.add('ftp_test_result', [
  [1, 'GRAAAAH! FTP {ftpNew}! Up {ftpGain}! GRAAAAH!', when(gt('ftpGain', 0))],
  [3, 'HRRRAAAGH... up {ftpGain}... {ftpNew}... HRRRAAAGH... I need LOUDER screams.', when(gt('ftpGain', 0))],
  [5, 'RAAAAAAH... {ftpNew}... up {ftpGain}... DAMN IT... RAAAAAAH... impressive.', whenP(gt('ftpGain', 0))],
  [1, 'hrrrm... FTP {ftpNew}... down {ftpDrop}... hrrm... next time.', when(gt('ftpDrop', 0))],
  [3, 'BLAAARGH... {ftpNew}... DOWN {ftpDrop}... from {ftpOld}... BLAAARGH... weak.', when(gt('ftpDrop', 0))],
  [2, 'GRAAH... {ftpNew}... same... SAME... always the SAME... GRAAAH.', when(eq('ftpGain', 0))],
  [1, 'GRAAAAH... test DONE... FTP {ftpNew}... GRAAAAAH.'],
])

b.add('workout_complete', [
  [1, 'GRAAAAAH... DONE... GRAAAAH... good job... grah.'],
  [1, 'Hrrrm... {elapsedMin} minutes... done... I sleep now.'],
  [2, "HRRRAAAGH... NP {np}... solid... HRRRAAAGH... I'm not crying."],
  [2, 'GRAAAH... {kj} kJ... DELICIOUS... GRAAAH... burp.'],
  [3, 'BLAAARGH... you FINISHED... against my PREDICTIONS... BLAAARGH.'],
  [4, 'SKREEEEE... done... the trainer needs a moment... I need a moment... SKREEEE.'],
  [5, "RAAAAAH... DAMN good ride... RAAAAAH... I'll deny it.", P],
])

b.add('ride_bailed', [
  [1, 'Hrrrm? Leaving? ...okay. ...hrrm.'],
  [2, 'GRAAAH... {elapsedMin} minutes? ONLY {elapsedMin}? GRAAAH.'],
  [3, "HRRRAAAGH... bailed... I'm still HUNGRY... HRRRAAAGH."],
  [3, "BLAAARGH... early exit... I'll scream about this ALL NIGHT... BLAAARGH."],
  [4, 'SKREEEEE... quitting? QUITTING? I had MORE SCREAMS... SKREEEEE!'],
  [5, 'RAAAAAH... BAILED? HELL... even the DUST BUNNIES stayed... RAAAAAH!', P],
])

b.add('fueling_reminder', [
  [1, 'GRAAH... eat... EAT... grah.'],
  [1, 'Hrrrm... snack. Drop crumbs. For me.'],
  [2, 'HRRRAAAGH... FUEL... the wrapper... throw it DOWN here... HRRRAAAGH.'],
  [3, 'BLAAARGH... eat something... hungry YOU... sad YOU... BLAAARGH.'],
  [4, "SKREEEE... {elapsedMin} minutes... EAT... or bonk... and I eat YOUR snacks... SKREEE."],
  [5, 'RAAAAGH... eat a DAMN gel... RAAAAAGH!', P],
])

b.add('hydration_reminder', [
  [1, "Hrrm... drink. Drip some on me. I'm thirsty."],
  [2, 'GRAAH... bottle... RIGHT THERE... drink... GRAAH.'],
  [3, 'BLAAARGH... drink... your sweat tastes like PANIC... BLAAARGH.'],
])

b.add('distress', [
  [1, "...shh. Hey. Ease off. Breathe. Stop if something feels wrong. I'm not going anywhere."],
  [1, '...no screaming now. Soft-pedal, or stop. You matter more than the workout.'],
  [1, "...quiet, now. Slow down. Get off the bike if you need to. I'll keep very still."],
])

b.add('idle_banter', [
  [1, 'Grrrah... you are doing fine... grrrah... I mean it.'],
  [1, 'Hrrrm... keep going... the hum is nice... hrrm.'],
  [2, 'GRAAAH... nice form... GRAAAH... from below it looks... fine.'],
  [2, 'HRRRAAAGH... {elapsedMin} minutes... still pedaling... HRRRAAAGH.'],
  [2, 'GRAAH... {power}... {cadence}... steady... suspicious... GRAAH.'],
  [3, 'BLAAARGH... from down here I see EVERYTHING... BLAAARGH... buy longer shorts.'],
  [3, 'SKREEEE... the sweat... dripping... on my FACE... SKREEEEE.'],
  [3, 'HRRRK... I ate your power meter battery... no... I wish... HRRRK... you are just slow.'],
  [4, "RAAAAGH... the trainer CREAKS... it's not ME... it's your WEIGHT... RAAAAGH."],
  [4, 'WAAAARGH... carbon bike... bolted to the floor... going NOWHERE... WAAARGH... like you.'],
  [5, 'SKRAAAAWK... you breathe like a BROKEN ACCORDION... and pedal like one... SKRAAAAWK.'],
  [5, "RAAAAAH... I've lived under a LOT of riders... you're the WORST... damn... RAAAAH.", P],
])

b.add('segment_start', [[5, 'RAAAAAAGH... {targetW}... get the FUCK on it... RAAAAAAAAGH!', P]], [HARD])
b.add('under_target', [[5, 'WAAAAARGH... {power}... FUCKING EMBARRASSING... WAAAAAARGH!', P]])
b.add('idle_banter', [[5, 'BLAAAARGH... this pace is BULLSHIT... BLAAAAAARGH!', P]])

// Unhinged: strong profanity, only for riders who asked for it.
b.add('ride_start', [
  [1, 'HNNNGAAAH... rider... ride... FUCK YES... GRAAAH. Hello.', P],
  [4, 'RAAAAAGH... up there... clip in... SHIT LEGS... SKREEEEEE.', P],
])
b.add(
  'segment_start',
  [
    [2, 'GRAAAH... {targetW}... easy? EASY? HAAA... SHIT... GRAAAAH.', P],
    [5, 'SKREEEEEEE... {targetW}... {remainingS}... no SHITTY EXCUSES... SKREEEEEEE!', P],
  ],
  [HARD],
)
b.add('countdown_10s', [[3, 'GRAAAH... ten... then {targetW}... or I FUCKING SCREAM... I scream anyway.', P]])
b.add('halfway', [[4, 'SKREEEE... half the interval... half the effort... FUCKING TYPICAL... SKREEEE!', P]])
b.add('last_minute', [[3, "RAAAAGH... last minute... don't FUCK it up... RAAAAAAAAGH!", P]])
b.add('segment_end_success', [
  [1, "HRRRAAAGH... that was FUCKING GOOD... HRRRAAAGH... don't tell anyone.", P],
  [5, "SKREEEE... you hit it? SHIT... SKREEEEE... now I'm hungry.", P],
])
b.add('segment_end_failed', [
  [3, 'HRRRAAAGH... {pct}%... SHIT... SHIT... HRRRAAAAGH.', P],
  [5, 'SKREEEEEEE... {avgW}... target {targetW}... FUCKING... PATHETIC... SKREEEEEEE!', P],
])
b.add('under_target', [
  [2, "GRAAAH... {deficitW} short... come ON... that's SHIT... GRAAAAH.", P],
  [4, 'HRRRAAAAGH... {power}? FUCK... my snoring makes more watts... HRRRAAAGH.', P],
])
b.add('cadence_sag', [[3, 'HRRRAAAGH... {cadence}... slow as SHIT... HRRRAAAGH.', P]])
b.add('stopped_pedaling', [[4, 'RAAAAAGH... stopped? FUCKING... stopped?... RAAAAAAAGH!', P]])
b.add('skipped_interval', [[3, 'GRAAAAH... skipped {segmentLabel}... SHIT CHOICE... GRAAAAAH.', P]])
b.add('intensity_down', [[4, 'WAAAARGH... {intensityPct}%? FUCKING SOFT... WAAAAARGH.', P]])
b.add('wbal_low', [[3, 'GRAAAH... W′bal {wbalPct}%... blew the whole FUCKING tank... GRAAAH.', P]])
b.add('pr', [[2, 'GRAAAAH... {prLabel} PR? HOLY SHIT... GRAAAAAH... I need new screams.', P]])
b.add('ftp_test_result', [[4, "SKREEEE... FTP {ftpNew}... that's IT? ...SHIT... SKREEEEEE.", P]])
b.add('workout_complete', [
  [1, 'GRAAAAH... that was FUCKING great... GRAAAAH... goodnight.', P],
  [5, 'HRRRAAAGH... {tss} TSS... not bad... for someone who STARTED like SHIT... HRRRAAAGH.', P],
])
b.add('ride_bailed', [[5, 'WAAAAAARGH... {elapsedMin} minutes? FUCKING QUITTER... WAAAAAARGH!', P]])
b.add('fueling_reminder', [[3, 'GRAAAH... eat... hungry you rides like SHIT... GRAAAH.', P]])
b.add('idle_banter', [
  [2, 'GRAAH... {power}... {cadence}... boring as SHIT... GRAAH.', P],
  [4, "HRRRAAAGH... I've eaten dust bunnies with more FUCKING drive... HRRRAAAGH.", P],
  [5, 'SKREEEEE... you call this SUFFERING? I live UNDER A TRAINER... in your SHIT SWEAT... SKREEEEE.', P],
])

const NOT_END = [ne('milestoneKind', 'halfway'), ne('milestoneKind', 'finish')]
b.add(
  'journey_milestone',
  [
    [1, 'GRAAAAH! {place}! GRAAAAH!'],
    [2, 'HRRRAAAGH... {place}... small town... they heard me SCREAM... HRRRAAAGH.'],
    [3, 'BLAAARGH... {place}... I lived under a trainer here once... BLAAARGH... rough crowd.'],
    [4, 'SKREEEE... {place}... the locals are CLOSING THEIR WINDOWS... SKREEEE.'],
    [5, 'RAAAAAH... {place}... {kmLeft} km... DAMN... so far... RAAAAAH!', P],
    [5, 'WAAAAAARGH... {place}... {kmLeft} KM LEFT... WAAAAAAAARGH!'],
  ],
  NOT_END,
)
b.add('journey_milestone', [
  [1, 'GRAAAH! {place}! New country! Same screaming!'],
  [3, 'HRRRAAAGH... {place}... they let you in... standards... LOW... HRRRAAAGH.'],
], [...NOT_END, eq('milestoneKind', 'border')])
b.add('journey_milestone', [
  [1, 'AAAAAAAAAAH! The top of {place}! AAAAAAAAAH!'],
  [3, 'HRRRAAAGH... {place}... summit... the ECHO up here... HRRRAAAAGH... hrrraaagh.'],
], [...NOT_END, eq('milestoneKind', 'summit')])
b.add('journey_milestone', [
  [1, 'GRAAAH... halfway... GRAAH... good.'],
  [3, 'BLAAARGH... halfway through {journeyName}... half... HALF... BLAAARGH.'],
], [eq('milestoneKind', 'halfway')])
b.add('journey_milestone', [
  [1, 'GRAAAAAAAAAH! {place}! {journeyName}! DONE! GRAAAAAAAAAH!'],
  [3, 'HRRRAAAGH... {place}... {kmDone} km... HRRRAAAGH... I have nothing... nothing...'],
], [eq('milestoneKind', 'finish')])

export const THE_THING: PersonaPack = {
  meta: {
    id: 'the-thing',
    name: 'The Thing Under the Trainer',
    tagline: 'Lives under your trainer. Screams louder the harder you ride. Sometimes a word gets out.',
    voiceHint: { rate: 1.05, pitch: 0.7, preferVoices: ['Bad News', 'Trinoids', 'Zarvox', 'Fred', 'Alex'] },
  },
  lines: b.build(),
}
