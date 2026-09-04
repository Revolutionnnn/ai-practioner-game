import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Subruta de GitHub Pages: https://revolutionnnn.github.io/ai-practioner-game/
  base: '/ai-practioner-game/',
  plugins: [react()],
})
