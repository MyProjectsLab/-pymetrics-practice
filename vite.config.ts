import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html', arrows: 'arrows.html', mouth: 'mouth-v12.html', mouthV13: 'mouth-v13.html', money: 'money.html', money2: 'money2.html', faces: 'faces.html', preparationGuide: 'pymetrics-practice.html', employerGuide: 'blackstone-pymetrics.html', privacy: 'privacy.html' } } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
