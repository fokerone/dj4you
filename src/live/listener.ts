import Peer, { type DataConnection, type MediaConnection } from 'peerjs'
import { Store } from '../audio/store'
import { peerOptions } from './config'
import { type LiveMeta, parseDjMessage } from './protocol'
import { musicSdp } from './sdp'

export type ListenStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  /** The DJ ended the set */
  | 'ended'
  /** No set with this id (never existed, or already over) */
  | 'notfound'
  /** The DJ's listener limit is reached */
  | 'full'
  | 'error'

export interface ListenState {
  readonly status: ListenStatus
  readonly meta: LiveMeta | null
  readonly stream: MediaStream | null
}

/** Join a DJ's set by id and receive the audio stream plus live info. */
export class LiveListener extends Store<ListenState> {
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private call: MediaConnection | null = null
  private timeout = 0

  constructor() {
    super({ status: 'idle', meta: null, stream: null })
  }

  connect(djId: string): void {
    this.disconnect()
    this.set({ status: 'connecting', stream: null })
    const peer = new Peer(peerOptions())
    this.peer = peer

    // If nothing arrives in time, the set is probably over.
    this.timeout = window.setTimeout(() => {
      if (this.peer === peer && this.state.status === 'connecting') this.fail('notfound')
    }, 20_000)

    peer.on('open', () => {
      const conn = peer.connect(djId, { reliable: true })
      this.conn = conn
      conn.on('data', (raw) => {
        const msg = parseDjMessage(raw)
        if (!msg) return
        if (msg.type === 'meta') this.set({ meta: msg })
        else this.fail(msg.type === 'end' ? 'ended' : 'full')
      })
      conn.on('close', () => {
        if (this.peer === peer && (this.state.status === 'live' || this.state.status === 'connecting')) this.fail('ended')
      })
    })

    peer.on('call', (call) => {
      this.call = call
      call.answer(undefined, { sdpTransform: musicSdp })
      call.on('stream', (stream) => {
        window.clearTimeout(this.timeout)
        this.set({ status: 'live', stream })
      })
      call.on('close', () => {
        if (this.peer === peer && this.state.status === 'live') this.fail('ended')
      })
    })

    peer.on('error', (err) => {
      if (this.peer !== peer) return
      const type = (err as { type?: string }).type
      this.fail(type === 'peer-unavailable' ? 'notfound' : 'error')
    })
  }

  disconnect(): void {
    window.clearTimeout(this.timeout)
    this.call?.close()
    this.conn?.close()
    this.peer?.destroy()
    this.peer = null
    this.conn = null
    this.call = null
  }

  private fail(status: ListenStatus): void {
    this.disconnect()
    this.set({ status, stream: null })
  }
}
