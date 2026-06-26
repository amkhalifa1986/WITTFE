import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor';
            if (id.includes('leaflet')) return 'leaflet';
            if (id.includes('@microsoft/signalr')) return 'signalr';
            if (id.includes('lucide')) return 'icons';
            return 'vendor-other';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
