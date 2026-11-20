/**
 * Help content: what every control does, exactly. Values here mirror the
 * code (pitch ranges, EQ frequencies, timings…); keep them in sync.
 *
 * `target` is a CSS selector for "Show me" (spotlight on the desk) and `tab`
 * is the portrait tab that contains it.
 */

export type HelpTab = 'A' | 'mixer' | 'B'

export interface HelpItem {
  readonly id: string
  readonly name: string
  readonly what: string
  readonly tip?: string
  readonly keys?: string
  readonly target?: string
  readonly tab?: HelpTab
}

export interface HelpSection {
  readonly id: string
  readonly title: string
  readonly intro?: string
  readonly items: readonly HelpItem[]
}

const ES: HelpSection[] = [
  {
    id: 'start',
    title: 'Primeros pasos',
    intro: 'DJ4YOU tiene dos decks (A y B) y un mezclador en medio. La idea de mezclar: mientras suena un tema, preparas el siguiente en el otro deck, igualas su tempo y lo vas metiendo con el crossfader.',
    items: [
      { id: 'flow', name: 'Una mezcla en 5 pasos', what: '1) Carga un tema en A y dale ▶. 2) Lleva el crossfader a A. 3) Carga otro tema en B y dale ▶ (aún no se oye). 4) Pulsa SYNC en B para igualar tempo y beats. 5) Desliza el crossfader despacio hacia B.', tip: 'El tutorial del Menú te guía por estos pasos con la mesa real.' },
      { id: 'layout', name: 'En el móvil', what: 'En vertical ves una sección cada vez con las pestañas A · Mezclador · B; el crossfader y REC quedan siempre abajo. En horizontal ves la mesa completa.', tip: 'Un punto verde en la pestaña indica que ese deck está sonando.' },
    ],
  },
  {
    id: 'deck',
    title: 'Deck (A y B)',
    intro: 'Los dos decks son iguales. A es cian y B es naranja; todo lo que pertenece a un deck lleva su color.',
    items: [
      { id: 'title', name: 'Título y reloj', what: 'Nombre del tema, tiempo transcurrido y tiempo restante (con signo −). Si el nombre no cabe, se desplaza solo para que lo leas entero.', target: '.deck-a .deck-track', tab: 'A' },
      { id: 'bpm', name: 'BPM', what: 'Tempo del tema tal como suena ahora: el tempo detectado multiplicado por el fader de tempo. «···» mientras se analiza; «—» si el tema no tiene un pulso claro (en ese caso SYNC no está disponible).', target: '.deck-a .deck-bpm', tab: 'A' },
      { id: 'load', name: 'Cargar (↑)', what: 'Abre un archivo de audio de tu dispositivo (MP3, M4A, AAC, WAV, AIFF, FLAC, OGG…) y lo carga en este deck. El archivo también se guarda en tu Biblioteca, solo en este dispositivo.', tip: 'También puedes arrastrar un archivo encima del deck (en ordenador).', target: '.deck-a .btn-load:not(.btn-library)', tab: 'A' },
      { id: 'library', name: 'Biblioteca (♪)', what: 'Abre la Biblioteca: tus temas guardados, el pack de inicio y tus grabaciones. Cada tema tiene botones A y B para cargarlo en ese deck.', target: '.deck-a .deck-load .btn-library', tab: 'A' },
      { id: 'wave', name: 'Forma de onda', what: 'Muestra la música alrededor del punto que suena (línea blanca del centro). Capas: tono tenue = graves, color del deck = medios, blanco = agudos. Líneas verticales = beats (más brillante = inicio de compás). Amarillo = punto de CUE; banderas de color = hot cues; zona verde = loop activo.', tip: 'Arrastra la onda a izquierda o derecha para moverte por el tema. Las 4 lucecitas de arriba a la izquierda cuentan los tiempos del compás.', target: '.deck-a .wave', tab: 'A' },
      { id: 'zoom', name: 'Zoom (− / +)', what: 'Cambia cuánto tiempo se ve en la forma de onda: 2, 4, 8, 16 o 32 segundos (8 por defecto).', target: '.deck-a .wave-zoom', tab: 'A' },
      { id: 'overview', name: 'Vista general', what: 'El tema entero de principio a fin. Toca o arrastra en cualquier punto para saltar ahí. La parte ya escuchada se ve más oscura.', target: '.deck-a .overview', tab: 'A' },
      { id: 'sync', name: 'SYNC', what: 'Iguala el tempo de este deck al del otro (como máximo ±16 %, también a doble o medio tempo) y, si los dos están sonando, alinea los beats sin salir de un loop activo. Queda bloqueado: el botón se pinta con un candado y el deck sigue los cambios de tempo del otro. Se suelta tocando SYNC otra vez o moviendo su fader de tempo.', tip: 'Si los tempos se diferencian más de un 16 % (p. ej. 174 y 128 BPM) te avisa de que no es posible.', keys: 'Z (deck A) · M (deck B)', target: '.deck-a .btn-sync', tab: 'A' },
      { id: 'cue', name: 'CUE', what: 'Funciona como en un reproductor de club: con el tema sonando, vuelve al punto de CUE y para. Parado en otro sitio, marca ese punto como nuevo CUE. Parado justo en el CUE, mantenlo pulsado para escuchar desde ahí; al soltar vuelve al CUE.', keys: 'W (deck A) · O (deck B), mantener para escuchar', target: '.deck-a .btn-cue', tab: 'A' },
      { id: 'play', name: '▶ / ❚❚', what: 'Reproduce o pausa el tema. Al llegar al final se para solo.', keys: 'Q (deck A) · P (deck B) · Espacio (el deck que más se oye)', target: '.deck-a .btn-play', tab: 'A' },
      { id: 'jog', name: 'Jog (plato)', what: 'Sonando: gíralo para acelerar o frenar el tema un momento (hasta ±30 %) y empujar los beats hasta que cuadren; al soltar vuelve a su tempo. Parado: gíralo para buscar un punto exacto; una vuelta completa = 1,8 segundos. El anillo de 16 luces se llena a lo largo de cada compás.', target: '.deck-a .jog', tab: 'A' },
      { id: 'tempo', name: 'Fader de tempo', what: 'Cambia la velocidad del tema: arriba más rápido, abajo más lento, en pasos de 0,05 %. La línea blanca marca 0 % (velocidad original). Igual que en un vinilo, al cambiar la velocidad también cambia el tono. Moverlo suelta el bloqueo de SYNC.', tip: 'Doble clic sobre el fader lo devuelve a 0 %.', target: '.deck-a .pitch .fader-rail', tab: 'A' },
      { id: 'range', name: '±8 / ±16 y 0', what: '±8 / ±16 cambia el recorrido del fader de tempo (±8 % para ajustes finos, ±16 % para tempos más distintos). 0 devuelve el tempo a la velocidad original.', target: '.deck-a .pitch-buttons', tab: 'A' },
    ],
  },
  {
    id: 'pads',
    title: 'Pads',
    intro: 'Cuatro pads bajo cada deck con tres modos (Hot Cue, Loop, FX). En el móvil en horizontal, el botón de la izquierda cambia de modo.',
    items: [
      { id: 'hotcue', name: 'Hot Cue (1–4)', what: 'Pad vacío: guarda la posición actual, ajustada al beat más cercano. Pad guardado: salta a esa posición y empieza a sonar. Mantenlo pulsado medio segundo (o Shift+clic) para borrarlo. Cada hot cue tiene su color y aparece en la forma de onda.', keys: '1–4 (deck A) · 7, 8, 9, 0 (deck B)', target: '.deck-a .pads', tab: 'A' },
      { id: 'loop', name: 'Loop (1, 2, 4, 8 tiempos)', what: 'Repite un fragmento de 1, 2, 4 u 8 tiempos que empieza en el beat que está sonando. Tocar otro tamaño cambia la longitud; tocar el pad iluminado sale del loop y el tema continúa. Saltar fuera del loop (onda, vista general, hot cue) también lo desactiva.', target: '.deck-a .pads', tab: 'A' },
      { id: 'echo', name: 'FX · Eco', what: 'Activa o desactiva un eco que repite el sonido a tempo. Al apagarlo, las repeticiones se desvanecen solas.', target: '.deck-a .pads', tab: 'A' },
      { id: 'echotime', name: 'FX · Tiempo de eco', what: 'Separación entre repeticiones: 1/4, 1/2, 3/4 o 1 tiempo. Sigue el tempo del deck aunque lo cambies.', target: '.deck-a .pads', tab: 'A' },
      { id: 'reverb', name: 'FX · Reverb', what: 'Activa o desactiva una reverberación (sensación de sala grande). Al apagarla, la cola se desvanece sola.', target: '.deck-a .pads', tab: 'A' },
      { id: 'wet', name: 'FX · Efecto (knob)', what: 'Cuánto efecto se mezcla con el sonido, de 0 a 100 %. Afecta al eco y a la reverb que estén encendidos.', target: '.deck-a .pads', tab: 'A' },
    ],
  },
  {
    id: 'mixer',
    title: 'Mezclador',
    intro: 'Un canal por deck (A a la izquierda, B a la derecha) y el master en el centro. Los knobs se giran arrastrando arriba/abajo; doble toque los devuelve al centro. Mientras los mueves verás el valor exacto.',
    items: [
      { id: 'cuebtn', name: '🎧 (junto a A / B)', what: 'Envía ese deck a los auriculares para escucharlo antes que el público. La primera vez abre la configuración de auriculares (necesitas un cable divisor en Y).', target: '.strip-a .cue-btn', tab: 'mixer' },
      { id: 'eq', name: 'Agudos · Medios · Graves', what: 'Ecualizador de 3 bandas: graves hasta ~220 Hz, medios alrededor de 1 kHz, agudos desde ~3,8 kHz. A la derecha suben hasta +6 dB; a la izquierda bajan, y al tope eliminan la banda (−40 dB, «KILL»).', tip: 'Truco clásico: quita los graves del tema que entra y, en el cambio, intercámbialos con los del que sale.', target: '.strip-a .strip-knobs', tab: 'mixer' },
      { id: 'filter', name: 'Filtro', what: 'Un solo knob: hacia la izquierda filtro paso bajo (el sonido se apaga, hasta 80 Hz); hacia la derecha filtro paso alto (se queda fino, desde 8 kHz). En el centro no hace nada.', target: '.strip-a .knob-filter', tab: 'mixer' },
      { id: 'meters', name: 'Medidores', what: 'Nivel de cada canal antes de su fader (para ver un tema aunque esté bajado) y nivel del master. Verde = bien, amarillo = alto, rojo = casi saturando. La raya blanca marca el pico reciente.', target: '.strip-a .meter', tab: 'mixer' },
      { id: 'chfader', name: 'Fader de canal', what: 'Volumen de ese deck en la mezcla (0–100). Por defecto 80.', target: '.strip-a .fader-channel', tab: 'mixer' },
      { id: 'master', name: 'Fader master', what: 'Volumen general de la mezcla. Un limitador final evita que el sonido sature.', target: '.strip-master .fader-master', tab: 'mixer' },
      { id: 'rec', name: 'REC', what: 'Graba exactamente lo que sale por el master (192 kb/s). Pulsa otra vez para parar: la grabación se guarda en la Biblioteca y, si dura 15 s o más, verás el resumen de la sesión.', target: '.btn-rec', tab: 'mixer' },
      { id: 'live', name: 'LIVE', what: 'Transmite tu mezcla en directo. Te da un enlace y un código QR; los oyentes escuchan en su navegador sin instalar nada (máximo 20). Solo disponible en la web, no en la vista previa.', target: '.btn-live', tab: 'mixer' },
      { id: 'xfader', name: 'Crossfader', what: 'Reparte el volumen entre A (izquierda) y B (derecha). Si lo sueltas muy cerca del centro, encaja en el centro. Doble toque: va al centro.', keys: '← / → (Shift: hasta el extremo)', target: '.xfader', tab: 'mixer' },
      { id: 'curve', name: 'Suave / Corte', what: 'Curva del crossfader. Suave: mezcla progresiva sin bajón de volumen en el centro. Corte: los dos decks suenan a tope y solo se cortan en el último 5 % de cada lado (para cortes rápidos y scratch).', target: '.xfader-curve', tab: 'mixer' },
      { id: 'phase', name: 'Medidor de fase', what: 'Compara los beats de los dos decks cuando suenan al mismo tempo. La aguja en la zona verde central (±6 % de un tiempo) significa beats alineados. Si no puede comparar, te dice por qué («Reproduce los dos decks», «Tempos distintos»…).', target: '.phase', tab: 'mixer' },
    ],
  },
  {
    id: 'headphones',
    title: 'Auriculares (cue)',
    intro: 'Una web solo puede usar una salida de sonido, así que la escucha previa usa el «modo dividido», como VirtualDJ o Mixxx.',
    items: [
      { id: 'split', name: 'Modo dividido', what: 'Con un cable divisor en Y: el canal izquierdo lleva los auriculares y el derecho los altavoces, ambos en mono. Desactivado, los dos canales suenan con el master normal.' },
      { id: 'cuemix', name: 'Cue / master', what: 'Qué oyes en los auriculares: a la izquierda solo los decks con 🎧 activado, a la derecha solo el master, en medio una mezcla de ambos.' },
      { id: 'hpvol', name: 'Volumen de auriculares', what: 'Volumen de la salida de auriculares. No afecta a lo que oye el público.' },
      { id: 'hpnote', name: 'Grabaciones y directo', what: 'Siempre reciben la mezcla estéreo completa, aunque el modo dividido esté activo.' },
    ],
  },
  {
    id: 'library',
    title: 'Biblioteca',
    items: [
      { id: 'yours', name: 'Tus temas', what: 'Todo lo que cargas se guarda en este dispositivo (nada se sube a internet) y aparece aquí la próxima vez, con su BPM y duración. Añadir temas permite elegir varios archivos a la vez. Borrar pide un segundo toque para confirmar.' },
      { id: 'jamendo', name: 'Música libre (Jamendo)', what: 'Busca entre miles de temas con licencia Creative Commons por artista, título o género y cárgalos en A o B. Solo se muestran licencias que permiten remezclar; cada tema indica su artista y su licencia (NC = sin uso comercial, SA = comparte tu mezcla con la misma licencia). Se reproducen desde internet y vuelven a cargarse al regresar.', tip: 'Necesita conexión. No está disponible en la vista previa, solo en la web.' },
      { id: 'starter', name: 'Pack de inicio', what: 'Siete beats creados en tu navegador, de estilos y tempos distintos: house (120–128), techno (132), hip-hop (90) y drum & bass (174).', tip: 'Para practicar SYNC combina temas de tempo parecido, por ejemplo Sunrise (122) y Night Drive (126).' },
      { id: 'recs', name: 'Grabaciones', what: 'Tus mezclas grabadas: escúchalas (▶), descárgalas (⤓) o bórralas.' },
      { id: 'resume', name: 'Al volver', what: 'Los temas que tenías en cada deck se vuelven a cargar en pausa.' },
    ],
  },
  {
    id: 'live',
    title: 'Transmisión en vivo',
    items: [
      { id: 'golive', name: 'Empezar', what: 'Escribe tu nombre de DJ y un título (opcional) y pulsa Empezar. Mantén la página abierta mientras estés en vivo.' },
      { id: 'share', name: 'Compartir', what: 'Comparte el enlace o deja que escaneen el código QR. Verás cuántos oyentes hay y cuánto tiempo llevas en el aire.' },
      { id: 'listen', name: 'Para quien escucha', what: 'Toca «Escuchar» y oirá tu master en estéreo, con el tema que más suena y el BPM de cada deck.' },
      { id: 'end', name: 'Terminar', what: 'Los oyentes ven que la sesión terminó y tú ves el resumen.' },
    ],
  },
  {
    id: 'coach',
    title: 'Menú, consejos y logros',
    items: [
      { id: 'menu', name: 'Menú (☰ ★)', what: 'Idioma, auriculares, lo que llevas en esta sesión, los 13 logros, repetir el tutorial, volver a ver la bienvenida y los atajos de teclado. La estrella muestra cuántos logros llevas.', target: '.btn-menu' },
      { id: 'notes', name: 'Avisos', what: 'Mensajes breves arriba: transición suave (al menos 1,5 s mezclando a tiempo) o perfecta (4 s o más), logros desbloqueados y confirmaciones.' },
      { id: 'hints', name: 'Consejos', what: 'Si los beats chocan durante 1,5 s aparece un consejo con un botón que pulsa SYNC por ti. Si la música se para más de 3 s, te lo recuerda. Puedes cerrarlos con ✕.' },
      { id: 'recap', name: 'Resumen de sesión', what: 'Al terminar una grabación (15 s o más) o un directo: duración, transiciones, setlist y logros, con botones para escuchar, descargar y compartir.' },
    ],
  },
]

