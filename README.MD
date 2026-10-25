# IPTVFlix

Reproductor web de listas IPTV (M3U/HLS) con interfaz estilo Netflix.

Stack: React + Vite + TypeScript, TailwindCSS v4, Zustand, HLS.js, iptv-playlist-parser y lucide-react.

## Arrancar

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm typecheck  # comprobación de tipos
pnpm build      # comprobación de tipos + build de producción en dist/
pnpm preview    # sirve el build
```

## Uso

- Al abrir se cargan a la vez seis fuentes gratuitas en español y se unifican por categorías: [TDTChannels](https://github.com/LaQuay/TDTChannels), [iptv-org (España)](https://github.com/iptv-org/iptv), [Free-TV (España)](https://github.com/Free-TV/IPTV), Samsung TV Plus y Plex (estas dos, con los datos que publica [i.mjh.nz](https://github.com/matthuisman/i.mjh.nz)) y Rakuten TV (canales gratuitos con anuncios: cine, series, deportes; la lista la mantiene una sola persona en GitHub y puede dejar de actualizarse). Cada fuente se pinta en cuanto llega; si una falla o tarda más de 20 s, se avisa y se siguen viendo los canales de las demás.
- Free-TV no clasifica sus canales (todos vienen como "Spain"): cada uno toma la categoría de la misma cadena en otra fuente o, si no está en ninguna, la de una tabla de canales conocidos (`CHANNEL_HINTS` en `src/config.ts`).
- **Sin duplicados**: un canal repetido (en una lista o en varias) aparece una sola vez. Se reconoce por su `tvg-id` o, si no lo trae, por el nombre sin "HD", "(720p)", país…; "La 1 (Catalunya)" sigue siendo un canal aparte. El canal unido guarda todas sus URLs: **si una falla, el reproductor pasa sola a la siguiente** (en la barra superior se ve "Fuente 2 de 4"), y solo se marca como no disponible si fallan todas.
- **Filtro por fuente**: en la barra superior, "Todas" o solo una. En el móvil son chips deslizables.
- **Categorías y comunidades**: los canales regionales de todas las comunidades van juntos en la fila **Autonómicas**. El botón **Categorías** de la barra superior permite ocultar cualquier categoría (p. ej. "Int. Asia") o comunidad (p. ej. Galicia); ocultar una comunidad quita sus canales de todas partes, también si otra fuente los trae. Se recuerda en el navegador.
- **Samsung TV Plus** solo se reproduce con `pnpm dev`/`pnpm preview`: sus streams pasan por un proxy de Vite. Se omiten sus canales con DRM. **Plex** no clasifica sus canales: la categoría se deduce del nombre, y los que no se pueden deducir van a "Otros".
- **Distintivos**: las etiquetas que las listas meten en el nombre se quitan y pasan a la tarjeta: **HD / FHD / 4K** (desde 720p, 1080p y 2160p), **Emisión puntual** (`[Not 24/7]`) y **Bloqueado fuera de España** (`[Geo-blocked]`, Ⓖ de Free-TV). En tarjetas estrechas, como en el móvil, estos dos últimos se reducen a su icono; el texto completo se ve en el reproductor y en el panel de pulsación larga.
- **Guía de programación**: cada tarjeta muestra lo que emite el canal ahora, con una barra de lo que lleva emitido. En el reproductor, la barra superior dice "Ahora… hasta las 18:35 · Después: …" y el botón del calendario (o `G`) abre la programación del día con sinopsis. El buscador también encuentra canales por el programa que emiten ahora ("telediario", "fútbol"…). Los datos son la guía XMLTV de TDTChannels (unos 180 canales) y la programación que traen Samsung TV Plus (unas 4 h) y Plex (la mitad de sus canales); los canales sin guía simplemente no muestran programa.
- **Calidad de vídeo**: el engranaje del reproductor permite fijar la resolución (720p, 576p…) o dejar "Automática"; útil si un canal va a saltos. La elección se recuerda para el resto de canales; si el canal no tiene esa resolución, usa la más alta que no la supere. Solo aparece cuando el canal ofrece más de una.
- **Ventana flotante (imagen en imagen)**: el botón del reproductor (o `P`) saca el vídeo a una ventana flotante y deja navegar por la app; "Ampliar" lo recupera. Hay que elegir otro canal desde las tarjetas para cambiar lo que se ve en la ventana. Funciona en Chrome, Edge, Safari de escritorio y Android; no en Firefox, y no lo he podido probar en iPhone.
- **Solo gratis y oficial**: no se ofrecen emisiones de pago reemitidas sin permiso. La lista de iptv-org trae algunas ("Liga de Campeones por Movistar Plus+", "Deportes por Movistar Plus+"…) y la app las descarta. LaLiga y la Champions son de pago en España; en abierto hay un partido de LaLiga por jornada en Teledeporte, la final de la Champions en RTVE y los canales oficiales gratuitos de los clubes (Real Madrid TV, Barça TV, Top Barça).
- **Telecinco, Cuatro, La Sexta, Antena 3 y demás canales de Mediaset y Atresmedia**: no se pueden reproducir en la app. Solo emiten en directo dentro de su web (Mediaset Infinity, Atresplayer) y los enlaces que traen las listas públicas están caducados (error 400) o cerrados (403). No es geobloqueo ni un problema de cabeceras. Al abrirlos, el reproductor (y el panel de pulsación larga) ofrece **"Ver en Mediaset Infinity / Atresplayer"**, que abre su página oficial de directo.
- **Fútbol hoy**: la primera fila del inicio, **solo cuando la guía anuncia un partido** (con enfrentamiento en el título, p. ej. "LaLiga EA Sports: Real Madrid - Betis") en uno de tus canales, ahora o hasta las 6:00 de la madrugada siguiente. Cada tarjeta lleva la hora del partido, y la barra de progreso si ya ha empezado. No cuenta resúmenes, repeticiones, programas de análisis ni fútbol americano. Muchos días no habrá ninguno: solo se ven los partidos que emiten canales gratuitos (Teledeporte, teles autonómicas y locales…), no los de pago.
- **Sin logo**: si un canal no trae logo o la imagen no carga, se muestran sus iniciales sobre un fondo de color.
- TDTChannels no permite descargar su lista desde el navegador (CORS), así que en `pnpm dev`/`pnpm preview` se descarga a través de un proxy de Vite (`vite.config.ts`). Si publicas `dist/` como web estática, necesitas un proxy equivalente en tu servidor o esa fuente aparecerá como no disponible.
- **Cargar lista**: acepta una URL `.m3u` o un archivo local (también arrastrándolo). La última URL usada se recuerda; un archivo local no (tras recargar se vuelve a la lista por defecto).
- **Favoritos**: el corazón de cada tarjeta, o "Mi lista" en el banner. Se guardan en `localStorage` y aparecen en la fila "Mis favoritos".
- **Seguir viendo**: la primera fila del inicio son los últimos 15 canales que has llegado a reproducir, el más reciente primero. Se guardan en el navegador; "Ver todo" abre la lista completa.
- **Buscador**: filtra por nombre, sin distinguir mayúsculas ni acentos.
- **Ver una categoría completa**: pulsa el título de una fila (o "Ver todo ›") para ver todos sus canales en cuadrícula, con un filtro propio. Cada categoría tiene su URL (`#/categoria/Noticias`), así que funciona el botón "atrás" del navegador y al volver se recupera la posición en el inicio.
- **Disponibilidad**: en segundo plano se comprueba cada canal que aparece en pantalla (su lista `.m3u8` y la primera variante, 6 a la vez). Los que el navegador no puede abrir (CORS, 403/404, servidor caído, timeout) se marcan como **No disponible** y "siguiente canal" se los salta. El resultado se guarda 30 minutos en `localStorage`, y lo que pasa al reproducir de verdad lo corrige. No se descargan segmentos de vídeo, así que algún canal marcado como disponible aún puede fallar al abrirlo.
- **Ocultar no disponibles**: el botón del ojo en la barra superior quita esos canales de las filas y de la búsqueda (las filas que se quedan vacías desaparecen). El contador indica cuántos hay detectados. La preferencia se recuerda.

