import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { PORT } from '@fourfold/core';

// In development, Vite serves the app and forwards /api to the local API (`pnpm start`).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': `http://127.0.0.1:${PORT}` } },
});
