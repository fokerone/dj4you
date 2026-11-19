import { useEffect, useRef, useState } from 'react'
import { useAnimationFrame, useStore } from '../hooks/useEngine'
import { LOBBY_URL } from '../live/config'
import { LiveListener } from '../live/listener'

const listener = new LiveListener()
// Handy for debugging from the browser console in dev builds.
if (import.meta.env.DEV) (window as unknown as { __listener: LiveListener }).__listener = listener
const appUrl = `${location.origin}${location.pathname}`

/** Entry for listeners: `?listen=<id>` plays a set, `?live` shows the lobby. */
export default function ListenerApp() {
  const params = new URLSearchParams(location.search)
  const id = params.get('listen')
  return (
    <div className="listen">
      <header className="listen-top">
        <a className="logo" href={appUrl}>
          DJ<span>4</span>YOU
        </a>
        <a className="btn btn-small" href={appUrl}>
          Open the DJ desk
        </a>
      </header>
      <main className="listen-main">{id ? <Player id={id} /> : <Lobby />}</main>
    </div>
  )
}

function Player({ id }: { id: string }) {
  const { status, meta, stream } = useStore(listener)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [blocked, setBlocked] = useState(false)
  const [volume, setVolume] = useState(1)

  useEffect(() => () => listener.disconnect(), [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.srcObject = stream
    if (stream) a.play().then(() => setBlocked(false), () => setBlocked(true))
  }, [stream])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const title = meta?.title || (meta?.dj ? `${meta.dj} live` : 'Live DJ set')

  return (
    <section className="player" aria-live="polite">
      <div className={`player-badge ${status === 'live' ? 'is-on' : ''}`}>
        <span className="live-dot" aria-hidden /> {status === 'live' ? 'LIVE' : 'DJ4YOU LIVE'}
      </div>
      <h1 className="player-title">{title}</h1>
      {meta?.dj && <p className="player-dj">by {meta.dj}</p>}

      <Visualizer stream={stream} />

      {status === 'idle' && (
        <button className="btn btn-listen" onClick={() => listener.connect(id)}>
          ▶ Tap to listen
        </button>
      )}
      {status === 'connecting' && <p className="player-msg">Connecting to the DJ…</p>}
      {status === 'live' && blocked && (
        <button className="btn btn-listen" onClick={() => void audioRef.current?.play().then(() => setBlocked(false))}>
          ▶ Start audio
        </button>
      )}

      {status === 'live' && meta && (
        <div className="player-info">
          <div className="player-now">
            <span>Now playing</span>
            <b>{meta.nowPlaying ?? 'Getting the next track ready…'}</b>
          </div>
          <ul className="player-decks">
            {meta.decks.map((d) => (
              <li key={d.id} className={`player-deck deck-${d.id.toLowerCase()}`}>
                <span className="deck-badge">{d.id}</span>
                <span className="player-deck-track">{d.track ?? 'Empty'}</span>
                <span className="dim">{d.bpm ? `${d.bpm.toFixed(1)} BPM` : ''}</span>
                {d.playing && <span className="tab-dot is-on" aria-label="playing" />}
              </li>
            ))}
          </ul>
          <div className="player-foot">
            <span className="dim">
              {meta.listeners} {meta.listeners === 1 ? 'listener' : 'listeners'} · <Since startedAt={meta.startedAt} />
            </span>
            <label className="player-vol">
              <span className="dim">Volume</span>
              <input id="listen-volume" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </label>
          </div>
        </div>
      )}

      {(status === 'ended' || status === 'notfound' || status === 'full' || status === 'error') && (
        <div className="player-over">
          <p className="player-msg">
            {status === 'ended' && 'This set has ended. Thanks for listening!'}
            {status === 'notfound' && "This set isn't live right now. It may have ended, or the link is incomplete."}
            {status === 'full' && 'This set is full right now. Try again in a bit.'}
            {status === 'error' && "Couldn't connect to the live server. Check your connection and try again."}
          </p>
          <div className="player-actions">
            {status !== 'ended' && (
              <button className="btn" onClick={() => listener.connect(id)}>
                Try again
              </button>
            )}
            {LOBBY_URL && (
              <a className="btn" href="?live">
                See who's live
              </a>
            )}
            <a className="btn btn-primary" href={appUrl}>
              Start your own set
            </a>
          </div>
        </div>
      )}
      <audio ref={audioRef} autoPlay playsInline />
    </section>
  )
}

