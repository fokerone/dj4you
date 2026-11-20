import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import { type Favorite, refKey, prefs } from '../library/prefs'

/** Star toggle: adds or removes a track from Favorites. `inline` sits before the title. */
export function FavButton({ fav, title, inline = false }: { fav: Favorite; title: string; inline?: boolean }) {
  const t = useT()
  useStore(prefs)
  const on = prefs.isFavorite(refKey(fav))
  return (
    <button
      className={`${inline ? 'fav-inline' : 'btn btn-small btn-fav'} ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      aria-label={on ? t('Remove {title} from favorites', { title }) : t('Add {title} to favorites', { title })}
      title={on ? t('Remove from favorites') : t('Add to favorites')}
      onClick={(e) => {
        e.stopPropagation()
        prefs.toggleFavorite(fav)
      }}
    >
      <span className="fav-star" aria-hidden>
        {on ? '★' : '☆'}
      </span>
    </button>
  )
}
