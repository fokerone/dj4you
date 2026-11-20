/** Pure tempo maths shared by the decks (and covered by tests). */

/**
 * Tempo change (%) that makes a track at `own` BPM play at `target` BPM, also
 * at double or half time (e.g. 87 ↔ 174), and the ratio used: our beats per
 * beat of the other track. Null if unknown or beyond `reach` %.
 */
export function matchTempo(own: number | null, target: number | null, reach: number): { pitch: number; ratio: 1 | 2 | 0.5 } | null {
  if (target === null || own === null) return null
  let best: { pitch: number; ratio: 1 | 2 | 0.5 } | null = null
  for (const ratio of [1, 2, 0.5] as const) {
    const pitch = ((target * ratio) / own - 1) * 100
    if (!best || Math.abs(pitch) < Math.abs(best.pitch)) best = { pitch, ratio }
  }
  return best && Math.abs(best.pitch) <= reach + 1e-9 ? best : null
}
