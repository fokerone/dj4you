import { Store } from './audio/store'
import { useStore } from './hooks/useEngine'

/**
 * Tiny i18n: English strings are the keys; other languages map them.
 * Missing translations fall back to English (and warn in dev).
 * `{name}` placeholders are filled from `vars`.
 */

export type Lang = 'en' | 'es'
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
]

const KEY = 'dj4you.lang'

const ES: Record<string, string> = {
  // brand / general
  'Rock the crowd. Right from your browser.': 'Haz bailar al público. Desde tu navegador.',
  Close: 'Cerrar',
  Open: 'Abrir',
  Language: 'Idioma',
  Keys: 'Teclas',
  'Keyboard shortcuts': 'Atajos de teclado',
  playing: 'sonando',
  Deck: 'Deck',
  'Deck {id}': 'Deck {id}',
  'Desk sections': 'Secciones de la mesa',
  Mixer: 'Mezclador',
  'Saved "{name}" to the Library': 'Guardada "{name}" en la Biblioteca',

  // welcome
  'Welcome to DJ4YOU': 'Bienvenido a DJ4YOU',
  Mix: 'Mezcla',
  'two decks with sync, EQ, loops and FX': 'dos decks con sync, EQ, loops y efectos',
  Score: 'Puntúa',
  'points for smooth, in-time transitions': 'con transiciones suaves y a tiempo',
  'Level up': 'Sube de nivel',
  'from Bedroom DJ to Festival Legend': 'de DJ de Habitación a Leyenda de Festival',
  'Play the tutorial': 'Jugar el tutorial',
  'Your first mix in 2 minutes': 'Tu primera mezcla en 2 minutos',
  'Quick start with 2 beats': 'Empezar con 2 beats',
  'Free play': 'Juego libre',

  // deck
  'Load a track or open the Library': 'Carga un tema o abre la Biblioteca',
  'Load track': 'Cargar tema',
  'Load a track from this device': 'Cargar un tema desde este dispositivo',
  Load: 'Cargar',
  'Open library': 'Abrir biblioteca',
  'Your tracks, demo beats and recordings': 'Tus temas, beats de demo y grabaciones',
  Library: 'Biblioteca',
  'Match tempo and beats to deck {id}': 'Igualar tempo y beats con el deck {id}',
  'Needs a BPM on both decks': 'Necesita BPM en ambos decks',
  Tempo: 'Tempo',
  'Zoom out': 'Alejar',
  'Zoom in': 'Acercar',
  'Analyzing…': 'Analizando…',
  'Loading…': 'Cargando…',
  'No track loaded': 'Sin tema cargado',
  'Jog wheel deck {id}': 'Jog del deck {id}',
  'Spin to nudge or scrub': 'Gira para ajustar o buscar',
  'Couldn\'t decode "{name}"': 'No se pudo leer "{name}"',
  'Couldn\'t create "{name}"': 'No se pudo crear "{name}"',

  // pads
  'Pad mode': 'Modo de pads',
  'Hot Cue': 'Hot Cue',
  Loop: 'Loop',
  FX: 'FX',
  'Pad mode: {mode}. Switch to {next}': 'Modo de pads: {mode}. Cambiar a {next}',
  beat: 'tiempo',
  beats: 'tiempos',
  Echo: 'Eco',
  Reverb: 'Reverb',
  Wet: 'Efecto',
  'Echo time {t} beat': 'Tiempo de eco {t}',
  set: 'fijar',
  'Hot cue {n}: jump. Hold to clear': 'Hot cue {n}: saltar. Mantén para borrar',
  'Set hot cue {n}': 'Fijar hot cue {n}',

  // mixer
  Hi: 'Agudos',
  Mid: 'Medios',
  Low: 'Graves',
  Filter: 'Filtro',
  HI: 'AGU',
  MID: 'MED',
  LOW: 'GRA',
  FLT: 'FIL',
  Master: 'Master',
  'Channel {id}': 'Canal {id}',
  'Deck {id} level': 'Nivel del deck {id}',
  'Master level': 'Nivel master',
  Crossfader: 'Crossfader',
  'Crossfader curve': 'Curva del crossfader',
  Blend: 'Suave',
  Cut: 'Corte',

  // rec / live buttons
  REC: 'REC',
  'Record your mix': 'Graba tu mezcla',
  'Stop recording and save to the library': 'Parar y guardar en la biblioteca',
  'Recording stopped unexpectedly.': 'La grabación se detuvo inesperadamente.',
  "This browser can't record audio.": 'Este navegador no puede grabar audio.',
  'Go live': 'Transmitir en vivo',
  LIVE: 'LIVE',
  'LIVE {n}': 'LIVE {n}',
  'Live, {n} listeners': 'En vivo, {n} oyentes',
  'DJ4YOU mix {date}': 'Mezcla DJ4YOU {date}',

  // library
  'Add tracks': 'Añadir temas',
  'Close library': 'Cerrar biblioteca',
  'Your tracks': 'Tus temas',
  "This browser is blocking storage, so tracks play but won't be kept after you close the page.":
    'Este navegador bloquea el almacenamiento: los temas suenan, pero no se guardan al cerrar la página.',
  "Tracks you load are kept here on this device, so they're ready next time. Nothing is uploaded. Tap Add tracks or load a file onto a deck.":
    'Los temas que cargues se guardan aquí, en este dispositivo, para la próxima vez. No se sube nada. Toca Añadir temas o carga un archivo en un deck.',
  'Starter pack': 'Pack de inicio',
  '{bpm} BPM · {dur} · made in your browser': '{bpm} BPM · {dur} · creado en tu navegador',
  Recordings: 'Grabaciones',
  'Press REC next to the crossfader to record your mix. Recordings are saved here.':
    'Pulsa REC para grabar tu mezcla. Las grabaciones se guardan aquí.',
  '{used} used on this device · {quota} available': '{used} usados en este dispositivo · {quota} disponibles',
  'Install app': 'Instalar app',
  'To install: Share → Add to Home Screen': 'Para instalar: Compartir → Añadir a pantalla de inicio',
  'Load {title} on deck {id}': 'Cargar {title} en el deck {id}',
  'Delete?': '¿Borrar?',
  'Delete {label}': 'Borrar {label}',
  'Confirm delete {label}': 'Confirmar borrar {label}',
  'Play {name}': 'Reproducir {name}',
  'Download {name}': 'Descargar {name}',
  Download: 'Descargar',
  'downloads work in the hosted app': 'las descargas funcionan en la web',
  downloaded: 'descargada',
  "couldn't download": 'no se pudo descargar',

  // live sheet
  "You're live": 'Estás en vivo',
  "Live streaming isn't available in this preview. Open the DJ4YOU website to go live.":
    'La transmisión en vivo no está disponible en esta vista previa. Abre la web de DJ4YOU para transmitir.',
  'DJ name': 'Nombre de DJ',
  'Set title (optional)': 'Título de la sesión (opcional)',
  'Friday warm-up': 'Calentamiento del viernes',
  'List my set in Live now so anyone can find it': 'Mostrar mi sesión en En vivo ahora para que cualquiera la encuentre',
  'Needs the DJ4YOU live server. Your share link still works.': 'Necesita el servidor de DJ4YOU. Tu enlace para compartir sigue funcionando.',
  "Listeners hear exactly what comes out of your master, in their browser, with no app or account. Up to {max} listeners. Keep this page open while you're live.":
    'Los oyentes escuchan exactamente lo que sale de tu master, en su navegador, sin app ni cuenta. Hasta {max} oyentes. Mantén esta página abierta mientras estés en vivo.',
  'Start live set': 'Empezar sesión en vivo',
  'Starting your set…': 'Iniciando tu sesión…',
  'on air': 'en el aire',
  listener: 'oyente',
  listeners: 'oyentes',
  'QR code for your listen link': 'Código QR de tu enlace para escuchar',
  'Scan to listen, or share the link:': 'Escanea para escuchar o comparte el enlace:',
  Copied: 'Copiado',
  Copy: 'Copiar',
  "Couldn't list your set in Live now. The link still works.": 'No se pudo mostrar tu sesión en En vivo ahora. El enlace sigue funcionando.',
  'Listed in Live now.': 'Visible en En vivo ahora.',
  'See the lobby': 'Ver la sala',
  'End live set': 'Terminar sesión en vivo',
  "This browser can't stream live.": 'Este navegador no puede transmitir en vivo.',
  "Couldn't reach the live server. Check your connection and try again.":
    'No se pudo conectar con el servidor en vivo. Revisa tu conexión e inténtalo de nuevo.',

  // HUD / game UI
  Crowd: 'Público',
  'Crowd energy': 'Energía del público',
  'Lv {n}': 'Nv {n}',
  'Level {n}, {title}. Show achievements': 'Nivel {n}, {title}. Ver logros',
  Achievements: 'Logros',
  'Close achievements': 'Cerrar logros',
  'Replay the first-mix tutorial': 'Repetir el tutorial',
  'Achievement unlocked': 'Logro desbloqueado',
  'Mission {n}/{total}': 'Misión {n}/{total}',
  'Skip tutorial': 'Saltar tutorial',
  'Beat alignment between deck A and B': 'Alineación de beats entre el deck A y B',
  'IN SYNC': 'EN FASE',
  ALIGN: 'ALINEA',
  PHASE: 'FASE',

  // levels
  'Bedroom DJ': 'DJ de Habitación',
  'Party Starter': 'Animador de Fiestas',
  'Warm-up DJ': 'DJ de Calentamiento',
  'Club Resident': 'Residente del Club',
  Headliner: 'Cabeza de Cartel',
  'Festival Legend': 'Leyenda de Festival',
  'Hall of Fame': 'Salón de la Fama',

  // achievements
  'Needle drop': 'Primera aguja',
  'Play your first track': 'Reproduce tu primer tema',
  'Locked in': 'Sincronizado',
  'Match two tracks with SYNC': 'Iguala dos temas con SYNC',
  'First mix': 'Primera mezcla',
  'Finish a transition between decks': 'Termina una transición entre decks',
  'Perfect blend': 'Mezcla perfecta',
  'Land a perfect transition': 'Consigue una transición perfecta',
  'On fire': 'En racha',
  'Reach a x3 combo': 'Llega a un combo x3',
  'Loop it': 'En bucle',
  'Use a beat loop': 'Usa un loop',
  'Effects wizard': 'Mago de los efectos',
  'Play with echo or reverb': 'Juega con el eco o la reverb',
  'Hot cue hero': 'Héroe de los hot cues',
  'Set all 4 hot cues on a deck': 'Fija los 4 hot cues de un deck',
  'Peak time': 'Hora punta',
  'Get the crowd to 100% energy': 'Lleva al público al 100% de energía',
  'On the record': 'Grabado',
  'Record a mix': 'Graba una mezcla',
  'On air': 'Al aire',
  'Go live to listeners': 'Transmite en vivo',
  '10K club': 'Club de los 10K',
  'Score 10,000 points in one session': 'Consigue 10.000 puntos en una sesión',

  // quest
  'Load a beat': 'Carga un beat',
  'Open the Library on Deck A and load "Sunrise" onto A.': 'Abre la Biblioteca en el Deck A y carga "Sunrise" en A.',
  'Drop the needle': 'Que empiece la música',
  'Press ▶ on Deck A. The crowd is waiting!': 'Pulsa ▶ en el Deck A. ¡El público espera!',
  'Own the floor': 'Domina la pista',
  'Slide the crossfader all the way to A so only Deck A is heard.': 'Lleva el crossfader del todo hacia A para que solo suene el Deck A.',
  'Cue the next track': 'Prepara el siguiente tema',
  'Load "Night Drive" onto Deck B. Nobody hears it yet.': 'Carga "Night Drive" en el Deck B. Todavía no lo oye nadie.',
  'Start it silently': 'Arráncalo en silencio',
  'Press ▶ on Deck B. It plays in the background.': 'Pulsa ▶ en el Deck B. Suena de fondo.',
  'Match the beats': 'Iguala los beats',
  'Press SYNC on Deck B. The phase meter turns green when beats line up.':
    'Pulsa SYNC en el Deck B. El medidor de fase se pone verde cuando los beats coinciden.',
  'The transition': 'La transición',
  'Slowly slide the crossfader all the way to B. Take a few seconds!': 'Desliza despacio el crossfader del todo hacia B. ¡Tómate unos segundos!',

  // game events
  'LEVEL {n}': 'NIVEL {n}',
  'DEAD AIR': 'SILENCIO',
  'Keep the music playing!': '¡Que no pare la música!',
  TRAINWRECK: 'CHOQUE DE BEATS',
  'Beats are clashing: use SYNC or the jog wheel': 'Los beats chocan: usa SYNC o el jog',
  'The crowd wants something new': 'El público quiere algo nuevo',
  'Mix in the next track': 'Mezcla el siguiente tema',
  'MISSION COMPLETE': 'MISIÓN CUMPLIDA',
  "You're a DJ now. Keep the crowd going!": 'Ya eres DJ. ¡Mantén al público bailando!',
  'PERFECT TRANSITION': 'TRANSICIÓN PERFECTA',
  '{n}s seamless blend': '{n}s de mezcla perfecta',
  'SMOOTH MIX': 'MEZCLA SUAVE',
  'Blend longer for a perfect transition': 'Mezcla más tiempo para una transición perfecta',
  'QUICK CUT': 'CORTE RÁPIDO',
  'Try a slow crossfade with SYNC on': 'Prueba un crossfade lento con SYNC',

  // shortcuts
  'Play / pause deck A / B': 'Reproducir / pausar deck A / B',
  'Cue deck A / B (hold to preview)': 'Cue deck A / B (mantén para escuchar)',
  'Hot cues deck A / B': 'Hot cues deck A / B',
  'Sync deck A / B': 'Sync deck A / B',
  'Move the crossfader (Shift: all the way)': 'Mover el crossfader (Shift: del todo)',
  'Play / pause the deck you hear most': 'Reproducir / pausar el deck que más suena',

  // listener page
  'Open the DJ desk': 'Abrir la mesa de DJ',
  'DJ4YOU LIVE': 'DJ4YOU EN VIVO',
  '{dj} live': '{dj} en vivo',
  'Live DJ set': 'Sesión de DJ en vivo',
  'by {dj}': 'por {dj}',
  '▶ Tap to listen': '▶ Toca para escuchar',
  'Connecting to the DJ…': 'Conectando con el DJ…',
  '▶ Start audio': '▶ Activar audio',
  'Now playing': 'Sonando ahora',
  'Getting the next track ready…': 'Preparando el siguiente tema…',
  Empty: 'Vacío',
  'live for {time}': 'en vivo desde hace {time}',
  Volume: 'Volumen',
  'This set has ended. Thanks for listening!': 'La sesión ha terminado. ¡Gracias por escuchar!',
  "This set isn't live right now. It may have ended, or the link is incomplete.":
    'Esta sesión no está en vivo ahora. Puede que haya terminado o que el enlace esté incompleto.',
  'This set is full right now. Try again in a bit.': 'La sesión está llena. Inténtalo en un rato.',
  'Try again': 'Reintentar',
  "See who's live": 'Ver quién está en vivo',
  'Start your own set': 'Empieza tu propia sesión',
  'Live now': 'En vivo ahora',
  "The public lobby isn't set up on this site yet. Ask the DJ for their listen link.":
    'La sala pública aún no está activa en esta web. Pide al DJ su enlace para escuchar.',
  "Couldn't load live sets. Retrying…": 'No se pudieron cargar las sesiones. Reintentando…',
  'Nobody is live right now.': 'Nadie está en vivo ahora.',
  'Be the first DJ': 'Sé el primer DJ',
  Listen: 'Escuchar',
  '{genre} · {bpm} BPM · {dur}': '{genre} · {bpm} BPM · {dur}',
  // v4: coach, menu, welcome, deck states
  'SYNC deck {id}': 'SYNC deck {id}',
  'Dismiss tip': 'Cerrar consejo',
  'Step {n} of {total}': 'Paso {n} de {total}',
  'Beats aligned': 'Beats alineados',
  'Beats off': 'Beats desfasados',
  'Beat phase': 'Fase de beats',
  'Different tempos': 'Tempos distintos',
  'No tempo detected': 'No se detectó el tempo',
  'Play both decks': 'Reproduce los dos decks',
  Menu: 'Menú',
  'This session': 'Esta sesión',
  'minutes mixing': 'minutos mezclando',
  transitions: 'transiciones',
  achievements: 'logros',
  Unlocked: 'Desbloqueado',
  Locked: 'Bloqueado',
  'Tutorial in progress': 'Tutorial en curso',
  'Play the tutorial again': 'Repetir el tutorial',
  'Show the welcome screen': 'Ver la pantalla de bienvenida',
  'Tap again to reset achievements': 'Toca otra vez para borrar los logros',
  'Reset achievements': 'Borrar logros',
  'Free · No sign-up · Runs in your browser': 'Gratis · Sin registro · Funciona en tu navegador',
  'Mix like a DJ, right in your browser.': 'Mezcla como un DJ, directamente en tu navegador.',
  'Two decks, sync, loops and effects. No downloads, no sign-up.': 'Dos decks, sync, loops y efectos. Sin descargas ni registro.',
  'Learn in 2 minutes': 'Aprende en 2 minutos',
  'A guided first mix, one step at a time': 'Tu primera mezcla guiada, paso a paso',
  'Start mixing': 'Empezar a mezclar',
  'Two demo beats, loaded and ready': 'Dos beats de demo, cargados y listos',
  'Start with an empty desk': 'Empezar con la mesa vacía',
  Free: 'Gratis',
  'No sign-up': 'Sin registro',
  'Your music stays on your device': 'Tu música no sale de tu dispositivo',
  'Works offline once installed': 'Funciona sin conexión al instalarla',
  'The beats aren’t lined up. Press SYNC on the incoming deck.': 'Los beats no coinciden. Pulsa SYNC en el deck que entra.',
  'The beats aren’t lined up. Nudge the jog wheel to align them.': 'Los beats no coinciden. Ajusta con el jog para alinearlos.',
  'The dance floor is quiet. Press ▶ or raise a fader.': 'La pista está en silencio. Pulsa ▶ o sube un fader.',
  'Perfect transition': 'Transición perfecta',
  'Smooth transition': 'Transición suave',
  'Blend a little longer for a perfect one': 'Mezcla un poco más para que sea perfecta',
  'Tutorial complete': 'Tutorial completado',
  "You're a DJ now. Keep the music flowing!": 'Ya eres DJ. ¡Que no pare la música!',
  'Blend two tracks in time for 4 seconds or more': 'Mezcla dos temas a tiempo durante 4 segundos o más',
  'In the groove': 'En el groove',
  'Make 3 smooth transitions in a row': 'Haz 3 transiciones suaves seguidas',
  'Filter sweep': 'Barrido de filtro',
  'Sweep the filter while a track plays': 'Mueve el filtro mientras suena un tema',
  'Bass swap': 'Cambio de graves',
  'Cut the bass on one deck while blending': 'Quita los graves de un deck mientras mezclas',
  Marathon: 'Maratón',
  'Keep the music going for 10 minutes': 'Mantén la música sonando 10 minutos',
  'Loading track…': 'Cargando tema…',
  'Finding the tempo…': 'Detectando el tempo…',
  'Deck {id} is empty': 'El deck {id} está vacío',
  'Choose another file': 'Elegir otro archivo',
  'Open a file': 'Abrir un archivo',
  'or drop an audio file here': 'o arrastra aquí un archivo de audio',
  'No track': 'Sin tema',
  'Loading your library…': 'Cargando tu biblioteca…',
  // v5: tactile, cue, recap, resume
  'Preview deck {id} in headphones': 'Escuchar el deck {id} en los auriculares',
  Headphones: 'Auriculares',
  'Hear the next track in your headphones before the crowd does, and line it up in private.': 'Escucha el siguiente tema en tus auriculares antes que el público y cuádralo en privado.',
  'What you need': 'Qué necesitas',
  'A stereo Y-splitter cable (one plug, two jacks).': 'Un cable divisor estéreo en Y (una clavija, dos salidas).',
  'Headphones on the LEFT jack, speakers on the RIGHT jack.': 'Auriculares en la salida IZQUIERDA y altavoces en la DERECHA.',
  'Turn split mode on below. Both outputs become mono.': 'Activa el modo dividido aquí abajo. Las dos salidas pasan a mono.',
  'Split mode': 'Modo dividido',
  'On: left = headphones, right = speakers': 'Activado: izquierda = auriculares, derecha = altavoces',
  'Off: both channels play the master': 'Desactivado: los dos canales suenan con el master',
  'Cue / master': 'Cue / master',
  Cue: 'Cue',
  'Headphone volume': 'Volumen de auriculares',
  'Recordings and live sets always get the full stereo mix.': 'Las grabaciones y los directos siempre reciben la mezcla estéreo completa.',
  'Preview the next track': 'Escucha el siguiente tema',
  'I just mixed {time} on DJ4YOU: {n} transitions ({p} perfect).': 'Acabo de mezclar {time} en DJ4YOU: {n} transiciones ({p} perfectas).',
  Setlist: 'Setlist',
  'Live set ended': 'Sesión en vivo terminada',
  'Recording saved': 'Grabación guardada',
  'Great set!': '¡Gran sesión!',
  'Nice set!': '¡Buena sesión!',
  duration: 'duración',
  perfect: 'perfectas',
  'No track was heard long enough to make the setlist.': 'Ningún tema sonó lo bastante para entrar en el setlist.',
  'Unlocked in this set': 'Desbloqueado en esta sesión',
  Shared: 'Compartido',
  Share: 'Compartir',
  'Keep mixing': 'Seguir mezclando',
  'Welcome back': 'Bienvenido de nuevo',
  'Your decks are loaded as you left them.': 'Tus decks están cargados como los dejaste.',
  // file picker
  '"{name}" isn’t an audio file': '"{name}" no es un archivo de audio',
  'Choose an MP3, M4A, WAV, AIFF, FLAC or OGG file.': 'Elige un archivo MP3, M4A, WAV, AIFF, FLAC u OGG.',
  '{n} file(s) skipped': '{n} archivo(s) omitido(s)',
  'Only audio files can be added.': 'Solo se pueden añadir archivos de audio.',
  // sync lock
  'Synced to deck {id}. Tap to release': 'Sincronizado con el deck {id}. Toca para soltar',
  'Deck {id} synced': 'Deck {id} sincronizado',
  'It follows deck {other}’s tempo until you tap SYNC again or move its tempo fader.': 'Sigue el tempo del deck {other} hasta que vuelvas a tocar SYNC o muevas su fader de tempo.',
  'Tempos too far apart to sync': 'Tempos demasiado distintos para sincronizar',
  '{a} and {b} BPM differ by more than {n}%. Widen the tempo range (±{r} button) to ±30 or ±50 to sync them.': '{a} y {b} BPM se diferencian en más de un {n} %. Amplía el rango de tempo (botón ±{r}) a ±30 o ±50 para sincronizarlos.',
  '{a} and {b} BPM differ by more than 50%. Pick tracks with closer tempos.': '{a} y {b} BPM se diferencian en más de un 50 %. Elige temas con tempos más parecidos.',
  'Tempo fader range: tap to change (±8, ±16, ±30, ±50 %)': 'Rango del fader de tempo: toca para cambiarlo (±8, ±16, ±30, ±50 %)',
  'Jamendo gives no BPM: load the track and DJ4YOU measures it': 'Jamendo no da el BPM: carga el tema y DJ4YOU lo mide',
  'Warn before a track ends': 'Avisar antes de que termine un tema',
  Off: 'No',
  Favorites: 'Favoritos',
  'Add to favorites': 'Añadir a favoritos',
  'Remove from favorites': 'Quitar de favoritos',
  'Add {title} to favorites': 'Añadir {title} a favoritos',
  'Remove {title} from favorites': 'Quitar {title} de favoritos',
  'very slow': 'muy lento',
  slow: 'lento',
  'mid tempo': 'tempo medio',
  fast: 'rápido',
  'very fast': 'muy rápido',
  // help
  Help: 'Ayuda',
  'Help: what every control does': 'Ayuda: qué hace cada control',
  'What every control does': 'Qué hace cada control',
  'Search a control (e.g. SYNC, loop, filter)': 'Busca un control (p. ej. SYNC, loop, filtro)',
  'Search help': 'Buscar en la ayuda',
  'Help sections': 'Secciones de la ayuda',
  'Nothing matches "{q}". Try another word.': 'Nada coincide con «{q}». Prueba con otra palabra.',
  'On a computer. They don’t work while you type in a text box.': 'En ordenador. No funcionan mientras escribes en un cuadro de texto.',
  'Open this help': 'Abrir esta ayuda',
  'Show on the desk': 'Ver en la mesa',
  // promos
  'You made your first mix!': '¡Hiciste tu primera mezcla!',
  'You loaded, synced and blended two tracks like a real DJ. Now make it count:': 'Cargaste, sincronizaste y mezclaste dos temas como un DJ de verdad. Ahora sácale partido:',
  'Starts now. Press REC again to stop: it is saved in your Library to listen, download or share.': 'Empieza ya. Pulsa REC otra vez para parar: se guarda en tu Biblioteca para escucharla, descargarla o compartirla.',
  'Share a link or QR code and up to {n} people listen in their browser, no app needed.': 'Comparte un enlace o un código QR y hasta {n} personas te escuchan en su navegador, sin instalar nada.',
  'Available on the DJ4YOU website (not in this preview). Up to {n} listeners.': 'Disponible en la web de DJ4YOU (no en esta vista previa). Hasta {n} oyentes.',
  'Also in DJ4YOU': 'También en DJ4YOU',
  'Record your sets': 'Graba tus sesiones',
  'Save your mix, download it and share it.': 'Guarda tu mezcla, descárgala y compártela.',
  'Stream live': 'Transmite en vivo',
  'Up to {n} listeners with a link or QR code.': 'Hasta {n} oyentes con un enlace o código QR.',
  // jamendo
  'My music': 'Mi música',
  'Free music': 'Música libre',
  'Free music from Jamendo is available on the DJ4YOU website, not in this preview.': 'La música libre de Jamendo está disponible en la web de DJ4YOU, no en esta vista previa.',
  'Search artist, track or style': 'Busca artista, tema o estilo',
  'Search free music': 'Buscar música libre',
  'Genre': 'Género',
  'All': 'Todo',
  'Couldn’t reach Jamendo. Check your connection.': 'No se pudo conectar con Jamendo. Revisa tu conexión.',
  'Finding music…': 'Buscando música…',
  'Nothing found for "{q}". Try another word or style.': 'Nada encontrado para «{q}». Prueba con otra palabra o estilo.',
  'No tracks in this style right now.': 'Ahora mismo no hay temas de este estilo.',
  'License terms': 'Condiciones de la licencia',
  'Load more': 'Cargar más',
  'Music from': 'Música de',
  'under Creative Commons licences that allow remixing. Each track shows its artist and licence: respect its terms (NC = no commercial use, SA = share your mix under the same licence).': 'con licencias Creative Commons que permiten remezclar. Cada tema muestra su artista y su licencia: respeta sus condiciones (NC = sin uso comercial, SA = comparte tu mezcla con la misma licencia).',
  'Couldn\'t download "{name}". Check your connection.': 'No se pudo descargar «{name}». Revisa tu conexión.',
  // genres
  Electronic: 'Electrónica',
  Dance: 'Dance',
  Lounge: 'Lounge',
  Chillout: 'Chillout',
  Funk: 'Funk',
  Pop: 'Pop',
  Trance: 'Trance',
  Dubstep: 'Dubstep',
  Techno: 'Techno',
  House: 'House',
  'Hip-hop': 'Hip-hop',
  'Drum & bass': 'Drum & bass',
  // tap tempo
  'Tap in time with the beat (4 times or more) to set the tempo': 'Toca al ritmo del beat (4 veces o más) para fijar el tempo',
}

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    /* ignore */
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

class I18n extends Store<{ lang: Lang }> {
  constructor() {
    super({ lang: detect() })
    document.documentElement.lang = this.state.lang
  }

  setLang(lang: Lang): void {
    try {
      localStorage.setItem(KEY, lang)
    } catch {
      /* not kept */
    }
    document.documentElement.lang = lang
    this.set({ lang })
  }
}

export const i18n = new I18n()

const warned = new Set<string>()

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = key
  if (i18n.getSnapshot().lang === 'es') {
    const tr = ES[key]
    if (tr !== undefined) s = tr
    else if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key)
      console.warn(`[i18n] missing es: ${key}`)
    }
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
  return s
}

/** Re-render on language change and get the translate function. */
export function useT(): typeof t {
  useStore(i18n)
  return t
}

/** Locale for dates / numbers in the current language. */
export function locale(): string {
  return i18n.getSnapshot().lang === 'es' ? 'es-ES' : 'en-US'
}
