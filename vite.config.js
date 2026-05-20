import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to remove development scripts from index.html during build
const removeDevScripts = () => {
  return {
    name: 'remove-dev-scripts',
    transformIndexHtml(html) {
      return html.replace(/<script id="redirect-script">[\s\S]*?<\/script>/, '')
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeDevScripts()],
  // Use relative base path for maximum compatibility on GitHub Pages
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['react-icons'],
          'utils-sentiment': ['sentiment', 'string-similarity']
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  }
})
