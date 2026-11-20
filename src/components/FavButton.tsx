import { useStore } from '../hooks/useEngine'
import { useT } from '../i18n'
import { type Favorite, favoriteKey, prefs } from '../library/prefs'

/** Star toggle: adds or removes a track from Favorites. */
export function FavButton({ fav, title }: { fav: Favorite; title: string }) {
  const t = useT()
  useStore(prefs)
  const on = prefs.isFavorite(favoriteKey(fav))
  return (
    <button
      className={`btn btn-small btn-fav ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      aria-label={on ? t('Remove {title} from favorites', { title }) : t('Add {title} to favorites', { title })}
      title={on ? t('Remove from favorites') : t('Add to favorites')}
      onClick={() => prefs.toggleFavorite(fav)}
    >
      <span className="fav-star" aria-hidden>
        {on ? '★' : '☆'}
      </span>
    </button>
  )
}
