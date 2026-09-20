#!/usr/bin/env node
/**
 * Builds the App Service deployment package:
 *
 *   package/
 *     package.json   -> start script, no dependencies
 *     server.mjs     -> zero dependency static server
 *     public/        -> the Vite build output
 *
 * Run after `npm run build`.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const dist = join(appRoot, 'dist');
const out = join(appRoot, 'package');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('[package] apps/web/dist/index.html is missing. Run "npm run build" first.');
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(dist, join(out, 'public'), { recursive: true });
await cp(join(appRoot, 'server', 'server.mjs'), join(out, 'server.mjs'));

const manifest = {
  name: 'collage-studio-web',
  version: process.env.APP_VERSION ?? '1.0.0',
  private: true,
  type: 'module',
  engines: { node: '>=20' },
  scripts: { start: 'node server.mjs' },
};

await writeFile(join(out, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.warn(`[package] deployment package ready at ${out}`);
