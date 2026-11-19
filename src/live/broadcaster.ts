import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import type { AudioEngine } from '../audio/engine'
import { crossfaderGains } from '../audio/mixer'
import { Store } from '../audio/store'
import { t } from '../i18n'
import { LOBBY_URL, MAX_LISTENERS, peerOptions } from './config'
import type { DjMessage, LiveMeta } from './protocol'
import { musicSdp, raiseBitrate } from './sdp'

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'error'

export interface BroadcastState {
  readonly status: LiveStatus
  /** Peer id listeners connect to */
  readonly id: string | null
  readonly listeners: number
  readonly dj: string
  readonly title: string
  readonly isPublic: boolean
  /** Lobby announce failed (set still works by link) */
  readonly lobbyError: boolean
  readonly startedAt: number
  readonly error: string | null
}

interface Listener {
  conn: DataConnection
  call: MediaConnection | null
}

/**
 * Go live: every listener opens a data connection to the DJ's peer id; the
 * DJ answers by calling them with the master-output stream. Audio flows
 * peer-to-peer, so the DJ's upload bandwidth sets the listener limit.
 */
export class Broadcaster extends Store<BroadcastState> {
  private readonly engine: AudioEngine
  private peer: Peer | null = null
  private readonly audience = new Map<string, Listener>()
  private metaTimer = 0
  private lobbyTimer = 0
  private wakeLock: { release(): Promise<void> } | null = null
  private unsubs: (() => void)[] = []

  constructor(engine: AudioEngine) {
    super({
      status: 'idle',
      id: null,
      listeners: 0,
      dj: '',
      title: '',
      isPublic: false,
      lobbyError: false,
      startedAt: 0,
      error: null,
    })
    this.engine = engine
  }

  start(opts: { dj: string; title: string; isPublic: boolean }): void {
    if (this.state.status === 'connecting' || this.state.status === 'live') return
    void this.engine.resume()
    this.set({
      status: 'connecting',
      dj: opts.dj.trim().slice(0, 40) || 'Anonymous DJ',
      title: opts.title.trim().slice(0, 80),
      isPublic: opts.isPublic && LOBBY_URL !== null,
      lobbyError: false,
      error: null,
      listeners: 0,
    })
    this.openPeer(0)
  }

  stop(): void {
    this.broadcast({ type: 'end' })
    window.clearInterval(this.metaTimer)
    window.clearInterval(this.lobbyTimer)
    for (const u of this.unsubs) u()
    this.unsubs = []
    const id = this.state.id
    if (id && this.state.isPublic && LOBBY_URL) {
      void fetch(`${LOBBY_URL}/${encodeURIComponent(id)}`, { method: 'DELETE', keepalive: true }).catch(() => undefined)
    }
    // Give the "end" message a moment to leave before closing everything.
    const peer = this.peer
    const listeners = [...this.audience.values()]
    this.peer = null
    this.audience.clear()
    window.setTimeout(() => {
      for (const l of listeners) {
        l.call?.close()
        l.conn.close()
      }
      peer?.destroy()
    }, 300)
    void this.wakeLock?.release().catch(() => undefined)
    this.wakeLock = null
    this.set({ status: 'idle', id: null, listeners: 0 })
  }

  // ---------------------------------------------------------------- internals

  private openPeer(attempt: number): void {
    const id = `dj4you-${randomId()}`
    const peer = new Peer(id, peerOptions())
    this.peer = peer

    peer.on('open', () => {
      if (this.peer !== peer) return
      this.set({ status: 'live', id, startedAt: Date.now() })
      this.startMetaUpdates()
      if (this.state.isPublic) this.startLobbyHeartbeat()
      void this.keepScreenOn()
    })

    peer.on('connection', (conn) => this.onListener(conn))

    peer.on('disconnected', () => {
      // Lost the signaling server: existing listeners keep playing; retry so
      // new listeners can still join.
      if (this.peer === peer && !peer.destroyed) window.setTimeout(() => peer.reconnect(), 2000)
    })

    peer.on('error', (err) => {
      if (this.peer !== peer) return
      const type = (err as { type?: string }).type
      if (type === 'unavailable-id' && attempt < 3) {
        peer.destroy()
        this.openPeer(attempt + 1)
        return
      }
      if (type === 'peer-unavailable') return // a listener left mid-handshake
      if (this.state.status === 'live' && (type === 'network' || type === 'server-error' || type === 'socket-error')) return
      peer.destroy()
      this.peer = null
      this.set({
        status: 'error',
        id: null,
        error:
          type === 'browser-incompatible'
            ? t("This browser can't stream live.")
            : t("Couldn't reach the live server. Check your connection and try again."),
      })
    })
  }

