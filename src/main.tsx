import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './skin.css'
import { registerServiceWorker } from './pwa'

// Listeners (`?listen=<id>`) and the lobby (`?live`) get a light page that
// never starts the DJ audio engine; everyone else gets the desk.
const params = new URLSearchParams(location.search)
const isListener = params.has('listen') || params.has('live')

const load = isListener ? import('./listen/ListenerApp') : import('./App')
void load.then(({ default: Root }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
})

registerServiceWorker()
