import { engine } from '../audio/engine'
import { useStore } from '../hooks/useEngine'
import { FloatingReactions } from './Reactions'

/** While live, listeners' reactions float up over the desk. */
export function LiveReactions() {
  const live = useStore(engine.live)
  if (live.status !== 'live') return null
  return <FloatingReactions feed={live.reactionFeed} className="is-dj" />
}
