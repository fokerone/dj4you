// DJ4YOU live server: WebRTC signaling (PeerJS-compatible) + the public lobby
// of live sets. Audio never passes through here — it flows peer-to-peer from
// the DJ's browser to each listener.
import cors from 'cors'
import express from 'express'
import { ExpressPeerServer } from 'peer'

const PORT = Number(process.env.PORT) || 9000
/** A lobby entry disappears if the DJ stops sending heartbeats. */
const LOBBY_TTL_MS = 45_000
const ID_RE = /^dj4you-[a-z0-9]{6,16}$/

const app = express()
app.set('trust proxy', true)
app.use(cors())
app.use(express.json({ limit: '4kb' }))

/** Peer ids currently connected to the signaling server. */
const connected = new Set()
/** id -> { id, dj, title, listeners, startedAt, seenAt } */
const lobby = new Map()

const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max)

app.get('/health', (_req, res) => res.json({ ok: true, live: lobby.size }))

app.get('/lobby', (_req, res) => {
  const now = Date.now()
  for (const [id, e] of lobby) if (now - e.seenAt > LOBBY_TTL_MS || !connected.has(id)) lobby.delete(id)
  const sets = [...lobby.values()]
    .sort((a, b) => b.listeners - a.listeners || a.startedAt - b.startedAt)
    .map(({ seenAt: _s, ...e }) => e)
  res.set('Cache-Control', 'no-store').json({ sets })
})

// Announce or refresh a public set. Only a DJ that is actually connected to
// the signaling server can list itself, which keeps junk out of the lobby.
app.post('/lobby', (req, res) => {
  const id = clean(req.body?.id, 40)
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'bad id' })
  if (!connected.has(id)) return res.status(409).json({ error: 'not connected' })
  const prev = lobby.get(id)
  lobby.set(id, {
    id,
    dj: clean(req.body?.dj, 40) || 'Anonymous DJ',
    title: clean(req.body?.title, 80),
    listeners: Math.max(0, Math.min(999, Number(req.body?.listeners) || 0)),
    startedAt: prev?.startedAt ?? Date.now(),
    seenAt: Date.now(),
  })
  res.status(204).end()
})

app.delete('/lobby/:id', (req, res) => {
  lobby.delete(req.params.id)
  res.status(204).end()
})

const server = app.listen(PORT, () => console.log(`DJ4YOU live server on :${PORT}`))

const peerServer = ExpressPeerServer(server, { path: '/', proxied: true, allow_discovery: false })
peerServer.on('connection', (client) => connected.add(client.getId()))
peerServer.on('disconnect', (client) => {
  connected.delete(client.getId())
  lobby.delete(client.getId())
})
app.use('/peerjs', peerServer)
