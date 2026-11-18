import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Desktop (Electron): CSP rígida, só fala com o processo principal via IPC.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
].join('; ')

// `vite build --mode mobile` gera o app da EQUIPE para celular (dist-empresa), que conversa com o servidor por HTTP.
export default defineConfig(({ mode }) => {
  const mobile = mode === 'mobile'
  return {
    base: './',
    plugins: [
      react(),
      {
        name: 'inject-csp',
        apply: 'build',
        transformIndexHtml: (html: string) => html.replace('<!--CSP-->', mobile ? '' : `<meta http-equiv="Content-Security-Policy" content="${csp}" />`),
      },
    ],
    build: { outDir: mobile ? 'dist-empresa' : 'dist', emptyOutDir: true, chunkSizeWarningLimit: 3000 },
    server: { port: 5173, strictPort: true },
  }
})
