import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
//import mkcert from 'vite-plugin-mkcert'
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    //mkcert(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'copy-bergamot-assets',
      writeBundle() {
        const files = [
          'bergamot-translator-worker.js',
          'bergamot-translator-worker.wasm',
          'translator-worker.js'
        ];
        
        // Resolves from the root of the project
        const srcDir = path.resolve('./node_modules/@browsermt/bergamot-translator/worker');
        const destDir = path.resolve('./dist/assets');

        // Guarantee the destination folder exists
        fs.mkdirSync(destDir, { recursive: true });

        // Forcefully copy files flat into the assets folder
        for (const file of files) {
          fs.copyFileSync(
            path.join(srcDir, file), 
            path.join(destDir, file)
          );
        }
      }
    }
  ],
  resolve: {
    alias: {
      // Ensure these match our actual folder structure relative to vite.config.ts
      '@components': path.resolve(__dirname, './src/components'),
      '@src': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    proxy: {
      // Whenever Vite sees a request starting with /api, 
      // it forwards it to the Node backend (only for development)
      '/api': {
        target: 'http://localhost:3847',
        changeOrigin: true,
      },
    },
  },
})