### En el móvil

- Barra de pestañas abajo: **Inicio** (si ya estás en él, sube arriba), **Buscar**, **Mi lista** y **Más** (ocultar no disponibles, categorías, cargar lista, recargar).
- Arriba, chips para elegir la fuente y abrir **Categorías**; se esconden al bajar y vuelven al subir.
- **Mantén pulsado** un canal para verlo o añadirlo a Mi lista.
- En el reproductor: toca el vídeo para mostrar u ocultar los controles y **desliza a los lados** para cambiar de canal. La pantalla completa gira a horizontal (en iPhone se usa la del sistema).
- El botón **atrás** del móvil cierra el reproductor, el panel abierto o la búsqueda, como en una app.
- **Instalar como app (PWA)**: en Chrome, Edge y Android sale un botón **Instalar** (en la barra superior, o en "Más" en el móvil); en iPhone, Safari → Compartir → "Añadir a pantalla de inicio". Se abre a pantalla completa, con su icono, sin la barra del navegador, y desde el icono hay atajos a "Mi lista" y "Seguir viendo". La página y sus archivos se guardan para **abrir sin conexión** y arrancar rápido (los canales, por supuesto, necesitan internet). Cuando hay una versión nueva, un aviso ofrece **Actualizar** sin cortar lo que estés viendo. Requiere `https://` (o `localhost`) y que la web esté en la raíz del dominio; `pnpm dev` no registra el service worker, pruébalo con `pnpm build && pnpm preview`.

