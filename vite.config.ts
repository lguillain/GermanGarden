import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'frontend',
  envDir: '..',
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: '../dist', emptyOutDir: true },
});
