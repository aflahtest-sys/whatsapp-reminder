import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The /api proxy below only exists during `npm run dev`. A production build has
// no proxy at all, so VITE_API_URL must be set when you build (Vercel: Project
// Settings > Environment Variables) or every request will 404.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
