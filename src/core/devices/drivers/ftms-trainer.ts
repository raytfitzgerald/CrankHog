// FTMS (Fitness Machine Service) smart-trainer driver: the primary path for
// every modern KICKR and most other smart trainers.
//
// Control-point discipline (FTMS v1.0 §4.16):
//   * enable indications on 0x2AD9 before the first write
//   * Request Control → Start/Resume → targets
//   * exactly one procedure outstanding; each write is answered by an
//     indication [0x80, requestOp, result, ...] which we match with a timeout
//   * "Control Not Permitted" (result 5) or Status 0xFF means another client
//     took over; we re-request control once and retry, then report.
//   * a spin down the app gives up on is ended with Stop; Start goes out
//     again before the next target.
import {
  FtmsResult,
  IndoorBikeDataAssembler,
  encodeFtmsCommand,
  parseFtmsFeatures,
  parseFtmsResponse,
  parseFtmsStatus,
  parseIndoorBikeData,
  parseSpinDownTargets,
  parseSupportedPowerRange,
  parseSupportedResistanceRange,
  type FtmsCommand,
  type FtmsFeatures,
} from '../../ble/codecs'
import { toHex, type GattSession } from '../../ble/transport'
import { CHAR, SERVICE } from '../../ble/uuids'
import type { DriverContext, SpinDownCapable, SpinDownStart, SpinDownUpdate, TrainerDriver } from '../driver'
import type { CommandResult, Range, TrainerCaps, TrainerCommand } from '../types'

const CP_TIMEOUT_MS = 3000

/** A control point answer: the result code and any response parameters. */
interface Answer {
  result: number
  params: Uint8Array
}

interface PendingOp {
  op: number
  resolve: (answer: Answer) => void
  timer: ReturnType<typeof setTimeout>
}

export class FtmsTrainerDriver implements TrainerDriver, SpinDownCapable {
  readonly kind = 'ftms' as const
  readonly role = 'trainer' as const
  caps: TrainerCaps
  private session: GattSession | null = null
  private ctx: DriverContext | null = null
  private unsubs: (() => Promise<void>)[] = []
  private pending: PendingOp | null = null
  private cpChain: Promise<unknown> = Promise.resolve()
  private hasControl = false
  private started = false
  private controlLostReported = false
  private resistanceEncoding: 'uint8' | 'sint16' = 'sint16'
  private readonly assembler = new IndoorBikeDataAssembler()
  private readonly controlLostListeners = new Set<() => void>()
  private readonly spinDownListeners = new Set<(update: SpinDownUpdate) => void>()
  /** A Stop has been queued since the last Start: the next target sends Start first. */
  private stopped = false
  /** The Stop under way, its Reset fallback included; a new spin down waits for it. */
  private stopping: Promise<unknown> = Promise.resolve()
  /** Bumped by a Stop, a reset and lost control, so a spin down Start still waiting to go out is dropped. */
  private spinDownRun = 0
  /** Our own Reset (Stop's fallback) went out: the Reset status it brings ends nothing new. */
  private ownReset = false
  private attached = false

  constructor(private features: FtmsFeatures | null = null) {
    this.caps = capsFrom(features)
  }