const EN: HelpSection[] = [
  {
    id: 'start',
    title: 'Getting started',
    intro: 'DJ4YOU has two decks (A and B) and a mixer in the middle. The idea of mixing: while one track plays, you prepare the next one on the other deck, match its tempo and bring it in with the crossfader.',
    items: [
      { id: 'flow', name: 'A mix in 5 steps', what: '1) Load a track on A and press ▶. 2) Move the crossfader to A. 3) Load another track on B and press ▶ (nobody hears it yet). 4) Press SYNC on B to match tempo and beats. 5) Slowly slide the crossfader to B.', tip: 'The tutorial in the Menu walks you through these steps on the real desk.' },
      { id: 'layout', name: 'On phones', what: 'In portrait you see one section at a time with the A · Mixer · B tabs; the crossfader and REC always stay at the bottom. In landscape you see the full desk.', tip: 'A green dot on a tab means that deck is playing.' },
    ],
  },
  {
    id: 'deck',
    title: 'Deck (A and B)',
    intro: 'Both decks work the same. A is cyan and B is orange; everything that belongs to a deck has its colour.',
    items: [
      { id: 'title', name: 'Title and clock', what: 'Track name, elapsed time and remaining time (with a − sign). If the name doesn’t fit, it scrolls so you can read it all.', target: '.deck-a .deck-track', tab: 'A' },
      { id: 'bpm', name: 'BPM', what: 'The tempo as it sounds now: the detected tempo times the tempo fader. «···» while analysing; «—» if the track has no clear beat (SYNC is then unavailable).', target: '.deck-a .deck-bpm', tab: 'A' },
      { id: 'load', name: 'Load (↑)', what: 'Opens an audio file from your device (MP3, M4A, AAC, WAV, AIFF, FLAC, OGG…) and loads it on this deck. The file is also kept in your Library, on this device only.', tip: 'On a computer you can also drop a file onto the deck.', target: '.deck-a .btn-load:not(.btn-library)', tab: 'A' },
      { id: 'library', name: 'Library (♪)', what: 'Opens the Library: your saved tracks, the starter pack and your recordings. Each track has A and B buttons to load it on that deck.', target: '.deck-a .deck-load .btn-library', tab: 'A' },
      { id: 'wave', name: 'Waveform', what: 'Shows the music around the play position (white centre line). Layers: dim = bass, deck colour = mids, white = highs. Vertical lines = beats (brighter = start of a bar). Yellow = CUE point; coloured flags = hot cues; green area = active loop.', tip: 'Drag the waveform left or right to move through the track. The 4 small lights at the top left count the beats of the bar.', target: '.deck-a .wave', tab: 'A' },
      { id: 'zoom', name: 'Zoom (− / +)', what: 'Changes how much time the waveform shows: 2, 4, 8, 16 or 32 seconds (8 by default).', target: '.deck-a .wave-zoom', tab: 'A' },
      { id: 'overview', name: 'Overview', what: 'The whole track from start to end. Tap or drag anywhere to jump there. The part already played is darker.', target: '.deck-a .overview', tab: 'A' },
      { id: 'sync', name: 'SYNC', what: 'Matches this deck’s tempo to the other deck (up to ±16 %, also double or half time) and, if both are playing, lines up the beats without leaving an active loop. It stays locked: the button fills in with a padlock and the deck follows the other deck’s tempo changes. Release it by tapping SYNC again or moving its tempo fader.', tip: 'If the tempos differ by more than 16 % (e.g. 174 and 128 BPM) it tells you it isn’t possible.', keys: 'Z (deck A) · M (deck B)', target: '.deck-a .btn-sync', tab: 'A' },
      { id: 'cue', name: 'CUE', what: 'Works like a club player: while playing, it jumps back to the CUE point and stops. Stopped somewhere else, it sets that spot as the new CUE. Stopped right on the CUE, hold it to listen from there; releasing returns to the CUE.', keys: 'W (deck A) · O (deck B), hold to preview', target: '.deck-a .btn-cue', tab: 'A' },
      { id: 'play', name: '▶ / ❚❚', what: 'Plays or pauses the track. It stops by itself at the end.', keys: 'Q (deck A) · P (deck B) · Space (the deck you hear most)', target: '.deck-a .btn-play', tab: 'A' },
      { id: 'jog', name: 'Jog wheel', what: 'While playing: spin it to speed up or slow down the track for a moment (up to ±30 %) and nudge the beats into place; when you let go it returns to its tempo. While paused: turn it to find an exact spot; one full turn = 1.8 seconds. The ring of 16 lights fills up through each bar.', target: '.deck-a .jog', tab: 'A' },
      { id: 'tempo', name: 'Tempo fader', what: 'Changes the track’s speed: up is faster, down is slower, in 0.05 % steps. The white line marks 0 % (original speed). As on vinyl, changing the speed also changes the pitch. Moving it releases the SYNC lock.', tip: 'Double-click the fader to return it to 0 %.', target: '.deck-a .pitch .fader-rail', tab: 'A' },
      { id: 'range', name: '±8 / ±16 and 0', what: '±8 / ±16 changes the tempo fader’s range (±8 % for fine adjustments, ±16 % for tempos further apart). 0 resets the tempo to the original speed.', target: '.deck-a .pitch-buttons', tab: 'A' },
    ],
  },
  {
    id: 'pads',
    title: 'Pads',
    intro: 'Four pads under each deck with three modes (Hot Cue, Loop, FX). On landscape phones, the button on the left switches the mode.',
    items: [
      { id: 'hotcue', name: 'Hot Cue (1–4)', what: 'Empty pad: saves the current position, snapped to the nearest beat. Saved pad: jumps there and starts playing. Hold it for half a second (or Shift+click) to clear it. Each hot cue has its own colour and shows on the waveform.', keys: '1–4 (deck A) · 7, 8, 9, 0 (deck B)', target: '.deck-a .pads', tab: 'A' },
      { id: 'loop', name: 'Loop (1, 2, 4, 8 beats)', what: 'Repeats 1, 2, 4 or 8 beats starting on the beat that’s playing. Tapping another size changes the length; tapping the lit pad leaves the loop and the track carries on. Jumping outside the loop (waveform, overview, hot cue) also turns it off.', target: '.deck-a .pads', tab: 'A' },
      { id: 'echo', name: 'FX · Echo', what: 'Turns on or off an echo that repeats the sound in time. When you turn it off, the repeats fade out naturally.', target: '.deck-a .pads', tab: 'A' },
      { id: 'echotime', name: 'FX · Echo time', what: 'Gap between repeats: 1/4, 1/2, 3/4 or 1 beat. It follows the deck’s tempo even if you change it.', target: '.deck-a .pads', tab: 'A' },
      { id: 'reverb', name: 'FX · Reverb', what: 'Turns on or off a reverb (big-room feel). When you turn it off, the tail fades out naturally.', target: '.deck-a .pads', tab: 'A' },
      { id: 'wet', name: 'FX · Wet (knob)', what: 'How much effect is mixed in, from 0 to 100 %. Applies to whichever of echo and reverb are on.', target: '.deck-a .pads', tab: 'A' },
    ],
  },
  {
    id: 'mixer',
    title: 'Mixer',
    intro: 'One channel per deck (A on the left, B on the right) and the master in the middle. Turn knobs by dragging up/down; double-tap returns them to centre. While you move them you’ll see the exact value.',
    items: [
      { id: 'cuebtn', name: '🎧 (next to A / B)', what: 'Sends that deck to your headphones so you can hear it before the crowd. The first time it opens the headphone setup (you need a Y-splitter cable).', target: '.strip-a .cue-btn', tab: 'mixer' },
      { id: 'eq', name: 'Hi · Mid · Low', what: '3-band EQ: lows up to ~220 Hz, mids around 1 kHz, highs from ~3.8 kHz. To the right they boost up to +6 dB; to the left they cut, and fully left they remove the band (−40 dB, «KILL»).', tip: 'Classic trick: cut the bass of the incoming track and swap the basses at the changeover.', target: '.strip-a .strip-knobs', tab: 'mixer' },
      { id: 'filter', name: 'Filter', what: 'One knob: left is a low-pass filter (the sound gets muffled, down to 80 Hz); right is a high-pass filter (it gets thin, up from 8 kHz). Centre does nothing.', target: '.strip-a .knob-filter', tab: 'mixer' },
      { id: 'meters', name: 'Meters', what: 'Each channel’s level before its fader (so you can see a track even when it’s down) and the master level. Green = fine, yellow = loud, red = close to clipping. The white tick marks the recent peak.', target: '.strip-a .meter', tab: 'mixer' },
      { id: 'chfader', name: 'Channel fader', what: 'That deck’s volume in the mix (0–100). 80 by default.', target: '.strip-a .fader-channel', tab: 'mixer' },
      { id: 'master', name: 'Master fader', what: 'Overall volume of the mix. A final limiter keeps the sound from clipping.', target: '.strip-master .fader-master', tab: 'mixer' },
      { id: 'rec', name: 'REC', what: 'Records exactly what comes out of the master (192 kb/s). Press again to stop: the recording is saved to the Library and, if it lasts 15 s or more, you’ll see the session recap.', target: '.btn-rec', tab: 'mixer' },
      { id: 'live', name: 'LIVE', what: 'Streams your mix live. You get a link and a QR code; listeners hear it in their browser without installing anything (up to 20). Only on the website, not in the preview.', target: '.btn-live', tab: 'mixer' },
      { id: 'xfader', name: 'Crossfader', what: 'Balances the volume between A (left) and B (right). If you let go very close to the centre, it snaps to the centre. Double-tap: goes to the centre.', keys: '← / → (Shift: all the way)', target: '.xfader', tab: 'mixer' },
      { id: 'curve', name: 'Blend / Cut', what: 'Crossfader curve. Blend: gradual mix with no volume dip in the middle. Cut: both decks play at full volume and only cut in the last 5 % on each side (for quick cuts and scratching).', target: '.xfader-curve', tab: 'mixer' },
      { id: 'phase', name: 'Phase meter', what: 'Compares the beats of both decks when they play at the same tempo. The needle in the green centre zone (±6 % of a beat) means the beats are lined up. If it can’t compare, it tells you why («Play both decks», «Different tempos»…).', target: '.phase', tab: 'mixer' },
    ],
  },
  {
    id: 'headphones',
    title: 'Headphones (cue)',
    intro: 'A web page can only use one sound output, so previewing uses «split mode», like VirtualDJ or Mixxx.',
    items: [
      { id: 'split', name: 'Split mode', what: 'With a Y-splitter cable: the left channel carries the headphones and the right channel the speakers, both in mono. When off, both channels play the normal master.' },
      { id: 'cuemix', name: 'Cue / master', what: 'What you hear in the headphones: left = only decks with 🎧 on, right = only the master, in between = a mix of both.' },
      { id: 'hpvol', name: 'Headphone volume', what: 'Volume of the headphone output. Doesn’t affect what the crowd hears.' },
      { id: 'hpnote', name: 'Recordings and live sets', what: 'Always get the full stereo mix, even when split mode is on.' },
    ],
  },
  {
    id: 'library',
    title: 'Library',
    items: [
      { id: 'yours', name: 'Your tracks', what: 'Everything you load is kept on this device (nothing is uploaded) and shows up here next time, with its BPM and length. Add tracks lets you pick several files at once. Delete asks for a second tap to confirm.' },
      { id: 'jamendo', name: 'Free music (Jamendo)', what: 'Search thousands of Creative Commons tracks by artist, title or genre and load them on A or B. Only licences that allow remixing are shown; each track shows its artist and licence (NC = no commercial use, SA = share your mix under the same licence). They stream from the internet and are loaded again when you come back.', tip: 'Needs a connection. Not available in the preview, only on the website.' },
      { id: 'starter', name: 'Starter pack', what: 'Seven beats made in your browser, in different styles and tempos: house (120–128), techno (132), hip-hop (90) and drum & bass (174).', tip: 'To practise SYNC, combine tracks with similar tempos, e.g. Sunrise (122) and Night Drive (126).' },
      { id: 'recs', name: 'Recordings', what: 'Your recorded mixes: listen (▶), download (⤓) or delete them.' },
      { id: 'resume', name: 'When you come back', what: 'The tracks you had on each deck are loaded again, paused.' },
    ],
  },
  {
    id: 'live',
    title: 'Live streaming',
    items: [
      { id: 'golive', name: 'Start', what: 'Type your DJ name and a title (optional) and press Start. Keep the page open while you’re live.' },
      { id: 'share', name: 'Share', what: 'Share the link or let people scan the QR code. You’ll see how many listeners there are and how long you’ve been on air.' },
      { id: 'listen', name: 'For listeners', what: 'They tap «Listen» and hear your master in stereo, with the track that’s mostly playing and each deck’s BPM.' },
      { id: 'end', name: 'End', what: 'Listeners see that the set has ended and you see the recap.' },
    ],
  },
  {
    id: 'coach',
    title: 'Menu, tips and achievements',
    items: [
      { id: 'menu', name: 'Menu (☰ ★)', what: 'Language, headphones, this session’s stats, the 13 achievements, replay the tutorial, show the welcome screen again and the keyboard shortcuts. The star shows how many achievements you have.', target: '.btn-menu' },
      { id: 'notes', name: 'Notes', what: 'Short messages at the top: smooth transition (at least 1.5 s blending in time) or perfect (4 s or more), unlocked achievements and confirmations.' },
      { id: 'hints', name: 'Tips', what: 'If the beats clash for 1.5 s, a tip appears with a button that presses SYNC for you. If the music stops for more than 3 s, it reminds you. Close them with ✕.' },
      { id: 'recap', name: 'Session recap', what: 'After a recording (15 s or more) or a live set: length, transitions, setlist and achievements, with buttons to listen, download and share.' },
    ],
  },
]

export const HELP: Record<'es' | 'en', HelpSection[]> = { es: ES, en: EN }
