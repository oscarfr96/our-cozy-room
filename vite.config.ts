import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // A custom list replaces Vite's defaults. Keep its credential exclusions.
      deny: [
        '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**',
        '.dev.vars*', 'PLAN_MAESTRO.md', '**/{.local,.wrangler,.firebase,.aws,.ssh,.codex,.agents,.secrets,secrets}/**',
        '**/docs/{screenshots,design,decisions}/**',
      ],
    },
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } },
  },
  build: { rollupOptions: { output: { manualChunks: (id: string) => id.includes('node_modules/phaser') ? 'phaser' : undefined } } },
});
