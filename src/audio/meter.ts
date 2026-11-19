/** Peak level (linear 0..1+) of an analyser's current time-domain window. */
export function readPeak(analyser: AnalyserNode, scratch: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(scratch)
  let peak = 0
  for (let i = 0; i < scratch.length; i++) {
    const v = Math.abs(scratch[i])
    if (v > peak) peak = v
  }
  return peak
}

export function createMeterTap(ctx: BaseAudioContext): AnalyserNode {
  const a = ctx.createAnalyser()
  a.fftSize = 1024
  a.smoothingTimeConstant = 0
  return a
}
