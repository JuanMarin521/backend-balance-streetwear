import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Hosting is still an open decision; the Node adapter is a neutral default.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  security: { checkOrigin: true },
});
