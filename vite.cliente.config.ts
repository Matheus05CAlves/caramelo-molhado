import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// App do CLIENTE: `npm run build:cliente` → dist-cliente (usado no APK do cliente e servido pelo servidor em "/").
// Defina VITE_SERVER_URL para embutir o endereço do servidor no APK (o cliente não precisa digitar nada).
export default defineConfig({
  root: path.resolve(__dirname, 'cliente'),
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [tailwind({ config: path.resolve(__dirname, 'tailwind.cliente.cjs') }), autoprefixer()] } },
  build: { outDir: path.resolve(__dirname, 'dist-cliente'), emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5174, strictPort: true, fs: { allow: [path.resolve(__dirname)] } },
})
