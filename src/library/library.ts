import type { Analyzed, Deck } from '../audio/deck'
import { DEMOS, renderDemo } from '../audio/demo'
import { Store } from '../audio/store'
import { idb, RECORDINGS, TRACKS } from './idb'

export interface TrackMeta {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly addedAt: number
  readonly duration?: number
  readonly bpm?: number | null
}

export interface RecordingMeta {
  readonly id: string
  readonly name: string
  readonly createdAt: number
  readonly duration: number
  readonly size: number
  readonly mime: string
}

interface TrackRecord extends TrackMeta {
  readonly blob: Blob
}
interface RecordingRecord extends RecordingMeta {
  readonly blob: Blob
}

export interface LibraryState {
  readonly ready: boolean
  /** IndexedDB unavailable: tracks still play, but aren't kept */
  readonly unavailable: boolean
  readonly tracks: readonly TrackMeta[]
  readonly recordings: readonly RecordingMeta[]
  /** Bytes used / available on this device, if the browser reports it */
  readonly usage: { used: number; quota: number } | null
}

const strip = <T extends { blob: Blob }>({ blob: _blob, ...meta }: T): Omit<T, 'blob'> => meta

/**
 * The on-device library: every track you load is kept (as a Blob in
 * IndexedDB) so it's there next time, plus your recorded mixes.
 * Tracks are only ever stored locally; nothing is uploaded.
 */
export class Library extends Store<LibraryState> {
  constructor() {
    super({ ready: false, unavailable: false, tracks: [], recordings: [], usage: null })
    void this.refresh()
  }

  async refresh(): Promise<void> {
    try {
      const [tracks, recordings] = await Promise.all([
        idb.all<TrackRecord>(TRACKS),
        idb.all<RecordingRecord>(RECORDINGS),
      ])
      this.set({
        ready: true,
        unavailable: false,
        tracks: tracks.map(strip).sort((a, b) => b.addedAt - a.addedAt),
        recordings: recordings.map(strip).sort((a, b) => b.createdAt - a.createdAt),
      })
    } catch {
      this.set({ ready: true, unavailable: true })
    }
    void this.updateUsage()
  }

  /** Store files in the library; returns their ids (null where saving failed). */
  async addFiles(files: readonly File[]): Promise<(string | null)[]> {
    // Ask once for storage that the browser won't evict under pressure.
    void navigator.storage?.persist?.().catch(() => undefined)
    const ids = await Promise.all(
      files.map(async (file) => {
        const existing = this.state.tracks.find((t) => t.name === stripExt(file.name) && t.size === file.size)
        if (existing) return existing.id
        const rec: TrackRecord = { id: uid(), name: stripExt(file.name), size: file.size, addedAt: Date.now(), blob: file }
        try {
          await idb.put(TRACKS, rec)
          return rec.id
        } catch {
          return null
        }
      }),
    )
    await this.refresh()
    return ids
  }

  /** Load a file onto a deck and keep it in the library. */
  async loadFile(file: File, deck: Deck): Promise<void> {
    // Start playing-ready decoding right away; save to IndexedDB in parallel.
    let id: string | null = null
    let pending: Analyzed | null = null
    const loading = deck.load(file, (a) => {
      if (id) void this.updateTrack(id, a)
      else pending = a
    })
    ;[id] = await this.addFiles([file])
    if (id && pending) void this.updateTrack(id, pending)
    await loading
  }

  async loadTrack(id: string, deck: Deck): Promise<void> {
    const rec = await idb.get<TrackRecord>(TRACKS, id).catch(() => undefined)
    if (!rec) return
    const file = new File([rec.blob], rec.name, { type: rec.blob.type })
    await deck.load(file, (a) => void this.updateTrack(id, a), rec.name)
  }

  loadDemo(index: number, deck: Deck): Promise<void> {
    const spec = DEMOS[index]
    return deck.loadGenerated(spec.name, () => renderDemo(spec))
  }

  async removeTrack(id: string): Promise<void> {
    await idb.delete(TRACKS, id).catch(() => undefined)
    await this.refresh()
  }

  async addRecording(blob: Blob, duration: number): Promise<RecordingMeta | null> {
    const now = new Date()
    const rec: RecordingRecord = {
      id: uid(),
      name: `DJ4YOU mix ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: now.getTime(),
      duration,
      size: blob.size,
      mime: blob.type,
      blob,
    }
    try {
      await idb.put(RECORDINGS, rec)
    } catch {
      // Not persisted: still keep it for this session.
      this.memoryRecordings.set(rec.id, blob)
      this.set({ recordings: [strip(rec), ...this.state.recordings] })
      return strip(rec)
    }
    await this.refresh()
    return strip(rec)
  }

  async recordingBlob(id: string): Promise<Blob | null> {
    const mem = this.memoryRecordings.get(id)
    if (mem) return mem
    const rec = await idb.get<RecordingRecord>(RECORDINGS, id).catch(() => undefined)
    return rec?.blob ?? null
  }

  async removeRecording(id: string): Promise<void> {
    this.memoryRecordings.delete(id)
    await idb.delete(RECORDINGS, id).catch(() => undefined)
    await this.refresh()
    if (this.state.unavailable) this.set({ recordings: this.state.recordings.filter((r) => r.id !== id) })
  }

  private memoryRecordings = new Map<string, Blob>()

  private async updateTrack(id: string, a: Analyzed): Promise<void> {
    const rec = await idb.get<TrackRecord>(TRACKS, id).catch(() => undefined)
    if (!rec) return
    await idb.put(TRACKS, { ...rec, bpm: a.bpm, duration: a.duration }).catch(() => undefined)
    this.set({ tracks: this.state.tracks.map((t) => (t.id === id ? { ...t, bpm: a.bpm, duration: a.duration } : t)) })
  }

  private async updateUsage(): Promise<void> {
    try {
      const est = await navigator.storage?.estimate?.()
      if (est?.usage !== undefined && est.quota) this.set({ usage: { used: est.usage, quota: est.quota } })
    } catch {
      /* not supported */
    }
  }
}

function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export const library = new Library()
