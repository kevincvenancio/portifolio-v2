import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5178, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4178, strictPort: true, host: '127.0.0.1' },
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: { vendor: ['gsap', 'lenis'] } } },
  },
});
