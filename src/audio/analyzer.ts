import { analyze, type Analysis } from './analysis'
// Inlined as a blob so it also works from a single-file build.
import AnalysisWorker from './analysis.worker?worker&inline'

interface Job {
  buffer: AudioBuffer
  resolve: (a: Analysis) => void
}

let worker: Worker | null | undefined
let nextId = 0
const jobs = new Map<number, Job>()

/** Analyse a decoded track off the main thread (falls back to main thread). */
export function analyzeBuffer(buffer: AudioBuffer): Promise<Analysis> {
  return new Promise((resolve) => {
    const w = getWorker()
    if (!w) {
      resolve(analyze(downmix(buffer), buffer.sampleRate))
      return
    }
    const id = nextId++
    jobs.set(id, { buffer, resolve })
    const mono = downmix(buffer)
    w.postMessage({ id, mono, sampleRate: buffer.sampleRate }, [mono.buffer])
  })
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    const w = new AnalysisWorker()
    w.onmessage = (e: MessageEvent<{ id: number; result: Analysis }>) => {
      const job = jobs.get(e.data.id)
      jobs.delete(e.data.id)
      job?.resolve(e.data.result)
    }
    // e.g. blocked by a Content-Security-Policy: finish pending jobs here instead.
    w.onerror = () => {
      worker = null
      w.terminate()
      for (const [id, job] of jobs) {
        jobs.delete(id)
        job.resolve(analyze(downmix(job.buffer), job.buffer.sampleRate))
      }
    }
    worker = w
  } catch {
    worker = null
  }
  return worker
}

function downmix(buffer: AudioBuffer): Float32Array<ArrayBuffer> {
  const out = new Float32Array(buffer.length)
  const n = buffer.numberOfChannels
  for (let c = 0; c < n; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < out.length; i++) out[i] += data[i] / n
  }
  return out
}