  async attach(session: GattSession, ctx: DriverContext): Promise<void> {
    this.session = session
    this.ctx = ctx
    this.hasControl = false
    this.started = false
    this.attached = true
    const S = SERVICE.fitnessMachine
    const chars = await session.characteristics(S)

    if (!this.features && chars.includes(CHAR.fitnessMachineFeature)) {
      this.features = parseFtmsFeatures(await session.read(S, CHAR.fitnessMachineFeature))
    }
    let powerRange: Range | undefined
    let resistanceRange: Range | undefined
    if (chars.includes(CHAR.supportedPowerRange)) {
      try {
        powerRange = parseSupportedPowerRange(await session.read(S, CHAR.supportedPowerRange))
      } catch {
        ctx.warn('Could not read supported power range')
      }
    }
    if (chars.includes(CHAR.supportedResistanceLevelRange)) {
      try {
        const r = parseSupportedResistanceRange(await session.read(S, CHAR.supportedResistanceLevelRange))
        resistanceRange = { min: r.min, max: r.max, step: r.step }
        this.resistanceEncoding = r.encoding
      } catch {
        ctx.warn('Could not read supported resistance range')
      }
    }
    this.caps = { ...capsFrom(this.features), powerRange, resistanceRange }

    // Control point indications first (writes fail with "CCCD improperly configured" otherwise).
    if (chars.includes(CHAR.fitnessMachineControlPoint)) {
      this.unsubs.push(await session.subscribe(S, CHAR.fitnessMachineControlPoint, (dv) => this.onControlPoint(dv)))
    }
    if (chars.includes(CHAR.fitnessMachineStatus)) {
      this.unsubs.push(await session.subscribe(S, CHAR.fitnessMachineStatus, (dv) => this.onStatus(dv)))
    }
    this.unsubs.push(await session.subscribe(S, CHAR.indoorBikeData, (dv) => this.onBikeData(dv)))

    if (chars.includes(CHAR.fitnessMachineControlPoint)) {
      const r = await this.ensureControl().catch((e: unknown) => {
        ctx.warn(`Request Control failed: ${String(e)}`)
        return null
      })
      if (r !== null && r !== FtmsResult.Success && r !== FtmsResult.ControlNotPermitted) ctx.warn(`Request Control rejected (${r})`)
    }
  }

  detach(): void {
    this.attached = false
    this.failPending(FtmsResult.OperationFailed)
    for (const u of this.unsubs) void u().catch(() => undefined)
    this.unsubs = []
    this.session = null
    this.hasControl = false
    this.started = false
  }

  onControlLost(listener: () => void): () => void {
    this.controlLostListeners.add(listener)
    return () => this.controlLostListeners.delete(listener)
  }

  async send(cmd: TrainerCommand): Promise<CommandResult> {
    if (!this.session || !this.attached) return 'disconnected'
    const ftms = this.toFtms(cmd)
    if (!ftms) return cmd.kind === 'idle' ? 'ok' : 'unsupported'
    try {
      if (!this.hasControl) {
        const c = await this.ensureControl()
        if (c !== FtmsResult.Success) return mapResult(c)
      } else if (this.stopped) await this.startSession()
      let result = await this.write(ftms)
      if (result === FtmsResult.ControlNotPermitted) {
        this.hasControl = false
        const c = await this.ensureControl()
        if (c !== FtmsResult.Success) return mapResult(c)
        result = await this.write(ftms)
      }
      return mapResult(result)
    } catch {
      return this.session ? 'timeout' : 'disconnected'
    }
  }

  /**
   * Spin Down Control (Start), after taking control like any command. On
   * success the trainer answers with the speed window to reach; what follows
   * arrives as Spin Down Status (onSpinDownStatus).
   */
  async startSpinDown(): Promise<SpinDownStart> {
    if (!this.session || !this.attached) return { result: 'disconnected', targets: null }
    if (!this.caps.spinDown) return { result: 'unsupported', targets: null }
    const cmd: FtmsCommand = { op: 'spinDown', start: true }
    const run = this.spinDownRun
    // stopped, reset or taken over before it went out: a Start sent now would outlive that
    const stopped: SpinDownStart = { result: 'rejected', targets: null }
    try {
      // an earlier Stop (and its Reset fallback) goes first
      await this.stopping
      if (run !== this.spinDownRun) return stopped
      if (!this.hasControl) {
        const c = await this.ensureControl()
        if (c !== FtmsResult.Success) return { result: mapResult(c), targets: null }
        if (run !== this.spinDownRun) return stopped
      }
      let answer = await this.procedure(cmd)
      if (answer.result === FtmsResult.ControlNotPermitted) {
        this.hasControl = false
        const c = await this.ensureControl()
        if (c !== FtmsResult.Success) return { result: mapResult(c), targets: null }
        if (run !== this.spinDownRun) return stopped
        answer = await this.procedure(cmd)
      }
      const result = mapResult(answer.result)
      return { result, targets: result === 'ok' ? parseSpinDownTargets(answer.params) : null }
    } catch {
      return { result: this.session ? 'timeout' : 'disconnected', targets: null }
    }
  }