  private onListener(conn: DataConnection): void {
    conn.on('open', () => {
      if (!this.peer) return conn.close()
      if (this.audience.size >= MAX_LISTENERS) {
        void conn.send({ type: 'full' } satisfies DjMessage)
        window.setTimeout(() => conn.close(), 300)
        return
      }
      const stream = this.engine.recorder.stream
      for (const t of stream.getAudioTracks()) (t as MediaStreamTrack & { contentHint: string }).contentHint = 'music'
      const call = this.peer.call(conn.peer, stream, { sdpTransform: musicSdp })
      const entry: Listener = { conn, call }
      this.audience.set(conn.peer, entry)
      call.peerConnection?.addEventListener('connectionstatechange', () => {
        const pc = call.peerConnection
        if (pc?.connectionState === 'connected') void raiseBitrate(pc)
        if (pc?.connectionState === 'failed') this.dropListener(conn.peer)
      })
      call.on('close', () => this.dropListener(conn.peer))
      this.set({ listeners: this.audience.size })
      this.sendMeta()
      void this.announce()
    })
    conn.on('close', () => this.dropListener(conn.peer))
    conn.on('error', () => this.dropListener(conn.peer))
  }

  private dropListener(peerId: string): void {
    const l = this.audience.get(peerId)
    if (!l) return
    this.audience.delete(peerId)
    l.call?.close()
    l.conn.close()
    this.set({ listeners: this.audience.size })
    this.sendMeta()
    void this.announce()
  }

  private broadcast(msg: DjMessage): void {
    for (const { conn } of this.audience.values()) {
      if (conn.open) void Promise.resolve(conn.send(msg)).catch(() => undefined)
    }
  }

  private sendMeta(): void {
    if (this.state.status !== 'live') return
    this.broadcast(this.meta())
  }

  /** What listeners see: DJ, title, decks and the track that's mostly audible. */
  private meta(): LiveMeta {
    const { crossfader, curve } = this.engine.mixer.getSnapshot()
    const xf = crossfaderGains(crossfader, curve)
    let loudest = 0
    let nowPlaying: string | null = null
    const decks = this.engine.decks.map((d, i) => {
      const s = d.getSnapshot()
      const weight = s.playing ? s.volume * s.volume * xf[i] : 0
      if (s.trackName && weight > loudest) {
        loudest = weight
        nowPlaying = s.trackName
      }
      return { id: s.id, track: s.trackName, bpm: d.effectiveBpm, playing: s.playing }
    })
    return {
      type: 'meta',
      dj: this.state.dj,
      title: this.state.title,
      listeners: this.audience.size,
      startedAt: this.state.startedAt,
      nowPlaying,
      decks,
    }
  }

  private startMetaUpdates(): void {
    // Push on track / transport changes, plus a slow refresh for fader moves.
    let last = ''
    const push = () => {
      const m = this.meta()
      const key = JSON.stringify(m)
      if (key !== last) {
        last = key
        this.broadcast(m)
      }
    }
    for (const store of [...this.engine.decks, this.engine.mixer]) this.unsubs.push(store.subscribe(push))
    this.metaTimer = window.setInterval(push, 2000)
  }

  /** List (or refresh) this set in the public lobby. */
  private async announce(): Promise<void> {
    if (!LOBBY_URL || !this.state.id || !this.state.isPublic || this.state.status !== 'live') return
    try {
      const res = await fetch(LOBBY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: this.state.id, dj: this.state.dj, title: this.state.title, listeners: this.audience.size }),
      })
      this.set({ lobbyError: !res.ok })
    } catch {
      this.set({ lobbyError: true })
    }
  }

  private startLobbyHeartbeat(): void {
    void this.announce()
    this.lobbyTimer = window.setInterval(() => void this.announce(), 20_000)
  }

  /** Phones dim and sleep, which can stop the stream: keep the screen on while live. */
  private async keepScreenOn(): Promise<void> {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
      this.wakeLock = (await wl?.request('screen')) ?? null
    } catch {
      /* not supported or refused */
    }
  }
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('')
}
