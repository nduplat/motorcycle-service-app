import { defineConfig } from 'vite';

export default defineConfig({
  // Environment variables starting with VITE_ are automatically exposed to the client
  envPrefix: ['VITE_'],
  define: {
    // Expose environment variables to the client (only safe ones)
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __APP_NAME__: JSON.stringify(process.env.APP_NAME || 'Blue Dragon Motors'),
    // Make sure the AI proxy URL is available in the browser
    'window.ENV': {
      AI_PROXY_URL: process.env.VITE_AI_PROXY_URL || 'http://localhost:3001',
      APP_NAME: process.env.APP_NAME || 'Blue Dragon Motors',
      APP_VERSION: process.env.npm_package_version || '1.0.0'
    },
    // Define process.env for browser compatibility
    'process.env': {}
  },
  build: {
    rollupOptions: {
      external: ['@angular/build']
    }
  }
});