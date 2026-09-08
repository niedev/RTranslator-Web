import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: {
      // Ensure these match your actual folder structure relative to vite.config.ts
      '@components': path.resolve(__dirname, './src/components'),
      '@src': path.resolve(__dirname, './src'),
    },
  },
})
