import type { Mixer } from './mixer'
import { Store } from './store'

export interface RecorderState {
  readonly supported: boolean
  readonly recording: boolean
  /** performance.now() when recording started */
  readonly startedAt: number
  readonly error: string | null
}

/** Formats in order of preference; Safari only does MP4/AAC. */
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus']

/**
 * Records the master output (post-limiter: exactly what you hear) with
 * MediaRecorder. The same MediaStream tap will feed the live stream later.
 */
export class Recorder extends Store<RecorderState> {
  private readonly ctx: AudioContext
  private readonly mixer: Mixer
  private tap: MediaStreamAudioDestinationNode | null = null
  private media: MediaRecorder | null = null
  private chunks: Blob[] = []
  private onDone: ((blob: Blob, seconds: number) => void) | null = null

  constructor(ctx: AudioContext, mixer: Mixer) {
    super({
      supported: typeof MediaRecorder !== 'undefined' && 'createMediaStreamDestination' in ctx,
      recording: false,
      startedAt: 0,
      error: null,
    })
    this.ctx = ctx
    this.mixer = mixer
  }

  /** Master output as a MediaStream (created on first use). */
  get stream(): MediaStream {
    if (!this.tap) {
      this.tap = this.ctx.createMediaStreamDestination()
      this.mixer.output.connect(this.tap)
    }
    return this.tap.stream
  }

  start(onDone: (blob: Blob, seconds: number) => void): void {
    if (this.state.recording || !this.state.supported) return
    try {
      const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
      const media = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 192_000 })
      this.chunks = []
      this.onDone = onDone
      media.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data)
      }
      media.onstop = () => {
        const seconds = (performance.now() - this.state.startedAt) / 1000
        const blob = new Blob(this.chunks, { type: media.mimeType || mimeType || 'audio/webm' })
        this.chunks = []
        this.media = null
        this.set({ recording: false })
        if (blob.size > 0) this.onDone?.(blob, seconds)
      }
      media.onerror = () => this.set({ recording: false, error: 'Recording stopped unexpectedly.' })
      media.start(1000) // 1 s chunks: a crash loses at most a second
      this.media = media
      this.set({ recording: true, startedAt: performance.now(), error: null })
    } catch {
      this.set({ recording: false, error: "This browser can't record audio." })
    }
  }

  stop(): void {
    if (this.media && this.media.state !== 'inactive') this.media.stop()
  }
}
