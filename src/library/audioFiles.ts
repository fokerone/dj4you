/**
 * Which files the file pickers offer.
 *
 * iOS Safari maps `accept="audio/*"` poorly: in the Files app many MP3s and
 * other songs show up greyed out. On iPhone / iPad the picker therefore
 * allows any file and we check the type ourselves; elsewhere we list the
 * audio extensions explicitly next to the MIME wildcard.
 */

const EXTENSIONS = ['mp3', 'm4a', 'mp4', 'aac', 'wav', 'wave', 'aif', 'aiff', 'flac', 'ogg', 'oga', 'opus', 'webm', 'caf', 'weba']

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

/** Value for <input type="file" accept>, or undefined to allow any file. */
export function audioAccept(): string | undefined {
  if (isIOS()) return undefined
  return ['audio/*', ...EXTENSIONS.map((e) => `.${e}`)].join(',')
}

/** Best-effort check before storing / decoding a file. */
export function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  // Some systems report MP4/WebM audio as video/*; trust the extension.
  return EXTENSIONS.includes(ext)
}
