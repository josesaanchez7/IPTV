import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Proxies para las fuentes cuyo servidor no permite descargar la lista desde el navegador
 * (CORS). Los prefijos son los `proxy` de `SPANISH_SOURCES` en `src/config.ts`; la app solo
 * los usa si la descarga directa falla. Solo existen en `pnpm dev` y `pnpm preview`.
 */
const sourceProxy = (prefix: string, target: string): [string, ProxyOptions] => [
  prefix,
  {
    target,
    changeOrigin: true,
    rewrite: (path) => path.slice(prefix.length),
  },
];

const proxy = Object.fromEntries([
  sourceProxy('/proxy/tdt', 'https://www.tdtchannels.com'),
  // Streams de Samsung TV Plus (`JMP2_PROXY`): solo la redirección inicial pasa por aquí.
  sourceProxy('/proxy/jmp2', 'https://jmp2.uk'),
]);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  optimizeDeps: {
    // hls.js solo se importa al abrir el primer canal (carga diferida). Sin esto, Vite lo
    // descubre en ese momento, re-optimiza y la importación en curso falla en desarrollo.
    include: ['hls.js'],
  },
});
