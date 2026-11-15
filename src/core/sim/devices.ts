// Simulated devices. Each one owns a GATT table and encodes its data with the
// same codecs the drivers parse, so every simulated ride exercises real bytes.
import {
  FtmsResult,
  decodeFtmsCommand,
  encodeCscMeasurement,
  encodeCyclingPowerMeasurement,
  encodeFtmsResponse,
  encodeFtmsStatus,
  encodeHeartRateMeasurement,
  encodeIndoorBikeData,
} from '../ble/codecs'
import type { Uuid } from '../ble/transport'
import { CHAR, SERVICE } from '../ble/uuids'
import type { DeviceRole } from '../devices/types'
import { VirtualPeripheral, type GattTable } from './virtual-peripheral'

/** Live physical state shared by every simulated device (owned by SimWorld). */
export interface SimBody {
  powerW: number
  cadenceRpm: number
  speedMps: number
  hrBpm: number
  rrMs: number[]
  coreTempC: number
  skinTempC: number
  /** Cumulative crank revolutions and last event time (1/1024 s ticks). */
  crankRevs: number
  crankEventTime: number
  wheelRevs: number
  wheelEventTime2048: number
  wheelEventTime1024: number
}

export type SimTrainerMode = 'none' | 'erg' | 'resistance' | 'sim'

const DIS_CHARS = [CHAR.manufacturerName, CHAR.modelNumber, CHAR.firmwareRevision]
const u8 = (...b: number[]) => Uint8Array.from(b)

// ---------------------------------------------------------------------------

export class SimFtmsTrainer extends VirtualPeripheral {
  readonly role: DeviceRole = 'trainer'
  readonly name = 'SIM KICKR 0001'
  readonly table: GattTable = {
    [SERVICE.fitnessMachine]: [
      CHAR.fitnessMachineFeature,
      CHAR.indoorBikeData,
      CHAR.trainingStatus,
      CHAR.supportedResistanceLevelRange,
      CHAR.supportedPowerRange,
      CHAR.fitnessMachineControlPoint,
      CHAR.fitnessMachineStatus,
    ],
    [SERVICE.cyclingPower]: [CHAR.cyclingPowerMeasurement, CHAR.cyclingPowerFeature],
    [SERVICE.deviceInformation]: DIS_CHARS,
  }

  hasControl = false
  started = false
  mode: SimTrainerMode = 'none'
  targetW = 0
  resistanceLevel = 0
  gradePct = 0
  crr = 0.004
  cwKgPerM = 0.51
  windMps = 0
  /** While true, another "app" owns control and Request Control is refused. */
  lockedByOtherApp = false
  /** Advertise and run spin down (a trainer without it answers "not supported"). */
  spinDownSupported = true
  /** Answer Stop (a trainer without it answers "not supported"). */
  stopSupported = true
  /** Answer Start with "operation failed", like a trainer that wants no Start but takes targets anyway. */
  refusesStart = false
  /** The speed window a spin down asks for, km/h. */
  readonly spinDownWindow = { lowKmh: 30, highKmh: 35 }
  /** Where a spin down is: speeding up to the window, or coasting down through it. */
  private spinDown: { phase: 'speedUp' } | { phase: 'coast'; since: number } | null = null
  /** The trainer has asked for a spin down, and no one has started or ignored it. */
  spinDownRequested = false
  /** Decoded command log for tests: RequestControl → Start → SetTargetPower... */
  readonly commandLog: { t: number; op: string; detail?: unknown }[] = []

  constructor(
    id: string,
    now: () => number,
    rng: () => number,
    private readonly body: () => SimBody,
  ) {
    super(id, now, rng)
  }

  /** Another client grabs control (Zwift opening in the background). */
  stealControl(): void {
    this.lockedByOtherApp = true
    this.hasControl = false
    this.mode = 'none'
    this.notify(SERVICE.fitnessMachine, CHAR.fitnessMachineStatus, encodeFtmsStatus({ kind: 'controlPermissionLost' }))
  }

  releaseControl(): void {
    this.lockedByOtherApp = false
  }