  /**
   * Ends a spin down early with Stop (FTMS v1.0 §4.16.2.9), which ends the
   * trainer's session and the spin down in it. Start goes out again before
   * the next target. A trainer without Stop is sent Reset instead, which also
   * hands back control; the next command takes it again. Queued behind
   * anything already sent, so it also ends a Start still waiting for its answer.
   */
  stopSpinDown(): Promise<CommandResult> {
    if (!this.session || !this.attached) return Promise.resolve('disconnected')
    this.spinDownRun++
    // set as the Stop is queued, so a target queued behind it sends Start first
    this.stopped = true
    const stop = this.endSession()
    this.stopping = stop
    return stop
  }

  private async endSession(): Promise<CommandResult> {
    try {
      const r = await this.write({ op: 'stop' })
      if (r !== FtmsResult.NotSupported) return mapResult(r)
      this.ownReset = true
      const reset = await this.write({ op: 'reset' })
      if (reset === FtmsResult.Success) this.hasControl = false
      else this.ownReset = false
      return mapResult(reset)
    } catch {
      return this.session ? 'timeout' : 'disconnected'
    }
  }

  onSpinDownStatus(listener: (update: SpinDownUpdate) => void): () => void {
    this.spinDownListeners.add(listener)
    return () => this.spinDownListeners.delete(listener)
  }

  // ---- internals ------------------------------------------------------------

  private toFtms(cmd: TrainerCommand): FtmsCommand | null {
    switch (cmd.kind) {
      case 'erg':
        return this.caps.erg ? { op: 'targetPower', watts: Math.round(cmd.watts) } : null
      case 'resistance': {
        if (!this.caps.resistance) return null
        const r = this.caps.resistanceRange ?? { min: 0, max: 100, step: 1 }
        let level = r.min + ((r.max - r.min) * Math.max(0, Math.min(100, cmd.pct))) / 100
        if (r.step > 0) level = r.min + Math.round((level - r.min) / r.step) * r.step
        return { op: 'targetResistance', level, encoding: this.resistanceEncoding }
      }
      case 'sim':
        return this.caps.sim ? { op: 'simulation', windMps: cmd.windMps, gradePct: cmd.gradePct, crr: cmd.crr, cwKgPerM: cmd.cwKgPerM } : null
      case 'idle':
        return null
    }
  }

  /**
   * Request Control (then Start, once). Resolves with Request Control's result
   * code. A refusal means another client holds control: listeners hear about
   * it once, until control comes back.
   */
  private async ensureControl(): Promise<number> {
    const r = await this.write({ op: 'requestControl' })
    if (r !== FtmsResult.Success) {
      if (r === FtmsResult.ControlNotPermitted) this.reportControlLost()
      return r
    }
    this.hasControl = true
    this.controlLostReported = false
    if (!this.started || this.stopped) await this.startSession()
    return r
  }

  /** Start: tried once per control, and once after each Stop. */
  private async startSession(): Promise<void> {
    // cleared as Start is queued: a Stop queued after it sets it again
    this.stopped = false
    const s = await this.write({ op: 'start' })
    // Some trainers answer "not supported" to Start; they're still controllable.
    if (s === FtmsResult.Success || s === FtmsResult.NotSupported) this.started = true
  }

  private reportControlLost(): void {
    this.hasControl = false
    if (this.controlLostReported) return
    this.controlLostReported = true
    for (const l of this.controlLostListeners) l()
  }

  /** Writes one control-point procedure and resolves with its result code. */
  private async write(cmd: FtmsCommand): Promise<number> {
    return (await this.procedure(cmd)).result
  }

