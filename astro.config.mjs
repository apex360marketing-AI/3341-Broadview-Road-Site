import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://valora.example',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto'
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
