import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// `vite build --mode artifact` emits one self-contained HTML file
// (JS, CSS and the analysis worker inlined) for publishing as an Artifact.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: mode === 'artifact' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'artifact' ? { outDir: 'dist-artifact' } : {},
}))
