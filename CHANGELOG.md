# Cambios

Todas las versiones de DJ4YOU. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el número de versión, [versionado semántico](https://semver.org/lang/es/).

## [1.1.1] - 2026-11-20

### Mejoras
- Los platos de los decks A y B son el mismo disco de vinilo que gira en la pantalla de bienvenida (surcos, etiqueta y brillo), con la letra del deck en la etiqueta.

## [1.1.0] - 2026-11-20

### Nuevo
- **Tono musical** de cada tema (rueda Camelot) junto al BPM, en el deck y en la biblioteca.
- **Combina con…**: sugerencias de qué tema sigue según tempo y tono, con el motivo.
- **Cola "A continuación"** y botón ⏭ en cada deck para cargar el siguiente.
- **AUTO**: mezcla automática de la cola con sincronización y cambio de graves.
- **Trucos** en los pads: freno, spinback, beat-roll y flanger.
- **CUE automático** en el primer beat (salta el silencio inicial).
- **Reacciones en el vivo**: los oyentes mandan emojis que ven el DJ y los demás oyentes.
- **Buscar, ordenar y filtrar** tus temas; análisis en segundo plano de los temas agregados sin reproducir.
- **Tests automáticos** (Vitest) de detección de BPM y tono, cue automático, SYNC y protocolo del vivo; corren en cada deploy.

### Mejoras
- Las filas de estilos y secciones (Música libre, Ayuda) se desplazan de costado con la rueda del mouse, arrastrando o con botones ‹ ›.
- Las filas de la biblioteca comparten un diseño: estrella junto al título, BPM, tono y licencia.

## [1.0.0] - 2026-11-20

Primera versión estable.

### Incluye
- Dos decks con forma de onda, vista general, detección de BPM con grilla de beats, TAP tempo, SYNC con bloqueo (rangos de tempo ±8 / ±16 / ±30 / ±50 %), jog, CUE, 4 hot cues, loops y efectos (eco y reverb).
- Mezclador con EQ de 3 bandas, filtro, faders, master con limitador, crossfader suave o de corte y medidor de fase.
- Auriculares en modo dividido para preescuchar.
- Aviso visual de fin de tema (15, 30 o 60 s).
- Biblioteca en el dispositivo, pack de inicio, favoritos y música libre de Jamendo (Creative Commons).
- Grabación de la mezcla con resumen de sesión, y transmisión en vivo hasta 20 oyentes (WebRTC).
- Tutorial, consejos, logros y página de ayuda; español e inglés; PWA instalable que funciona sin conexión.

[1.1.1]: https://github.com/fokerone/dj4you/releases/tag/v1.1.1
[1.1.0]: https://github.com/fokerone/dj4you/releases/tag/v1.1.0
[1.0.0]: https://github.com/fokerone/dj4you/releases/tag/v1.0.0