  /** The trainer asks for a spin down (after a firmware update, or once warm). */
  requestSpinDown(): void {
    this.spinDownRequested = true
    this.notify(SERVICE.fitnessMachine, CHAR.fitnessMachineStatus, encodeFtmsStatus({ kind: 'spinDown', status: 'requested' }))
  }

  /** The trainer resets itself (a power blip, or its own button). */
  resetByTrainer(): void {
    this.hasControl = false
    this.started = false
    this.mode = 'none'
    this.spinDown = null
    this.notify(SERVICE.fitnessMachine, CHAR.fitnessMachineStatus, encodeFtmsStatus({ kind: 'reset' }))
  }

  /** True while a spin down runs: targets are refused until it finishes or is stopped. */
  get spinningDown(): boolean {
    return this.spinDown !== null
  }

  /** 1 Hz: Indoor Bike Data (+ CPS measurement for realism: KICKRs expose both). */
  tick(): void {
    const b = this.body()
    this.notify(
      SERVICE.fitnessMachine,
      CHAR.indoorBikeData,
      encodeIndoorBikeData({
        moreData: false,
        speedKmh: round(b.speedMps * 3.6, 2),
        cadenceRpm: round(b.cadenceRpm * 2, 0) / 2,
        powerW: Math.round(b.powerW),
        resistanceLevel: Math.round(this.resistanceLevel),
      }),
    )
    this.followSpinDown(b)
    this.notify(
      SERVICE.cyclingPower,
      CHAR.cyclingPowerMeasurement,
      encodeCyclingPowerMeasurement({ powerW: Math.round(b.powerW), crankRevs: b.crankRevs & 0xffff, crankEventTime: b.crankEventTime & 0xffff }),
    )
  }

  /**
   * A spin down the way trainers run one: "stop pedalling" once the flywheel
   * passes the top of the window, then "success" once it has coasted below
   * the bottom. Pedalling during the coast (after a moment to react) is an
   * error.
   */
  private followSpinDown(b: SimBody): void {
    const sd = this.spinDown
    if (!sd) return
    const kmh = b.speedMps * 3.6
    const status = (s: 'stopPedaling' | 'success' | 'error') => this.notify(SERVICE.fitnessMachine, CHAR.fitnessMachineStatus, encodeFtmsStatus({ kind: 'spinDown', status: s }))
    if (sd.phase === 'speedUp') {
      if (kmh < this.spinDownWindow.highKmh) return
      this.spinDown = { phase: 'coast', since: this.now() }
      status('stopPedaling')
      return
    }
    if (b.powerW > 20 && this.now() - sd.since > 3000) {
      this.spinDown = null
      status('error')
    } else if (kmh < this.spinDownWindow.lowKmh) {
      this.spinDown = null
      status('success')
    }
  }

  protected override onConnectionChange(connected: boolean): void {
    if (!connected) {
      // FTMS: control is lost on disconnect; the trainer keeps its last load.
      this.hasControl = false
      this.started = false
      this.spinDown = null
    }
  }

  protected readChar(_service: Uuid, characteristic: Uuid): Uint8Array | null {
    switch (characteristic) {
      case CHAR.fitnessMachineFeature: {
        // machine: cadence(1) | totalDistance(2) | resistanceLevel(7) | power(14)
        const machine = (1 << 1) | (1 << 2) | (1 << 7) | (1 << 14)
        // target: resistance(2) | power(3) | simulation(13) | wheelCircumference(14) | spinDown(15)
        const target = (1 << 2) | (1 << 3) | (1 << 13) | (1 << 14) | (this.spinDownSupported ? 1 << 15 : 0)
        const out = new DataView(new ArrayBuffer(8))
        out.setUint32(0, machine, true)
        out.setUint32(4, target, true)
        return new Uint8Array(out.buffer)
      }
      case CHAR.supportedPowerRange: {
        const out = new DataView(new ArrayBuffer(6))
        out.setInt16(0, 0, true)
        out.setInt16(2, 2000, true)
        out.setUint16(4, 1, true)
        return new Uint8Array(out.buffer)
      }
      case CHAR.supportedResistanceLevelRange: {
        // sint16 min, sint16 max, uint16 step, all ×0.1 → 0..100 step 1
        const out = new DataView(new ArrayBuffer(6))
        out.setInt16(0, 0, true)
        out.setInt16(2, 1000, true)
        out.setUint16(4, 10, true)
        return new Uint8Array(out.buffer)
      }
      case CHAR.trainingStatus:
        return u8(0x00, 0x01)
      case CHAR.cyclingPowerFeature:
        return u8(0x08, 0x00, 0x00, 0x00) // crank revolution data supported
      default:
        return null
    }
  }