function Since({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useAnimationFrame(() => {
    if (!ref.current) return
    const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    ref.current.textContent = `live for ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })
  return <span ref={ref} />
}

/** Level bars from the incoming stream (purely visual). */
function Visualizer({ stream }: { stream: MediaStream | null }) {
  const barsRef = useRef<HTMLDivElement>(null)
  const analyser = useRef<{ a: AnalyserNode; data: Uint8Array<ArrayBuffer>; ctx: AudioContext } | null>(null)

  useEffect(() => {
    if (!stream) return
    let ctx: AudioContext
    try {
      ctx = new AudioContext()
      const a = ctx.createAnalyser()
      a.fftSize = 512
      a.smoothingTimeConstant = 0.75
      ctx.createMediaStreamSource(stream).connect(a)
      analyser.current = { a, data: new Uint8Array(a.frequencyBinCount), ctx }
      void ctx.resume()
    } catch {
      return
    }
    return () => {
      analyser.current = null
      void ctx.close()
    }
  }, [stream])

  useAnimationFrame(() => {
    const bars = barsRef.current?.children
    const an = analyser.current
    if (!bars) return
    if (an) an.a.getByteFrequencyData(an.data)
    for (let i = 0; i < bars.length; i++) {
      // Log-spaced bins (~90 Hz .. 16 kHz) so the bars spread like a spectrum.
      const bin = an ? Math.min(an.data.length - 1, Math.round(1 + (an.data.length / 1.2) ** (i / (bars.length - 1)))) : 0
      const v = an ? an.data[bin] / 255 : 0
      ;(bars[i] as HTMLElement).style.transform = `scaleY(${Math.max(0.04, v)})`
    }
  })

  return (
    <div ref={barsRef} className="viz" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  )
}

interface LobbySet {
  id: string
  dj: string
  title: string
  listeners: number
  startedAt: number
}

function Lobby() {
  const [sets, setSets] = useState<LobbySet[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!LOBBY_URL) return
    let stop = false
    const load = async () => {
      try {
        const res = await fetch(LOBBY_URL!, { cache: 'no-store' })
        const body = (await res.json()) as { sets?: LobbySet[] }
        if (!stop) {
          setSets(Array.isArray(body.sets) ? body.sets.slice(0, 100) : [])
          setFailed(false)
        }
      } catch {
        if (!stop) setFailed(true)
      }
    }
    void load()
    const t = window.setInterval(() => void load(), 10_000)
    return () => {
      stop = true
      window.clearInterval(t)
    }
  }, [])

  return (
    <section className="lobby">
      <h1>Live now</h1>
      {!LOBBY_URL && <p className="player-msg">The public lobby isn't set up on this site yet. Ask the DJ for their listen link.</p>}
      {LOBBY_URL && failed && <p className="player-msg">Couldn't load live sets. Retrying…</p>}
      {LOBBY_URL && sets?.length === 0 && (
        <p className="player-msg">
          Nobody is live right now. <a href={appUrl}>Be the first DJ</a>.
        </p>
      )}
      <ul className="lobby-list">
        {sets?.map((s) => (
          <li key={s.id}>
            <a className="lobby-card" href={`?listen=${encodeURIComponent(s.id)}`}>
              <span className="live-dot" aria-hidden />
              <span className="lobby-info">
                <b>{s.title || `${s.dj} live`}</b>
                <span className="dim">
                  {s.dj} · {s.listeners} {s.listeners === 1 ? 'listener' : 'listeners'}
                </span>
              </span>
              <span className="btn btn-small">Listen</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
