/** Map a 0..1 fader position to gain with a perceptually smoother curve. */
export function faderCurve(v: number): number {
  return v * v
}
