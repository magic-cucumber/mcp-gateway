import * as esbuild from 'esbuild';

const dev = (process.env?.NODE_ENV ?? 'production') === 'development';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/main.js',
  sourcemap: dev ?? false,
  external: [],
  minify: !dev ?? true,
  banner: {
    js: "import { createRequire as __createRequire } from 'module';const require = __createRequire(import.meta.url);"
  }
}).catch(() => process.exit(1));

console.log('Build completed successfully!');
