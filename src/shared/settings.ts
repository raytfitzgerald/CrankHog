// App-level settings owned by the main process (atomic JSON in userData).
// Rides, workouts, the athlete profile and FTP history live in the renderer's
// IndexedDB; this file holds what main needs at startup or across windows.
import { z } from 'zod'

export const DeviceRoleSchema = z.enum(['trainer', 'hr', 'power', 'cadence', 'coreTemp', 'smo2', 'fan'])

export const RememberedDeviceSchema = z.object({
  role: DeviceRoleSchema,
  chooserId: z.string().min(1).max(200),
  name: z.string().max(200),
  lastConnectedAt: z.number(),
})

export const TrainerPrefsSchema = z.object({
  /** SIM "feel" (FulGaz-style slope scaling). Speed always uses the true grade. */
  uphillPct: z.number().min(0).max(150).default(100),
  downhillPct: z.number().min(0).max(150).default(50),
  gradeLimitPct: z.number().min(2).max(25).default(20),
  ergSoftStartS: z.number().min(0).max(30).default(10),
  spiralGuard: z.boolean().default(true),
  /** Physics for virtual speed. */
  bikeKg: z.number().min(4).max(30).default(8.5),
  cda: z.number().min(0.15).max(0.7).default(0.35),
  crr: z.number().min(0.001).max(0.02).default(0.0033),
  autoPause: z.boolean().default(true),
  /** With power pedals connected, correct ERG so the pedals read the target. */
  powerMatch: z.boolean().default(true),
})

export const CoachPrefsSchema = z.object({
  enabled: z.boolean().default(true),
  personaId: z.string().max(60).default('drill-sergeant'),
  spice: z.number().int().min(1).max(5).default(3),
  /** Clean, Mild or Unhinged. Settings from before the three levels stored a boolean: on meant no limits. */
  profanity: z.preprocess((v) => (v === true ? 'unhinged' : v === false ? 'clean' : v), z.enum(['clean', 'mild', 'unhinged'])).default('clean'),
  voice: z.boolean().default(true),
  voiceName: z.string().max(120).nullable().default(null),
  rate: z.number().min(0.6).max(1.6).default(1.05),
  volume: z.number().min(0).max(1).default(0.9),
  /** Use AI-generated lines (quip packs / live lines) when an AI provider is set. */
  useAi: z.boolean().default(false),
  /** The ride-along panel where the coach bikes next to you: open, folded to a strip, or off. */
  rideAlong: z.enum(['open', 'minimized', 'off']).default('open'),
  /** What every coach should know, in the rider's words: sent with each chat, debrief and fitness overview, whoever the coach is. */
  notes: z.string().max(4000).default(''),
})

export const FuelingPrefsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Target carbohydrate intake for rides over 60 min. */
  carbsPerHourG: z.number().min(0).max(150).default(60),
  drinkEveryMin: z.number().min(5).max(60).default(15),
})

/** Interval countdown beeps (src/core/ride/countdown.ts): ticks before a step ends, a go as the next starts. Not muted with the coach. */
export const BeepPrefsSchema = z.object({
  enabled: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.6),
})

/** KICKR Headwind (or any smart fan driver): what drives its speed. */
export const FanPrefsSchema = z.object({
  mode: z.enum(['off', 'fixed', 'hr', 'speed', 'power']).default('hr'),
  fixedPct: z.number().min(0).max(100).default(60),
  hrStart: z.number().min(60).max(200).default(110),
  hrFull: z.number().min(80).max(220).default(170),
  speedFullKmh: z.number().min(10).max(80).default(40),
  powerFull: z.number().min(0.5).max(2).default(1.2),
})

/** HUD tile layouts per ride view; null = the built-in preset. */
export const HudPrefsSchema = z.object({
  free: z.array(z.string().max(40)).max(24).nullable().default(null),
  workout: z.array(z.string().max(40)).max(24).nullable().default(null),
  route: z.array(z.string().max(40)).max(24).nullable().default(null),
})

/** Journeys: free rides and workouts go somewhere real (see src/core/journeys). */
export const JourneyPrefsSchema = z.object({
  enabled: z.boolean().default(false),
  /** What a free ride or workout does when the rider doesn't choose: carry on the active journey, drop somewhere, or nothing. */
  mode: z.enum(['continue', 'drop', 'none']).default('drop'),
  /** Real terrain slows you on climbs; flat is watts to distance only. The trainer is never changed by a journey. */
  terrain: z.enum(['real', 'flat']).default('real'),
  /** Write the track into the FIT file, so Strava draws the map. */
  gps: z.boolean().default(true),
  /** The journey "continue" carries on. */
  activeId: z.string().max(80).nullable().default(null),
})

