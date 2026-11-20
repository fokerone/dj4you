import { useEffect } from 'react'
import { engine } from '../audio/engine'

/** [keys, description] — descriptions are i18n keys. */

/** PC keyboard shortcuts (shown in the "Keys" panel). */
export const SHORTCUTS: [string, string][] = [
  ['Q / P', 'Play / pause deck A / B'],
  ['W / O', 'Cue deck A / B (hold to preview)'],
  ['1-4 / 7-0', 'Hot cues deck A / B'],
  ['Z / M', 'Sync deck A / B'],
  ['← →', 'Move the crossfader (Shift: all the way)'],
  ['Space', 'Play / pause the deck you hear most'],
]

export function useShortcuts(onToggleHelp: () => void): void {
  // '?' opens the menu, which lists these shortcuts.
  useEffect(() => {
    const [a, b] = engine.decks
    const held = new Set<string>()
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return t?.closest('input, textarea, select, [contenteditable]') !== null && t?.closest('input[type=range]') === null
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const mx = engine.mixer
      const hot: Record<string, [typeof a, number]> = { '1': [a, 0], '2': [a, 1], '3': [a, 2], '4': [a, 3], '7': [b, 0], '8': [b, 1], '9': [b, 2], '0': [b, 3] }
      let handled = true
      if (k === 'q') a.togglePlay()
      else if (k === 'p') b.togglePlay()
      else if (k === 'w' || k === 'o') {
        if (!held.has(k)) (k === 'w' ? a : b).cueDown()
        held.add(k)
      } else if (k in hot && !e.repeat) hot[k][0].hotCue(hot[k][1])
      else if (k === 'z') a.engageSync(b)
      else if (k === 'm') b.engageSync(a)
      else if (k === 'arrowleft') mx.setCrossfader(e.shiftKey ? 0 : mx.getSnapshot().crossfader - 0.05)
      else if (k === 'arrowright') mx.setCrossfader(e.shiftKey ? 1 : mx.getSnapshot().crossfader + 0.05)
      else if (k === ' ') {
        const x = mx.getSnapshot().crossfader
        ;(x <= 0.5 ? a : b).togglePlay()
      } else if (k === '?') onToggleHelp()
      else handled = false
      if (handled) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!held.delete(k)) return
      ;(k === 'w' ? a : b).cueUp()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [onToggleHelp])
}
