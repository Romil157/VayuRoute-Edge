import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('@react-three') || id.includes('\\three\\') || id.includes('/three/')) {
            return 'three-vendor'
          }
          if (id.includes('react-leaflet') || id.includes('\\leaflet\\') || id.includes('/leaflet/')) {
            return 'map-vendor'
          }
          if (id.includes('/react/') || id.includes('\\react\\')) {
            return 'react-vendor'
          }
          return 'vendor'
        },
      },
    },
  },
})