/** In-app updates of the signed Mac app (electron-updater, from GitHub releases). */
export const UpdatePrefsSchema = z.object({
  /** Check at launch and every few hours, and download in the background. Installing waits for a restart or quit. */
  auto: z.boolean().default(true),
  /** Take pre-releases too: test builds like 1.1.0-beta.1. On by default from before 1.0, when every release was one. */
  prereleases: z.boolean().default(true),
})

/** The public OpenBikeNet server (OBN_DEFAULT_SERVER in core/openbikenet/protocol.ts; a test keeps them equal). */
export const DEFAULT_GROUP_RIDE_SERVER = 'wss://openbikenet.cloud/v0'

/**
 * Ride with others (beta): shared tracks on an OpenBikeNet server, where
 * riders of other apps see you and you see them (src/core/openbikenet). Off
 * until the rider turns it on; nothing is sent before that.
 */
export const GroupRidePrefsSchema = z.object({
  enabled: z.boolean().default(false),
  /** The name other riders see: the rider's own choice, never filled in from the athlete profile. 32 characters (core checks code points). */
  name: z.string().max(64).default(''),
  /** Send power and cadence with the position. */
  sharePower: z.boolean().default(true),
  shareHeartRate: z.boolean().default(false),
  /** wss:// anywhere, or ws:// to this Mac for a server you run yourself. */
  server: z.string().max(300).default(DEFAULT_GROUP_RIDE_SERVER),
})

/** The numbers an uploaded ride's description can carry (core/ride/upload-text.ts has their text). */
export const DESCRIPTION_STAT_IDS = ['avgPower', 'np', 'maxPower', 'avgHr', 'maxHr', 'avgCadence', 'kj', 'tss', 'if'] as const
export const DescriptionStatSchema = z.enum(DESCRIPTION_STAT_IDS)
export const DEFAULT_RIDE_DESCRIPTION = 'Cranked hog with CrankHog\n{stats}\nCrankHog.app'
export const DEFAULT_DESCRIPTION_STATS = ['avgPower', 'avgHr', 'kj'] as const

