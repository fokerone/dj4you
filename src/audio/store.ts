/** Minimal observable state container, consumed in React via useSyncExternalStore. */
export class Store<S extends object> {
  protected state: S
  private readonly listeners = new Set<() => void>()

  constructor(initial: S) {
    this.state = initial
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): S => this.state

  /** Replace state with a patched copy and notify. An empty patch still notifies. */
  protected set(patch: Partial<S>): void {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn()
  }
}
