/**
 * Channel processing building blocks: DJ-style EQ, a one-knob filter, beat-synced
 * echo and a reverb. Control values are UI-friendly (-1..1 / 0..1); the mapping
 * to Hz / dB lives here.
 */

export type EqBand = 'low' | 'mid' | 'high'

export const EQ_FREQS: Record<EqBand, number> = { low: 220, mid: 1000, high: 3800 }

/**
 * EQ knob (-1..1) → gain in dB. Right half boosts up to +6 dB; left half cuts
 * along 20·log10(1+v), so the last bit of travel falls off to a -40 dB "kill".
 */
export function eqKnobToDb(v: number): number {
  if (v >= 0) return 6 * v
  return Math.max(-40, 20 * Math.log10(1 + v))
}

const FILTER_DEADZONE = 0.03

/**
 * Filter knob (-1..1) → cutoffs. Left sweeps a low-pass down from 20 kHz to
 * 80 Hz, right sweeps a high-pass up from 20 Hz to 8 kHz, centre is off.
 * Exponential so the sweep sounds even.
 */
export function filterKnobToCutoffs(v: number, nyquist: number): { lowpass: number; highpass: number } {
  const lpOpen = Math.min(20000, nyquist * 0.95)
  const hpOpen = 10
  if (v < -FILTER_DEADZONE) {
    const t = (-v - FILTER_DEADZONE) / (1 - FILTER_DEADZONE)
    return { lowpass: lpOpen * (80 / lpOpen) ** t, highpass: hpOpen }
  }
  if (v > FILTER_DEADZONE) {
    const t = (v - FILTER_DEADZONE) / (1 - FILTER_DEADZONE)
    return { lowpass: lpOpen, highpass: 20 * (8000 / 20) ** t }
  }
  return { lowpass: lpOpen, highpass: hpOpen }
}

/** Decaying stereo noise: a cheap, decent-sounding plate-like reverb. */
export function createImpulseResponse(ctx: BaseAudioContext, seconds = 2.6, decay = 3.2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  const preDelay = Math.floor(ctx.sampleRate * 0.012)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = preDelay; i < len; i++) {
      const t = (i - preDelay) / (len - preDelay)
      d[i] = (Math.random() * 2 - 1) * (1 - t) ** decay
    }
  }
  return ir
}

export const ECHO_BEATS = [0.25, 0.5, 0.75, 1] as const
export type EchoBeats = (typeof ECHO_BEATS)[number]

export function echoLabel(b: EchoBeats): string {
  return b === 0.25 ? '1/4' : b === 0.5 ? '1/2' : b === 0.75 ? '3/4' : '1'
}
