# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Qué es

IPTVFlix: reproductor web de listas IPTV (M3U + streams HLS) con interfaz estilo Netflix. Es solo frontend, sin backend: todo, incluida la descarga de listas y streams, ocurre en el navegador del usuario. UI en español.

Stack: React 19 + Vite 8, Tailwind CSS v4 (plugin `@tailwindcss/vite`, sin `tailwind.config.js`; el tema está en `src/index.css` con `@theme`), Zustand 5, hls.js, iptv-playlist-parser y lucide-react. TypeScript estricto (`.ts`/`.tsx`).

## Comandos

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm typecheck  # tsc --noEmit
pnpm build      # tsc --noEmit + vite build: falla si hay errores de tipos
pnpm preview
```

No hay tests, linter ni formateador configurados; la comprobación de tipos es la única red automática. Tras un cambio, ejecuta `pnpm build` y, si afecta a la UI o a la reproducción, pruébalo en un navegador real (los streams y el CORS no se pueden simular de forma fiable).

## Arquitectura

```
src/
├─ types.ts                  modelo compartido: Channel, Category, LoadResult, Notice…
├─ config.ts                 listas predefinidas de iptv-org, traducción de categorías, constantes
├─ lib/playlist.ts           descarga → parseo → normalización → agrupado por categoría
├─ lib/fastChannels.ts       Samsung TV Plus y Plex desde los datos de i.mjh.nz en GitHub
├─ lib/guide.ts              guía de programación: XMLTV, programas y "ahora/después"
├─ store/useGuide.ts         programas por canal (no se persiste) y su descarga
├─ lib/streamCheck.ts        comprobación de disponibilidad de un stream sin reproducirlo
├─ store/useIPTVStore.ts     estado principal (lista, canales, reproductor, favoritos, búsqueda)
├─ store/useStreamStatus.ts  disponibilidad por canal + cola de comprobaciones
├─ store/useUIStore.ts       panel inferior abierto y búsqueda del móvil (no se persiste)
├─ hooks/useHls.ts           ciclo de vida de hls.js y traducción de errores a mensajes
├─ hooks/useCategoryRoute.ts ruta `#/categoria/<nombre>` sobre el historial del navegador
├─ hooks/useAvailableChannels.ts  filtro "Ocultar no disponibles"
├─ hooks/useInView.ts        IntersectionObserver (render perezoso)
├─ hooks/useOverlayHistory.ts botón "atrás" para reproductor, paneles y búsqueda
├─ hooks/useLongPress.ts     pulsación larga táctil (acciones de un canal)
├─ hooks/useKeyboardNavigation.ts  flechas/Esc por la parrilla (elementos `data-nav`)
├─ hooks/useChannelNumber.ts salto por número tecleado en el reproductor
└─ components/               Navbar, BottomNav, Sheets/BottomSheet, HeroBanner, CategoryRow,
                             ChannelCard, ChannelGrid, CategoryView, VideoPlayerModal, Toast…
