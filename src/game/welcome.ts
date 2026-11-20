const KEY = 'dj4you.welcomed'

/** First visit: show the welcome screen. */
export function shouldWelcome(): boolean {
  // Installed as an app: open straight on the desk.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return false
  try {
    return localStorage.getItem(KEY) === null
  } catch {
    return true
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* shown again next time */
  }
}
