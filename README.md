# DJ4YOU

A mobile-friendly DJ desk in the browser. Anyone with a phone or PC and a web browser can mix.

- Two decks with waveform, BPM detection, beat grid, SYNC and jog wheels
- Mixer with 3-band EQ, filter, channel faders, crossfader (blend / cut) and meters
- Headphone cue (split mode: left = headphones, right = speakers with a Y-splitter cable)
- Hot cues, beat-synced loops, echo and reverb
- On-device library (IndexedDB) with a built-in starter pack of 7 generated demo beats (house, techno, hip-hop 90, drum & bass 174); decks are restored on your next visit
- Record your mix and get a session recap (setlist, transitions, achievements, share); installable PWA that works offline
- A friendly coach: guided first-mix tutorial, gentle feedback on transitions, one-tap fixes when beats clash, and 13 achievements
- Spanish and English UI
- Go live: stream your mix to up to 20 listeners over WebRTC (stereo Opus, 192 kb/s), with a share link, QR code and a public "Live now" lobby

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build           # static site in dist/ (PWA)
npm run build:artifact  # single self-contained HTML file in dist-artifact/
```

## Layout

- `src/audio/` – the audio engine (plain TypeScript, Web Audio API): decks, mixer, FX, analysis worker, recorder
- `src/library/` – on-device track/recording storage
- `src/components/` – React UI
- `public/` – PWA manifest, service worker, icons
- `src/live/` – live streaming (PeerJS / WebRTC): broadcaster, listener, protocol
- `src/listen/` – the listener and lobby pages (`?listen=<id>`, `?live`)
- `server/` – optional signaling + lobby server

## How live streaming works

The DJ's master output (the same tap the recorder uses) is sent peer-to-peer
from the DJ's browser to each listener; no audio goes through a server. A
signaling server only introduces the browsers to each other.

- **Without a server of your own** the free public PeerJS server is used: Go Live
  and share links / QR codes work, the public lobby is off.
- **With the DJ4YOU server** (`server/`) you also get the **Live now** lobby.
  Set `VITE_SIGNAL_URL` at build time to its URL.

Because every listener gets their own stream from the DJ, the DJ's upload speed
sets the limit (capped at 20 listeners, about 200 kb/s each).

## Deploy

### Web app → GitHub Pages

1. Push to `main`.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow builds and publishes `dist/`. The site is
   at `https://<user>.github.io/<repo>/`.

### Live server (optional, enables the lobby)

Deploy `server/` anywhere that runs Node 20+ and supports WebSockets, e.g.
[Render](https://render.com) using `render.yaml` (New → Blueprint), or the
`server/Dockerfile` on Fly.io / Railway. Then add a repository variable
`SIGNAL_URL` (e.g. `https://dj4you-live.onrender.com`) under **Settings → Secrets
and variables → Actions → Variables** and re-run the deploy workflow.

```bash
cd server && npm install && npm start   # local: http://localhost:9000
VITE_SIGNAL_URL=http://localhost:9000 npm run dev
```
