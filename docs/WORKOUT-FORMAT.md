# Run, swim and other session files

CrankHog plays bike workouts on your trainer. Runs, swims and everything else (a squash game, a gym session) happen elsewhere, but you can still plan them on the calendar, count them in your weekly volume, and send them to intervals.icu and on to your Garmin. This page is the format those sessions are written in, so a file lands on the calendar the way you meant.

The same guide is in the app: **Format guide**, next to every place you can import sessions.

## Where you import

- **Calendar, Import sessions** (or drop the files on the calendar). Each file goes straight onto its day. A file without a date isn't guessed at: it's listed in the report as having no date. Dated bike workouts (`.zwo`, `.mrc`, `.erg`, `.txt`) work here too, so a mixed week imports in one go.
- **Workouts, Run or Swim.** Files go to the library, to plan later with **Plan**, or to open in the builder. **Paste a session** reads what you type as you type it: the steps, the time, distance and load, and anything to fix.
- **Workouts, Training plan.** Files go into the open plan in file-name order, dated ones on their day.

After every import, a report lists every file and where it went: on a day, in the library, in a plan, or skipped. Errors and warnings name the line. A file with errors is skipped whole, never half-imported; a file with only warnings is imported, and the warnings stay on the report.

## One session per file

A plain text file ending in `.txt`, in UTF-8. It has two parts: header lines, a blank line, then the steps. The steps are intervals.icu's workout text, so the same lines can be pasted into intervals.icu. The header is CrankHog's own, and is left out when a session is sent to intervals.icu.

A `.txt` file without a `sport:` line is a bike workout, read as before.

## The file name sets the day

`YYYY-MM-DD_Name.txt` puts the session on that day: `2026-12-02_Threshold 4x8.txt` goes on 2 December 2026. Without a date, the session goes to the library (or, imported into a plan, takes the plan's next day). A `date:` header line wins over the date in the file name.

## Header lines

One `key: value` per line, in any order. A key CrankHog doesn't know is a warning, not an error.

| Key | Needed | Values | What it does on the calendar |
|---|---|---|---|
| `sport` | Yes, for anything that isn't a bike workout | `run`, `swim`, `other` | The card's icon, and the weekly volume row it counts in (Run, Swim, Other) |
| `name` | No | Text | The card's title. Without it, the file name without its date |
| `date` | No | `YYYY-MM-DD` | The day it goes on. Wins over the file name |
| `pool` | No, swims only | `25m`, `50m`, `25y` | Shown with the swim. A distance that isn't a whole number of lengths gets a warning |
| `duration` | For a session with no steps | `45m`, `1h`, `1h15m` | Planned time |
| `distance` | No, sessions with no steps | `8km`, `5mi`, `2000mtr`, `1650y` | Planned distance |
| `effort` | No, sessions with no steps | `easy`, `moderate`, `hard`, `max` | Planned load: 40, 60, 80 or 100 TSS an hour (moderate when left out) |
| `notes` | No | One line of text | Shown when you open the session |

## Steps

1. A step is a line starting with `- `, then a length, then at most one target, then any words.
2. **Lengths.** Time is `30s`, `10m`, `1h`, `1h20m`, `5m30s`. **`m` always means minutes.** Distance is `400mtr` (metres), `1km`, `1.5km`, `1mi`, `100y` (yards).
3. **Targets.**
   - Pace: `4:30/km Pace`, `7:15/mi Pace`, `1:45/100m Pace`, `1:35/100y Pace`, or a range `4:20-4:40/km Pace`.
   - Percent of threshold pace: `95% Pace`, `90-95% Pace`.
   - Pace zone: `Z3 Pace`.
   - Heart rate: `Z2 HR`, `75% LTHR`, `140-150bpm`.
   - None: the step is easy. Words such as `easy`, `drill`, `kick`, `pull` or `fins` stay as the step's note.
4. **Rest.** `- 20s rest`.
5. **Repeats.** A line ending in a count, like `Main set 4x` or just `4x`, repeats the `- ` lines under it, up to the next blank line. **One level only**: to repeat a set inside a set, write it out.
6. **Section titles.** Any other line (`Warmup`, `Cooldown`) is a title, shown in the step list.
7. **No steps.** A file with no steps is a planned session (a squash game, an easy run). It needs `duration` or `distance`.

## Examples

These four files are in the app's guide too, with **Save examples** to save them and edit your own. CrankHog's tests read each one, so they always import as shown.

### `2026-12-02_Threshold 4x8.txt`

A run with a repeated main set: heart-rate zones for the easy parts, a pace range for the efforts.

```
sport: run
name: Threshold 4x8

Warmup
- 15m Z2 HR

Main set 4x
- 8m 4:10-4:20/km Pace
- 2m Z1 HR

Cooldown
- 10m Z1 HR
```

### `2026-12-03_CSS 10x100.txt`

A pool swim in metres, with drills, rests and a main set at a pace per 100 m.

```
sport: swim
name: CSS 10x100
pool: 25m

Warmup
- 400mtr easy

Drills 4x
- 50mtr drill
- 15s rest

Main set 10x
- 100mtr 1:40/100m Pace
- 15s rest

Cooldown
- 200mtr easy
```

### `2026-12-04_Squash.txt`

A session with no steps: just how long and how hard.

```
sport: other
name: Squash
duration: 60m
effort: hard
```

### `Easy 8k.txt`

No date in the name, so it goes to the library to plan later.

```
sport: run
name: Easy 8k
distance: 8km
effort: easy
```

## How the calendar's numbers are worked out

- **Time.** Time steps add up as written. Distance steps are converted with your threshold run pace, or swim threshold pace (CSS), from **Settings, Athlete**. A step with no target counts as easy: 75 % of threshold for runs, 80 % for swims. Without the threshold, a distance-only session shows its distance and no time. Missing is not zero.
- **Other sessions.** A squash game or a gym session has no pace to go by, so a distance step there gets no time, and a time step no distance.
- **Load.** On the same scale as ride TSS (an hour at threshold is 100). Pace steps score by pace against threshold; heart-rate steps by your threshold heart rate; zone steps by the zone's middle; a session with no steps by its effort. Runs and other sports score intensity squared, swims cubed. Without what it needs, the load is blank, never 0.

## What the report says, and what to do

| Message | Meaning |
|---|---|
| `line 6: "400m" is 400 minutes. For metres write 400mtr.` | A warning on any swim step written with `m` (a swim is counted in lengths), and on a run step of 100 minutes or more |
| `line 2: sport must be run, swim or other.` | The `sport:` line names something else. A bike workout has no `sport:` line |
| `line 9: a repeat inside a repeat isn't supported. Write the inner set out, or leave a blank line before a new set.` | A second count line came before the first set ended |
| `line 4: one target per step. "Z2 HR 4:30/km Pace" has two.` | Pick one target for the step |
| `No steps, and no duration or distance: add "duration: 45m" or some steps.` | The file has nothing to plan |
| `line 5: distance 160mtr isn't a whole number of 25m lengths.` | A warning: check the distance against the pool |
| `This is a run with distance steps, and no threshold run pace is set: it shows its distance but no time. Set it in Settings, Athlete.` | A warning: add your threshold pace to see time and load |
| `No date: name it YYYY-MM-DD_Name.txt or add a "date:" line, or import it on the Workouts page.` | On the Calendar, every file needs a day |

## Sending to intervals.icu

A planned run or swim can be sent to your intervals.icu calendar (the header is left out; the steps go as the workout's description). intervals.icu then puts it on your Garmin, if your Garmin connection there allows planned workouts. A workout only reaches the watch if intervals.icu read it as steps: open it on intervals.icu once to check.
