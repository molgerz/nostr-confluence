import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 5173 ist auf diesem Rechner von einem Container belegt
  server: { port: 5273, strictPort: true },
})
