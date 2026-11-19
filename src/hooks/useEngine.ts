import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Store } from '../audio/store'

/** Subscribe a component to an engine store's (low-frequency) state. */
export function useStore<S extends object>(store: Store<S>): S {
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/**
 * Run `cb` every animation frame. For high-frequency visuals (play head,
 * clocks) that write straight to the DOM instead of going through React.
 */
export function useAnimationFrame(cb: () => void): void {
  const ref = useRef(cb)
  useEffect(() => {
    ref.current = cb
  })
  useEffect(() => {
    let id = 0
    const loop = () => {
      ref.current()
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
}
