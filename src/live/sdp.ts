/**
 * WebRTC's Opus defaults are tuned for voice (mono, ~32 kb/s). Ask for
 * stereo music quality instead by rewriting the Opus fmtp line.
 */
const MUSIC_PARAMS: Record<string, string> = {
  stereo: '1',
  'sprop-stereo': '1',
  maxaveragebitrate: '192000',
  maxplaybackrate: '48000',
  useinbandfec: '1',
  usedtx: '0',
}

export function musicSdp(sdp: string): string {
  const rtpmap = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp)
  if (!rtpmap) return sdp
  const pt = rtpmap[1]
  const fmtp = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`)
  const existing = fmtp.exec(sdp)
  const params = new Map<string, string>()
  for (const kv of existing?.[1].split(';') ?? []) {
    const [k, v] = kv.split('=')
    if (k?.trim()) params.set(k.trim(), (v ?? '').trim())
  }
  for (const [k, v] of Object.entries(MUSIC_PARAMS)) params.set(k, v)
  const line = `a=fmtp:${pt} ${[...params].map(([k, v]) => `${k}=${v}`).join(';')}`
  return existing ? sdp.replace(fmtp, line) : sdp.replace(rtpmap[0], `${rtpmap[0]}\r\n${line}`)
}

/** Raise the sender's bitrate cap once the connection exists. */
export async function raiseBitrate(pc: RTCPeerConnection | undefined, bps = 192_000): Promise<void> {
  for (const sender of pc?.getSenders() ?? []) {
    if (sender.track?.kind !== 'audio') continue
    try {
      const p = sender.getParameters()
      p.encodings = p.encodings?.length ? p.encodings : [{}]
      p.encodings[0].maxBitrate = bps
      await sender.setParameters(p)
    } catch {
      /* not supported: the SDP hint still applies */
    }
  }
}
