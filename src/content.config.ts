import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const staticContent = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/static' }),
  schema: z.object({
    title: z.string().optional(),
    lastUpdated: z.string().optional()
  })
});

export const collections = { static: staticContent };