  /** Writes one control-point procedure and resolves with the trainer's whole answer. */
  private procedure(cmd: FtmsCommand): Promise<Answer> {
    const run = async (): Promise<Answer> => {
      const session = this.session
      if (!session) throw new Error('disconnected')
      const bytes = encodeFtmsCommand(cmd)
      const op = bytes[0]!
      const response = new Promise<Answer>((resolve) => {
        const timer = setTimeout(() => {
          if (this.pending?.op === op) this.pending = null
          resolve({ result: -1, params: new Uint8Array() })
        }, CP_TIMEOUT_MS)
        this.pending = { op, resolve, timer }
      })
      this.ctx?.capture({ dir: 'tx', service: SERVICE.fitnessMachine, characteristic: CHAR.fitnessMachineControlPoint, hex: toHex(bytes) })
      await session.write(SERVICE.fitnessMachine, CHAR.fitnessMachineControlPoint, bytes, { withResponse: true })
      const answer = await response
      if (answer.result === -1) throw new Error(`FTMS op 0x${op.toString(16)} timed out`)
      return answer
    }
    const p = this.cpChain.then(run, run)
    this.cpChain = p.catch(() => undefined)
    return p
  }

  private onControlPoint(dv: DataView): void {
    this.ctx?.capture({ dir: 'rx', service: SERVICE.fitnessMachine, characteristic: CHAR.fitnessMachineControlPoint, hex: toHex(dv) })
    const res = parseFtmsResponse(dv)
    if (!res || !this.pending || res.requestOp !== this.pending.op) return
    const p = this.pending
    this.pending = null
    clearTimeout(p.timer)
    p.resolve({ result: res.result, params: res.params })
  }

  private onStatus(dv: DataView): void {
    this.ctx?.capture({ dir: 'rx', service: SERVICE.fitnessMachine, characteristic: CHAR.fitnessMachineStatus, hex: toHex(dv) })
    let status
    try {
      status = parseFtmsStatus(dv)
    } catch {
      return
    }
    if (status.kind === 'controlPermissionLost') {
      this.reportControlLost()
      this.spinDownRun++
      this.spinDownUpdate('controlLost')
    } else if (status.kind === 'reset') {
      this.hasControl = false
      this.started = false
      if (this.ownReset) {
        this.ownReset = false
        return
      }
      this.spinDownRun++
      this.spinDownUpdate('reset')
    } else if (status.kind === 'spinDown') {
      this.spinDownUpdate(status.status)
    }
  }

  private spinDownUpdate(update: SpinDownUpdate): void {
    for (const l of this.spinDownListeners) l(update)
  }

  private onBikeData(dv: DataView): void {
    const ctx = this.ctx
    if (!ctx) return
    ctx.capture({ dir: 'rx', service: SERVICE.fitnessMachine, characteristic: CHAR.indoorBikeData, hex: toHex(dv) })
    let part
    try {
      part = parseIndoorBikeData(dv)
    } catch (e) {
      ctx.warn(`Bad Indoor Bike Data: ${String(e)}`)
      return
    }
    const d = this.assembler.push(part)
    if (!d) return
    const t = ctx.now()
    if (d.powerW !== undefined) ctx.emit('power', Math.max(0, d.powerW), t)
    if (d.cadenceRpm !== undefined) ctx.emit('cadence', d.cadenceRpm, t)
    if (d.speedKmh !== undefined) ctx.emit('speed', d.speedKmh / 3.6, t)
    if (d.heartRateBpm !== undefined && d.heartRateBpm > 0) ctx.emit('hr', d.heartRateBpm, t)
    if (d.resistanceLevel !== undefined) ctx.emit('resistanceLevel', d.resistanceLevel, t)
  }

  private failPending(result: number): void {
    if (!this.pending) return
    clearTimeout(this.pending.timer)
    this.pending.resolve({ result, params: new Uint8Array() })
    this.pending = null
  }
}

function capsFrom(f: FtmsFeatures | null): TrainerCaps {
  return {
    erg: f?.target.power ?? true,
    sim: f?.target.simulation ?? true,
    resistance: f?.target.resistance ?? true,
    spinDown: f?.target.spinDown ?? false,
  }
}

function mapResult(code: number): CommandResult {
  switch (code) {
    case FtmsResult.Success:
      return 'ok'
    case FtmsResult.NotSupported:
      return 'unsupported'
    case FtmsResult.ControlNotPermitted:
      return 'not-permitted'
    default:
      return 'rejected'
  }
}

