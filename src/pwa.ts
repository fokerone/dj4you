import { Store } from './audio/store'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallState {
  /** The browser offered an install prompt we can show (Chrome / Edge / Android). */
  readonly canPrompt: boolean
  /** Running as an installed app */
  readonly installed: boolean
  /** iOS Safari: install is manual via Share → Add to Home Screen */
  readonly iosHint: boolean
  /** Inside an embedding frame (e.g. a preview): install and downloads unavailable */
  readonly embedded: boolean
}

class Install extends Store<InstallState> {
  private deferred: BeforeInstallPromptEvent | null = null

  constructor() {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    let embedded = false
    try {
      embedded = window.top !== window.self
    } catch {
      embedded = true
    }
    super({ canPrompt: false, installed: standalone, iosHint: ios && !standalone && !embedded, embedded })

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferred = e as BeforeInstallPromptEvent
      this.set({ canPrompt: true })
    })
    window.addEventListener('appinstalled', () => {
      this.deferred = null
      this.set({ canPrompt: false, installed: true })
    })
  }

  async prompt(): Promise<void> {
    const e = this.deferred
    if (!e) return
    this.deferred = null
    this.set({ canPrompt: false })
    await e.prompt()
  }
}

export const install = new Install()

/** Offline support for the hosted app. Not used in the single-file build. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'artifact') return
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}
