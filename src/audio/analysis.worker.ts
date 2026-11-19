import { analyze } from './analysis'

interface Request {
  id: number
  mono: Float32Array
  sampleRate: number
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Request>) => void) | null
  postMessage(msg: unknown, transfer: Transferable[]): void
}

scope.onmessage = (e) => {
  const { id, mono, sampleRate } = e.data
  const result = analyze(mono, sampleRate)
  scope.postMessage({ id, result }, [result.peaks.buffer, result.detail.buffer, result.bands.low.buffer, result.bands.mid.buffer, result.bands.high.buffer])
}