  protected onWrite(_service: Uuid, characteristic: Uuid, bytes: Uint8Array): void {
    if (characteristic !== CHAR.fitnessMachineControlPoint) return
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const cmd = decodeFtmsCommand(view)
    const op = bytes[0] ?? 0
    const reply = (result: number, params: number[] = []) =>
      // Indications arrive after the write completes, like a real device.
      queueMicrotask(() => this.notify(SERVICE.fitnessMachine, CHAR.fitnessMachineControlPoint, encodeFtmsResponse(op, result, params)))

    if (!cmd) {
      this.commandLog.push({ t: this.now(), op: `unknown-0x${op.toString(16)}` })
      reply(FtmsResult.NotSupported)
      return
    }
    this.commandLog.push({ t: this.now(), op: cmd.op, detail: cmd })

    if (cmd.op === 'requestControl') {
      if (this.lockedByOtherApp) return reply(FtmsResult.ControlNotPermitted)
      this.hasControl = true
      return reply(FtmsResult.Success)
    }
    if (!this.hasControl) return reply(FtmsResult.ControlNotPermitted)

    // measuring the flywheel: no load is applied until the spin down ends
    const busy = () => this.spinDown !== null
    switch (cmd.op) {
      case 'reset':
        this.hasControl = false
        this.started = false
        this.mode = 'none'
        this.spinDown = null
        reply(FtmsResult.Success)
        queueMicrotask(() => this.notify(SERVICE.fitnessMachine, CHAR.fitnessMachineStatus, encodeFtmsStatus({ kind: 'reset' })))
        return
      case 'start':
        if (this.refusesStart) return reply(FtmsResult.OperationFailed)
        this.started = true
        return reply(FtmsResult.Success)
      case 'stop':
        if (!this.stopSupported) return reply(FtmsResult.NotSupported)
        // ends the session, and a spin down running in it
        this.started = false
        this.spinDown = null
        return reply(FtmsResult.Success)
      case 'pause':
        this.started = false
        return reply(FtmsResult.Success)
      case 'targetPower':
        if (busy()) return reply(FtmsResult.OperationFailed)
        this.mode = 'erg'
        this.targetW = Math.max(0, Math.min(2000, cmd.watts))
        return reply(FtmsResult.Success)
      case 'targetResistance':
        if (busy()) return reply(FtmsResult.OperationFailed)
        this.mode = 'resistance'
        this.resistanceLevel = Math.max(0, Math.min(100, cmd.level))
        return reply(FtmsResult.Success)
      case 'simulation':
        if (busy()) return reply(FtmsResult.OperationFailed)
        this.mode = 'sim'
        this.gradePct = cmd.gradePct
        this.crr = cmd.crr
        this.cwKgPerM = cmd.cwKgPerM
        this.windMps = cmd.windMps
        return reply(FtmsResult.Success)
      case 'wheelCircumference':
        return reply(FtmsResult.Success)
      case 'spinDown': {
        if (!this.spinDownSupported) return reply(FtmsResult.NotSupported)
        // Ignore declines a spin down the trainer asked for; it never stops one that runs
        this.spinDownRequested = false
        if (!cmd.start) return reply(FtmsResult.Success)
        // the trainer lets go of any load while the flywheel is measured
        this.mode = 'none'
        this.spinDown = { phase: 'speedUp' }
        const u16 = (kmh: number) => [Math.round(kmh * 100) & 0xff, Math.round(kmh * 100) >> 8]
        return reply(FtmsResult.Success, [...u16(this.spinDownWindow.lowKmh), ...u16(this.spinDownWindow.highKmh)])
      }
      default:
        return reply(FtmsResult.NotSupported)
    }
  }
}

// ---------------------------------------------------------------------------

