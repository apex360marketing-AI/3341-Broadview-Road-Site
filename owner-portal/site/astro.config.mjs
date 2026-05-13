import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

/*
 * Astro config for the OWNER PORTAL site.
 * Intentionally distinct from the public marketing site's astro.config —
 * different port, different build dir name is fine to keep distinct (we
 * keep `dist` to follow Astro's default; deploy target should be a
 * different host anyway).
 */
export default defineConfig({
  site: 'https://owner.valora.example',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto'
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
