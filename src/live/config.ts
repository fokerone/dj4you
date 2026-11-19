import type { PeerOptions } from 'peerjs'

/**
 * Where signaling happens. Set VITE_SIGNAL_URL (e.g. https://dj4you-live.onrender.com)
 * to use the DJ4YOU server in /server, which also powers the public lobby.
 * Without it, the free public PeerJS server is used: share links work, the
 * lobby doesn't.
 */
const SIGNAL_URL: string | undefined = import.meta.env.VITE_SIGNAL_URL || undefined

export function peerOptions(): PeerOptions {
  const base: PeerOptions = { debug: 1 }
  if (!SIGNAL_URL) return base
  const u = new URL(SIGNAL_URL)
  const secure = u.protocol === 'https:'
  return {
    ...base,
    host: u.hostname,
    port: Number(u.port) || (secure ? 443 : 80),
    secure,
    path: `${u.pathname.replace(/\/$/, '')}/peerjs`,
    config: {
      iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }],
    },
  }
}

/** Lobby API base, or null when running without the DJ4YOU server. */
export const LOBBY_URL: string | null = SIGNAL_URL ? `${SIGNAL_URL.replace(/\/$/, '')}/lobby` : null

/** The single-file Artifact build runs where WebRTC is blocked; some browsers lack it. */
export function liveSupported(): boolean {
  return import.meta.env.MODE !== 'artifact' && typeof RTCPeerConnection !== 'undefined'
}

export const MAX_LISTENERS = 20

export function listenUrl(id: string): string {
  return `${location.origin}${location.pathname}?listen=${encodeURIComponent(id)}`
}

export function lobbyPageUrl(): string {
  return `${location.origin}${location.pathname}?live`
}
