/**
 * Browser bundle for the dsh-bundler client half.
 *
 * External plugins cannot use the DSH monorepo's shared tsdown preset, so
 * this config re-implements the essential contract of
 * `packages/client/tsdown.client.ts` (clientConfig):
 *   - output lands at dist/client.js, stamped with the
 *     `window.__ModuleLoader__.load({ id, factory })` handoff the DSH web
 *     shell expects (`/plugins/<id>/client.js`);
 *   - externals are the platform modules from the shell's frozen module
 *     table plus the documented runtime exemption; everything else inlines;
 *   - `process.env.NODE_ENV` / `import.meta.env` substitutions for inlined
 *     node-idiom deps (zustand/immer read them at module scope).
 */

import { defineConfig } from 'tsdown'

const id = '@dsh-bundler/ui'

/** Modules the DSH web shell shares into its frozen module table (web/src/platform.ts). */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
]

/** Externals resolved from the loader module table. */
const CLIENT_EXTERNALS = [...PLATFORM_MODULES, '@deepseek-ai/dsh-client-runtime/client']

export default defineConfig({
  name: `${id}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'dist',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: CLIENT_EXTERNALS,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  noExternal: (specifier: string) => (CLIENT_EXTERNALS.includes(specifier) ? undefined : true),
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