### Teclado y mando

En la parrilla (inicio, categorías y resultados de búsqueda):

| Tecla | Acción |
| ----- | ------ |
| `←` `→` `↑` `↓` | Mover el foco por las tarjetas y los botones del banner. La página no se desplaza con las flechas: si no hay nada más a la vista, baja o sube un poco y sigue |
| `Intro` | Reproducir el canal enfocado |
| `Esc` | Salir de la categoría, de la búsqueda del móvil o limpiar la búsqueda |

Con el reproductor abierto:

| Tecla | Acción |
| ----- | ------ |
| `Re Pág` / `↑` | Canal anterior (también `←`) |
| `Av Pág` / `↓` | Canal siguiente (también `→`) |
| `0`–`9` | Saltar al canal con ese número (el "3 / 35" de la barra). Se pueden teclear varias cifras: salta tras una pausa o al llegar al máximo de cifras; `Intro` salta ya. Un número que no existe no hace nada |
| `Retroceso` | Volver al último canal visto; pulsada otra vez, alterna entre los dos |
| `Espacio` / `K` | Reproducir / pausar |
| `+` / `-` (o `Mayús`+`↑`/`↓`) | Volumen |
| `M` | Silenciar |
| `G` | Programación del canal |
| `P` | Ventana flotante (imagen en imagen) |
| `F` | Pantalla completa |
| `Esc` | Cerrar panel / reproductor (el foco vuelve a la tarjeta de la que venías) |

## Estructura

```
src/
├─ config.ts               listas predefinidas y constantes
├─ lib/playlist.ts         descarga, parseo, normalización y agrupado de la lista
├─ store/useIPTVStore.ts   estado global (Zustand + persist)
├─ hooks/useHls.ts         ciclo de vida de HLS.js y gestión de errores
├─ hooks/useInView.ts      render perezoso con IntersectionObserver
└─ components/             Navbar, HeroBanner, CategoryRow, ChannelCard, VideoPlayerModal…
```

## Limitaciones conocidas

Son propias de reproducir IPTV desde un navegador, no de la app:

- **CORS**: muchos servidores de streams no permiten peticiones desde páginas web. Esos canales muestran un error en el reproductor aunque funcionen en VLC.
- **Geobloqueo** y enlaces caídos: las listas públicas cambian a diario; es normal que una parte de los canales no funcione.
- **Contenido mixto**: si la app se publica en `https://`, el navegador bloquea los streams `http://`. En local (`http://localhost`) sí se intentan reproducir.
- Los canales que exigen cabeceras `Referer` o `User-Agent` concretas no se pueden reproducir: el navegador no permite fijarlas.
