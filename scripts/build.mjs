import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { build } = await import(pathToFileURL(require.resolve('vite')).href);
await build({
  configFile: false,
  resolve: { alias: { '@poker/shared': resolve('packages/shared/src/index.ts') } },
  ssr: { noExternal: ['@poker/shared'] },
  build: {
    ssr: 'apps/server/src/index.ts',
    outDir: 'dist',
    target: 'node24',
    rollupOptions: { output: { entryFileNames: 'server.js' } },
  },
});
