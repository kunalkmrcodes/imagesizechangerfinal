// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.imagesizechanger.info',
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/403') &&
        !page.includes('/404') &&
        !page.includes('/500')
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});