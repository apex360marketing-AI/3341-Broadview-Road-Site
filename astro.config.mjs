import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://broadview-house.example',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto'
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
