/** Short vibration feedback on phones that support it (Android). No-op elsewhere. */
export function buzz(pattern: number | number[]): void {
  try {
    if (matchMedia('(pointer: coarse)').matches) navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}
