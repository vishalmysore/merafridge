import { defineConfig } from 'vite';

export default defineConfig({
  base: '/merafridge/', // Required for GitHub Pages deployment
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    target: 'esnext',
  }
});
