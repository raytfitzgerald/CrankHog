import { useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { displayNameProblem, normalizeServerUrl } from '@core/openbikenet/protocol'
import { DEFAULT_GROUP_RIDE_SERVER } from '@shared/settings'
import { useGroupRide } from '../../group-ride/runtime'
import { GroupRideStatus } from '../../group-ride/GroupRideStatus'
import { bridge } from '../../platform/bridge'
import { patchSettings, settingsStore, useSettings } from '../../stores/settings'
import { BetaBadge } from '../../ui/BetaBadge'
import { Button } from '../../ui/Button'
import { Field, Input, Section, Switch } from '../../ui/form'

const setPrefs = (p: Partial<ReturnType<typeof settingsStore.getState>['groupRides']>) => void patchSettings({ groupRides: { ...settingsStore.getState().groupRides, ...p } })
const open = (url: string) => void bridge().invoke('files.openUrl', { url })

/** Settings → Ride with others (beta): shared tracks on an OpenBikeNet server. Mac app only. */
export function GroupRidesSection() {
  const prefs = useSettings((s) => s.groupRides)
  const state = useGroupRide((s) => s)
  // what's being typed; null shows the saved value
  const [nameDraft, setName] = useState<string | null>(null)
  const [serverDraft, setServer] = useState<string | null>(null)
  const name = nameDraft ?? prefs.name
  const server = serverDraft ?? prefs.server

  const nameProblem = displayNameProblem(name)
  const serverOk = normalizeServerUrl(server) !== null
  const saveName = () => {
    const v = name.trim()
    if (displayNameProblem(v) !== null) return
    if (v !== prefs.name) setPrefs({ name: v })
    setName(null)
  }
  const saveServer = () => {
    const v = normalizeServerUrl(server)
    if (!v) return
    if (v !== prefs.server) setPrefs({ server: v })
    setServer(null)
  }

  return (
    <>
      <Section
        title={
          <span className="flex items-center gap-2">
            Ride with others <BetaBadge />
          </span>
        }
        description="Ride the shared tracks with riders of other apps. CrankHog joins OpenBikeNet, an open network that lets indoor cycling apps put their riders on the same road. It's new: few riders are on it yet, and the protocol may still change."
      >
        <Field label="Ride with others" hint="Off: nothing is sent, and the shared tracks are ridden alone.">
          <Switch checked={prefs.enabled} onChange={(v) => setPrefs({ enabled: v })} label={prefs.enabled ? 'On' : 'Off'} />
          {prefs.enabled && (
            <div className="mt-2 text-xs text-ink-dim" data-testid="group-ride-settings-status">
              <GroupRideStatus state={state} idle="Connects when you open or ride a shared track." />
            </div>
          )}
        </Field>
        <Field label="Your name on the track" hint="What other riders see next to your dot. Pick anything: it doesn't have to be your real name.">
          <Input
            value={name}
            maxLength={64}
            placeholder="Your name on the track"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            aria-label="Your name on the track"
            aria-invalid={nameProblem !== null}
            data-testid="group-ride-name"
          />
          {nameProblem && <div className="mt-1 text-xs text-warn">{nameProblem}</div>}
        </Field>
        <Field label="Share power and cadence" hint="Others see your watts and rpm next to your name.">
          <Switch checked={prefs.sharePower} onChange={(v) => setPrefs({ sharePower: v })} label={prefs.sharePower ? 'On' : 'Off'} />
        </Field>
        <Field label="Share heart rate">
          <Switch checked={prefs.shareHeartRate} onChange={(v) => setPrefs({ shareHeartRate: v })} label={prefs.shareHeartRate ? 'On' : 'Off'} />
        </Field>
      </Section>

      <Section title="What goes where" description="While you ride a shared track, CrankHog sends the server your name on the track, where you are on it and how fast you're going, about once a second, plus whatever you share above. Nothing else: no account, and nothing from your rides or profile.">
        <Field
          label="Server"
          hint="The public OpenBikeNet server, run for the community. The protocol's rules say a server keeps nothing about you after you leave, only how many riders each app had. Anyone can run their own: put its address here."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={server}
              className="max-w-sm flex-1"
              onChange={(e) => setServer(e.target.value)}
              onBlur={saveServer}
              onKeyDown={(e) => e.key === 'Enter' && saveServer()}
              aria-label="OpenBikeNet server"
              aria-invalid={!serverOk}
              spellCheck={false}
              data-testid="group-ride-server"
            />
            {prefs.server !== DEFAULT_GROUP_RIDE_SERVER && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setServer(null)
                  setPrefs({ server: DEFAULT_GROUP_RIDE_SERVER })
                }}
              >
                Use the public server
              </Button>
            )}
          </div>
          {!serverOk && <div className="mt-1 text-xs text-warn">Use wss://, or ws:// for a server on this Mac.</div>}
        </Field>
        <Field label="Simulated rides" hint="Rides on simulated devices stay off the public server, so nobody races a robot. They do join a server on this Mac, for testing.">
          <div className="flex items-center gap-2 pt-2 text-xs text-ink-dim">
            <CheckCircle2 className="size-3.5 text-good" aria-hidden /> Always kept off servers other people use
          </div>
        </Field>
        <Field label="About OpenBikeNet">
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
            <button type="button" className="flex items-center gap-1 text-accent underline" onClick={() => open('https://github.com/OpenBikeNet')}>
              The project <ExternalLink className="size-3" aria-hidden />
            </button>
            <button type="button" className="flex items-center gap-1 text-accent underline" onClick={() => open('https://openbikenet.cloud/v0/stats')}>
              Which apps are on it <ExternalLink className="size-3" aria-hidden />
            </button>
          </div>
        </Field>
      </Section>
    </>
  )
}