export class SimHeartRateMonitor extends VirtualPeripheral {
  readonly role: DeviceRole = 'hr'
  readonly name = 'SIM HRM 0002'
  readonly table: GattTable = {
    [SERVICE.heartRate]: [CHAR.heartRateMeasurement],
    [SERVICE.battery]: [CHAR.batteryLevel],
    [SERVICE.deviceInformation]: DIS_CHARS,
  }
  /** Emit RR intervals (like a chest strap); watches usually don't. */
  withRr = true

  constructor(
    id: string,
    now: () => number,
    rng: () => number,
    private readonly body: () => SimBody,
  ) {
    super(id, now, rng)
  }

  tick(): void {
    const b = this.body()
    const rr = this.withRr ? b.rrMs.splice(0) : []
    this.notify(
      SERVICE.heartRate,
      CHAR.heartRateMeasurement,
      encodeHeartRateMeasurement({ bpm: Math.round(b.hrBpm), contactSupported: true, contactDetected: true, rrMs: rr }),
    )
  }

  protected readChar(_s: Uuid, characteristic: Uuid): Uint8Array | null {
    return characteristic === CHAR.batteryLevel ? u8(87) : null
  }
  protected onWrite(): void {}
}

// ---------------------------------------------------------------------------

export class SimPowerMeter extends VirtualPeripheral {
  readonly role: DeviceRole = 'power'
  readonly name = 'SIM PEDALS 0003'
  readonly table: GattTable = {
    [SERVICE.cyclingPower]: [CHAR.cyclingPowerMeasurement, CHAR.cyclingPowerFeature],
    [SERVICE.battery]: [CHAR.batteryLevel],
    [SERVICE.deviceInformation]: DIS_CHARS,
  }
  /** Pedals read a touch differently from the trainer (drivetrain loss). */
  offset = 1.02

  constructor(
    id: string,
    now: () => number,
    rng: () => number,
    private readonly body: () => SimBody,
  ) {
    super(id, now, rng)
  }

  tick(): void {
    const b = this.body()
    this.notify(
      SERVICE.cyclingPower,
      CHAR.cyclingPowerMeasurement,
      encodeCyclingPowerMeasurement({
        powerW: Math.round(b.powerW * this.offset),
        pedalBalancePct: 50 + Math.round((this.rng() - 0.5) * 4),
        pedalBalanceRefLeft: true,
        crankRevs: b.crankRevs & 0xffff,
        crankEventTime: b.crankEventTime & 0xffff,
      }),
    )
  }

  protected readChar(_s: Uuid, characteristic: Uuid): Uint8Array | null {
    if (characteristic === CHAR.batteryLevel) return u8(64)
    if (characteristic === CHAR.cyclingPowerFeature) return u8(0x09, 0x00, 0x00, 0x00)
    return null
  }
  protected onWrite(): void {}
}

export class SimSpeedCadence extends VirtualPeripheral {
  readonly role: DeviceRole = 'cadence'
  readonly name = 'SIM CADENCE 0004'
  readonly table: GattTable = {
    [SERVICE.cyclingSpeedCadence]: [CHAR.cscMeasurement, CHAR.cscFeature],
    [SERVICE.battery]: [CHAR.batteryLevel],
  }
  constructor(
    id: string,
    now: () => number,
    rng: () => number,
    private readonly body: () => SimBody,
  ) {
    super(id, now, rng)
  }
  tick(): void {
    const b = this.body()
    this.notify(
      SERVICE.cyclingSpeedCadence,
      CHAR.cscMeasurement,
      encodeCscMeasurement({
        wheelRevs: b.wheelRevs >>> 0,
        wheelEventTime: b.wheelEventTime1024 & 0xffff,
        crankRevs: b.crankRevs & 0xffff,
        crankEventTime: b.crankEventTime & 0xffff,
      }),
    )
  }
  protected readChar(_s: Uuid, characteristic: Uuid): Uint8Array | null {
    if (characteristic === CHAR.batteryLevel) return u8(91)
    if (characteristic === CHAR.cscFeature) return u8(0x03, 0x00)
    return null
  }
  protected onWrite(): void {}
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp
