# DJ4YOU

A mobile-friendly DJ desk in the browser. Anyone with a phone or PC and a web browser can mix.

- Two decks with waveform, BPM detection, beat grid, SYNC and jog wheels
- Mixer with 3-band EQ, filter, channel faders, crossfader (blend / cut) and meters
- Hot cues, beat-synced loops, echo and reverb
- On-device library (IndexedDB) with a built-in starter pack of generated demo beats
- Record your mix; installable PWA that works offline
- Go live: stream your mix to listeners over WebRTC

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