```

Flujo de vistas en `App.tsx`, por prioridad: pantalla de carga/error → resultados de búsqueda → búsqueda del móvil sin texto (todos los canales) → vista de categoría → inicio (Hero + filas).

### Modelo de canal

`lib/playlist.ts` normaliza cada entrada a `{ id, url, name, logo, groups, region, tvgId, sources, badges }`. `parseName` saca del nombre las etiquetas de las listas ("(1080p)", "[Not 24/7]", "[Geo-blocked]", Ⓖ/Ⓢ de Free-TV) y las guarda en `badges` (`quality` HD/FHD/4K, `partTime`, `geoBlocked`); se muestran con `ChannelBadges.tsx`. Al unir duplicados, la calidad es la mejor de sus URLs y los otros dos distintivos solo se mantienen si lo son todas (basta una URL buena para verlo). **`id` es la URL del stream** (sin el sufijo `|user-agent=…` estilo Kodi): es única por stream y estable entre recargas, así que es la clave de los favoritos y de la caché de disponibilidad. No cambies cómo se forma el `id` sin migrar los datos guardados. `url` es lo que se reproduce y casi siempre coincide con `id`; no en Samsung TV Plus (se reproduce por el proxy `/proxy/jmp2`) ni en Plex (lleva la credencial en la URL). Por eso los estados se guardan siempre por `id`, nunca por `url`. Un canal puede estar en varias categorías (`group-title` separado por `;`). Un `group-title` que es una comunidad autónoma (`REGION_ALIASES`, así agrupa TDTChannels sus regionales) se convierte en la categoría `REGIONAL_CATEGORY` ("Autonómicas") y la comunidad se guarda en `region`.

### Estado y persistencia

- `useIPTVStore` persiste en `localStorage` (`iptv-store`) solo `favorites`, `recents`, `volume`, `muted`, `hideUnavailable` y `hidden`. El contenido de un archivo local no se guarda.
- `useStreamStatus` persiste `iptv-stream-status` con una caducidad de 30 minutos. Usa un almacenamiento con escritura limitada (throttle, no debounce: con debounce, la ráfaga continua de resultados impedía que llegara a escribirse) y vuelca lo pendiente en `pagehide`.
- `recents` son los ids de los últimos `RECENTS_LIMIT` (15) canales vistos, el más reciente primero; la fila "Seguir viendo" (`RECENTS_CATEGORY`) va la primera. Se anotan en `Player` cuando `hls.status` llega a `playing`, no al abrir, para que un canal que falla no entre. Se resuelven a canales igual que los favoritos (también por `sources`), así que los que ya no están en la lista actual se omiten sin borrarse.
- `hidden` (menú "Categorías", `CategoryFilterDialog`) son las categorías y comunidades que el usuario no quiere ver. `baseChannels` es la vista de `sourceFilter` sin duplicados; `channels`/`categories` son `applyHidden(baseChannels)`. Ocultar una comunidad quita también las copias de sus canales en otras fuentes (por `channelKey`).
- Los selectores que dependen del mapa de estados usan `useShallow` (`hooks/useAvailableChannels.ts`) para que una fila solo se vuelva a pintar cuando cambia su propia lista, no con cada resultado de cualquier canal.

### Fuentes españolas

Al iniciar se cargan en paralelo las fuentes de `SPANISH_SOURCES` (`config.ts`; `exclude` descarta categorías enteras de una lista, p. ej. los canales internacionales "Int. …" de TDTChannels, porque la app es solo de España; `excludeNames` descarta canales por nombre: lo usan iptv-org, para quitar las reemisiones no autorizadas de canales de pago de Movistar Plus+, y Rakuten TV, para los canales en inglés o latinoamericanos). No añadas listas con canales de pago reemitidos (Movistar, DAZN, Canal+, Antena 3/Telecinco desde IPs sueltas…): el criterio del proyecto es gratuito y oficial. Rakuten TV viene de `coderfast/IPTV` (copia de una sola persona; su generador original desapareció) y sus URLs pueden rotar; su orden es la prioridad al unir duplicados (`mergeChannels`): son el mismo canal si comparten `tvg-id` normalizado (`tvgKey`: sin "@SD" ni el sufijo ".TV"/".es", porque cada lista los escribe a su manera) o nombre normalizado (`nameKey`), y la unión es transitiva. `nameKey` conserva lo que va entre paréntesis (distingue "La 1 (Catalunya)") y quita calidad, país y corchetes. El canal unido toma el `id` del primero (así no cambian favoritos ni caché) y las URLs de todos en `sources`. El reproductor prueba `sources` en orden y pasa sola a la siguiente si una falla (`attempt` en `Player`); la comprobación de disponibilidad prueba hasta 3 (`checkSources`). Las que no permiten CORS llevan `proxy`: el prefijo debe existir en `vite.config.ts` (`server.proxy` y `preview.proxy`), y solo se usa si la descarga directa falla. Un build estático no tiene proxy.

Categoría de un canal que llega sin una útil (sin `group-title`, o uno de `GENERIC_GROUPS` como el "Spain" de Free-TV): primero `CHANNEL_HINTS` al parsear, y si sigue en "Otros", `inheritCategories` le da la de la misma cadena (por `channelKey`) en otra fuente cargada; esto último se hace en `sourceView`, porque depende de qué fuentes han llegado. Los nombres se limpian de las letras en círculo (Ⓖ, Ⓨ…) que Free-TV usa como notas.

Samsung TV Plus y Plex (`kind` en `SPANISH_SOURCES`) no se cargan de sus listas M3U en i.mjh.nz, que están bloqueadas por orden judicial en algunas operadoras españolas, sino de los `.channels.json.gz` que el mismo autor publica en GitHub (`lib/fastChannels.ts`). Samsung: se descartan los canales con DRM (`license_url`) y el stream pasa por el proxy `/proxy/jmp2`, porque la redirección de `jmp2.uk` no permite CORS; solo funciona en `pnpm dev`/`preview`. Plex: stream directo a `epg.provider.plex.tv`, con la credencial pública que viene en los propios datos. Plex no da categorías: salen de `NAME_CATEGORY_RULES` (palabras del nombre). Pluto TV no está: sus streams responden 403 "channel not permitted for partner".

### Disponibilidad de canales

`ChannelCard` encola una comprobación al montarse y la cancela al desmontarse, así que solo se comprueban las tarjetas en pantalla, como mucho 6 a la vez y una por servidor (Plex responde 429 a las ráfagas, y eso marcaría canales buenos como caídos). `checkStream` pide el manifiesto y la primera variante con `fetch`, igual que haría hls.js desde el mismo navegador, de modo que detecta CORS, 403/404, caídas y timeouts. No descarga segmentos: un canal "online" aún puede fallar al reproducir. Lo que ocurre al reproducir de verdad (`reportPlayback`) prevalece sobre la comprobación. `playNext`/`playPrev` se saltan los que ya se saben caídos.

### Reproductor

- `LazyPlayer` carga `VideoPlayerModal` (y con él hls.js) con `React.lazy`, para que no pese en la carga inicial. Su error boundary convierte cualquier fallo en un aviso; si el fallo es de descarga del chunk, el aviso ofrece "Recargar", porque el navegador recuerda la importación fallida hasta recargar la página.
- `vite.config.ts` incluye `hls.js` en `optimizeDeps.include`. Sin eso, en `pnpm dev` Vite lo descubre al abrir el primer canal, re-optimiza y esa importación falla.
- `useHls` nunca lanza: todo termina en `status: 'error'` con un mensaje en español. Devuelve también `url`, porque justo tras cambiar de canal el estado aún es el del anterior. El modal compara `hls.url === channel.url` antes de fiarse de `status`; respétalo si tocas esa lógica, o el error de un canal se atribuirá al siguiente.

### Móvil

El corte móvil/escritorio es `md` (768 px). En el móvil la barra superior es logo + chips (`SourceFilter variant="chips"`, se esconden al bajar), hay barra de pestañas inferior (`BottomNav`: Inicio, Buscar, Mi lista, Más) y los menús son paneles que suben desde abajo (`BottomSheet`); en escritorio, la barra de siempre y ventanas centradas. Qué panel está abierto vive en `useUIStore().sheet`, y `Sheets` lo pinta.

- Alturas de las barras fijas en las variables CSS `--header-h` y `--bottom-nav-h` (`index.css`), con las zonas seguras (`env(safe-area-inset-*)`, la página usa `viewport-fit=cover`). Usa esas variables para dejar hueco, no alturas fijas.
- `useOverlayHistory` mantiene una entrada propia en el historial mientras hay reproductor, panel o búsqueda abiertos: "atrás" cierra el de más arriba. Si cierras algo y justo después navegas (`openCategory`), hazlo dentro de `afterOverlaysClose`, o el `pushState` se adelanta al `history.back()` pendiente.
- Táctil (`pointer-coarse:`): no hay hover, así que el corazón vacío de las tarjetas se oculta y una pulsación larga abre las acciones del canal; en el reproductor, tocar el vídeo muestra/oculta los controles y deslizar cambia de canal. Los `hover:` de Tailwind v4 ya solo se aplican con ratón.
- Los `<input>` llevan `text-base` (16 px) en el móvil: con menos, Safari de iPhone amplía la página al enfocarlos.
- PWA: `public/manifest.webmanifest` (con `id`, atajos y iconos generados desde `public/icon.svg`) y `public/sw.js`, que `lib/registerServiceWorker.ts` registra solo en producción (en `pnpm dev` serviría archivos viejos). El service worker guarda únicamente la carcasa de la app: la página (red primero, por si hay versión nueva) y `/assets/*` (caché primero, llevan hash). **No toca** otros orígenes ni `/proxy/*`: listas y streams van siempre a la red. La versión nueva espera a que la página mande `SKIP_WAITING` (aviso "Actualizar" con la acción del `Toast`), para no recargar a mitad de una reproducción; al cambiar `sw.js` hay que subir `VERSION`, que es lo que limpia las cachés viejas.
- `hooks/useInstallPrompt.ts` guarda `beforeinstallprompt` a nivel de módulo (se dispara una sola vez, antes de que se monte el menú "Más") y alimenta los botones de instalar. Las rutas del manifiesto y del service worker son absolutas (`/`): la app debe servirse desde la raíz del dominio.

### Guía de programación

`store/useGuide.ts` guarda `Program[]` (`{ start, end, title, description }`, en segundos) por clave; se recarga entera en cada carga y no se persiste. `lib/guide.ts` `guideKeys(channel)` da las claves en las que buscar: el `tvg-id` normalizado con `tvgKey` (prefijo `tvg:`, así `La1.es@SD` de iptv-org encuentra el `La1.TV` del XMLTV de TDTChannels), el `id` y las URLs de `sources` (Samsung y Plex se guardan por `id` y por `url`, que pueden diferir). Fuentes: XMLTV de TDT (`GUIDE_URL`, gzip con CORS, se descarta lo que empieza más allá de `GUIDE_HORIZON_S`) con `loadGuide()` en cada `runSpanishLoad`, y los `programs` que ya traen los JSON de Samsung/Plex (`programsFromStarts`; el fin es el inicio del siguiente y el del último, una hora). iptv-org y Free-TV anuncian una guía (`x-tvg-url`) que no se ha comprobado que sea accesible desde el navegador.

`lib/football.ts` decide qué programa es un partido (`isFootballMatch`: competición o "fútbol" **y** un enfrentamiento "A - B" **y** no resumen/repetición/análisis; el título solo no basta, hay programas de clubes llamados "LaLiga") y `footballToday` da el primero de cada canal hasta las 6:00 de la madrugada siguiente. `App` lo usa para la fila `FOOTBALL_CATEGORY` (primera, solo si hay alguno): `CategoryRow`/`ChannelGrid` aceptan `highlights` (programa por id de canal) que `ChannelCard` enseña como "20:45 · A - B" en lugar del programa actual. En los datos reales de 5 días solo coincidían 4 programas y dos eran de GOL TV, que no está en las listas: la fila saldrá pocas veces.

`useNowNext(channel)` da `{ now, next, progress }`; "ahora" es un reloj compartido a precisión de minuto (`useNowSeconds`), así que las tarjetas solo se repintan una vez por minuto. `App` añade a la búsqueda los canales cuyo programa actual coincide (`filterByProgram`).

### Reproductor: calidad y ventana flotante

- `useHls` expone `levels` (resoluciones, la mejor velocidad de cada altura), `activeLevel` y `setQuality(altura | null)`. La preferencia (`preferredHeight`, persistida) se aplica en `MANIFEST_PARSED` con `applyHeight`: la más alta que no la supere, o la más baja. No hay niveles en Safari nativo ni en archivos sueltos, y entonces `QualityMenu` no se muestra.
- Imagen en imagen: el estado `pip` vive en `useUIStore` (lo ponen `enterpictureinpicture`/`leavepictureinpicture` de `Player`). Con `pip` el `Player` sigue montado pero invisible (si se desmontara, el vídeo desaparecería de la ventana flotante), se libera el scroll y las teclas pasan a la pantalla de debajo; `useOverlayHistory` y `useKeyboardNavigation` lo tratan como si no hubiera reproductor.

### Canales sin emisión abierta

Telecinco, Cuatro, FDF, Divinity, Energy, Be Mad, Boing, Antena 3, La Sexta, Neox, Nova, Mega y Atreseries no tienen una URL pública que funcione: las de Free-TV apuntan a propiedades de Akamai desaparecidas (`livehlsdai-i…`, `a3live-lh…`: 400) o cerradas (`directos.divinity.es`: 403 aunque se pongan Referer, Origin o User-Agent; y no es por ubicación). Las alternativas que circulan son reemisiones desde IPs sueltas, que el proyecto no ofrece. `lib/officialLive.ts` mapea el **nombre exacto** del canal a su página oficial de directo (`Player` y `ChannelSheet` enseñan "Ver en …"). Las direcciones se comprobaron cargando cada página; Mitele se llama ahora Mediaset Infinity (`mediasetinfinity.es`). No intentes "arreglar" estos canales con proxies que falsifiquen cabeceras: se probó que no es cuestión de cabeceras, y sería saltarse la protección del emisor.

### Teclado y mando

- Las flechas se mueven por los elementos con el atributo `data-nav` (botón principal de `ChannelCard` y botones de `HeroBanner`); cualquier lista nueva de canales que quiera navegarse con flechas debe marcar sus botones igual. El vecino se elige por posición en pantalla (`neighbour`), no por orden del DOM, así que vale para filas horizontales y cuadrículas. Intro es el `click` nativo del botón enfocado. El anillo de foco de la tarjeta usa `has-[:focus-visible]`, para que no aparezca al hacer clic con el ratón.
- `useKeyboardNavigation` se desactiva con reproductor o panel abiertos y al escribir en un campo (salvo Esc en la búsqueda del móvil). Intercepta las flechas siempre, así que el teclado ya no desplaza la página; es deliberado (mando).
- En `Player`, ↑/↓/Re Pág/Av Pág cambian de canal y el volumen pasa a `+`/`-` y `Mayús`+flechas. `Player` mueve el foco a su contenedor (`tabIndex={-1}`) al montarse y lo devuelve al elemento anterior al cerrarse; sin eso, Espacio/Intro seguían actuando sobre la tarjeta de debajo.
- El número de canal es la posición en `activeList` (la que muestra "3 / 35"), no un número de canal de la lista M3U. `playLast` (Retroceso) usa `recents`, así que solo cuentan los canales que llegaron a reproducirse.

### Rendimiento

Las listas pueden tener más de 11.000 canales (preset "Global"). Por eso las filas no pintan nada hasta acercarse al viewport, pintan las tarjetas en tramos de `ROW_PAGE_SIZE` (30) según el scroll horizontal, y `ChannelGrid` hace lo mismo en vertical (tramos de 60). Mantén este patrón en cualquier lista nueva de canales.

## TypeScript

- `tsconfig.json` activa `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` y `verbatimModuleSyntax`: los imports que solo traen tipos se escriben como `import type` (o `type X` dentro de las llaves).
- Los tipos del dominio viven en `src/types.ts`; el estado de cada store se declara junto al store (`IPTVState` en `useIPTVStore.ts`) y se crea con `create<State>()(persist(...))`.
- Las props de cada componente se declaran como `type XxxProps` justo encima del componente.
- `VideoPlayerModal` es un envoltorio que lee `activeChannel` y monta `Player` solo si no es null; así `Player` recibe `channel: Channel` y no tiene que comprobarlo en cada uso.
- Evita `any` y las aserciones `!`/`as`: las pocas que hay están justificadas (el `#root` de `main.tsx`, el índice ya acotado de `step()` y los datos persistidos de `merge`).
- `iptv-playlist-parser` trae sus propios tipos (`src/index.d.ts`, solo exportaciones con nombre); la importación por defecto que usa `lib/playlist.ts` compila gracias a `allowSyntheticDefaultImports`, y es la que funciona en el navegador porque el paquete es CommonJS.
- TypeScript instalado: 7.x (compilador nativo).

## Convenciones

- Estilo de código: comillas simples, punto y coma, comas finales en estructuras multilínea, indentación de 2 espacios. Imports relativos (no hay alias `@/`).
- Comentarios y textos de la UI en español. Los errores visibles siempre en lenguaje llano, nunca códigos crudos.
- Colores de marca: `brand` y `brand-hover`, definidos en `src/index.css`.
- Accesibilidad: los botones de solo icono llevan `aria-label`, y los interruptores, `aria-pressed`. No anides `<button>` dentro de `<button>`; `ChannelCard` usa un contenedor con dos botones hermanos por eso.
- Al usar un icono de lucide-react nuevo, comprueba que existe en la versión instalada: algunos nombres antiguos cambiaron (por ejemplo, se usa `LoaderCircle` y `TriangleAlert`).

## Limitaciones conocidas (no son bugs de la app)

- Muchos streams públicos fallan en navegador por CORS, geobloqueo o enlaces caídos.
- En una página `https://`, los streams `http://` se bloquean por contenido mixto (`isMixedContent` en `lib/streamCheck.ts` lo detecta antes de intentarlo).
- El navegador no permite fijar las cabeceras `Referer` y `User-Agent` que exigen algunos canales.
- `iptv-playlist-parser` es CommonJS y añade métodos a `String.prototype`. Además arrastra `validator`, que es la mayor parte del chunk inicial (~380 KB).
