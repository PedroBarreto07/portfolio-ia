import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  assetsInclude: ['**/*.glb', '**/*.exr', '**/*.hdr', '**/*.ktx2'],
  server: { host: true, port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    modulePreload: { polyfill: false },
  },
})