export const AppSettingsSchema = z.object({
  version: z.literal(1).default(1),
  /** One remembered device per role, auto-selected on launch. */
  rememberedDevices: z.array(RememberedDeviceSchema).default([]),
  /** Reconnect remembered devices automatically when the app starts. */
  autoConnect: z.boolean().default(true),
  /** Folder for automatic FIT export; null = ~/Documents/CrankHog/Rides. */
  exportDir: z.string().nullable().default(null),
  /**
   * Distance, elevation and temperature. Also the preset for speed and weight.
   * New installs start imperial; anyone upgrading keeps what they had, which
   * `migrateStoredSettings` is careful about.
   */
  units: z.enum(['metric', 'imperial']).default('imperial'),
  /** Speed and weight can each differ from `units` (a UK rider: miles, kg). */
  speedUnit: z.enum(['kmh', 'mph']).default('mph'),
  weightUnit: z.enum(['kg', 'lb']).default('lb'),
  /** Light, dark, or follow macOS. The mini-HUD stays dark so it reads over video. */
  appearance: z.enum(['system', 'light', 'dark']).default('system'),
  /** Upload finished (non-simulated) rides automatically. */
  autoUpload: z.object({ strava: z.boolean().default(false), intervals: z.boolean().default(false) }).default({ strava: false, intervals: false }),
  /** Bring completed activities (runs, swims, squash, outdoor rides) in from intervals.icu. Off until the rider turns it on. */
  intervalsSync: z.object({ activities: z.boolean().default(false) }).default({ activities: false }),
  /** Mirror planned training into a CrankHog calendar in Google (src/core/calendar-mirror). Turns on when the rider signs in with Google. */
  googleCalendar: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
  /** Claude Desktop and Claude Code can use CrankHog through its add-on (src/main/mcp): off until the rider turns it on; changes on with it. */
  claude: z.object({ enabled: z.boolean().default(false), changes: z.boolean().default(true) }).default({ enabled: false, changes: true }),
  /** Capture the hardest effort and a coach line from each ride as images, saved next to its FIT file. */
  rideSnapshots: z.boolean().default(true),
  /** The description on uploaded rides (core/ride/upload-text.ts): the rider's text, with {stats} for the numbers they tick. */
  rideDescription: z
    .object({
      text: z.string().max(1000).default(DEFAULT_RIDE_DESCRIPTION),
      stats: z.array(DescriptionStatSchema).max(DESCRIPTION_STAT_IDS.length).default([...DEFAULT_DESCRIPTION_STATS]),
    })
    .default({ text: DEFAULT_RIDE_DESCRIPTION, stats: [...DEFAULT_DESCRIPTION_STATS] }),
  /** The version whose What's new the rider last saw: null on a new install, and in versions before What's new existed. */
  whatsNewSeen: z.string().max(40).nullable().default(null),
  trainer: TrainerPrefsSchema.default(TrainerPrefsSchema.parse({})),
  coach: CoachPrefsSchema.default(CoachPrefsSchema.parse({})),
  fueling: FuelingPrefsSchema.default(FuelingPrefsSchema.parse({})),
  beeps: BeepPrefsSchema.default(BeepPrefsSchema.parse({})),
  hud: HudPrefsSchema.default(HudPrefsSchema.parse({})),
  fan: FanPrefsSchema.default(FanPrefsSchema.parse({})),
  journeys: JourneyPrefsSchema.default(JourneyPrefsSchema.parse({})),
  updates: UpdatePrefsSchema.default(UpdatePrefsSchema.parse({})),
  groupRides: GroupRidePrefsSchema.default(GroupRidePrefsSchema.parse({})),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>
export type TrainerPrefs = z.infer<typeof TrainerPrefsSchema>
export type CoachPrefs = z.infer<typeof CoachPrefsSchema>
export type FuelingPrefs = z.infer<typeof FuelingPrefsSchema>
export type BeepPrefs = z.infer<typeof BeepPrefsSchema>
export type HudPrefs = z.infer<typeof HudPrefsSchema>
export type FanPrefs = z.infer<typeof FanPrefsSchema>
export type JourneyPrefs = z.infer<typeof JourneyPrefsSchema>
export type UpdatePrefs = z.infer<typeof UpdatePrefsSchema>
export type GroupRidePrefs = z.infer<typeof GroupRidePrefsSchema>
export type RememberedDeviceSetting = z.infer<typeof RememberedDeviceSchema>

export const DEFAULT_SETTINGS: AppSettings = AppSettingsSchema.parse({})

/**
 * Fills in units for settings saved by an older version. Run on stored JSON
 * before AppSettingsSchema parses it (the schema itself stays a plain object,
 * since AppSettingsPatchSchema is built from its shape).
 *
 * Two jobs:
 *  - settings saved before speed and weight had their own units get them from
 *    `units`, so an imperial rider keeps mph and lb;
 *  - settings saved before `units` existed at all are pinned to metric, which
 *    is what they were shown at the time. Without this they would inherit the
 *    schema's new imperial default, and a rider who never touched the setting
 *    would come back to a different app.
 */
export function migrateStoredSettings(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const r = raw as Record<string, unknown>
  const units = r.units === 'metric' || r.units === 'imperial' ? r.units : 'metric'
  const imperial = units === 'imperial'
  return {
    ...r,
    units,
    // anything unrecognised falls back to the preset, rather than failing the whole file
    speedUnit: r.speedUnit === 'kmh' || r.speedUnit === 'mph' ? r.speedUnit : imperial ? 'mph' : 'kmh',
    weightUnit: r.weightUnit === 'kg' || r.weightUnit === 'lb' ? r.weightUnit : imperial ? 'lb' : 'kg',
  }
}

const unwrapDefault = (schema: z.ZodType): z.ZodType => (schema instanceof z.ZodDefault ? (schema.unwrap() as z.ZodType) : schema)

/**
 * A field of the patch: optional, with no default, and for a nested object
 * (coach, trainer…) every inner field optional and default-free too, so a
 * patch carries exactly what the caller sent.
 */
function patchField(schema: z.ZodType): z.ZodType {
  const inner = unwrapDefault(schema)
  if (inner instanceof z.ZodObject) {
    const shape = inner.shape as Record<string, z.ZodType>
    return z.object(Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, unwrapDefault(v).optional()]))).optional()
  }
  return inner.optional()
}

const { version: _version, ...settingsShape } = AppSettingsSchema.shape
type SettingsShape = typeof settingsShape
type PatchValue<T> = T extends readonly unknown[] ? T : T extends object ? Partial<T> : T

/** Partial update accepted over IPC. Arrays replace wholesale; nested objects merge field by field (see mergeSettings). */
export type AppSettingsPatch = { [K in keyof SettingsShape]?: PatchValue<z.output<SettingsShape[K]>> }

/**
 * The patch schema, built without defaults: zod 4 applies a default even
 * inside .partial(), which turned every patch into a reset of every other
 * setting (a spice change flipped Light back to System).
 */
export const AppSettingsPatchSchema = z.object(Object.fromEntries(Object.entries(settingsShape).map(([k, v]) => [k, patchField(v)]))) as unknown as z.ZodType<AppSettingsPatch, AppSettingsPatch>

const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/**
 * Applies a patch: keys sent as undefined are ignored (never reset to the
 * default), nested objects merge into the current ones, arrays replace.
 */
export function mergeSettings(current: AppSettings, patch: AppSettingsPatch): AppSettings {
  const next: Record<string, unknown> = { ...current }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const cur = (current as Record<string, unknown>)[k]
    next[k] = isPlainObject(v) && isPlainObject(cur) ? { ...cur, ...defined(v) } : v
  }
  return AppSettingsSchema.parse(next)
}
